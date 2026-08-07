import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS gallery_albums (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE gallery_photos
    ADD COLUMN IF NOT EXISTS album_id integer REFERENCES gallery_albums(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE gallery_photos
    ADD COLUMN IF NOT EXISTS storage_key text
  `;
  await sql`
    ALTER TABLE gallery_photos
    ADD COLUMN IF NOT EXISTS original_filename text
  `;
  await sql`
    ALTER TABLE gallery_photos
    ADD COLUMN IF NOT EXISTS mime_type text
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gallery_photo_groupings (
      photo_id integer NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
      grouping text NOT NULL,
      PRIMARY KEY (photo_id, grouping)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS gallery_photos_album_id_idx
    ON gallery_photos (album_id)
  `;

  console.log("Gallery albums migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
