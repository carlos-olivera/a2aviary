import { SiteError } from '@a2aviary/generator';
import { requireRole, requireConfirmation } from '../identity/store.ts';

import type { SiteRow } from '../sites/deployments.ts';
import type { Sites } from '../sites/deployments.ts';

export async function reset(
  this: Sites,
  actor: string,
  siteId: string,
  confirmation: string,
) {
  // This connection-level lock prevents concurrent provider cleanup attempts;
  // lifecycle remains resetting after errors/crashes for an explicit retry.
  requireRole(await this.store.principal(actor), 'tester.reset');
  requireConfirmation(confirmation, 'RESET ' + siteId);
  const lease = await this.store.pool.connect();
  const lock = 'tester-reset:' + siteId;
  let locked = false;
  try {
    locked = (
      await lease.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [
        lock,
      ])
    ).rows[0].locked;
    if (!locked) throw new SiteError('reset_busy');
    const snapshot = await this.store.siteAction(
      actor,
      'tester.reset',
      async (c, p) => {
        const site = (
          await c.query('SELECT * FROM platform_site WHERE id=$1 FOR UPDATE', [
            siteId,
          ])
        ).rows[0] as SiteRow | undefined;
        if (!site?.test_mode) throw new SiteError('test_site_required');
        const active = await c.query(
          `SELECT 1 FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.state IN ('queued','running')`,
          [siteId],
        );
        if (active.rowCount) throw new SiteError('site_busy');
        const specs = (
          await c.query('SELECT id FROM platform_site_spec WHERE site_id=$1', [
            siteId,
          ])
        ).rows.map((r) => r.id as string);
        await c.query(
          "UPDATE platform_site SET lifecycle='resetting' WHERE id=$1 AND lifecycle<>'archived'",
          [siteId],
        );
        await c.query(
          `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
          [
            p.id,
            siteId,
            JSON.stringify({
              siteId,
              confirmation,
              result:
                site.lifecycle === 'archived' ? 'already_reset' : 'started',
              test: true,
            }),
          ],
        );
        return { site, specs };
      },
    );
    if (snapshot.site.lifecycle === 'archived')
      return { siteId, test: true, state: 'archived', reset: true };
    await this.deployer.reset(
      snapshot.site.resources,
      this.name(snapshot.site),
      true,
    );
    // Persist provider deletion before bucket deletion. A bucket failure retries
    // only remaining objects, without depending on provider not-found errors.
    await this.store.pool.query(
      "UPDATE platform_site SET resources='{}' WHERE id=$1",
      [siteId],
    );
    for (const specId of snapshot.specs)
      await this.objects.deletePrefix('specs/' + specId + '/');
    const draftIds = (
      await this.store.pool.query(
        'SELECT id FROM platform_site_draft WHERE site_id=$1',
        [siteId],
      )
    ).rows;
    for (const d of draftIds)
      await this.objects.deletePrefix('drafts/' + d.id + '/');
    await this.store.siteAction(actor, 'tester.reset', async (c, p) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + snapshot.site.owner_id,
      ]);
      const editHistory = (
        await c.query(
          'SELECT id,draft_id,state,spec_sha256,base_sha256,created_at,applied_at FROM platform_site_spec WHERE site_id=$1 AND accounting IS NOT NULL ORDER BY created_at',
          [siteId],
        )
      ).rows;
      await this.administration.event(
        c,
        { ...p, testMode: true },
        snapshot.site,
        'tester.reset.edits',
        'archived-edits',
        null,
        null,
        { editHistory },
      );
      await c.query(
        'UPDATE platform_site SET current_spec_id=NULL WHERE id=$1',
        [siteId],
      );
      await c.query(
        'DELETE FROM platform_site_job WHERE spec_id IN (SELECT id FROM platform_site_spec WHERE site_id=$1)',
        [siteId],
      );
      await c.query('DELETE FROM platform_site_spec WHERE site_id=$1', [
        siteId,
      ]);
      await c.query('DELETE FROM platform_site_draft WHERE site_id=$1', [
        siteId,
      ]);
      await c.query(
        "UPDATE platform_site SET lifecycle='archived' WHERE id=$1",
        [siteId],
      );
      await c.query(
        `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
        [
          p.id,
          siteId,
          JSON.stringify({
            siteId,
            confirmation,
            result: 'success',
            test: true,
          }),
        ],
      );
    });
    return { siteId, test: true, state: 'archived', reset: true };
  } catch (error) {
    await this.store.transaction(async (c) => {
      await c.query(
        `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
        [
          actor,
          siteId,
          JSON.stringify({
            siteId,
            confirmation,
            result: error instanceof SiteError ? error.code : 'reset_failed',
            test: true,
          }),
        ],
      );
    });
    await this.store.adminResult(
      actor,
      'tester.reset',
      error instanceof SiteError ? error.code : 'reset_failed',
      siteId,
    );
    throw error;
  } finally {
    if (locked)
      await lease.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]);
    lease.release();
  }
}
