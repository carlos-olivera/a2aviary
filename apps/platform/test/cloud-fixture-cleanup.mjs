// Keep failure cleanup independent of the stage at which the fixture stopped.
export async function cleanupFixture({ enabled, saved, owner, sites, resetVerified }) {
  if (!enabled || !saved || resetVerified) return { attempted: false, resetVerified };
  try {
    const result = await sites.reset(owner.id, saved.siteId, 'RESET ' + saved.siteId);
    const site = await sites.inspect(owner.id, saved.siteId);
    if (result.reset !== true || site.lifecycle !== 'archived')
      throw new Error('fixture_reset_incomplete');
    return { attempted: true, resetVerified: true };
  } catch {
    // Provider errors may contain credentials or private records.
    return { attempted: true, resetVerified: false, errorCode: 'fixture_reset_failed' };
  }
}
