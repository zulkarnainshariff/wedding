import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE itinerary_items
    ADD COLUMN IF NOT EXISTS parent_item_id integer
      REFERENCES itinerary_items(id) ON DELETE CASCADE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS item_documents (
      id serial PRIMARY KEY,
      item_id integer NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
      traveller_name text NOT NULL,
      label text NOT NULL,
      file_name text NOT NULL,
      storage_key text NOT NULL UNIQUE,
      mime_type text,
      file_size integer,
      uploaded_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      extra_viewers jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS item_documents_item_id_idx
    ON item_documents (item_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS itinerary_items_parent_item_id_idx
    ON itinerary_items (parent_item_id)
  `;

  console.log("Item features migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
