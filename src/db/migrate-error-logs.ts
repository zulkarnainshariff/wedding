import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS error_logs (
      id serial PRIMARY KEY,
      operation text NOT NULL,
      resource_type text NOT NULL,
      resource_id text,
      summary text NOT NULL,
      error_message text NOT NULL,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      username text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS error_logs_operation_idx ON error_logs (operation)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS error_logs_resource_type_idx ON error_logs (resource_type)
  `;

  console.log("Error logs migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
