import OpenAI from 'openai';
import { S3Client } from '@aws-sdk/client-s3';
import { BucketStore } from './storage.ts';
import { AgentsVerifier } from './verification.ts';
import { RailwayDeployer } from './deploy.ts';
export function siteRuntime(env: NodeJS.ProcessEnv = process.env) {
  if (env.SITE_WORKFLOW_ENABLED !== 'true') {
    if (env.SITE_WORKFLOW_ENABLED && env.SITE_WORKFLOW_ENABLED !== 'false')
      throw new Error('Invalid SITE_WORKFLOW_ENABLED');
    return undefined;
  }
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error('Missing ' + name);
    return value;
  };
  const key = required('SITE_CREDENTIAL_KEY');
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error(
      'SITE_CREDENTIAL_KEY must be 32 bytes encoded as lowercase hex'
    );
  const endpoint = required('SITE_BUCKET_ENDPOINT');
  if (new URL(endpoint).protocol !== 'https:')
    throw new Error('SITE_BUCKET_ENDPOINT must use HTTPS');
  const mode = required('SITE_DEPLOY_ENVIRONMENT');
  if (!['fixture', 'production'].includes(mode))
    throw new Error('Invalid SITE_DEPLOY_ENVIRONMENT');
  if (env.SITE_AI_GAPS_ENABLED && env.SITE_AI_GAPS_ENABLED !== 'false')
    throw new Error(
      'No AI gaps are approved in catalog v1; SITE_AI_GAPS_ENABLED must remain false'
    );
  const backupVariables = Object.fromEntries(
    [
      'PB_BACKUP_BUCKET',
      'PB_BACKUP_ENDPOINT',
      'PB_BACKUP_REGION',
      'PB_BACKUP_ACCESS_KEY_ID',
      'PB_BACKUP_SECRET_ACCESS_KEY'
    ].map((name) => [name, required(name)])
  );
  if (new URL(backupVariables.PB_BACKUP_ENDPOINT).protocol !== 'https:')
    throw new Error('Backup endpoint must use HTTPS');
  backupVariables.PB_BACKUP_FORCE_PATH_STYLE =
    env.PB_BACKUP_FORCE_PATH_STYLE ?? 'true';
  const protectedIds = new Set(
    required('SITE_PROTECTED_PROJECT_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  if (env.RAILWAY_PROJECT_ID) protectedIds.add(env.RAILWAY_PROJECT_ID);
  const protectedDomains = new Set(
    (env.SITE_PROTECTED_DOMAINS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (env.PLATFORM_ORIGIN)
    protectedDomains.add(new URL(env.PLATFORM_ORIGIN).hostname);
  return {
    key,
    objects: new BucketStore(
      new S3Client({
        endpoint,
        region: required('SITE_BUCKET_REGION'),
        forcePathStyle: env.SITE_BUCKET_FORCE_PATH_STYLE !== 'false',
        credentials: {
          accessKeyId: required('SITE_BUCKET_ACCESS_KEY_ID'),
          secretAccessKey: required('SITE_BUCKET_SECRET_ACCESS_KEY')
        }
      }),
      required('SITE_BUCKET_NAME')
    ),
    verifier: new AgentsVerifier(
      new OpenAI({ apiKey: required('OPENAI_API_KEY') })
    ),
    deployer: new RailwayDeployer({
      apiToken: required('RAILWAY_API_TOKEN'),
      workspaceId: required('SITE_RAILWAY_WORKSPACE_ID'),
      protectedProjectIds: protectedIds,
      protectedDomains,
      test: mode === 'fixture',
      backupVariables
    })
  };
}
