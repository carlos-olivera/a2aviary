CREATE TABLE platform_role (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('superadmin', 'admin', 'client', 'tester')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_invitation (
  email text PRIMARY KEY,
  invited_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_by text REFERENCES "user"(id) ON DELETE RESTRICT
);
CREATE TABLE platform_agent_key (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  thumbprint text NOT NULL UNIQUE,
  public_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX platform_agent_key_user ON platform_agent_key(user_id);
CREATE TABLE platform_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target text NOT NULL,
  details jsonb NOT NULL,
  test_mode boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_audit_created ON platform_audit(id DESC);
-- App code only inserts/reads audit rows. Dedicated DB roles may further restrict access.
