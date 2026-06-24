import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS event_rsvp_settings (
      event_id integer PRIMARY KEY REFERENCES wedding_events(id) ON DELETE CASCADE,
      rsvp_enabled boolean NOT NULL DEFAULT true,
      rsvp_deadline timestamptz,
      contact_name text,
      contact_phone text,
      contact_email text
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guest_list_permissions (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      can_view boolean NOT NULL DEFAULT true,
      can_edit boolean NOT NULL DEFAULT false,
      UNIQUE (event_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guests (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      invite_token text NOT NULL UNIQUE,
      label text NOT NULL,
      allow_include_family boolean NOT NULL DEFAULT false,
      expected_headcount integer NOT NULL DEFAULT 1,
      rsvp_status text NOT NULL DEFAULT 'not_responded',
      rsvp_attending_count integer,
      rsvp_notes text,
      admin_notes text,
      contact_email text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guest_members (
      id serial PRIMARY KEY,
      guest_id integer NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
      name text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0
    )
  `;

  const events = await sql<{ id: number }[]>`SELECT id FROM wedding_events`;
  for (const event of events) {
    await sql`
      INSERT INTO event_rsvp_settings (event_id)
      VALUES (${event.id})
      ON CONFLICT (event_id) DO NOTHING
    `;
  }

  console.log("Guest list tables ready.");
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
