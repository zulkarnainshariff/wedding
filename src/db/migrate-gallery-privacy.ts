import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE gallery_photos
    ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE gallery_photo_tags
    ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL
  `;

  console.log("Gallery privacy and people-link migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
