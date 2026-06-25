import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE task_permissions
    ADD COLUMN IF NOT EXISTS viewable_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  console.log("Task view permissions column ready.");
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
