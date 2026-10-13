-- Additive migration; applied migrations and immutable approvals remain unchanged.
ALTER TABLE platform_site_draft DROP CONSTRAINT platform_site_draft_site_id_key;
ALTER TABLE platform_site_draft DROP CONSTRAINT platform_site_draft_state_check;
ALTER TABLE platform_site_draft ADD CONSTRAINT platform_site_draft_state_check CHECK(state IN ('active','discarded','expired','completed'));
-- Completed initial drafts must not occupy the active slot.
UPDATE platform_site_draft d SET state='completed' FROM platform_site s WHERE s.id=d.site_id AND s.current_spec_id IS NOT NULL AND d.state='active';
CREATE UNIQUE INDEX platform_one_active_draft ON platform_site_draft(site_id) WHERE state='active';
ALTER TABLE platform_site_draft ADD COLUMN base_spec_id uuid;
ALTER TABLE platform_site_draft ADD COLUMN asset_sources jsonb NOT NULL DEFAULT '{}';
ALTER TABLE platform_site_draft ADD COLUMN policy_version text;
UPDATE platform_site_draft d SET policy_version=s.policy_version FROM platform_site s WHERE s.id=d.site_id;
ALTER TABLE platform_site_draft ALTER COLUMN policy_version SET NOT NULL;
ALTER TABLE platform_site_draft ALTER COLUMN policy_version SET DEFAULT '2.3.0';
-- base_sha256 binds the live baseline, accounting identifies edits, reserved
-- holds pending/unknown capacity. All three columns are reused.
