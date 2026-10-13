-- Additive provenance; the existing transactional, checksum-pinned migrator
-- applies this file once. Existing sites remain websites with no starter.
ALTER TABLE platform_site ADD COLUMN kind text NOT NULL DEFAULT 'website' CHECK (kind IN ('website'));
ALTER TABLE platform_site ADD COLUMN starter_id text NULL;
ALTER TABLE platform_site ADD COLUMN starter_version text NULL;
ALTER TABLE platform_site ADD CONSTRAINT platform_site_starter_pair CHECK ((starter_id IS NULL) = (starter_version IS NULL));
CREATE FUNCTION platform_site_provenance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.starter_id IS DISTINCT FROM OLD.starter_id OR NEW.starter_version IS DISTINCT FROM OLD.starter_version THEN
  RAISE EXCEPTION 'immutable site provenance';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER platform_site_provenance_immutable BEFORE UPDATE ON platform_site FOR EACH ROW EXECUTE FUNCTION platform_site_provenance_immutable();
