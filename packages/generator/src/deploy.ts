import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SiteError } from './render.ts';
import { sha256 } from '../../../services/src/site/policy.ts';
import { safePath, type VerifiedBuild } from './verification.ts';
import {
  pocketBaseMigration,
  pocketBaseBootstrap,
  pocketBaseDockerfile,
  cmsEditorHtml,
  cmsEditorScript
} from './pocketbase.ts';
import {railwayUsage, type SiteUsage} from './costs.ts';
import type { SiteSpec } from '../../../services/src/site/types.ts';
export interface SiteResources {
  projectId?: string;
  environmentId?: string;
  webServiceId?: string;
  cmsServiceId?: string;
  volumeId?: string;
  domain?: string;
  domainId?: string;
  customDomain?: string;
  customDomainId?: string;
  cmsConfigured?: boolean;
  test?: boolean;
}
export interface DeploymentInput {
  name: string;
  spec: SiteSpec;
  build: VerifiedBuild;
  resources: SiteResources;
  clientEmail: string;
  clientPassword: string;
  domain?: string;
  test?: boolean;
  saveResources: (value: SiteResources) => Promise<void>;
}
export interface SiteDeployer {
  usage(resources: SiteResources, name: string, period: string, test?: boolean): Promise<SiteUsage>;
  deploy(input: DeploymentInput): Promise<SiteResources>;
  status(
    resources: SiteResources,
    name: string,
    test?: boolean
  ): Promise<unknown>;
  reset(resources: SiteResources, name: string, test: boolean): Promise<void>;
}
export interface RailwayOptions {
  apiToken: string;
  workspaceId: string;
  protectedProjectIds: ReadonlySet<string>;
  protectedDomains?: ReadonlySet<string>;
  test: boolean;
  backupVariables: Record<string, string>;
  cliPath?: string;
}
type Graphql = (
  query: string,
  variables: Record<string, unknown>
) => Promise<any>;
export class RailwayDeployer implements SiteDeployer {
  private readonly options: RailwayOptions;
  private readonly query: Graphql;
  constructor(options: RailwayOptions, query?: Graphql) {
    this.options = options;
    this.query =
      query ??
      (async (query, variables) => {
        const response = await fetch(
          'https://backboard.railway.com/graphql/v2',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + options.apiToken,
              'content-type': 'application/json'
            },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.timeout(30000)
          }
        );
        if (!response.ok) throw new SiteError('railway_request_failed');
        const r = (await response.json()) as any;
        if (r.errors?.length || !r.data)
          throw new SiteError('railway_request_failed');
        return r.data;
      });
  }
  private async guard(
    resources: SiteResources,
    name: string,
    test = false,
    allowMissing = false
  ) {
    if (
      !resources.projectId ||
      this.options.protectedProjectIds.has(resources.projectId)
    )
      throw new SiteError('protected_project');
    if (!/^cli-[0-9]{3,}-[a-z][a-z0-9-]{0,63}$/.test(name))
      throw new SiteError('invalid_project_name');
    const p = (
      await this.query(
        'query($id:String!){project(id:$id){name workspaceId environments{edges{node{id name}}} services{edges{node{id name}}}}}',
        { id: resources.projectId }
      )
    ).project;
    if (!p && allowMissing) return false;
    if (!p) throw new SiteError('deployment_target_missing');
    if (
      p.name !== name ||
      p.workspaceId !== this.options.workspaceId ||
      !p.environments.edges.some(
        (e: any) =>
          e.node.id === resources.environmentId &&
          e.node.name === (test || this.options.test ? 'fixture' : 'production')
      )
    )
      throw new SiteError('deployment_target_mismatch');
    if (
      test &&
      (p.environments.edges.length !== 1 ||
        p.services.edges.some(
          (e: any) =>
            !(
              (e.node.id === resources.webServiceId && e.node.name === 'web') ||
              (e.node.id === resources.cmsServiceId && e.node.name === 'cms')
            )
        ))
    )
      throw new SiteError('test_project_not_isolated');
    for (const [id, expected] of [
      [resources.webServiceId, 'web'],
      [resources.cmsServiceId, 'cms']
    ])
      if (
        id &&
        !p.services.edges.some(
          (e: any) => e.node.id === id && e.node.name === expected
        )
      )
        throw new SiteError('deployment_service_mismatch');
    return true;
  }
  async usage(resources: SiteResources, name: string, period: string, test = false): Promise<SiteUsage> {
    if(!/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(period))throw new SiteError('invalid_report_period');
    await this.guard(resources,name,test);
    return railwayUsage(this.options.cliPath ?? fileURLToPath(new URL('./bin/railway',import.meta.url)),this.options.apiToken,this.options.workspaceId,resources,period);
  }
  async deploy(input: DeploymentInput): Promise<SiteResources> {
    const test = input.test === true;
    const r = { ...input.resources };
    if (test && (input.domain || r.customDomain || r.customDomainId))
      throw new SiteError('test_custom_domain_forbidden');
    if (r.test !== undefined && r.test !== test)
      throw new SiteError('deployment_test_mismatch');
    r.test = test;
    if (
      input.domain &&
      (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        input.domain
      ) ||
        input.domain.length > 253 ||
        ['a2aviary.io', ...(this.options.protectedDomains ?? [])].some(
          (d) => input.domain === d || input.domain!.endsWith('.' + d)
        ))
    )
      throw new SiteError('protected_or_invalid_domain');
    if (r.customDomain && input.domain && r.customDomain !== input.domain)
      throw new SiteError('domain_change_unsupported');
    if (!r.projectId) {
      if (!/^cli-[0-9]{3,}-[a-z][a-z0-9-]{0,63}$/.test(input.name))
        throw new SiteError('invalid_project_name');
      const p = (
        await this.query(
          'mutation($input:ProjectCreateInput!){projectCreate(input:$input){id environments{edges{node{id name}}}}}',
          {
            input: {
              name: input.name,
              workspaceId: this.options.workspaceId,
              isPublic: false,
              prDeploys: false,
              defaultEnvironmentName:
                test || this.options.test ? 'fixture' : 'production',
              description: test
                ? 'a2aviary test=true catalog site'
                : 'a2aviary managed catalog site'
            }
          }
        )
      ).projectCreate;
      r.projectId = p.id;
      r.environmentId = p.environments.edges.find(
        (e: any) =>
          e.node.name === (test || this.options.test ? 'fixture' : 'production')
      )?.node.id;
      if (!r.environmentId) throw new SiteError('railway_environment_missing');
      await input.saveResources(r);
    }
    await this.guard(r, input.name, test);
    for (const [key, name] of [
      ['webServiceId', 'web'],
      ['cmsServiceId', 'cms']
    ] as const)
      if (!r[key]) {
        const service = (
          await this.query(
            'mutation($input:ServiceCreateInput!){serviceCreate(input:$input){id}}',
            { input: { projectId: r.projectId, name } }
          )
        ).serviceCreate;
        r[key] = service.id;
        await input.saveResources(r);
      }
    await this.guard(r, input.name, test);
    if (!r.volumeId) {
      r.volumeId = (
        await this.query(
          'mutation($input:VolumeCreateInput!){volumeCreate(input:$input){id}}',
          {
            input: {
              projectId: r.projectId,
              environmentId: r.environmentId,
              serviceId: r.cmsServiceId,
              mountPath: '/pb/pb_data'
            }
          }
        )
      ).volumeCreate.id;
      await input.saveResources(r);
    }
    for (const [serviceId, healthcheckPath] of [
      [r.webServiceId, '/healthz'],
      [r.cmsServiceId, '/api/health']
    ]) {
      await this.query(
        'mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$serviceId,environmentId:$environmentId,input:$input)}',
        {
          serviceId,
          environmentId: r.environmentId,
          input: {
            numReplicas: 1,
            healthcheckPath,
            healthcheckTimeout: 120,
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 3
          }
        }
      );
      await this.query(
        'mutation($input:ServiceInstanceLimitsUpdateInput!){serviceInstanceLimitsUpdate(input:$input)}',
        {
          input: {
            serviceId,
            environmentId: r.environmentId,
            vCPUs: 1,
            memoryGB: 0.5
          }
        }
      );
    }
    // No client-supplied endpoint or admin secret reaches these variables. No variable values are logged.
    if (!r.cmsConfigured) {
      await this.variables(r, r.cmsServiceId!, {
        PORT: '8090',
        A2AVIARY_TEST_MODE: String(test),
        PB_ADMIN_EMAIL: 'cms-admin@internal.invalid',
        PB_ADMIN_PASSWORD: randomBytes(32).toString('base64url'),
        PB_CLIENT_EMAIL: input.clientEmail,
        PB_CLIENT_PASSWORD: input.clientPassword,
        PB_ENCRYPTION_KEY: randomBytes(16).toString('hex'),
        GOMEMLIMIT: '384MiB',
        ...this.options.backupVariables
      });
      r.cmsConfigured = true;
      await input.saveResources(r);
    }
    await this.variables(r, r.webServiceId!, {
      PORT: '8080',
      A2AVIARY_TEST_MODE: String(test),
      CMS_UPSTREAM: 'cms.railway.internal:8090'
    });
    const directory = await mkdtemp(join(tmpdir(), 'a2aviary-deploy-'));
    try {
      const web = join(directory, 'web'),
        cms = join(directory, 'cms');
      await mkdir(web, { recursive: true });
      await mkdir(cms, { recursive: true });
      for (const [path, data] of Object.entries(input.build.files)) {
        if (!safePath(path)) throw new SiteError('unsafe_build_artifact');
        const file = join(web, 'site', path);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, Buffer.from(data, 'base64'));
      }
      await writeFile(join(web, 'Dockerfile'), caddyDockerfile);
      await writeFile(join(web, 'Caddyfile'), caddyfile(input.spec));
      await writeFile(join(web, 'railway.json'), railwayConfig('/healthz'));
      await mkdir(join(cms, 'pb_migrations'));
      await mkdir(join(cms, 'pb_hooks'));
      await mkdir(join(cms, 'pb_public'));
      await writeFile(join(cms, 'Dockerfile'), pocketBaseDockerfile);
      await writeFile(join(cms, 'railway.json'), railwayConfig('/api/health'));
      await writeFile(
        join(
          cms,
          'pb_migrations',
          '2-' + input.build.report.specSha256 + '.js'
        ),
        pocketBaseMigration(input.spec)
      );
      await writeFile(
        join(cms, 'pb_hooks', 'bootstrap.pb.js'),
        pocketBaseBootstrap
      );
      await writeFile(join(cms, 'pb_public', 'editor.html'), cmsEditorHtml());
      await writeFile(
        join(cms, 'pb_public', 'editor.js'),
        cmsEditorScript(input.spec)
      );
      const cmsDeployment = await this.upload(cms, r, r.cmsServiceId!);
      await this.waitHealthy(r, r.cmsServiceId!, cmsDeployment);
      const webDeployment = await this.upload(web, r, r.webServiceId!);
      await this.waitHealthy(r, r.webServiceId!, webDeployment);
      if (!r.domain) {
        const d = (
          await this.query(
            'mutation($input:ServiceDomainCreateInput!){serviceDomainCreate(input:$input){id domain}}',
            {
              input: {
                serviceId: r.webServiceId,
                environmentId: r.environmentId,
                targetPort: 8080
              }
            }
          )
        ).serviceDomainCreate;
        r.domain = d.domain;
        r.domainId = d.id;
        await input.saveResources(r);
      }
      if (input.domain && !r.customDomain) {
        const d = (
          await this.query(
            'mutation($input:CustomDomainCreateInput!){customDomainCreate(input:$input){id domain}}',
            {
              input: {
                projectId: r.projectId,
                serviceId: r.webServiceId,
                environmentId: r.environmentId,
                targetPort: 8080,
                domain: input.domain
              }
            }
          )
        ).customDomainCreate;
        r.customDomain = d.domain;
        r.customDomainId = d.id;
        await input.saveResources(r);
      }
      await this.waitPublic(r.domain!, input.build);
      return r;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  async reset(resources: SiteResources, name: string, test: boolean) {
    if (
      !test ||
      resources.test === false ||
      resources.customDomain ||
      resources.customDomainId
    )
      throw new SiteError('test_site_required');
    if (!resources.projectId) return;
    // Never infer absence from access errors; only an explicit null project is
    // an idempotent success. Workspace/name/fixture/service guards precede delete.
    if (!(await this.guard(resources, name, true, true))) return;
    const result = await this.query(
      'mutation($id:String!){projectDelete(id:$id)}',
      { id: resources.projectId }
    );
    if (result.projectDelete !== true)
      throw new SiteError('test_reset_unconfirmed');
  }
  private async variables(
    r: SiteResources,
    serviceId: string,
    variables: Record<string, string>
  ) {
    await this.query(
      'mutation($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}',
      {
        input: {
          projectId: r.projectId,
          environmentId: r.environmentId,
          serviceId,
          variables,
          replace: false,
          skipDeploys: true
        }
      }
    );
  }
  private async upload(directory: string, r: SiteResources, serviceId: string) {
    const cli =
      this.options.cliPath ??
      fileURLToPath(new URL('./bin/railway', import.meta.url));
    try {
      const uploaded = await promisify(execFile)(
        cli,
        [
          'up',
          directory,
          '--path-as-root',
          '--project',
          r.projectId!,
          '--environment',
          r.environmentId!,
          '--service',
          serviceId,
          '--detach',
          '--json'
        ],
        {
          cwd: directory,
          timeout: 180000,
          maxBuffer: 1024 * 1024,
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            RAILWAY_API_TOKEN: this.options.apiToken,
            CI: 'true'
          }
        }
      );
      const result = JSON.parse(uploaded.stdout);
      if (typeof result.deploymentId !== 'string' || !result.deploymentId)
        throw new Error('Missing deployment identifier');
      return result.deploymentId;
    } catch {
      throw new SiteError('deployment_outcome_unknown');
    }
  }
  private async waitHealthy(
    r: SiteResources,
    serviceId: string,
    deploymentId: string
  ) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const d = await this.query(
        'query($input:DeploymentListInput!){deployments(input:$input,first:1){edges{node{id status}}}}',
        {
          input: {
            projectId: r.projectId,
            environmentId: r.environmentId,
            serviceId
          }
        }
      );
      const deployment = d.deployments.edges[0]?.node;
      const status =
        deployment?.id === deploymentId ? deployment.status : undefined;
      if (status === 'SUCCESS') return;
      if (['FAILED', 'CRASHED', 'REMOVED'].includes(status))
        throw new SiteError('deployment_failed');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new SiteError('deployment_outcome_unknown');
  }
  private async waitPublic(domain: string, build: VerifiedBuild) {
    if (!/^[a-z0-9-]+\.up\.railway\.app$/.test(domain))
      throw new SiteError('deployment_outcome_unknown');
    const expected = sha256(Buffer.from(build.files['index.html'], 'base64')),
      deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch('https://' + domain + '/', {
          redirect: 'error',
          signal: AbortSignal.timeout(15000)
        });
        if (
          response.ok &&
          sha256(Buffer.from(await response.arrayBuffer())) === expected
        )
          return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new SiteError('deployment_outcome_unknown');
  }
  async status(resources: SiteResources, name: string, test = false) {
    await this.guard(resources, name, test);
    return this.query(
      'query($projectId:String!,$environmentId:String!,$serviceId:String!){domains(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId){serviceDomains{id domain} customDomains{id domain status{verificationToken certificateStatus dnsRecords{hostlabel requiredValue currentValue status}}}}}',
      {
        projectId: resources.projectId,
        environmentId: resources.environmentId,
        serviceId: resources.webServiceId
      }
    );
  }
}
export const caddyDockerfile =
  'FROM caddy:2.11.2-alpine\nCOPY site /srv\nCOPY Caddyfile /etc/caddy/Caddyfile\nEXPOSE 8080\n';
