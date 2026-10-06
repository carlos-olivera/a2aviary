// Only server-defined audit fields are returned. Arbitrary detail strings and
// unknown fields are discarded, including credentials accidentally persisted
// by a future caller. Raw provider/HTTP logs are never part of logs.query.
const results = new Set([
  'success',
  'pass',
  'fail',
  'accepted',
  'duplicate',
  'queued',
  'cached',
  'applied',
  'reserved',
  'read',
  'updated',
  'started',
  'already_reset',
  'revoked',
  'already_revoked',
  'forbidden',
  'confirmation_required',
  'reserved_identity',
  'invited_admin_required',
  'test_site_required',
  'test_reset_unconfirmed',
  'test_custom_domain_forbidden',
  'site_busy',
  'reset_busy',
  'reset_failed',
  'asset_reset_failed',
  'asset_reset_incomplete',
  'site_resetting',
  'site_archived',
  'site_mode_mismatch',
  'invalid_log_range',
  'operation_failed',
  'submission_failed',
  'owned_site_required',
  'owned_spec_required',
  'invalid_spec',
  'invalid_assets',
  'invalid_change',
  'candidate_digest_mismatch',
  'candidate_site_mismatch',
  'verified_build_required',
  'approved_change_required',
  'stale_change_base',
  'pending_change_required',
  'live_site_required',
  'spec_busy',
  'deployment_busy',
  'deployment_failed',
  'deployment_outcome_unknown',
  'verification_failed',
  'worker_interrupted',
  'request_rate_limited'
]);
export function redactedAudit(
  row: Record<string, any>,
  tools: Readonly<Record<string, unknown>>
) {
  const details: Record<string, unknown> = {};
  const d = row.details ?? {};
  for (const key of [
    'specSha256',
    'sourceSha256',
    'outputSha256',
    'thumbprint'
  ])
    if (
      typeof d[key] === 'string' &&
      (key === 'thumbprint' ? /^[a-zA-Z0-9_-]{43}$/ : /^[a-f0-9]{64}$/).test(d[key])
    )
      details[key] = d[key];
  for (const key of ['role', 'previousRole'])
    if (['client', 'tester', 'admin', 'superadmin', null].includes(d[key]))
      details[key] = d[key];
  for (const key of ['siteId', 'specId'])
    if (typeof d[key] === 'string' && /^[a-f0-9-]{36}$/.test(d[key]))
      details[key] = d[key];
  if (typeof d.tool === 'string' && Object.hasOwn(tools, d.tool))
    details.tool = d.tool;
  if (results.has(d.result)) details.result = d.result;
  if (['build', 'deploy'].includes(d.kind)) details.kind = d.kind;
  for (const key of ['limit', 'count'])
    if (Number.isSafeInteger(d[key]) && d[key] >= 0) details[key] = d[key];
  if (
    typeof d.confirmation === 'string' &&
    /^RESET [a-f0-9-]{36}$/.test(d.confirmation)
  )
    details.confirmation = d.confirmation;
  if (typeof d.test === 'boolean') details.test = d.test;
  // action/target are server-controlled identifiers, not caller/provider dumps.
  return { ...row, details, test: row.testMode ?? row.test_mode ?? false };
}
