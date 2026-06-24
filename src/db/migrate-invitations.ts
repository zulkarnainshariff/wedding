import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS wedding_events (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      event_date date NOT NULL,
      location text,
      card_front jsonb NOT NULL DEFAULT '{}'::jsonb,
      sort_order integer NOT NULL DEFAULT 0,
      published boolean NOT NULL DEFAULT true
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public_schedule_items (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      time_label text NOT NULL,
      title text NOT NULL,
      description text,
      sort_order integer NOT NULL DEFAULT 0,
      published boolean NOT NULL DEFAULT true
    )
  `;

  console.log("Invitation tables ready.");
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
