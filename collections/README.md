# CMS collections

`<id>/collection.json` owns each reviewed CMS collection's identity/order,
PocketBase fields (`text` with required/max bounds or `bool`), public list/view
rules, editor create/update/delete rules, editor labels/controls, record label and public heading/body display fields.
No client collection definition or executable package is accepted.

`collection.schema.json` validates the closed JSON format. The library compiler
also rejects unknown files, symlinks, unsafe/reserved/duplicate fields and IDs,
duplicate ordering, invalid public boolean rules and invalid editor labels.
Editor rules are restricted to authenticated `editors`; public rules can expose
records only through a declared boolean field. The editor builds fields from the selected collection. Identical shipped schemas
use the existing compact serialization; differing reviewed schemas use a dynamic
form with the same text-only DOM and authentication boundary.

Run `npm run library:generate` to compile inert
`packages/site-core/src/collections-data.ts`; `library:check` detects drift.
The engine profile and compiler both require the shipped ordered collection set
to equal the policy's `cmsCollections`; this cleanup changes no policy 2.2.0 value.
Renderer bindings, schema/validator selection, Caddy routing, PocketBase migration
and editor fields consume the compiled data. Caddy retains first-encounter order;
renderer/CMS metadata retains sorted order, preserving existing output bytes.

This is source preparation. No live PocketBase migration or deployment is run.
