import { archivedEditHistory } from './edit-history.ts';
import type { SiteAdministration } from '../admin/site-administration.ts';

export async function report(
  this: SiteAdministration,
  actor: string,
  siteId: string,
  period: string,
) {
  this.period(period);
  return this.action(actor, 'site.report', async (c, p) => {
    const site = await this.access(c, p, siteId, true);
    const from = period + '-01T00:00:00Z',
      to = new Date(
        Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1),
      ).toISOString();
    const operations = (
      await c.query(
        'SELECT id::text,actor_id AS "actorId",kind,result,spec_id AS "specId",job_id AS "jobId",billing_snapshot AS billing,details,created_at AS "createdAt" FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY id DESC LIMIT 1000',
        [siteId, from, to],
      )
    ).rows;
    const summary = (
      await c.query(
        'SELECT kind,result,count(*)::int AS count FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 GROUP BY kind,result',
        [siteId, from, to],
      )
    ).rows;
    const costs =
      (
        await c.query(
          'SELECT data,collected_at AS "collectedAt" FROM platform_site_cost WHERE site_id=$1 AND period=$2 ORDER BY observed_date DESC LIMIT 1',
          [siteId, period],
        )
      ).rows[0] ?? null;
    const eligibility = (
      await c.query(
        'SELECT id::text,eligible,owner_role AS "ownerRole",reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 AND effective_at<$3 AND (effective_at>=$2 OR id=(SELECT max(id) FROM platform_site_billing WHERE site_id=$1 AND effective_at<$2)) ORDER BY id',
        [siteId, from, to],
      )
    ).rows;
    const legacy = (
      await c.query(
        'SELECT j.kind,j.state,count(*)::int AS count FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.created_at>=$2 AND j.created_at<$3 GROUP BY j.kind,j.state',
        [siteId, from, to],
      )
    ).rows;
    const archivedEdits = await archivedEditHistory(c, siteId);
    const inPeriod = (value: unknown) =>
      Boolean(value) &&
      new Date(value as string).getTime() >= Date.parse(from) &&
      new Date(value as string).getTime() < Date.parse(to);
    const changes = (
      await c.query(
        'SELECT count(*)::int AS count FROM platform_site_spec WHERE site_id=$1 AND accounting IS NOT NULL AND applied_at>=$2 AND applied_at<$3',
        [siteId, from, to],
      )
    ).rows[0].count;
    const billing = await this.billing(c, site);
    await this.event(c, p, site, 'site.report', 'read');
    return {
      siteId,
      period,
      currency: 'USD',
      billing,
      eligibility,
      summary,
      operations,
      operationsTruncated: operations.length === 1000,
      catalogJobs: legacy,
      appliedChanges:
        changes + archivedEdits.filter((e) => inPeriod(e.appliedAt)).length,
      editHistory: [
        ...archivedEdits.filter(
          (e) => inPeriod(e.createdAt) || inPeriod(e.appliedAt),
        ),
        ...(
          await c.query(
            'SELECT id AS "specId",draft_id AS "draftId",state,base_sha256 AS "baseSha256",spec_sha256 AS "specSha256",applied_at AS "appliedAt",reserved FROM platform_site_spec WHERE site_id=$1 AND accounting IS NOT NULL AND (created_at >= $2 AND created_at < $3 OR applied_at >= $2 AND applied_at < $3) ORDER BY created_at DESC LIMIT 1000',
            [siteId, from, to],
          )
        ).rows,
      ],
      costs: costs ?? {
        data: {
          status: 'unavailable',
          basis: 'unavailable',
          amount: null,
          reason: 'not_collected',
        },
        collectedAt: null,
      },
      verificationCost: {
        status: 'unavailable',
        amount: null,
        reason: 'provider_verification_cost_not_reported',
      },
      storageCost: {
        status: 'unavailable',
        amount: null,
        reason: 'shared_bucket_not_allocated',
      },
      sharedPlatformOverhead: { status: 'unallocated', amount: null },
      csvUrl: '/api/site-reports/' + siteId + '/' + period + '.csv',
    };
  });
}

export async function csv(
  this: SiteAdministration,
  actor: string,
  siteId: string,
  period: string,
) {
  const r = await this.report(actor, siteId, period);
  const escape = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      'record',
      'site_id',
      'period',
      'time',
      'kind',
      'result',
      'actor_id',
      'spec_id',
      'billing_eligible',
      'cost_usd',
      'basis',
    ],
    [
      'cost',
      siteId,
      period,
      r.costs.collectedAt,
      'railway',
      r.costs.data.status,
      '',
      '',
      r.billing.eligible,
      r.costs.data.amount,
      r.costs.data.basis,
    ],
    [
      'cost',
      siteId,
      period,
      '',
      'verification',
      'unavailable',
      '',
      '',
      '',
      null,
      'unavailable',
    ],
    [
      'cost',
      siteId,
      period,
      '',
      'storage',
      'unavailable',
      '',
      '',
      '',
      null,
      'unavailable',
    ],
    [
      'cost',
      siteId,
      period,
      '',
      'shared-platform',
      'unallocated',
      '',
      '',
      '',
      null,
      'unallocated',
    ],
  ];
  for (const [kind, amount] of Object.entries(r.costs.data.breakdown ?? {}))
    rows.push([
      'provider-cost-component',
      siteId,
      period,
      r.costs.collectedAt,
      kind,
      r.costs.data.status,
      '',
      '',
      '',
      amount,
      r.costs.data.basis,
    ]);
  for (const [kind, data] of Object.entries(r.costs.data.metrics ?? {}))
    rows.push([
      'resource-usage',
      siteId,
      period,
      r.costs.collectedAt,
      kind,
      r.costs.data.metricsStatus,
      '',
      '',
      '',
      '',
      JSON.stringify(data),
    ]);
  if (r.costs.data.providerBillingPeriod)
    rows.push([
      'provider-period',
      siteId,
      period,
      r.costs.collectedAt,
      'billing-period',
      r.costs.data.status,
      '',
      '',
      '',
      '',
      JSON.stringify(r.costs.data.providerBillingPeriod),
    ]);
  for (const j of r.catalogJobs)
    rows.push([
      'catalog-jobs',
      siteId,
      period,
      '',
      j.kind,
      j.state,
      '',
      '',
      '',
      '',
      String(j.count),
    ]);
  rows.push([
    'applied-changes',
    siteId,
    period,
    '',
    'changes',
    'applied',
    '',
    '',
    '',
    '',
    String(r.appliedChanges),
  ]);
  for (const o of r.operations)
    rows.push([
      'operation',
      siteId,
      period,
      o.createdAt,
      o.kind,
      o.result,
      o.actorId,
      o.specId,
      o.billing.eligible,
      '',
      '',
    ]);
  for (const e of r.eligibility)
    rows.push([
      'eligibility',
      siteId,
      period,
      e.effectiveAt,
      e.ownerRole,
      e.reason,
      '',
      '',
      e.eligible,
      '',
      '',
    ]);
  return rows.map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
}
