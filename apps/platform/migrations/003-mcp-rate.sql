-- Operational request admission, separate from plan/monthly change accounting.
CREATE TABLE platform_mcp_rate (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0)
);
