ALTER TABLE platform_site ADD COLUMN kind text NOT NULL DEFAULT 'catalog' CHECK(kind IN ('catalog','imported-static'));
ALTER TABLE platform_site ADD COLUMN cms_mode text NOT NULL DEFAULT 'catalog' CHECK(cms_mode IN ('catalog','none'));
ALTER TABLE platform_site ADD COLUMN first_client_pilot boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX platform_first_client_pilot ON platform_site(first_client_pilot) WHERE first_client_pilot;
ALTER TABLE platform_site ADD CONSTRAINT platform_imported_not_test CHECK(kind<>'imported-static' OR (NOT test_mode AND cms_mode='none'));

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

CREATE TABLE platform_static_binding (
 site_id uuid PRIMARY KEY REFERENCES platform_site(id), target jsonb NOT NULL, serving jsonb NOT NULL,
 baseline jsonb NOT NULL, observation jsonb NOT NULL, handed_off boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_static_target_unique ON platform_static_binding ((target->>'projectId'),(target->>'environmentId'),(target->>'serviceId'));
CREATE TABLE platform_static_release (
 id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id), source_commit text NOT NULL CHECK(source_commit~'^[a-f0-9]{40}$'),
 artifact_sha256 text NOT NULL CHECK(artifact_sha256~'^[a-f0-9]{64}$'), baseline boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','verifying','verified','live','failed','unknown')),
 predecessor_id uuid REFERENCES platform_static_release(id), submitted_by text NOT NULL REFERENCES "user"(id),
 approved_by text REFERENCES "user"(id), approved_at timestamptz, observation_sha256 text NOT NULL,
 report jsonb, provider_deployment_id text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(site_id,source_commit,artifact_sha256)
);
ALTER TABLE platform_site ADD COLUMN current_release_id uuid REFERENCES platform_static_release(id);
CREATE TABLE platform_static_job (
 id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id), release_id uuid REFERENCES platform_static_release(id),
 base_release_id uuid REFERENCES platform_static_release(id), actor_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL CHECK(kind IN ('verify','deploy','rollback','usage')), state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','failed','unknown')),
 handoff boolean NOT NULL DEFAULT false, billing_snapshot jsonb NOT NULL, error_code text, provider_deployment_id text, recovery_deployment_id text,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX platform_static_busy ON platform_static_job(site_id) WHERE kind IN ('deploy','rollback') AND state IN ('queued','running','unknown');
CREATE UNIQUE INDEX platform_static_verification ON platform_static_job(release_id) WHERE kind='verify' AND state IN ('queued','running');
CREATE UNIQUE INDEX platform_static_usage_busy ON platform_static_job(site_id) WHERE kind='usage' AND state IN ('queued','running');
CREATE TABLE platform_site_operation (
 id bigserial PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id), actor_id text REFERENCES "user"(id),
 kind text NOT NULL, result text NOT NULL, release_id uuid REFERENCES platform_static_release(id),
 job_id uuid REFERENCES platform_static_job(id), billing_snapshot jsonb NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER platform_operation_immutable BEFORE UPDATE OR DELETE ON platform_site_operation FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();
CREATE TABLE platform_site_cost (
 site_id uuid NOT NULL REFERENCES platform_site(id), period text NOT NULL CHECK(period~'^[0-9]{4}-[0-9]{2}$'),
 observed_date date NOT NULL, data jsonb NOT NULL, collected_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,period,observed_date)
);
-- Provider bindings and release bytes are immutable; only observed runtime state
-- and controller verification/lifecycle fields may advance.
CREATE FUNCTION platform_static_binding_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.target<>OLD.target OR NEW.serving<>OLD.serving OR NEW.baseline<>OLD.baseline THEN RAISE EXCEPTION 'immutable static binding'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_static_binding_immutable BEFORE UPDATE ON platform_static_binding FOR EACH ROW EXECUTE FUNCTION platform_static_binding_immutable();
CREATE FUNCTION platform_static_release_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.site_id<>OLD.site_id OR NEW.source_commit<>OLD.source_commit OR NEW.artifact_sha256<>OLD.artifact_sha256 OR NEW.baseline<>OLD.baseline OR NEW.observation_sha256<>OLD.observation_sha256 OR NEW.predecessor_id IS DISTINCT FROM OLD.predecessor_id THEN RAISE EXCEPTION 'immutable static release'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_static_release_immutable BEFORE UPDATE ON platform_static_release FOR EACH ROW EXECUTE FUNCTION platform_static_release_immutable();
ALTER TABLE platform_static_release ADD CONSTRAINT platform_static_release_site_unique UNIQUE(site_id,id);
ALTER TABLE platform_site ADD CONSTRAINT platform_static_current_owned FOREIGN KEY(id,current_release_id) REFERENCES platform_static_release(site_id,id);

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
ALTER TABLE platform_static_release ADD CONSTRAINT platform_static_predecessor_owned FOREIGN KEY(site_id,predecessor_id) REFERENCES platform_static_release(site_id,id);
ALTER TABLE platform_static_job ADD CONSTRAINT platform_static_job_release_owned FOREIGN KEY(site_id,release_id) REFERENCES platform_static_release(site_id,id);
ALTER TABLE platform_static_job ADD CONSTRAINT platform_static_job_base_owned FOREIGN KEY(site_id,base_release_id) REFERENCES platform_static_release(site_id,id);
CREATE TRIGGER platform_static_binding_retained BEFORE DELETE ON platform_static_binding FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();
CREATE TRIGGER platform_static_release_retained BEFORE DELETE ON platform_static_release FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();
