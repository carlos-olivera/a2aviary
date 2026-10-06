export interface Config {
  origin: string; resource: string; issuer: string; databaseUrl: string;
  secret: string; googleClientId: string; googleClientSecret: string;
  superadminEmail: string; testerEmails: ReadonlySet<string>; dcr: boolean; port: number;
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const origin = required('PLATFORM_ORIGIN');
  const url = new URL(origin);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== origin || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) throw new Error('PLATFORM_ORIGIN must be a bare HTTPS origin (HTTP loopback allowed for development)');
  if (!loopback && origin !== 'https://mcp.a2aviary.io') throw new Error('Production origin must be https://mcp.a2aviary.io');
  const secret = required('BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  const superadminEmail = required('PLATFORM_SUPERADMIN_EMAIL').toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.test(superadminEmail)) throw new Error('Invalid PLATFORM_SUPERADMIN_EMAIL');
  const testerEmails = new Set((env.PLATFORM_TESTER_EMAILS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
  if ([...testerEmails].some(v => !email.test(v)) || testerEmails.has(superadminEmail)) throw new Error('Invalid tester allowlist');
  if (env.OAUTH_ENABLE_DCR && !['true', 'false'].includes(env.OAUTH_ENABLE_DCR)) throw new Error('OAUTH_ENABLE_DCR must be true or false');
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {origin, resource: `${origin}/mcp`, issuer: `${origin}/api/auth`, databaseUrl: required('DATABASE_URL'), secret,
    googleClientId: required('GOOGLE_CLIENT_ID'), googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    superadminEmail, testerEmails, dcr: env.OAUTH_ENABLE_DCR === 'true', port};
}
