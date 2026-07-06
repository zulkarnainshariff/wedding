import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE item_documents
    ADD COLUMN IF NOT EXISTS category text
  `;

  await sql`
    UPDATE item_documents AS d
    SET category = i.category
    FROM itinerary_items AS i
    WHERE d.item_id = i.id
      AND (d.category IS NULL OR d.category = '')
  `;

  await sql`
    UPDATE item_documents
    SET category = 'general'
    WHERE category IS NULL OR category = ''
  `;

  await sql`
    ALTER TABLE item_documents
    ALTER COLUMN category SET DEFAULT 'general'
  `;

  await sql`
    ALTER TABLE item_documents
    ALTER COLUMN item_id DROP NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS item_documents_category_idx
    ON item_documents (category)
  `;

  console.log("Document fields migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
