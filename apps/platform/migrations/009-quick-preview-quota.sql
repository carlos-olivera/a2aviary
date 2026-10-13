-- Add a separate allowance without modifying historical migration bytes or rows.
ALTER TABLE platform_site_quota DROP CONSTRAINT platform_site_quota_kind_check;
ALTER TABLE platform_site_quota ADD CONSTRAINT platform_site_quota_kind_check
  CHECK (kind IN ('upload', 'preview', 'quick'));
