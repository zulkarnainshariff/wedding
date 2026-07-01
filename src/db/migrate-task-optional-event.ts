import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE tasks
    ALTER COLUMN event_id DROP NOT NULL
  `;

  console.log("Tasks event_id is now optional.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
