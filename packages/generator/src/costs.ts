import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SiteResources } from './deploy.ts';

export interface SiteUsage {
  currency: 'USD';
  period: string;
  status: 'available' | 'unavailable';
  basis: 'provider-accrued' | 'unavailable';
  amount: number | null;
  reason?: string;
  breakdown?: Record<string, number>;
  providerBillingPeriod?: unknown;
  metrics: Record<string, unknown> | null;
  metricsStatus: 'available' | 'unavailable';
}
/** Only read recorded catalog resources. Provider gaps never become guessed bills. */
export async function railwayUsage(
  cli: string,
  token: string,
  workspaceId: string,
  r: SiteResources,
  period: string
): Promise<SiteUsage> {
  const directory = await mkdtemp(join(tmpdir(), 'a2aviary-costs-'));
  const run = async (args: string[]) =>
    JSON.parse(
      (
        await promisify(execFile)(cli, args, {
          cwd: directory,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            RAILWAY_API_TOKEN: token,
            CI: 'true'
          }
        })
      ).stdout
    );
  const result: SiteUsage = {
    currency: 'USD',
    period,
    status: 'unavailable',
    basis: 'unavailable',
    amount: null,
    reason: 'provider_usage_unavailable',
    metrics: null,
    metricsStatus: 'unavailable'
  };
  const serviceIds = [
    ...new Set(
      [r.webServiceId, r.cmsServiceId].filter((id): id is string => Boolean(id))
    )
  ];
  try {
    try {
      const u = await run([
        'usage',
        'projects',
        '--workspace',
        workspaceId,
        '--project',
        r.projectId!,
        '--period',
        period,
        '--json'
      ]);
      if (
        u.workspace?.id !== workspaceId ||
        u.project?.id !== r.projectId ||
        !serviceIds.length
      )
        throw Error();
      const names = [
        'cpuDollars',
        'memoryDollars',
        'egressDollars',
        'volumeDollars',
        'backupDollars'
      ];
      const services = serviceIds.map((id) =>
        u.services?.find((s: any) => s.id === id)
      );
      if (
        services.some(
          (s) =>
            !s ||
            [...names, 'totalDollars'].some(
              (k) =>
                typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0
            )
        )
      )
        throw Error();
      const breakdown = Object.fromEntries(
        names.map((k) => [k, services.reduce((sum, s) => sum + s[k], 0)])
      );
      const total = services.reduce((sum, s) => sum + s.totalDollars, 0);
      if (
        !Number.isFinite(total) ||
        Object.values(breakdown).some((n) => !Number.isFinite(n))
      )
        throw Error();
      result.breakdown = breakdown;
      result.amount = total;
      result.status = 'available';
      result.basis = 'provider-accrued';
      delete result.reason;
      result.providerBillingPeriod = u.billingPeriod;
    } catch {
      /* Missing or unbound service usage is unavailable for the whole site. */
    }
    const metrics: Record<string, unknown> = {};
    for (const id of serviceIds) {
      try {
        const m = await run([
          'metrics',
          '--project',
          r.projectId!,
          '--environment',
          r.environmentId!,
          '--service',
          id,
          '--since',
          '1d',
          '--cpu',
          '--memory',
          '--network',
          '--json'
        ]);
        const allowed = ['cpu', 'memory', 'public_network_traffic', 'window'];
        metrics[id] = Object.fromEntries(
          allowed.filter((k) => m[k] !== undefined).map((k) => [k, m[k]])
        );
      } catch {
        /* Preserve successful service observations independently. */
      }
    }
    if (
      Object.values(metrics).some((m) =>
        Object.keys(m as object).some((k) => k !== 'window')
      )
    ) {
      result.metrics = metrics;
      result.metricsStatus = 'available';
    }
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
