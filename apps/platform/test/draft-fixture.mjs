import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
export async function call(f, user, name, args = {}) {
  const response = await f.rpc(await f.token(user), 'tools/call', {
      name,
      arguments: args,
    }),
    body = await response.json();
  assert.ok(body.result?.content, JSON.stringify(body));
  return {
    ...JSON.parse(body.result.content[0].text),
    isError: body.result.isError === true,
  };
}
export async function prepare(
  f,
  user,
  input,
  viaMcp = false,
  onCreated = () => {},
) {
  input ??= await fixtureSubmission();
  const drafts = f.app.sites.drafts;
  const invoke = async (name, args, local) => {
    const r = viaMcp ? await call(f, user, name, args) : await local();
    assert.equal(r.isError ?? false, false, JSON.stringify(r));
    return r;
  };
  const created = await invoke(
    'site.draft.create',
    { slug: input.slug, requestId: randomUUID() },
    () => drafts.create(user.id, input.slug, randomUUID()),
  );
  onCreated(created);
  const opened = await invoke(
    'site.upload.open',
    { draftId: created.draftId, requestId: randomUUID() },
    () => drafts.open(user.id, created.draftId, randomUUID()),
  );
  const probe = await fetch(opened.agent.probe.url, {
    method: 'PUT',
    headers: { authorization: opened.agent.authorization },
    body: Buffer.from([0]),
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(probe.status, 200);
  const mappings = new Map();
  for (const asset of input.spec.assets) {
    const response = await fetch(
      opened.agent.uploadUrl.replace('{uploadId}', randomUUID()),
      {
        method: 'PUT',
        headers: { authorization: opened.agent.authorization },
        body: Buffer.from(input.assets[asset.id], 'base64'),
      },
    );
    const r = await response.json();
    assert.equal(response.status, 200, JSON.stringify(r));
    mappings.set(asset.id, r.assetId);
  }
  function remap(v) {
    if (typeof v === 'string') return mappings.get(v) ?? v;
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, remap(x)]),
      );
    return v;
  }
  const current = await drafts.get(user.id, created.draftId);
  const operations = [
    {
      op: 'settings',
      settings: {
        tokens: input.spec.tokens,
        navigation: input.spec.navigation,
        cms: input.spec.cms,
      },
    },
    ...input.spec.pages.map((page, index) => ({
      op: 'upsert-page',
      page: remap(page),
      index,
    })),
    ...input.spec.assets.map((a) => ({
      op: 'asset-metadata',
      assetId: mappings.get(a.id),
      alt: a.alt,
    })),
  ];
  const args = {
    draftId: created.draftId,
    expectedRevision: current.revision,
    requestId: randomUUID(),
    operations,
  };
  const updated = await invoke('site.draft.apply', args, () =>
    drafts.apply(user.id, args),
  );
  assert.deepEqual(updated.missing, []);
  const snapshot = await invoke(
    'site.preview',
    { draftId: created.draftId, expectedRevision: updated.revision },
    () => drafts.preview(user.id, created.draftId, updated.revision),
  );
  return { ...created, ...updated, ...snapshot, opened };
}
export async function approve(f, user, specId) {
  const path = '/sites/approve/' + specId;
  const page = await f.request(path, { headers: { cookie: user.cookie } });
  assert.equal(page.status, 200);
  const text = await page.text(),
    csrf = text.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf, text);
  const response = await f.request(path, {
    method: 'POST',
    headers: {
      cookie: user.cookie,
      origin: f.config.origin,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ csrf, action: 'approve' }),
  });
  assert.equal(response.status, 303, await response.text());
  return csrf;
}