export const railwayConfig = (healthcheckPath: string) =>
  JSON.stringify(
    {
      $schema: 'https://railway.com/railway.schema.json',
      build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
      deploy: {
        healthcheckPath,
        healthcheckTimeout: 120,
        numReplicas: 1,
        restartPolicyType: 'ON_FAILURE',
        restartPolicyMaxRetries: 3,
        limitOverride: { containers: { cpu: 1, memoryBytes: 500000000 } }
      }
    },
    null,
    2
  ) + '\n';
export function caddyfile(spec: SiteSpec): string {
  const collections = [
    ...new Set(
      spec.pages.flatMap((p) =>
        p.sections.flatMap((s) =>
          s.blocks
            .filter((b) =>
              ['catalog', 'blog', 'announcements'].includes(b.component)
            )
            .map((b) => String(b.props.collection))
        )
      )
    )
  ];
  return `{ admin off\n auto_https off\n}\n:{$PORT:8080} {\n root * /srv\n header {\n X-Content-Type-Options nosniff\n Referrer-Policy no-referrer\n Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"\n Strict-Transport-Security "max-age=31536000"\n }\n handle /healthz {\n respond 200\n }\n @cms path /api/cms/editor.html /api/cms/editor.js /api/cms/api/collections/editors/auth-with-password ${collections.map((c) => '/api/cms/api/collections/' + c + '/records*').join(' ')}\n handle @cms {\n uri strip_prefix /api/cms\n reverse_proxy {$CMS_UPSTREAM}\n }\n handle /api/* {\n respond 404\n }\n handle {\n try_files {path} {path}/index.html =404\n file_server\n }\n handle_errors {\n rewrite * /404.html\n file_server\n }\n}\n`;
}
