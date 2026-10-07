// Trusted checker: only prebuilt public files enter this sandbox. No client build scripts.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const canonical = (v) =>
  Array.isArray(v)
    ? "[" + v.map(canonical).join(",") + "]"
    : v && typeof v === "object"
      ? "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
      : JSON.stringify(v);
const input = JSON.parse(await readFile("verification-input.json", "utf8"));
const report = {
  version: 1,
  passed: false,
  artifactSha256: input.artifactSha256,
  baselineSha256: input.baselineSha256,
  checks: [],
};
// Chromium can quantize a handful of rounded fixed-layer edge pixels by 1–2
// channel values between equivalent captures. Only byte-identical bundles may
// classify this observed, bounded raster noise; every larger difference fails.
const raster = (a, b) => {
  if (a.width !== b.width || a.height !== b.height)
    return { passed: false, changedPixels: -1, rawChangedPixels: -1 };
  const rawChangedPixels = pixelmatch(a.data, b.data, null, a.width, a.height, {
    threshold: 0,
    includeAA: true,
  });
  let maxChannelDelta = 0;
  for (let i = 0; i < a.data.length; i++)
    maxChannelDelta = Math.max(
      maxChannelDelta,
      Math.abs(a.data[i] - b.data[i]),
    );
  const noise =
    canonical(candidate) === canonical(baseline) &&
    rawChangedPixels <= 100 &&
    maxChannelDelta <= 2;
  return {
    passed: rawChangedPixels === 0 || noise,
    changedPixels: noise ? 0 : rawChangedPixels,
    rawChangedPixels,
    maxChannelDelta,
    rasterizationNoise: rawChangedPixels > 0 && noise,
  };
};
const check = (name, passed, details) =>
  report.checks.push({ name, passed, details });
await mkdir("outputs", { recursive: true });
async function files(dir, prefix = "") {
  const result = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = prefix + e.name;
    if (e.isDirectory())
      Object.assign(result, await files(dir + "/" + e.name, p + "/"));
    else if (e.isFile())
      result[p] = (await readFile(dir + "/" + e.name)).toString("base64");
    else throw Error("unsafe_file");
  }
  return result;
}
const candidate = await files("candidate"),
  baseline = await files("baseline");
