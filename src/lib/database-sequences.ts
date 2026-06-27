import postgres from "postgres";

const SERIAL_COLUMNS_SQL = `
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    a.attname AS column_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
`;

/** SQL appended to data dumps so restore realigns serial sequences. */
export const SEQUENCE_RESET_SQL = `
-- Realign serial/identity sequences after explicit-id INSERT restores
DO $$
DECLARE
  r RECORD;
  seq_name text;
BEGIN
  FOR r IN
    ${SERIAL_COLUMNS_SQL.trim()}
  LOOP
    seq_name := pg_get_serial_sequence(
      format('%I.%I', r.schema_name, r.table_name),
      r.column_name
    );
    IF seq_name IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), EXISTS (SELECT 1 FROM %I.%I))',
      seq_name,
      r.column_name, r.schema_name, r.table_name,
      r.schema_name, r.table_name
    );
  END LOOP;
END $$;
`.trim();

export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "23505") return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("duplicate key") || message.includes("23505");
}

/** After a data-only restore with explicit ids, realign serial/identity sequences. */
export async function resetApplicationSequences(
  databaseUrl?: string,
): Promise<number> {
  const url = databaseUrl?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  let resetCount = 0;

  try {
    const rows = await sql.unsafe<
      { schema_name: string; table_name: string; column_name: string }[]
    >(SERIAL_COLUMNS_SQL);

    for (const row of rows) {
      const qualified = `${row.schema_name}.${row.table_name}`;
      const sequence = await sql<{ seq: string | null }[]>`
        SELECT pg_get_serial_sequence(${qualified}, ${row.column_name}) AS seq
      `;
      const seq = sequence[0]?.seq;
      if (!seq) continue;

      await sql.unsafe(`
        SELECT setval(
          '${seq.replace(/'/g, "''")}',
          COALESCE((SELECT MAX("${row.column_name}") FROM "${row.schema_name}"."${row.table_name}"), 1),
          (SELECT COUNT(*) > 0 FROM "${row.schema_name}"."${row.table_name}")
        )
      `);
      resetCount += 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  return resetCount;
}

export async function executeSequenceResetSql(
  databaseUrl?: string,
): Promise<void> {
  const url = databaseUrl?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(SEQUENCE_RESET_SQL);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
