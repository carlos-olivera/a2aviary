import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import type { Pool } from 'pg';
import type { Config } from './config.ts';

// mcp() already composes @better-auth/oauth-provider. Registering it twice is invalid.
export function createAuth(config: Config, database: Pool) {
  return betterAuth({
    appName: 'a2aviary', baseURL: config.origin, basePath: '/api/auth', secret: config.secret, database,
    trustedOrigins: [config.origin],
    advanced: {ipAddress: {ipAddressHeaders: ['x-platform-client-ip']}},
    socialProviders: {google: {clientId: config.googleClientId, clientSecret: config.googleClientSecret}},
    emailAndPassword: {enabled: false},
    account: {accountLinking: {enabled: false}},
    session: {cookieCache: {enabled: false}, expiresIn: 60 * 60 * 24, updateAge: 60 * 60},
    rateLimit: {enabled: true, storage: 'database', window: 60, max: 100},
    disabledPaths: ['/token', '/oauth2/create-client', '/oauth2/update-client', '/oauth2/delete-client',
      '/oauth2/client/rotate-secret', '/admin/oauth2/create-client', '/admin/oauth2/update-client',
      '/oauth2/update-consent', '/oauth2/delete-consent'],
    plugins: [
      jwt({jwt: {issuer: config.issuer}, jwks: {keyPairConfig: {alg: 'ES256'}}}),
      mcp({resource: config.resource, loginPage: '/sign-in', consentPage: '/consent',
        scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
        grantTypes: ['authorization_code', 'refresh_token'], accessTokenExpiresIn: 300,
        allowDynamicClientRegistration: config.dcr, allowUnauthenticatedClientRegistration: config.dcr,
        clientRegistrationRequirePKCE: true, clientPrivileges: async () => false,
        resourcePrivileges: async () => false}),
      cimd({fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28'})
    ]
  });
}
export type Auth = ReturnType<typeof createAuth>;
