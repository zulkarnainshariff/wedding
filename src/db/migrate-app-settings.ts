import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id integer PRIMARY KEY DEFAULT 1,
      theme_id text NOT NULL DEFAULT 'azure-blossom',
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT app_settings_singleton CHECK (id = 1)
    )
  `;

  await sql`
    INSERT INTO app_settings (id, theme_id)
    VALUES (1, 'azure-blossom')
    ON CONFLICT (id) DO NOTHING
  `;

  console.log("App settings migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
