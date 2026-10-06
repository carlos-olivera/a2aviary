// Local overrides are explicit and cannot silently redirect production clients.
const allowed = new Set(['127.0.0.1', 'localhost', 'localstack', 'standins']);
export function localEndpoint(name: string): string | undefined {
  const value = process.env[name];
  if (process.env.A2AVIARY_TARGET !== 'local') {
    if (value) throw new Error('local_endpoint_in_production');
    return undefined;
  }
  if (!value) throw new Error('local_endpoint_missing');
  const url = new URL(value);
  if (url.protocol !== 'http:' || !allowed.has(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error('local_endpoint_denied');
  return value.replace(/\/$/, '');
}
export function awsOptions(ses = false) {
  const endpoint = localEndpoint(ses ? 'LOCAL_SES_ENDPOINT' : 'AWS_ENDPOINT_URL');
  return endpoint ? { endpoint, region: 'us-east-1', credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, forcePathStyle: true } : {};
}
export function githubBase() { return localEndpoint('GITHUB_BASE_URL') ?? 'https://api.github.com'; }
