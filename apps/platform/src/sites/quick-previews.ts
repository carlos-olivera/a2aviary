import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  quickRender,
  SiteError,
  safePath,
  QUICK_TIMEOUT_MS,
} from '@a2aviary/generator';
import type { SiteSpec } from '@a2aviary/site-core';
import { identity, blockers } from './draft-content.ts';
import type { Drafts } from './drafts.ts';
import { escapeHtml as e } from '../pages.ts';

const TTL = 10 * 60_000;
const RETAINED_BYTES = 64 * 1024 * 1024;
type Entry = {
  id: string;
  draftId: string;
  owner: string;
  revision: number;
  test: boolean;
  expires: number;
  bytes: number;
  files: Record<string, string>;
  pages: { path: string; title: string }[];
};

/** Ephemeral render artifacts only. Never reads/writes snapshot, approval or job rows. */
export class QuickPreviews {
  private entries = new Map<string, Entry>();
  private busy = false;
  private readonly drafts: Drafts;
  constructor(drafts: Drafts) {
    this.drafts = drafts;
  }
  private prune() {
    for (const [id, entry] of this.entries)
      if (entry.expires <= Date.now()) this.entries.delete(id);
  }
  async create(actor: string, draftId: string, revision: number) {
    if (this.busy) throw new SiteError('quick_preview_busy');
    this.busy = true;
    const store = this.drafts.sites.store;
    let lease,
      locked = false,
      admitted:
        | { d: any; site: any; summary: ReturnType<Drafts['summary']> }
        | undefined;
    const started = Date.now();
    try {
      lease = await store.pool.connect();
      locked = (
        await lease.query(
          "SELECT pg_try_advisory_lock(hashtext('quick-preview-execution')) AS ok",
        )
      ).rows[0].ok;
      if (!locked) throw new SiteError('quick_preview_busy');
      admitted = await store.siteAction(
        actor,
        'site.preview.quick',
        async (c, p) => {
          const { d, site } = await this.drafts.draft(c, actor, draftId, true);
          p.testMode = site.test_mode;
          this.drafts.revision(d, revision);
          this.drafts.currentPolicy(site);
          const missing = blockers(
            d.content,
            { test: site.test_mode },
            Boolean(site.starter_id),
          );
          if (missing.length) throw new SiteError('draft_incomplete', missing);
          const count = (
            await c.query(
              `SELECT count(*)::int AS total,
          count(*) FILTER(WHERE owner_id=$1)::int AS owned,
          count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int AS burst,
          count(*) FILTER(WHERE owner_id=$1 AND created_at>now()-interval '1 minute')::int AS owner_burst
          FROM platform_site_quota WHERE kind='quick' AND created_at>now()-interval '24 hours'`,
              [site.owner_id],
            )
          ).rows[0];
          if (
            count.owned >= 60 ||
            count.total >= 300 ||
            count.owner_burst >= 10 ||
            count.burst >= 30
          )
            throw new SiteError('quick_preview_quota');
          // Commit admission before rendering: failed attempts also consume this separate allowance.
          await c.query(
            "INSERT INTO platform_site_quota(owner_id,kind,amount) VALUES($1,'quick',1)",
            [site.owner_id],
          );
          await this.drafts.event(
            c,
            actor,
            site.id,
            'site.preview.quick',
            'admitted',
          );
          return { d, site, summary: this.drafts.summary(d) };
        },
      );
      const { d, site, summary } = admitted;
      const remaining = () => {
        const ms = QUICK_TIMEOUT_MS - (Date.now() - started);
        if (ms <= 0) throw new SiteError('quick_timeout');
        return ms;
      };
      const assets = new Map<string, Uint8Array>();
      let assetBytes = 0;
      for (const a of d.content.assets) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const bytes = await Promise.race([
            this.drafts.sites.objects.get(
              'drafts/' + draftId + '/assets/' + a.id,
            ),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new SiteError('quick_timeout')),
                remaining(),
              );
            }),
          ]);
          assetBytes += bytes.length;
          if (bytes.length !== a.bytes || assetBytes > 25 * 1024 * 1024)
            throw new SiteError('quick_input_size');
          assets.set(a.id, bytes);
        } finally {
          clearTimeout(timer);
        }
      }
      const rendered = await quickRender(
        { ...identity(), ...d.content } as SiteSpec,
        assets,
        site.test_mode,
        { timeoutMs: remaining() },
      );
      // Editing, discarding, membership changes and deployment admission may occur during rendering.
      return await store.siteAction(
        actor,
        'site.preview.quick',
        async (c, p) => {
          const current = await this.drafts.draft(c, actor, draftId, true);
          this.drafts.currentPolicy(current.site);
          this.drafts.revision(current.d, revision);
          p.testMode = site.test_mode;
          remaining();
          const entry: Entry = {
            id: randomUUID(),
            draftId,
            owner: site.owner_id,
            revision,
            test: site.test_mode,
            expires: Date.now() + TTL,
            bytes: Buffer.byteLength(JSON.stringify(rendered.files)),
            files: rendered.files,
            pages: d.content.pages.map((page: any) => ({
              path: page.path,
              title: page.seo.title,
            })),
          };
          this.prune();
          // One retained result per draft, at most 20 service-local results and 64 MiB encoded data.
          for (const [id, old] of this.entries)
            if (old.draftId === draftId) this.entries.delete(id);
          while (
            this.entries.size &&
            (this.entries.size >= 20 ||
              [...this.entries.values()].reduce((n, x) => n + x.bytes, 0) +
                entry.bytes >
                RETAINED_BYTES)
          )
            this.entries.delete(this.entries.keys().next().value!);
          if (entry.bytes > RETAINED_BYTES)
            throw new SiteError('quick_output_size');
          await this.drafts.event(
            c,
            actor,
            site.id,
            'site.preview.quick',
            'rendered_unverified',
          );
          this.entries.set(entry.id, entry);
          setTimeout(() => this.entries.delete(entry.id), TTL).unref();
          const value = entry.id + '.' + Math.floor(entry.expires / 1000);
          const token =
            value + '.' + this.drafts.mac('quick-preview-v1', value);
          return {
            quickPreviewId: entry.id,
            siteId: site.id,
            draftId,
            revision,
            verified: false as const,
            previewUrl: this.drafts.origin + '/q/' + token,
            expiresAt: new Date(entry.expires).toISOString(),
            blockers: summary.blockers,
            suggestions: summary.suggestions,
            test: site.test_mode,
          };
        },
      );
    } catch (error) {
      if (admitted)
        await store.recordSiteResult(
          actor,
          'site.preview.quick',
          null,
          error instanceof SiteError ? error.code : 'quick_render_failed',
          admitted.site.test_mode,
        );
      throw error;
    } finally {
      try {
        if (locked)
          await lease!.query(
            "SELECT pg_advisory_unlock(hashtext('quick-preview-execution'))",
          );
      } finally {
        lease?.release();
        this.busy = false;
      }
    }
  }
  async row(token: string) {
    const match = /^([a-f0-9-]{36})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(
      token,
    );
    if (
      !match ||
      !timingSafeEqual(
        Buffer.from(match[3]),
        Buffer.from(
          this.drafts.mac('quick-preview-v1', match[1] + '.' + match[2]),
        ),
      ) ||
      Number(match[2]) <= Date.now() / 1000
    )
      throw new SiteError('quick_preview_expired');
    this.prune();
    const entry = this.entries.get(match[1]);
    if (!entry) throw new SiteError('quick_preview_expired');
    // Capability URLs ignore cookies. Bind to immutable owner/test scope and current draft.
    const row = (
      await this.drafts.sites.store.pool.query(
        `SELECT d.revision,d.state,d.expires_at,d.created_at,
      s.owner_id,s.test_mode,s.policy_version,s.lifecycle AS site_state FROM platform_site_draft d
      JOIN platform_site s ON s.id=d.site_id WHERE d.id=$1`,
        [entry.draftId],
      )
    ).rows[0];
    if (
      !row ||
      row.state !== 'active' ||
      row.site_state !== 'active' ||
      row.owner_id !== entry.owner ||
      row.test_mode !== entry.test ||
      row.revision !== entry.revision ||
      new Date(row.expires_at).getTime() <= Date.now() ||
      Date.now() - new Date(row.created_at).getTime() >= 30 * 86400000
    )
      throw new SiteError('quick_preview_expired');
    this.drafts.currentPolicy(row);
    return entry;
  }
  async page(request: Request) {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    const url = new URL(request.url),
      [, , token, ...parts] = url.pathname.split('/');
    const entry = await this.row(token);
    const prefix = this.drafts.origin + '/q/' + token + '/files/';
    const headers: Record<string, string> = {
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'permissions-policy':
        'clipboard-read=(), clipboard-write=(), camera=(), microphone=(), geolocation=()',
    };
    if (parts.length === 0) {
      const selected =
        entry.pages.find((p) => p.path === url.searchParams.get('page')) ??
        entry.pages[0];
      headers['content-type'] = 'text/html; charset=utf-8';
      headers['content-security-policy'] =
        `default-src 'none'; style-src ${this.drafts.origin}/site-ui.css; frame-src ${prefix}; frame-ancestors 'none'; form-action 'none'; base-uri 'none'`;
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unverified preview · a2aviary</title><link rel="stylesheet" href="/site-ui.css"></head><body><main><h1>Unverified preview</h1><p>For design and content iteration only. Full site.preview verification is required before browser approval and deployment. Scripts and live CMS content are disabled.</p><nav aria-label="Preview pages">${entry.pages.map((p) => `<a href="?page=${encodeURIComponent(p.path)}">${e(p.title)}</a>`).join(' · ')}</nav><iframe title="Unverified site preview" sandbox src="${e(prefix + selected.path.slice(1))}"></iframe></main></body></html>`;
      return new Response(request.method === 'HEAD' ? null : body, { headers });
    }
    if (parts.shift() !== 'files') throw new SiteError('preview_path_invalid');
    let file = parts.join('/');
    if (!file || file.endsWith('/')) file += 'index.html';
    if (!safePath(file)) throw new SiteError('preview_path_invalid');
    headers['content-security-policy'] =
      `sandbox; default-src 'none'; style-src ${prefix}; img-src ${prefix}; font-src ${prefix}; script-src 'none'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors ${this.drafts.origin}`;
    headers['access-control-allow-origin'] = '*';
    const types: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css',
      woff2: 'font/woff2',
      webp: 'image/webp',
      txt: 'text/plain',
    };
    headers['content-type'] =
      types[file.split('.').at(-1)!] ?? 'application/octet-stream';
    const encoded = Object.hasOwn(entry.files, file)
      ? entry.files[file]
      : undefined;
    return new Response(
      request.method === 'HEAD'
        ? null
        : encoded
          ? new Uint8Array(Buffer.from(encoded, 'base64'))
          : 'Not found',
      { status: encoded ? 200 : 404, headers },
    );
  }
}
