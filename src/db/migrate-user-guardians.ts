import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_guardians (
      ward_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guardian_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (ward_user_id, guardian_user_id),
      CHECK (ward_user_id <> guardian_user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_guardians_guardian_user_id_idx
    ON user_guardians (guardian_user_id)
  `;

  console.log("User guardians migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
