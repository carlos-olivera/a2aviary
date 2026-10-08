import QRCode from 'qrcode';
import {
  safePath,
  SiteError,
  sha256,
  canonicalJson,
  type VerifiedBuild,
} from '@a2aviary/generator';
import type { Drafts } from './drafts.ts';
import type { Auth } from './auth.ts';
import { escapeHtml as e } from './pages.ts';
const html = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · a2aviary</title><link rel="stylesheet" href="/site-ui.css"></head><body><main><h1>${e(title)}</h1>${body}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
export const uploadScript = `const input=document.querySelector('input[type=file]'),status=document.getElementById('progress');input.addEventListener('change',async()=>{input.disabled=true;for(const file of input.files){try{status.textContent='Uploading '+file.name;const response=await fetch(input.dataset.url+'/'+crypto.randomUUID(),{method:'PUT',credentials:'same-origin',headers:{'x-csrf-token':input.dataset.csrf},body:file});const result=await response.json();if(!response.ok)throw Error(result.error);status.textContent='Uploaded '+file.name;}catch(error){status.textContent=error.message;input.disabled=false;return;}}location.reload();});`;
export async function browserIdentity(request: Request, auth: Auth) {
  if (request.headers.has('authorization'))
    throw new SiteError('browser_session_required');
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified)
    throw new SiteError('verified_browser_session_required');
  return session;
}
export async function authorizeUploadRequest(
  request: Request,
  drafts: Drafts,
  auth: Auth,
) {
  const match = new URL(request.url).pathname.match(
    /^\/api\/site-uploads\/([a-f0-9-]{36})\/(probe|files\/[a-f0-9-]{36})$/,
  );
  if (!match || request.method !== 'PUT')
    throw new SiteError('upload_route_invalid');
  const bearer = request.headers.get('authorization');
  if (bearer) {
    if (!bearer.startsWith('Bearer '))
      throw new SiteError('upload_capability_invalid');
    return {
      actor: await drafts.authenticateUpload(match[1], bearer.slice(7)),
      sessionId: match[1],
      channel: 'agent' as const,
    };
  }
  if (request.headers.get('origin') !== drafts.origin)
    throw new SiteError('origin_required');
  const s = await browserIdentity(request, auth);
  await drafts.sites.store.transaction(async (c) => {
    await drafts.status(s.user.id, match[1]);
    const token = request.headers.get('x-csrf-token') ?? ''; // Upload nonce is reusable for this page/session; each file has its own retry UUID.
    if (
      !(
        await c.query(
          'SELECT 1 FROM platform_browser_nonce WHERE hash=$1 AND session_id=$2 AND target=$3 AND expires_at>now()',
          [sha256(token), s.session.id, 'upload:' + match[1]],
        )
      ).rowCount
    )
      throw new SiteError('csrf_invalid');
  });
  return { actor: s.user.id, sessionId: match[1], channel: 'human' as const };
}
export async function sitePage(
  request: Request,
  drafts: Drafts,
  auth: Auth,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname;
  if (path === '/site-ui.css')
    return new Response(
      'body{font:16px system-ui;margin:0;padding:1rem;color:#222;background:#fff}main{max-width:70rem;margin:auto}button,input,select{font:inherit;padding:.6rem}img{max-width:100%;height:auto}iframe{width:100%;height:65vh;border:1px solid #888}figure{margin:1rem 0}li{margin:.5rem 0}a{overflow-wrap:anywhere}',
      { headers: { 'content-type': 'text/css' } },
    );
  if (path === '/uploads.js')
    return new Response(uploadScript, {
      headers: { 'content-type': 'text/javascript' },
    });
  if (path.startsWith('/api/site-uploads/')) {
    const permit = await authorizeUploadRequest(request, drafts, auth);
    const bytes = new Uint8Array(await request.arrayBuffer());
    return Response.json(
      path.endsWith('/probe')
        ? await drafts.probe(permit.actor, permit.sessionId, bytes)
        : await drafts.upload(
            permit.actor,
            permit.sessionId,
            path.split('/').at(-1)!,
            bytes,
            permit.channel,
          ),
    );
  }
  if (path.startsWith('/p/')) {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    const [, , token, ...parts] = path.split('/'),
      row = await drafts.previewRow(token);
    let file = parts.join('/');
    if (file === '' || file.endsWith('/')) file += 'index.html';
    if (!safePath(file)) throw new SiteError('preview_path_invalid');
    const build = JSON.parse(
      Buffer.from(
        await drafts.sites.objects.get('specs/' + row.id + '/build.json'),
      ).toString(),
    ) as VerifiedBuild;
    if (
      build.report.outputSha256 &&
      (build.report.outputSha256 !== sha256(canonicalJson(build.files)) ||
        (row.output_sha256 && row.output_sha256 !== build.report.outputSha256))
    )
      throw new SiteError('preview_integrity');
    const encoded = build.files[file];
    if (!encoded) return new Response('Not found', { status: 404 });
    const type: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css',
      js: 'text/javascript',
      webp: 'image/webp',
      png: 'image/png',
      woff2: 'font/woff2',
      txt: 'text/plain',
    };
    const prefix = drafts.origin + '/p/' + token + '/';
    return new Response(
      request.method === 'HEAD'
        ? null
        : new Uint8Array(Buffer.from(encoded, 'base64')),
      {
        headers: {
          'content-type':
            type[file.split('.').at(-1)!] ?? 'application/octet-stream',
          'content-security-policy': `sandbox; default-src 'none'; style-src ${prefix}; img-src ${prefix}; font-src ${prefix}; script-src 'none'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors ${drafts.origin}`,
          'x-robots-tag': 'noindex, nofollow, noarchive',
          'access-control-allow-origin': '*',
        },
      },
    );
  }
  if (!['GET', 'POST'].includes(request.method))
    return new Response('Method not allowed', { status: 405 });
  let s;
  try {
    s = await browserIdentity(request, auth);
  } catch (error) {
    if (
      request.method === 'GET' &&
      !request.headers.has('authorization') &&
      /^\/(?:u\/[A-Za-z0-9_-]{22}|sites\/approve\/[a-f0-9-]{36})$/.test(path)
    )
      return new Response(null, {
        status: 303,
        headers: { location: '/sign-in?return_to=' + encodeURIComponent(path) },
      });
    throw error;
  }
  if (
    request.method === 'POST' &&
    request.headers.get('origin') !== drafts.origin
  )
    throw new SiteError('origin_required');
  const upload = path.match(
    /^\/u\/([A-Za-z0-9_-]{22})(\/qr|\/assets\/[a-z0-9-]{42})?$/,
  );
  if (upload) {
    if (request.method !== 'GET')
      return new Response('Method not allowed', { status: 405 });
    const session = await drafts.sessionByShort(upload[1]);
    if (!session) throw new SiteError('upload_session_invalid');
    const after = Number(url.searchParams.get('after') ?? 0);
    if (!Number.isSafeInteger(after) || after < 0)
      throw new SiteError('invalid_cursor');
    const status = await drafts.status(s.user.id, session.id, after);
    if (upload[2]?.startsWith('/assets/')) {
      const assetId = upload[2].slice(8),
        full: any = await drafts.get(s.user.id, session.draft_id, 'full');
      if (!full.content.assets.some((a: any) => a.id === assetId))
        throw new SiteError('asset_not_found');
      return new Response(
        new Uint8Array(
          await drafts.sites.objects.get(
            'drafts/' + session.draft_id + '/assets/' + assetId,
          ),
        ),
        { headers: { 'content-type': 'image/webp' } },
      );
    }
    if (upload[2] === '/qr')
      return new Response(
        new Uint8Array(
          await QRCode.toBuffer(drafts.origin + '/u/' + upload[1], {
            width: 256,
            margin: 2,
          }),
        ),
        { headers: { 'content-type': 'image/png' } },
      );
    const csrf = await drafts.nonce(s.session.id, 'upload:' + session.id);
    return html(
      'Upload site images',
      `<p>Signed in as ${e(s.user.email)}. Upload JPEG, PNG or WebP images, up to 20 MiB each. Images are resized and location metadata is removed.</p><img src="${e(path)}/qr" width="256" height="256" alt="QR code for this upload page"><p><a href="${e(drafts.origin + path)}">${e(drafts.origin + path)}</a></p><label>Select photos <input type="file" multiple accept="image/jpeg,image/png,image/webp" data-url="/api/site-uploads/${session.id}/files" data-csrf="${e(csrf)}"></label><p id="progress" role="status"></p><h2>Uploaded images</h2><ul>${status.files.map((f: any) => `<li><img src="/u/${upload[1]}/assets/${e(f.assetId)}" width="160" alt="Uploaded image ${e(f.assetId)}"> ${e(f.assetId)} · ${e(f.metadata.width)} × ${e(f.metadata.height)} · ${e(f.channel)}</li>`).join('')}</ul>${status.nextAfter !== null ? `<p><a href="/u/${upload[1]}?after=${status.nextAfter}">More uploaded images</a></p>` : ''}<script src="/uploads.js" defer></script>`,
    );
  }
  const approve = path.match(
    /^\/sites\/approve\/([a-f0-9-]{36})(?:\/artifacts\/([^/]+))?$/,
  );
  if (!approve) return new Response('Not found', { status: 404 });
  const specId = approve[1];
  const row = await drafts.sites.store.transaction((c) =>
    drafts.approvalAccess(c, s.user.id, specId),
  );
  if (approve[2]) {
    const bytes = await drafts.sites.artifact(s.user.id, specId, approve[2]);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': approve[2].endsWith('.png')
          ? 'image/png'
          : 'application/json',
      },
    });
  }
  if (request.method === 'POST') {
    const form = new URLSearchParams(await request.text());
    if (form.get('action') !== 'approve')
      throw new SiteError('explicit_approval_required');
    await drafts.approve(
      s.user.id,
      s.session.id,
      specId,
      form.get('csrf') ?? '',
    );
    return new Response(null, { status: 303, headers: { location: path } });
  }
  let build: any;
  try {
    build = JSON.parse(
      Buffer.from(
        await drafts.sites.objects.get('specs/' + specId + '/build.json'),
      ).toString(),
    );
  } catch {
    if (!['queued', 'building'].includes(row.state))
      build = {
        report: {
          checks: [
            {
              name: 'build',
              passed: false,
              details: { error: row.error_code },
            },
          ],
        },
        files: {},
        artifactNames: [],
      };
  }
  const current = (
    await drafts.sites.store.pool.query(
      'SELECT revision,state,expires_at FROM platform_site_draft WHERE id=$1',
      [row.draft_id],
    )
  ).rows[0];
  const can =
    row.state === 'verified' &&
    current?.revision === row.draft_revision &&
    current.state === 'active' &&
    new Date(current.expires_at).getTime() > Date.now() &&
    new Date(row.expires_at).getTime() > Date.now() &&
    !row.artifacts_deleted;
  const csrf = can ? await drafts.nonce(s.session.id, 'approve:' + specId) : '';
  const page =
    row.spec.pages.find((p: any) => p.id === url.searchParams.get('page')) ??
    row.spec.pages[0];
  const pageOptions = row.spec.pages
    .map(
      (p: any) =>
        `<option value="${e(p.id)}" ${p.id === page.id ? 'selected' : ''}>${e(p.seo.title)}</option>`,
    )
    .join('');
  return html(
    'Review site preview',
    `<p>Snapshot ${e(specId)} · revision ${row.draft_revision} · ${e(row.state)}</p><p>Signed in as ${e(s.user.email)}. Approval authorizes these exact verified site bytes. CMS content can change later through the CMS.</p><form method="get"><label>Page <select name="page">${pageOptions}</select></label><button>Show page</button></form>${build && Object.keys(build.files ?? {}).length ? `<iframe title="Verified site preview" sandbox src="/p/${drafts.signPreview(specId)}${e(page.path)}"></iframe>` : '<p>Preview is not available yet.</p>'}<h2>Screenshots</h2>${[
      390, 1280,
    ]
      .map((width) => {
        const name =
          sha256(page.path).slice(0, 12) + '-' + width + '-actual.png';
        return build?.artifactNames?.includes(name)
          ? `<figure><figcaption>${width} px</figcaption><img src="${path}/artifacts/${name}" alt="Preview of ${e(page.seo.title)} at ${width} pixels" loading="lazy"></figure>`
          : '';
      })
      .join(
        '',
      )}<h2>Verification</h2><ul>${(build?.report?.checks ?? []).map((check: any) => `<li>${e(check.name)}: ${check.passed ? 'passed' : 'failed'}${!check.passed ? ' · ' + e(JSON.stringify(check.details)) : ''}</li>`).join('')}</ul>${can ? `<form method="post"><input type="hidden" name="csrf" value="${e(csrf)}"><button name="action" value="approve">Approve this snapshot</button></form>` : '<p>This snapshot cannot be approved in its current state.</p>'}`,
  );
}
