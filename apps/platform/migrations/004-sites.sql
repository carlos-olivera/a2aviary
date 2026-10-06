CREATE SEQUENCE platform_site_number;
CREATE TABLE platform_site (
 id uuid PRIMARY KEY, number bigint NOT NULL DEFAULT nextval('platform_site_number') UNIQUE,
 owner_id text NOT NULL REFERENCES "user"(id), slug text NOT NULL CHECK(slug ~ '^[a-z][a-z0-9-]{0,63}$'),
 plan_id text NOT NULL, policy_version text NOT NULL, current_spec_id uuid, resources jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,slug)
);
CREATE TABLE platform_site_spec (
 id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES platform_site(id), spec jsonb NOT NULL,
 spec_sha256 text NOT NULL CHECK(spec_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','building','verified','deploying','live','failed','unknown')),
 base_sha256 text, accounting jsonb, reserved boolean NOT NULL DEFAULT false,
 source_sha256 text, output_sha256 text, error_code text, client_password_ciphertext text, requested_domain text,
 applied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(site_id,spec_sha256)
);
ALTER TABLE platform_site ADD CONSTRAINT platform_current_spec_fk FOREIGN KEY(current_spec_id) REFERENCES platform_site_spec(id);
CREATE TABLE platform_site_job (
 id uuid PRIMARY KEY, spec_id uuid NOT NULL REFERENCES platform_site_spec(id), actor_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL CHECK(kind IN ('build','deploy')), state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','failed','unknown')),
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz, UNIQUE(spec_id,kind)
);
CREATE INDEX platform_site_owner ON platform_site(owner_id);
CREATE INDEX platform_site_usage ON platform_site_spec(applied_at) WHERE accounting IS NOT NULL;
CREATE INDEX platform_site_jobs ON platform_site_job(created_at) WHERE state='queued';
