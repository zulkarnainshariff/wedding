import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL,
      title text NOT NULL,
      body text,
      href text,
      metadata jsonb DEFAULT '{}'::jsonb,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS task_permissions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      can_assign boolean NOT NULL DEFAULT false,
      can_assign_for_others boolean NOT NULL DEFAULT false,
      can_view_others_tasks boolean NOT NULL DEFAULT false,
      UNIQUE (user_id, event_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES wedding_events(id) ON DELETE CASCADE,
      day_id integer REFERENCES itinerary_days(id) ON DELETE SET NULL,
      item_id integer REFERENCES itinerary_items(id) ON DELETE SET NULL,
      parent_task_id integer REFERENCES tasks(id) ON DELETE CASCADE,
      title text NOT NULL,
      assigner_notes text,
      status text NOT NULL DEFAULT 'not_started',
      assignee_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      due_at timestamptz,
      allow_subtasks boolean NOT NULL DEFAULT false,
      allow_tagged_notes boolean NOT NULL DEFAULT false,
      is_urgent boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS task_notes (
      id serial PRIMARY KEY,
      task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text NOT NULL,
      tagged_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS task_reminders (
      id serial PRIMARY KEY,
      task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      remind_at timestamptz NOT NULL,
      processed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("Notifications and tasks tables ready.");
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
