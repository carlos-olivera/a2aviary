-- Append-only: never reconcile or alter the inventories of migrations 001–006.
CREATE TABLE platform_site_draft (
 id uuid PRIMARY KEY, site_id uuid NOT NULL UNIQUE REFERENCES platform_site(id),
 revision integer NOT NULL DEFAULT 0, content jsonb NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','discarded','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE TABLE platform_draft_receipt (
 actor_id text NOT NULL REFERENCES "user"(id), request_id uuid NOT NULL,
 draft_id uuid REFERENCES platform_site_draft(id) ON DELETE CASCADE,
 request_sha256 text NOT NULL, response jsonb NOT NULL, PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE platform_upload_session (
 id uuid PRIMARY KEY, draft_id uuid NOT NULL REFERENCES platform_site_draft(id) ON DELETE CASCADE,
 short_id text NOT NULL UNIQUE, capability_sha256 text NOT NULL, actor_id text NOT NULL REFERENCES "user"(id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour', revoked boolean NOT NULL DEFAULT false,
 attempts integer NOT NULL DEFAULT 0, raw_bytes bigint NOT NULL DEFAULT 0, probed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_upload_file (
 session_id uuid NOT NULL REFERENCES platform_upload_session(id) ON DELETE CASCADE,
 upload_id uuid NOT NULL, asset_id text NOT NULL, raw_sha256 text NOT NULL,
 metadata jsonb NOT NULL, channel text NOT NULL CHECK(channel IN ('agent','human')),
 PRIMARY KEY(session_id,upload_id)
);
CREATE TABLE platform_site_quota (
 id bigserial PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL CHECK(kind IN ('upload','preview')), amount bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_quota_window ON platform_site_quota(kind,created_at,owner_id);
ALTER TABLE platform_site_spec DROP CONSTRAINT platform_site_spec_state_check;
ALTER TABLE platform_site_spec ADD CONSTRAINT platform_site_spec_state_check CHECK(state IN ('queued','building','verified','approved','deploying','live','failed','superseded','unknown'));
ALTER TABLE platform_site_spec DROP CONSTRAINT platform_site_spec_site_id_spec_sha256_key;
ALTER TABLE platform_site_spec ADD COLUMN draft_id uuid REFERENCES platform_site_draft(id);
ALTER TABLE platform_site_spec ADD COLUMN draft_revision integer;
ALTER TABLE platform_site_spec ADD COLUMN cache_key text;
ALTER TABLE platform_site_spec ADD COLUMN generator_version text;
ALTER TABLE platform_site_spec ADD COLUMN checker_sha256 text;
ALTER TABLE platform_site_spec ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours';
ALTER TABLE platform_site_spec ADD COLUMN artifacts_deleted boolean NOT NULL DEFAULT false;
CREATE INDEX platform_snapshot_cache ON platform_site_spec(cache_key);
CREATE TABLE platform_site_approval (
 spec_id uuid PRIMARY KEY, draft_id uuid NOT NULL, actor_id text NOT NULL REFERENCES "user"(id),
 revision integer NOT NULL, spec_sha256 text NOT NULL, output_sha256 text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER platform_approval_immutable BEFORE UPDATE OR DELETE ON platform_site_approval FOR EACH ROW EXECUTE FUNCTION platform_immutable_history();
CREATE TABLE platform_browser_nonce (
 hash text PRIMARY KEY, session_id text NOT NULL, target text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);

-- Durable write intents cover bucket writes whose surrounding SQL transaction fails.
CREATE TABLE platform_artifact_prefix (
 prefix text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
 cleaned_at timestamptz
);
ALTER TABLE platform_site_draft ADD COLUMN artifacts_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE platform_site_spec ADD COLUMN pending_source_id uuid REFERENCES platform_site_spec(id) ON DELETE SET NULL;
ALTER TABLE platform_site_spec ADD COLUMN artifact_hashes jsonb;
CREATE TABLE platform_asset_staging (
 key text PRIMARY KEY, draft_id uuid NOT NULL, asset_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), discarded boolean NOT NULL DEFAULT false,
 cleaned_at timestamptz
);
ALTER TABLE platform_upload_file ADD COLUMN position bigserial NOT NULL UNIQUE;
ALTER TABLE platform_site_spec ADD COLUMN verification_admitted boolean NOT NULL DEFAULT false;
