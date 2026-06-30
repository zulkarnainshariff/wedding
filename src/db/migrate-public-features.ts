import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      name text NOT NULL,
      message text NOT NULL,
      email text,
      hidden boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS guestbook_entries_event_id_idx
    ON guestbook_entries (event_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      url text NOT NULL,
      caption text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gallery_photo_tags (
      photo_id integer NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
      email text,
      guest_name text NOT NULL,
      PRIMARY KEY (photo_id, guest_name)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS gallery_photos_event_id_idx
    ON gallery_photos (event_id, created_at DESC)
  `;

  console.log("Public features migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
