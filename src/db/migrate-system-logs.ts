import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_level integer NOT NULL DEFAULT 3
  `;

  await sql`
    UPDATE users
    SET role_level = 1
    WHERE is_admin = true AND role_level = 3
  `;

  const superuserUsername = process.env.SUPERUSER_USERNAME?.trim().toLowerCase();
  if (superuserUsername) {
    await sql`
      UPDATE users
      SET role_level = 0, is_admin = true
      WHERE username = ${superuserUsername}
    `;
  }

  // One-time rename; skip when chris already exists (e.g. restored seed + legacy row).
  const renamed = await sql`
    UPDATE users
    SET username = 'chris'
    WHERE username = 'christopher'
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.username = 'chris')
    RETURNING id
  `;
  if (renamed.length === 0) {
    const [{ christopherExists }] = await sql<{ christopherExists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM users WHERE username = 'christopher') AS christopher_exists
    `;
    if (christopherExists) {
      console.log(
        "Skipping christopher -> chris rename: chris already exists.",
      );
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS login_logs (
      id serial PRIMARY KEY,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      username text,
      event_type text NOT NULL,
      session_id text,
      ip_address text,
      user_agent text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id serial PRIMARY KEY,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      username text,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id text,
      summary text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id serial PRIMARY KEY,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      username text,
      session_id text NOT NULL,
      event_type text NOT NULL,
      path text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_activity_sessions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id text NOT NULL UNIQUE,
      started_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS login_logs_created_at_idx ON login_logs (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS usage_logs_created_at_idx ON usage_logs (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS usage_logs_user_id_created_at_idx
    ON usage_logs (user_id, created_at DESC)
  `;

  console.log("System logs migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
