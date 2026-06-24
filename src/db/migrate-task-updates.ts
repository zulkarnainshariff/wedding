import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS allow_assignee_edit boolean NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS status_reason text
  `;
  await sql`
    ALTER TABLE task_notes
    ADD COLUMN IF NOT EXISTS updated_at timestamptz
  `;

  console.log("Task updates migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
