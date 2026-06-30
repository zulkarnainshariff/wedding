import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const updated = await sql`
    UPDATE itinerary_items
    SET details = details || '{"participants": ["Nat", "Zulkarnain"]}'::jsonb
    WHERE category = 'pet_relocation'
      AND (
        details->'participants' IS NULL
        OR jsonb_array_length(COALESCE(details->'participants', '[]'::jsonb)) = 0
      )
      AND lower(details->>'petName') = 'seymour'
    RETURNING id, title
  `;

  console.log(
    `Pet relocation participants migration complete (${updated.length} item(s) updated).`,
  );
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
