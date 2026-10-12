import assert from 'node:assert/strict';
import { boundCollections } from '@a2aviary/generator';
import { composition } from '@a2aviary/site-core/fixtures/presentation';

/** Hosted variants exercise CMS without changing the static presentation matrix. */
export async function hostedComposition(name) {
  const input = await composition(name);
  const es = input.spec.language === 'es';
  input.spec.cms.collections = ['announcements'];
  input.spec.pages[0].sections.splice(-1, 0, {
    id: 'studio-news',
    blocks: [
      {
        id: 'studio-announcements',
        component: 'announcements',
        variant: 'standard',
        props: {
          heading: es
            ? 'Novedades del estudio ficticio'
            : 'Fictional studio news',
          collection: 'announcements',
          emptyText: es
            ? 'Todavía no hay novedades ficticias.'
            : 'No fictional news yet.',
        },
      },
    ],
  });
  return input;
}

export async function editFixtureCms({
  spec,
  origin,
  token,
  request = fetch,
}) {
  const declared = new Set(spec.cms.collections);
  const bound = boundCollections(spec);
  assert.ok(
    bound.every((name) => declared.has(name)),
    'CMS bindings must be declared',
  );
  const target = bound.find((name) => declared.has(name));
  // A declared-but-unbound spec is a broken fixture, not the no-collection case.
  assert.ok(
    target || declared.size === 0,
    'Declared CMS collection must be bound',
  );
  const collection = target ?? 'fixture_undeclared';
  const response = await request(
    origin +
      '/api/cms/api/collections/' +
      encodeURIComponent(collection) +
      '/records',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({
        title: 'Fictional smoke content',
        body: 'Fictional test record',
        published: true,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  assert.equal(
    response.status,
    target ? 200 : 404,
    'CMS fixture write status',
  );
  return {
    stage: target ? 'edited' : 'no collection to edit',
    collection,
    httpStatus: response.status,
  };
}
