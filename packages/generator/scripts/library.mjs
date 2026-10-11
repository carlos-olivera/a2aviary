import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep } from 'node:path';
import { parseTemplate } from '../src/library-template.ts';
import { validateVariantCss } from '../src/library-css.ts';
const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const canonical = (value) =>
  Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : value && typeof value === 'object'
      ? '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
          .join(',') +
        '}'
      : JSON.stringify(value);
const assert = (condition, message) => {
  if (!condition) throw Error('Invalid library: ' + message);
};
const sha = (data) => createHash('sha256').update(data).digest('hex');
export async function libraryArtifacts(root = defaultRoot) {
  const library = resolve(root, 'library'),
    policy = JSON.parse(
      await readFile(
        resolve(root, 'plans/versions/web-simple/2.0.0.policy.json'),
        'utf8',
      ),
    );
  const active = JSON.parse(
    await readFile(resolve(root, 'plans/web-simple.policy.json'), 'utf8'),
  );
  assert(
    canonical(active) === canonical(policy),
    'active policy differs from pinned 2.0.0',
  );
  const components = policy.firstVersion.components,
    packages = [],
    compiled = {},
    seen = new Set();
  async function files(directory) {
    const list = [];
    for (const name of (await readdir(directory)).sort()) {
      assert(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name), 'unsafe path');
      const path = resolve(directory, name),
        stat = await lstat(path);
      assert(!stat.isSymbolicLink(), 'symlink: ' + name);
      if (stat.isDirectory()) list.push(...(await files(path)));
      else {
        assert(stat.isFile(), 'non-file: ' + name);
        list.push(path);
      }
    }
    return list;
  }
  async function manifest(path, expected) {
    const value = JSON.parse(await readFile(path, 'utf8'));
    assert(
      canonical(Object.keys(value).sort()) ===
        canonical(Object.keys(expected).sort()),
      'metadata keys: ' + path,
    );
    for (const [key, v] of Object.entries(expected))
      if (v !== undefined)
        assert(
          canonical(value[key]) === canonical(v),
          'metadata ' + key + ': ' + path,
        );
    assert(/^\d+\.\d+\.\d+$/.test(value.version), 'version');
    assert(
      ['experimental', 'stable', 'deprecated'].includes(value.status),
      'status',
    );
    assert(!seen.has(value.id), 'duplicate ID');
    seen.add(value.id);
    return value;
  }
  async function entry(metadata, paths) {
    const hashes = {};
    for (const path of paths.sort())
      hashes[relative(library, path).split(sep).join('/')] = sha(
        await readFile(path),
      );
    packages.push({
      id: metadata.id,
      type: metadata.type,
      version: metadata.version,
      status: metadata.status,
      files: hashes,
    });
  }
  assert(!(await lstat(library)).isSymbolicLink(), 'library root symlink');
  const rootEntries = await readdir(library);
  for (const name of rootEntries)
    assert(
      !(await lstat(resolve(library, name))).isSymbolicLink(),
      'root symlink: ' + name,
    );
  for (const name of rootEntries)
    assert(
      Object.hasOwn(components, name) ||
        ['README.md', 'registry.json', 'registry.schema.json'].includes(name),
      'unexpected root package/file: ' + name,
    );
  for (const name of Object.keys(components).sort()) {
    const dir = resolve(library, name),
      paths = await files(dir),
      componentPath = resolve(dir, 'component.json');
    const metadata = await manifest(componentPath, {
      id: name,
      type: 'component',
      version: undefined,
      status: undefined,
      fields: components[name].fields,
    });
    await entry(metadata, [componentPath]);
    const owned = new Set([componentPath]);
    for (const variant of [...components[name].variants.value].sort()) {
      const id = name + ':' + variant,
        vdir = resolve(dir, 'variants', variant),
        vpath = resolve(vdir, 'variant.json');
      const vmeta = await manifest(vpath, {
        id,
        type: 'variant',
        version: undefined,
        status: undefined,
        component: name,
        variant,
        behaviors: [],
      });
      const vfiles = paths.filter((p) => p.startsWith(vdir + sep));
      for (const path of vfiles) {
        const rel = relative(vdir, path).split(sep).join('/');
        assert(
          ['variant.json', 'template.html', 'style.css'].includes(rel) ||
            /^fixtures\/[a-z0-9-]+\.json$/.test(rel),
          'unexpected package file: ' + rel,
        );
        owned.add(path);
      }
      const fixturePaths = vfiles.filter((p) =>
        p.includes(sep + 'fixtures' + sep),
      );
      assert(fixturePaths.length > 0, 'missing fixtures: ' + id);
      for (const path of fixturePaths) {
        const fixture = JSON.parse(await readFile(path, 'utf8'));
        assert(
          fixture.component === name && fixture.variant === variant,
          'fixture identity: ' + id,
        );
        assert(
          fixture.props &&
            typeof fixture.props === 'object' &&
            !Array.isArray(fixture.props),
          'fixture props',
        );
        for (const field of Object.keys(fixture.props))
          assert(
            Object.hasOwn(metadata.fields, field),
            'unknown fixture field',
          );
        for (const [field, contract] of Object.entries(metadata.fields))
          assert(
            !contract.required || Object.hasOwn(fixture.props, field),
            'missing fixture field',
          );
      }
      const ast = parseTemplate(
        await readFile(resolve(vdir, 'template.html'), 'utf8'),
        metadata.fields,
      );
      const css = await readFile(resolve(vdir, 'style.css'), 'utf8');
      validateVariantCss(css, id);
      compiled[id] = { component: name, ast, css };
      await entry(vmeta, vfiles);
    }
    assert(
      paths.every((p) => owned.has(p)),
      'unknown variant or executable package file: ' + name,
    );
  }
  packages.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    registry: json({ schemaVersion: 1, packages }),
    data:
      "// Generated by scripts/library.mjs; do not edit.\nimport type { LibraryVariant } from './library-template.ts';\nexport const library: Record<string, LibraryVariant> = " +
      JSON.stringify(compiled, null, 2) +
      ';\n',
  };
}
export async function checkLibrary(root = defaultRoot, write = false) {
  const output = await libraryArtifacts(root);
  for (const [path, bytes] of [
    ['library/registry.json', output.registry],
    ['packages/generator/src/library-data.ts', output.data],
  ]) {
    const target = resolve(root, path);
    if (write) await writeFile(target, bytes);
    else
      assert(
        (await readFile(target, 'utf8').catch(() => null)) === bytes,
        'stale ' + path + '; run library:generate',
      );
  }
  return output;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkLibrary(defaultRoot, process.argv.includes('--write'));
  console.log(
    process.argv.includes('--write')
      ? 'Library artifacts generated'
      : 'Library registry, templates, CSS and policy consistency passed',
  );
}
