import { execFile, execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { APPLICATION_TABLES } from "@/lib/database-tables";
import { dumpDatabaseWithNode } from "@/lib/database-sql-node";
import {
  defaultDumpDirectory,
  isDockerCliAvailable,
  isRunningInContainer,
  resolveDatabaseUrlForCli,
} from "@/lib/runtime-env";

const execFileAsync = promisify(execFile);

function todaySuffix(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolvePgDump(): string | null {
  const candidates = [
    process.env.PG_DUMP?.trim(),
    "pg_dump",
    "/usr/bin/pg_dump",
    "/opt/homebrew/opt/postgresql@17/bin/pg_dump",
    "/opt/homebrew/opt/postgresql@16/bin/pg_dump",
    "/usr/local/opt/postgresql@16/bin/pg_dump",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      /* try next */
    }
  }

  return null;
}

async function runPgDumpCli(
  databaseUrl: string,
  outputPath: string,
): Promise<void> {
  const tableArgs = APPLICATION_TABLES.flatMap((table) => ["-t", table]);
  const pgDumpBin = resolvePgDump();

  if (pgDumpBin) {
    try {
      await execFileAsync(pgDumpBin, [
        databaseUrl,
        "--data-only",
        "--no-owner",
        "--no-privileges",
        "--column-inserts",
        ...tableArgs,
        "--file",
        outputPath,
      ]);
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      if (!message.includes("server version mismatch")) {
        throw error;
      }
    }
  }

  if (isRunningInContainer() || !isDockerCliAvailable()) {
    throw new Error("pg_dump unavailable");
  }

  const dumpUrl = resolveDatabaseUrlForCli(databaseUrl);
  const tableFlags = APPLICATION_TABLES.map((table) => `-t ${table}`).join(" ");
  const workDir = path.dirname(outputPath);
  const fileName = path.basename(outputPath);

  await execFileAsync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `DUMP_URL=${dumpUrl}`,
      "-v",
      `${workDir}:/work`,
      "-w",
      "/work",
      "postgres:16-alpine",
      "sh",
      "-c",
      `pg_dump "$DUMP_URL" --data-only --no-owner --no-privileges --column-inserts ${tableFlags} --file /work/${fileName}`,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
}

async function runPgDump(
  databaseUrl: string,
  outputPath: string,
): Promise<"pg_dump" | "node"> {
  try {
    await runPgDumpCli(databaseUrl, outputPath);
    return "pg_dump";
  } catch {
    await dumpDatabaseWithNode(databaseUrl, outputPath);
    return "node";
  }
}

async function wrapReplicationRole(outputPath: string): Promise<void> {
  const body = await readFile(outputPath, "utf8");
  if (body.includes("session_replication_role")) return;

  await writeFile(
    outputPath,
    [
      "SET session_replication_role = replica;",
      body,
      "SET session_replication_role = DEFAULT;",
    ].join("\n"),
    "utf8",
  );
}

export type DatabaseDumpResult = {
  filename: string;
  localPath: string;
  lineCount: number;
  byteSize: number;
  method: "pg_dump" | "node";
};

export async function dumpDatabaseToFile(options?: {
  outputDir?: string;
  filename?: string;
}): Promise<DatabaseDumpResult> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const outputDir =
    options?.outputDir ?? path.join(/* turbopackIgnore: true */ defaultDumpDirectory());
  await mkdir(outputDir, { recursive: true });

  const filename = options?.filename ?? `wedding-${todaySuffix()}.sql`;
  const localPath = path.join(outputDir, filename);
  const tempPath = path.join(tmpdir(), `wedding-dump-${Date.now()}.sql`);

  const method = await runPgDump(databaseUrl, tempPath);
  if (method === "pg_dump") {
    await wrapReplicationRole(tempPath);
  }
  await rename(tempPath, localPath);

  const contents = await readFile(localPath, "utf8");
  const lineCount = contents.split("\n").length;

  return {
    filename,
    localPath,
    lineCount,
    byteSize: Buffer.byteLength(contents, "utf8"),
    method,
  };
}
