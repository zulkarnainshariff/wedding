import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE guestbook_entries
    ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS guestbook_entries_hidden_idx
    ON guestbook_entries (hidden, created_at DESC)
  `;

  console.log("Guestbook moderation migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
