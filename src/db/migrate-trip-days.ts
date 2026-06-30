import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE itinerary_days
    ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS itinerary_days_date_unique
    ON itinerary_days (date)
  `;

  console.log("Trip days migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
