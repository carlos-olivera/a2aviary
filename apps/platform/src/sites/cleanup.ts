import type { Drafts } from './drafts.ts';

export async function cleanup(this: Drafts) {
  const pool = this.sites.store.pool;
  const expired = (
    await pool.query(
      "UPDATE platform_site_draft SET state='expired' WHERE id IN (SELECT d.id FROM platform_site_draft d WHERE state='active' AND (expires_at<=now() OR created_at<=now()-interval '30 days') AND NOT EXISTS(SELECT 1 FROM platform_site_job j JOIN platform_site_spec p ON p.id=j.spec_id WHERE p.draft_id=d.id AND j.state IN ('running','queued','unknown')) LIMIT 100) RETURNING id",
    )
  ).rows;
  for (const d of expired)
    await pool.query(
      'UPDATE platform_upload_session SET revoked=true WHERE draft_id=$1',
      [d.id],
    );
  const snapshots = (
    await pool.query(
      "SELECT p.id,p.site_id FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.expires_at<=now() AND NOT p.artifacts_deleted AND p.state NOT IN ('live','deploying','unknown') AND s.current_spec_id IS DISTINCT FROM p.id AND NOT EXISTS(SELECT 1 FROM platform_site_job j WHERE j.spec_id=p.id AND j.state IN ('queued','running','unknown')) ORDER BY p.expires_at LIMIT 20",
    )
  ).rows;
  for (const p of snapshots)
    await this.sites.store.transaction(async (c) => {
      if (
        !(
          await c.query(
            'SELECT id FROM platform_site WHERE id=$1 FOR UPDATE SKIP LOCKED',
            [p.site_id],
          )
        ).rowCount
      )
        return;
      const eligible = await c.query(
        "SELECT p.id FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.id=$1 AND p.expires_at<=now() AND NOT p.artifacts_deleted AND p.state NOT IN ('live','deploying','unknown') AND s.current_spec_id IS DISTINCT FROM p.id AND NOT EXISTS(SELECT 1 FROM platform_site_job j WHERE j.spec_id=p.id AND j.state IN ('queued','running','unknown')) FOR UPDATE OF p SKIP LOCKED",
        [p.id],
      );
      if (!eligible.rowCount) return;
      await this.sites.objects.deletePrefix('specs/' + p.id + '/');
      await c.query(
        "UPDATE platform_site_spec SET artifacts_deleted=true,state=CASE WHEN state='failed' THEN state ELSE 'superseded' END WHERE id=$1",
        [p.id],
      );
    });
  const drafts = (
    await pool.query(
      "SELECT id FROM platform_site_draft WHERE state IN ('expired','discarded','completed') AND NOT artifacts_deleted ORDER BY expires_at LIMIT 20",
    )
  ).rows;
  for (const d of drafts) {
    await this.sites.objects.deletePrefix('drafts/' + d.id + '/');
    await pool.query(
      'UPDATE platform_site_draft SET artifacts_deleted=true WHERE id=$1',
      [d.id],
    );
    await pool.query(
      'UPDATE platform_asset_staging SET cleaned_at=now() WHERE draft_id=$1 AND cleaned_at IS NULL',
      [d.id],
    );
  }
  const orphaned = (
    await pool.query(
      "SELECT a.prefix FROM platform_artifact_prefix a WHERE a.cleaned_at IS NULL AND a.created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM platform_site_spec p WHERE a.prefix='specs/'||p.id||'/') AND NOT EXISTS(SELECT 1 FROM platform_site_draft d WHERE a.prefix='drafts/'||d.id||'/') ORDER BY created_at LIMIT 20",
    )
  ).rows;
  for (const a of orphaned) {
    await this.sites.objects.deletePrefix(a.prefix);
    await pool.query(
      'UPDATE platform_artifact_prefix SET cleaned_at=now() WHERE prefix=$1',
      [a.prefix],
    );
  }
  const staged = (
    await pool.query(
      "SELECT * FROM platform_asset_staging a WHERE cleaned_at IS NULL AND (discarded OR created_at<now()-interval '24 hours') AND NOT EXISTS(SELECT 1 FROM platform_site_draft d WHERE d.id=a.draft_id AND d.state='active' AND d.content->'assets' @>jsonb_build_array(jsonb_build_object('id',a.asset_id))) ORDER BY created_at LIMIT 20",
    )
  ).rows;
  for (const asset of staged)
    await this.sites.store.transaction(async (c) => {
      const draft = (
        await c.query('SELECT site_id FROM platform_site_draft WHERE id=$1', [
          asset.draft_id,
        ])
      ).rows[0];
      if (
        draft &&
        !(
          await c.query(
            'SELECT id FROM platform_site WHERE id=$1 FOR UPDATE SKIP LOCKED',
            [draft.site_id],
          )
        ).rowCount
      )
        return;
      if (
        (
          await c.query(
            "SELECT 1 FROM platform_site_draft WHERE id=$1 AND state='active' AND content->'assets' @>jsonb_build_array(jsonb_build_object('id',$2::text))",
            [asset.draft_id, asset.asset_id],
          )
        ).rowCount
      )
        return;
      await this.sites.objects.deletePrefix(asset.key);
      await c.query(
        'UPDATE platform_asset_staging SET cleaned_at=now() WHERE key=$1',
        [asset.key],
      );
    });
  await pool.query(
    'DELETE FROM platform_upload_session WHERE id IN (SELECT id FROM platform_upload_session WHERE revoked OR expires_at<=now() ORDER BY created_at LIMIT 100)',
  );
  await pool.query(
    'DELETE FROM platform_browser_nonce WHERE hash IN (SELECT hash FROM platform_browser_nonce WHERE expires_at<=now() LIMIT 500)',
  );
  await pool.query(
    "DELETE FROM platform_site_quota WHERE id IN (SELECT id FROM platform_site_quota WHERE created_at<=now()-interval '31 days' LIMIT 1000)",
  );
}
