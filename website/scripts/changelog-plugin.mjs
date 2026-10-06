import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderChangelog } from '../src/changelog-section.js';

export function changelogSection() {
  let file;
  return {
    name: 'a2aviary-changelog-section',
    configResolved(config) { file = resolve(config.publicDir, 'changelog.json'); },
    configureServer(server) {
      server.watcher.add(file);
      server.watcher.on('change', path => { if (path === file) server.ws.send({ type: 'full-reload' }); });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        return html.replace('<!-- CHANGELOG_SECTION -->', renderChangelog(JSON.parse(await readFile(file, 'utf8'))));
      },
    },
  };
}
