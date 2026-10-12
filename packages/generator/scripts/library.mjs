import { canonicalJson } from '@a2aviary/site-core';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep } from 'node:path';
import { parseTemplate } from '../src/library-template.ts';
import { validateVariantCss } from '../src/library-css.ts';
import { validateBehavior } from '../src/library-behavior.ts';
import { generateContracts } from '@a2aviary/site-core';
import { gzipBytes } from '@a2aviary/site-core';
const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const Ajv = require('ajv'),
  { parse } = require('acorn'),
  { transformSync } = require('esbuild');
const json = (v) => JSON.stringify(v, null, 2) + '\n';
const canonical = canonicalJson;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const assert = (ok, message) => {
  if (!ok) throw Error('Invalid library: ' + message);
};
export async function libraryArtifacts(root = defaultRoot) {
  const dir = resolve(root, 'library'),
    policy = JSON.parse(
      await readFile(resolve(root, 'plans/web-simple.policy.json'), 'utf8'),
    );
  assert(
    canonical(policy) ===
      canonical(
        JSON.parse(
          await readFile(
            resolve(
              root,
              'plans/versions/web-simple/' +
                policy.version.value +
                '.policy.json',
            ),
            'utf8',
          ),
        ),
      ),
    'active policy differs from pinned ' + policy.version.value,
  );
  const schema = JSON.parse(
      await readFile(resolve(dir, 'package.schema.json'), 'utf8'),
    ),
    registrySchema = JSON.parse(
      await readFile(resolve(dir, 'registry.schema.json'), 'utf8'),
    );
  const ajv = new Ajv({ allErrors: true, strict: false }),
    validate = ajv.compile(schema),
    validateRegistry = ajv.compile(registrySchema);
  const blockSchema = generateContracts(policy).siteSchema;
  ajv.addFormat('site-link', (value) => {
    try {
      const u = new URL(value);
      return (
        ['https:', 'mailto:', 'tel:'].includes(u.protocol) &&
        !u.username &&
        !u.password
      );
    } catch {
      return false;
    }
  });
  const validateBlock = ajv.compile({
    definitions: blockSchema.definitions,
    $ref: '#/definitions/block',
  });
  const packages = [],
    compiled = {},
    catalog = {},
    owned = new Set([
      'README.md',
      'registry.json',
      'registry.schema.json',
      'package.schema.json',
    ]),
    all = [];
  assert(!(await lstat(dir)).isSymbolicLink(), 'library root symlink');
  async function walk(path) {
    for (const name of (await readdir(path)).sort()) {
      assert(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name), 'unsafe path');
      const p = resolve(path, name),
        s = await lstat(p);
      assert(!s.isSymbolicLink(), 'symlink');
      if (s.isDirectory()) await walk(p);
      else {
        assert(s.isFile(), 'non-file');
        all.push(relative(dir, p).split(sep).join('/'));
      }
    }
  }
  await walk(dir);
  async function read(path) {
    return readFile(resolve(dir, path));
  }
  async function add(path, expectedType) {
    const meta = JSON.parse(await read(path));
    assert(
      validate(meta),
      'package schema ' + path + ': ' + ajv.errorsText(validate.errors),
    );
    assert(meta.type === expectedType, 'package type');
    assert(!catalog[meta.id], 'duplicate ID');
    assert(meta.version.trim() === meta.version, 'version');
    catalog[meta.id] = structuredClone(meta);
    return meta;
  }
  async function entry(meta, files) {
    const hashes = {};
    for (const p of files.sort()) {
      assert(!owned.has(p), 'duplicate file owner');
      owned.add(p);
      hashes[p] = sha(await read(p));
    }
    packages.push({
      id: meta.id,
      type: meta.type,
      version: meta.version,
      status: meta.status,
      files: hashes,
    });
  }
  const components = policy.firstVersion.components;
  for (const name of Object.keys(components).sort()) {
    const path = name + '/component.json',
      c = await add(path, 'component');
    assert(
      c.id === name &&
        canonical(c.fields) === canonical(components[name].fields),
      'component fields/policy',
    );
    await entry(c, [path]);
    for (const variant of [...components[name].variants.value].sort()) {
      const id = name + ':' + variant,
        base = name + '/variants/' + variant + '/',
        v = await add(base + 'variant.json', 'variant');
      assert(
        v.id === id && v.component === name && v.variant === variant,
        'variant identity',
      );
      const paths = all.filter((p) => p.startsWith(base));
      assert(
        paths.every(
          (p) =>
            ['variant.json', 'template.html', 'style.css'].includes(
              p.slice(base.length),
            ) || /^fixtures\/[a-z0-9-]+\.json$/.test(p.slice(base.length)),
        ),
        'unexpected variant file',
      );
      const fixtures = paths.filter((p) => p.startsWith(base + 'fixtures/'));
      assert(fixtures.length, 'missing fixtures');
      for (const p of fixtures) {
        const f = JSON.parse(await read(p));
        assert(
          f.component === name &&
            f.variant === variant &&
            f.props &&
            !Array.isArray(f.props),
          'fixture identity/props',
        );
        assert(
          Object.keys(f.props).every((k) => Object.hasOwn(c.fields, k)),
          'unknown fixture field',
        );
        assert(
          Object.entries(c.fields).every(
            ([k, fld]) => !fld.required || Object.hasOwn(f.props, k),
          ),
          'missing fixture field',
        );
        assert(
          validateBlock(f),
          'fixture schema ' + p + ': ' + ajv.errorsText(validateBlock.errors),
        );
        catalog[id].fixture ??= f;
        (catalog[id].fixtures ??= []).push(f);
      }
      const source = (await read(base + 'template.html')).toString(),
        ast = parseTemplate(source, c.fields, v.requiresShellContent),
        css = (await read(base + 'style.css')).toString();

      const walkNodes = (nodes, visit) => {
        for (const node of nodes) {
          visit(node);
          if (node.children) walkNodes(node.children, visit);
        }
      };
      for (const [role, target] of Object.entries(v.targets ?? {})) {
        if (typeof target === 'string') {
          assert(
            new RegExp(
              'class="(?:[^"\\n]* )?' + target + '(?: [^"\\n]*)?"',
            ).test(source),
            'missing ' + role + ' target',
          );
          if (role === 'control')
            assert(
              new RegExp(
                '<button class="(?:[^"\\n]* )?' + target + '(?: [^"\\n]*)?">',
              ).test(source),
              'control must be button',
            );
        } else {
          let count = 0;
          walkNodes(ast, (node) => {
            if (
              role === 'items' &&
              node.type === 'each' &&
              node.field === target.each
            ) {
              const first = node.children.find(
                (n) => n.type !== 'literal' || n.value.trim(),
              );
              assert(
                first?.type === 'literal' && first.value === '<li>',
                'items must select the direct repeated li',
              );
              first.target = role;
              count++;
            }
            if (
              role === 'action' &&
              node.type === 'helper' &&
              node.helper === target.helper &&
              node.field === target.field
            )
              count++;
          });
          assert(count === 1, 'target must resolve exactly once');
        }
      }
      assert(
        !v.behaviors.length || typeof v.targets?.root === 'string',
        'behavior root required',
      );
      assert(
        !v.targets?.control || v.behaviors.length,
        'control needs behavior',
      );
      const classes = Object.values(v.targets ?? {}).filter(
        (v) => typeof v === 'string',
      );
      assert(
        new Set(classes).size === classes.length,
        'ambiguous target class',
      );
      for (const req of v.contentRequirements ?? []) {
        assert(
          !req.when || Object.hasOwn(c.fields, req.when),
          'unknown requirement condition',
        );
        for (const field of req.fields)
          assert(
            ['heading', 'shortCopy'].includes(c.fields[field]?.kind),
            'requirement must name a text field',
          );
      }
      if (v.requiresShellContent) {
        const checkLabels = (nodes, conditions = []) => {
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.children)
              checkLabels(
                node.children,
                node.type === 'if' ? [...conditions, node.field] : conditions,
              );
            if (node.type !== 'literal' || !/^<[a-z]/.test(node.value))
              continue;
            const match = /^<([a-z0-9]+)(?: class="([^"]+)")?>$/.exec(
                node.value,
              ),
              classes = match?.[2]?.split(' ') ?? [];
            if (classes.includes(v.targets?.status))
              assert(
                nodes[i + 1]?.value === '</' + match[1] + '>',
                'status must be initially empty',
              );
            if (
              match?.[1] === 'button' ||
              classes.includes(v.targets?.messages)
            ) {
              const text = nodes[i + 1],
                end = nodes[i + 2];
              assert(
                text?.type === 'text' && end?.value === '</' + match[1] + '>',
                'controls/messages require owner text',
              );
              assert(
                c.fields[text.field]?.required ||
                  (v.contentRequirements ?? []).some(
                    (r) =>
                      r.fields.includes(text.field) &&
                      (!r.when || conditions.includes(r.when)),
                  ),
                'control/message label must be required when rendered',
              );
            }
          }
        };
        checkLabels(ast);
      }
      catalog[id].css = css;
      compiled[id] = {
        component: name,
        ast,
        css,
        behaviors: v.behaviors,
        targets: v.targets ?? {},
      };
      await entry(v, paths);
    }
  }
  for (const [folder, type] of [
    ['behaviors', 'behavior'],
    ['effects', 'effect'],
    ['fonts', 'font'],
  ]) {
    const manifests = all.filter((p) =>
      new RegExp('^' + folder + '/[a-z][a-z0-9-]*/' + type + '\\.json$').test(
        p,
      ),
    );
    for (const path of manifests) {
      const m = await add(path, type),
        base = path.slice(0, path.lastIndexOf('/') + 1);
      assert(base === folder + '/' + m.id + '/', 'package directory');
      const paths = all.filter((p) => p.startsWith(base));
      if (type === 'behavior') {
        assert(
          canonical(paths.map((p) => p.slice(base.length)).sort()) ===
            canonical(['behavior.json', 'index.js']),
          'behavior files',
        );
        const source = (await read(base + 'index.js')).toString();
        for (const [key, value] of Object.entries(m.styleProperties ?? {}))
          assert(
            key.startsWith('--pkg-' + m.id + '-') &&
              value.min <= value.initial &&
              value.initial <= value.max,
            'behavior property declaration',
          );
        const fn = validateBehavior(
          source,
          parse,
          m.id,
          m.styleProperties ?? {},
          m.requiresShellContent,
        );
        const min = transformSync('export default ' + fn, {
          minify: true,
          target: 'es2022',
        }).code;
        const expression = parse(min, {
          ecmaVersion: 2022,
          sourceType: 'module',
        }).body[0].declaration;
        catalog[m.id].code = min.slice(expression.start, expression.end);
      }
      if (type === 'effect') {
        assert(
          paths.every(
            (p) =>
              ['effect.json', 'style.css'].includes(p.slice(base.length)) ||
              /^fixtures\/[a-z0-9-]+\.json$/.test(p.slice(base.length)),
          ),
          'effect files',
        );
        assert(
          paths.some((p) => p.startsWith(base + 'fixtures/')),
          'effect fixture',
        );
        catalog[m.id].css = (await read(base + 'style.css')).toString();
        validateVariantCss(catalog[m.id].css, m.id, 'effect');
        catalog[m.id].fixtures = [];
        for (const path of paths.filter((p) =>
          p.startsWith(base + 'fixtures/'),
        )) {
          const f = JSON.parse(await read(path));
          assert(
            catalog[f.component + ':' + f.variant]?.type === 'variant',
            'effect fixture identity',
          );
          catalog[m.id].fixtures.push(f);
        }
        catalog[m.id].fixture = catalog[m.id].fixtures[0];
        for (const id of m.compatibility)
          assert(catalog[id]?.type === 'variant', 'effect compatibility');
      }
      if (type === 'font') {
        assert(
          new Set(m.files.map((f) => f.file)).size === m.files.length,
          'duplicate font file',
        );
        assert(
          paths.length === m.files.length + 2 &&
            paths.every((p) =>
              [
                type + '.json',
                'LICENSE',
                ...m.files.map((f) => f.file),
              ].includes(p.slice(base.length)),
            ),
          'font files',
        );
        const license = (await read(base + 'LICENSE')).toString();
        assert(
          /SIL OPEN FONT LICENSE Version 1.1/i.test(license),
          'font license',
        );
        catalog[m.id].license = license;
        for (const f of catalog[m.id].files) {
          assert(
            f.file.includes('-latin-') && !f.file.includes('-latin-ext-'),
            'Latin subset required',
          );
          const b = await read(base + f.file);
          assert(
            b.toString('ascii', 0, 4) === 'wOF2' && sha(b) === f.sha256,
            'font bytes/hash',
          );
          f.data = b.toString('base64');
        }
      }
      await entry(m, paths);
    }
  }
  assert(
    all.every((p) => owned.has(p)),
    'unknown package/file',
  );
  const rules = policy.firstVersion.library,
    b = rules.budgets;
  const ids = (t) =>
    Object.values(catalog)
      .filter((p) => p.type === t)
      .map((p) => p.id)
      .sort();
  assert(
    canonical(ids('effect')) === canonical([...rules.effects.value].sort()),
    'effect registry/policy mismatch',
  );
  assert(
    canonical(ids('font')) === canonical([...rules.fonts.value].sort()),
    'font registry/policy mismatch',
  );
  assert(
    canonical(
      Object.values(catalog)
        .filter((p) => p.type === 'font')
        .map((p) => p.family)
        .sort(),
    ) ===
      canonical(
        policy.firstVersion.designTokens.fonts.value
          .filter((f) => !f.startsWith('system-'))
          .sort(),
      ),
    'font family/policy mismatch',
  );
  for (const p of Object.values(catalog))
    if (p.type === 'variant') {
      const properties = {};
      for (const id of p.behaviors) {
        assert(catalog[id]?.type === 'behavior', 'unknown behavior');
        Object.assign(properties, catalog[id].styleProperties ?? {});
      }
      validateVariantCss(p.css, p.id, 'variant', properties);
    }
  for (const [type, key] of [
    ['component', 'components'],
    ['variant', 'variants'],
    ['behavior', 'behaviors'],
    ['effect', 'effects'],
    ['font', 'fonts'],
  ])
    assert(ids(type).length <= b[key].value, 'budget ' + key);
  for (const p of Object.values(catalog))
    if (['variant', 'effect', 'behavior'].includes(p.type)) {
      const key =
        p.type === 'variant'
          ? 'variantCss'
          : p.type === 'effect'
            ? 'effectCss'
            : 'behaviorJs';
      const source =
        p.type === 'behavior' ? 'export default ' + p.code + ';' : p.css;
      const bytes = gzipBytes(source, b.gzipLevel.value);
      assert(bytes <= b[key].value, 'budget ' + key + ' ' + p.id);
      packages.find((e) => e.id === p.id).measurements = {
        bytes: Buffer.byteLength(source),
        gzipBytes: bytes,
      };
    }
  const signatures = new Map();
  for (const id of ids('component')) {
    const p = catalog[id],
      sig = canonical(
        Object.entries(p.fields)
          .sort()
          .map(([k, v]) => [k, v.kind, v.required]),
      );
    const other = signatures.get(sig);
    assert(
      !other || [other, id].sort().join(',') === 'feature-grid,steps',
      'duplicate component field signature: ' + id + ' / ' + other,
    );
    signatures.set(sig, id);
  }
  const styles = Object.values(catalog).filter((p) => p.css?.trim());
  const decl = (p) =>
    new Set(
      [...p.css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/g)].map(
        (m) => m[1] + ':' + m[2].replace(/pkg-[a-z-]+/g, 'PACKAGE'),
      ),
    );
  const warnings = [];
  for (let i = 0; i < styles.length; i++)
    for (let j = i + 1; j < styles.length; j++) {
      const a = decl(styles[i]),
        c = decl(styles[j]),
        intersection = [...a].filter((x) => c.has(x)).length;
      if (a.size && c.size && intersection / Math.max(a.size, c.size) >= 0.8)
        warnings.push(
          'CSS overlap >=80%: ' + styles[i].id + ' / ' + styles[j].id,
        );
    }
  packages.sort((a, b) => a.id.localeCompare(b.id));
  const registry = { schemaVersion: 1, packages };
  assert(validateRegistry(registry), 'registry schema');
  return {
    registry: json(registry),
    data:
      "// Generated by scripts/library.mjs; do not edit.\nimport type { LibraryVariant } from './library-template.ts';\nexport const library: Record<string, LibraryVariant> = " +
      json(compiled).trim() +
      ';\n',
    metadata:
      "// Generated by the library compiler; inert reviewed package data.\nimport type { LibraryCatalog } from './library.ts';\nexport const catalog: LibraryCatalog = " +
      json(catalog).trim() +
      ';\n',
    catalog,
    variants: compiled,
    warnings,
  };
}
export async function checkLibrary(root = defaultRoot, write = false) {
  const out = await libraryArtifacts(root);
  for (const [path, bytes] of [
    ['library/registry.json', out.registry],
    ['packages/generator/src/library-data.ts', out.data],
    ['packages/site-core/src/library-data.ts', out.metadata],
  ]) {
    if (write) await writeFile(resolve(root, path), bytes);
    else
      assert(
        (await readFile(resolve(root, path), 'utf8').catch(() => null)) ===
          bytes,
        'stale ' + path + '; run library:generate',
      );
  }
  return out;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const out = await checkLibrary(defaultRoot, process.argv.includes('--write'));
  for (const w of out.warnings) console.warn(w);
  console.log('Library static validation passed');
  if (!process.argv.includes('--write') && !process.argv.includes('--static')) {
    const { checkLibraryBrowser } = await import('./library-browser.mjs');
    await checkLibraryBrowser(defaultRoot, out, libraryArtifacts);
  }
}
