-- Catalog site administration and immutable billing/operation history.
ALTER TABLE platform_site ADD COLUMN first_client_pilot boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX platform_first_client_pilot ON platform_site(first_client_pilot) WHERE first_client_pilot;

CREATE TABLE platform_site_admin (
 site_id uuid NOT NULL REFERENCES platform_site(id), email text NOT NULL CHECK(email=lower(email)),
 assigned_by text NOT NULL REFERENCES "user"(id), enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,email)
);
CREATE TABLE platform_site_billing (
 id bigserial PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id),
 owner_role text NOT NULL CHECK(owner_role IN ('client','tester','admin','superadmin')),
 eligible boolean NOT NULL, reason text NOT NULL CHECK(reason IN ('owner_admin','test_site','standard')),
 effective_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX platform_billing_history ON platform_site_billing(site_id,effective_at,id);
CREATE FUNCTION platform_record_billing(s platform_site, r text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE exempt boolean := s.test_mode OR r IN ('admin','superadmin'); why text;
BEGIN
 why := CASE WHEN s.test_mode THEN 'test_site' WHEN r IN ('admin','superadmin') THEN 'owner_admin' ELSE 'standard' END;
 IF NOT EXISTS(SELECT 1 FROM platform_site_billing WHERE id=(SELECT max(id) FROM platform_site_billing WHERE site_id=s.id) AND owner_role=r AND eligible=NOT exempt AND reason=why) THEN
  INSERT INTO platform_site_billing(site_id,owner_role,eligible,reason) VALUES(s.id,r,NOT exempt,why);
 END IF;
END $$;
CREATE FUNCTION platform_billing_site() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM platform_record_billing(NEW,COALESCE((SELECT role FROM platform_role WHERE user_id=NEW.owner_id),'client')); RETURN NEW; END $$;
CREATE TRIGGER platform_billing_site AFTER INSERT OR UPDATE OF owner_id ON platform_site FOR EACH ROW EXECUTE FUNCTION platform_billing_site();
CREATE FUNCTION platform_billing_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s platform_site;
BEGIN FOR s IN SELECT * FROM platform_site WHERE owner_id=NEW.user_id LOOP PERFORM platform_record_billing(s,NEW.role); END LOOP; RETURN NEW; END $$;
CREATE TRIGGER platform_billing_role AFTER INSERT OR UPDATE OF role ON platform_role FOR EACH ROW EXECUTE FUNCTION platform_billing_role();
SELECT platform_record_billing(s,COALESCE(r.role,'client')) FROM platform_site s LEFT JOIN platform_role r ON r.user_id=s.owner_id;
CREATE FUNCTION platform_immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable history'; END $$;
CREATE TRIGGER platform_billing_immutable BEFORE UPDATE OR DELETE ON platform_site_billing FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();

CREATE TABLE platform_site_operation (
 id bigserial PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id), actor_id text REFERENCES "user"(id),
 kind text NOT NULL, result text NOT NULL, spec_id uuid,
 job_id uuid, billing_snapshot jsonb NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER platform_operation_immutable BEFORE UPDATE OR DELETE ON platform_site_operation FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();
CREATE TABLE platform_site_cost (
 site_id uuid NOT NULL REFERENCES platform_site(id), period text NOT NULL CHECK(period~'^[0-9]{4}-[0-9]{2}$'),
 observed_date date NOT NULL, data jsonb NOT NULL, collected_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,period,observed_date)
);
-- Catalog jobs retain their existing contracts and carry the same effective
-- owner eligibility snapshot. Tester resets may delete their original jobs.
ALTER TABLE platform_site_job ADD COLUMN billing_snapshot jsonb NOT NULL DEFAULT '{}';
CREATE FUNCTION platform_catalog_job_billing() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s platform_site; b platform_site_billing;
BEGIN
 SELECT site.* INTO s FROM platform_site site JOIN platform_site_spec spec ON spec.site_id=site.id WHERE spec.id=NEW.spec_id;
 PERFORM platform_record_billing(s,COALESCE((SELECT role FROM platform_role WHERE user_id=s.owner_id),'client'));
 SELECT * INTO b FROM platform_site_billing WHERE site_id=s.id ORDER BY id DESC LIMIT 1;
 NEW.billing_snapshot := jsonb_build_object('id',b.id::text,'ownerRole',b.owner_role,'eligible',b.eligible,'reason',b.reason,'effectiveAt',b.effective_at,'chargesEnabled',false);
 RETURN NEW;
END $$;
CREATE TRIGGER platform_catalog_job_billing BEFORE INSERT ON platform_site_job FOR EACH ROW EXECUTE FUNCTION platform_catalog_job_billing();

ALTER TABLE platform_site_job DROP CONSTRAINT platform_site_job_kind_check;
ALTER TABLE platform_site_job ADD CONSTRAINT platform_site_job_kind_check CHECK(kind IN ('build','deploy','usage'));
ALTER TABLE platform_site_job ADD COLUMN cost_period text CHECK(cost_period~'^[0-9]{4}-(0[1-9]|1[0-2])$');