const type = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain",
  xml: "application/xml",
  json: "application/json",
};
const serve = (root) => async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    let p = decodeURIComponent(u.pathname);
    p = p.endsWith("/") ? p + "index.html" : p;
    let f = resolve(root, "." + p);
    if (!f.startsWith(resolve(root) + sep)) throw Error();
    let b;
    try {
      b = await readFile(f);
    } catch {
      res.statusCode = 404;
      f = resolve(root, "404.html");
      b = await readFile(f);
    }
    res.setHeader(
      "content-type",
      type[f.split(".").at(-1)] ?? "application/octet-stream",
    );
    res.end(b);
  } catch {
    res.statusCode = 400;
    res.end();
  }
};
let activeRoot = "baseline";
const servers = [createServer((req, res) => serve(activeRoot)(req, res))];
let browser;
try {
  check(
    "files-unchanged",
    hash(canonical(candidate)) === input.artifactSha256 &&
      hash(canonical(baseline)) === input.baselineSha256 &&
      canonical(candidate) === canonical(baseline),
  );
  for (const s of servers)
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + servers[0].address().port;
  const origins = [origin, origin];
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--force-color-profile=srgb"],
  });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  await context.route("**/*", (r) =>
    origins.includes(new URL(r.request().url()).origin)
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  const pages = [page, page];
  const settle = async (p, scroll = false) => {
    await p.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.images) image.loading = "eager";
      await Promise.all(
        [...document.images].map((image) => image.decode().catch(() => {})),
      );
    });
    if (scroll) {
      const height = await p.evaluate(
        () => document.documentElement.scrollHeight,
      );
      for (let y = 0; y < height; y += 700) {
        await p.evaluate((y) => window.scrollTo(0, y), y);
        await p.waitForTimeout(100);
      }
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    await p.waitForTimeout(800);
  };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const routes = Object.keys(candidate).filter((p) => p.endsWith(".html"));
  let interactions = true,
    delivery = true;
  for (const path of routes) {
    const route =
      path === "index.html"
        ? "/"
        : path.endsWith("/index.html")
          ? "/" + path.slice(0, -10)
          : "/" + path;
    for (const width of [360, 375, 768, 1440]) {
      const screenshots = [],
        states = [];
      for (let i = 0; i < 2; i++) {
        activeRoot = i ? "candidate" : "baseline";
        await page.mouse.move(0, 0);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(origins[i] + route, { waitUntil: "networkidle" });
        await settle(page, true);
        screenshots.push(
          await page.screenshot({ fullPage: true, animations: "disabled" }),
        );
        states.push(await state(page));
      }
      const key = hash(path).slice(0, 16);
      for (let i = 0; i < 2; i++)
        await writeFile(
          `outputs/${i ? "candidate" : "baseline"}-${key}-${width}.png`,
          screenshots[i],
        );
      const [a, b] = screenshots.map((s) => PNG.sync.read(s));
      const difference = raster(a, b);
      check("visual:" + path + ":" + width, difference.passed, difference);
      // Compare expanded FAQ, mobile menu, keyboard focus and reduced-motion states.
      async function state(p) {
        let valid = true;
        const frames = [];
        const summaries = p.locator("details summary");
        if (await summaries.count()) {
          await summaries.first().click();
          valid &&= await summaries
            .first()
            .evaluate((e) => e.parentElement.open === true);
          frames.push(
            await p
              .locator("details")
              .first()
              .screenshot({ animations: "disabled" }),
          );
        }
        const menu = p.locator("[aria-controls][aria-expanded]");
        if ((await menu.count()) && (await menu.first().isVisible())) {
          await menu.first().click();
          valid &&=
            (await menu.first().getAttribute("aria-expanded")) === "true";
          const navId = await menu.first().getAttribute("aria-controls");
          if (navId && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(navId))
            frames.push(
              await p
                .locator("#" + navId)
                .screenshot({ animations: "disabled" }),
            );
          else valid = false;
          await p.keyboard.press("Escape");
          valid &&=
            (await menu.first().getAttribute("aria-expanded")) === "false" &&
            (await menu.first().evaluate((e) => document.activeElement === e));
        }
        await p.keyboard.press("Tab");
        if (await p.locator(":focus").count())
          frames.push(
            await p
              .locator(":focus")
              .first()
              .screenshot({ animations: "disabled" }),
          );
        await p.emulateMedia({ reducedMotion: "reduce" });
        await settle(p);
        return {
          valid,
          frames,
          html: await p.locator("body").evaluate((e) => e.innerHTML),
          focus: await p.evaluate(() => document.activeElement?.outerHTML),
          image: await p.screenshot({ animations: "disabled" }),
        };
      }
      const [sa, sb] = states.map((s) => PNG.sync.read(s.image));
      const statesMatch =
        states.every((s) => s.valid) &&
        states[0].frames.length === states[1].frames.length &&
        states[0].frames.every(
          (frame, i) =>
            raster(PNG.sync.read(frame), PNG.sync.read(states[1].frames[i]))
              .passed,
        ) &&
        states[0].html === states[1].html &&
        states[0].focus === states[1].focus &&
        raster(sa, sb).passed;
      check("interaction:" + path + ":" + width, statesMatch, {
        domMatched: states[0].html === states[1].html,
        focusMatched: states[0].focus === states[1].focus,
        raster: raster(sa, sb),
      });
      interactions &&= statesMatch;
      for (const p of pages)
        await p.emulateMedia({ reducedMotion: "no-preference" });
    }
    const violations = [];
    for (let i = 0; i < 2; i++) {
      activeRoot = i ? "candidate" : "baseline";
      await page.goto(origins[i] + route, { waitUntil: "networkidle" });
      await settle(page, true);
      violations.push(
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze(),
      );
    }
    const a11y = (result) =>
      result.violations
        .map((v) => ({
          id: v.id,
          nodes: v.nodes
            .map((n) => ({
              target: n.target,
              failureSummary: n.failureSummary,
            }))
            .sort((a, b) => canonical(a).localeCompare(canonical(b))),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    check(
      "a11y:" + path,
      canonical(a11y(violations[0])) === canonical(a11y(violations[1])),
      {
        baselineRules: violations[0].violations.map((v) => v.id),
        candidateRules: violations[1].violations.map((v) => v.id),
      },
    );
    let broken = 0;
    const refs = await pages[1]
      .locator("a[href],img[src],link[href],script[src]")
      .evaluateAll((ns) =>
        ns.map((n) => n.getAttribute("href") ?? n.getAttribute("src")),
      );
    for (const ref of refs) {
      const u = new URL(ref, origins[1] + route);
      if (u.origin !== origins[1]) continue;
      const r = await context.request.get(u.href);
      if (r.status() !== 200) broken++;
      if (u.hash) {
        const html = await r.text();
        if (!html.includes(`id="${decodeURIComponent(u.hash.slice(1))}"`))
          broken++;
      }
    }
    check("links:" + path, broken === 0, { broken });
    // Metadata, canonical URLs, JSON-LD and contact targets must remain byte-identical.
    delivery &&= candidate[path] === baseline[path];
  }
  const missing = await context.request.get(
    origins[1] + "/__a2aviary_unknown_route__",
  );
  delivery &&=
    missing.status() === 404 &&
    hash(await missing.body()) ===
      hash(Buffer.from(candidate["404.html"], "base64"));
  check("delivery", delivery && errors.length === 0, {
    pageErrors: errors.length,
  });
  check("interactions", interactions);
  report.passed = report.checks.every((c) => c.passed);
} catch {
  check("checker-completion", false, { error: "checker_failed" });
} finally {
  await browser?.close();
  for (const s of servers)
    if (s.listening) await new Promise((r) => s.close(r));
  await writeFile("outputs/report.json", JSON.stringify(report));
}
