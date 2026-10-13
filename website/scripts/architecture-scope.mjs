import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Tests, evidence records, workflow orchestration and general prose are not runtime architecture.
export function architectureRelevantPath(path) {
  return /^(?:infra\/src\/|services\/src\/|local\/|apps\/platform\/(?:src\/|migrations\/|Dockerfile$)|packages\/(?:site-core|generator)\/(?:src\/|template\/|scripts\/(?:library|collections|build)\.mjs$)|plans\/|contracts\/|library\/|collections\/|docs\/architecture\/|website\/(?:architecture\/|public\/architecture\.(?:js|css)$|scripts\/(?:architecture-[^/]+|check-architecture|integrate-architecture)\.mjs$))/.test(path)
    || /^(?:AGENTS\.md|docker-compose\.local\.yml|\.env\.local\.example|(?:package(?:-lock)?|(?:infra|services|apps\/platform|packages\/(?:site-core|generator))\/package)\.json)$/.test(path);
}

export function sourceFreshnessRequired(changedPaths, release = false) {
  return release || changedPaths.some(architectureRelevantPath);
}

export function changedArchitecturePaths(root, env = process.env) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  const event = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) : {};
  let base;
  if (env.ARCHITECTURE_BASE_REVISION) base = git('rev-parse', env.ARCHITECTURE_BASE_REVISION);
  else if (event.pull_request?.base?.sha || (env.GITHUB_EVENT_NAME === 'push' && event.before && !/^0+$/.test(event.before))) {
    base = event.pull_request?.base?.sha ?? event.before;
    if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Invalid architecture base SHA in event.');
    // actions/checkout is shallow by default. Fetch only the immutable public base, with no writes.
    try { git('cat-file','-e',base + '^{commit}'); }
    catch { git('fetch','--no-tags','--depth=1','origin',base); }
  }
  else if (env.GITHUB_BASE_REF) base = git('merge-base', 'HEAD', 'origin/' + env.GITHUB_BASE_REF);
  else if (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_SHA) base = git('rev-parse', 'HEAD^');
  else {
    try { base = git('merge-base', 'HEAD', 'origin/main'); }
    catch { throw new Error('Architecture base unavailable; fetch origin/main or set ARCHITECTURE_BASE_REVISION.'); }
  }
  const tracked = git('diff', '--name-only', base);
  const untracked = git('ls-files', '--others', '--exclude-standard');
  return [...new Set([tracked,untracked].join('\n').split('\n').filter(Boolean))];
}
