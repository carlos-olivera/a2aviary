-- Removed seeds remain as disabled entries, so restarting cannot re-enroll them.
CREATE TABLE platform_tester (
 email text PRIMARY KEY CHECK(email=lower(email)), enabled boolean NOT NULL DEFAULT true,
 source text NOT NULL CHECK(source IN ('config','chat')), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_site ADD COLUMN test_mode boolean NOT NULL DEFAULT false;
ALTER TABLE platform_site ADD COLUMN lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','resetting','archived'));
ALTER TABLE platform_site_spec ADD COLUMN test_mode boolean NOT NULL DEFAULT false;
ALTER TABLE platform_site_job ADD COLUMN test_mode boolean NOT NULL DEFAULT false;
-- Classification is immutable and inherited by every build/change/job.
CREATE FUNCTION platform_site_test_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.test_mode<>OLD.test_mode THEN RAISE EXCEPTION 'immutable site test mode'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_site_test_immutable BEFORE UPDATE ON platform_site FOR EACH ROW EXECUTE FUNCTION platform_site_test_immutable();
CREATE FUNCTION platform_spec_test_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.test_mode := (SELECT test_mode FROM platform_site WHERE id=NEW.site_id); RETURN NEW; END $$;
CREATE TRIGGER platform_spec_test_mode BEFORE INSERT OR UPDATE ON platform_site_spec FOR EACH ROW EXECUTE FUNCTION platform_spec_test_mode();
CREATE FUNCTION platform_job_test_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.test_mode := (SELECT test_mode FROM platform_site_spec WHERE id=NEW.spec_id); RETURN NEW; END $$;
CREATE TRIGGER platform_job_test_mode BEFORE INSERT OR UPDATE ON platform_site_job FOR EACH ROW EXECUTE FUNCTION platform_job_test_mode();
