import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { APPLICATION_TABLES } from "@/lib/database-tables";

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) {
    if (value.length === 0) return "ARRAY[]::text[]";
    const items = value.map((entry) => sqlLiteral(entry));
    return `ARRAY[${items.join(", ")}]`;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function dumpDatabaseWithNode(
  databaseUrl: string,
  outputPath: string,
): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  const lines: string[] = ["SET session_replication_role = replica;"];

  try {
    for (const table of APPLICATION_TABLES) {
      const rows = (await sql.unsafe(
        `SELECT * FROM ${escapeIdentifier(table)}`,
      )) as Record<string, unknown>[];

      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const columnList = columns.map(escapeIdentifier).join(", ");
        const valueList = columns.map((column) => sqlLiteral(row[column])).join(", ");
        lines.push(
          `INSERT INTO ${escapeIdentifier(table)} (${columnList}) VALUES (${valueList});`,
        );
      }
    }

    lines.push("SET session_replication_role = DEFAULT;");
    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function executeSqlFileWithNode(
  databaseUrl: string,
  filePath: string,
): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const contents = await readFile(filePath, "utf8");
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    const statements = contents
      .split(/;\s*\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.unsafe(statement.endsWith(";") ? statement : `${statement};`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
