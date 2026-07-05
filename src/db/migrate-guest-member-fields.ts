import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE guest_members
    ADD COLUMN IF NOT EXISTS under_13 boolean NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE guest_members
    ADD COLUMN IF NOT EXISTS attending boolean NOT NULL DEFAULT true
  `;

  console.log("Guest member under_13 and attending columns ready.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
