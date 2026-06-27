import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";
import { APPLICATION_TABLES } from "@/lib/database-tables";
import { executeSqlFileWithNode } from "@/lib/database-sql-node";
import {
  isDockerCliAvailable,
  isRunningInContainer,
  resolveDatabaseUrlForCli,
} from "@/lib/runtime-env";
import { bumpSyncVersion } from "@/lib/sync";

const execFileAsync = promisify(execFile);

function seedDirectories(): string[] {
  const root = path.join(/* turbopackIgnore: true */ process.cwd());
  const dirs = [root, path.join(root, "seeds")];

  if (isRunningInContainer()) {
    if (existsSync("/app/seeds")) dirs.push("/app/seeds");
    if (existsSync("/app/data/dumps")) dirs.push("/app/data/dumps");
  }

  return dirs;
}

export type SeedFileInfo = {
  filename: string;
  location: "project" | "seeds";
  byteSize: number;
  modifiedAt: string;
};

function isSafeSqlFilename(filename: string): boolean {
  return (
    filename.endsWith(".sql") &&
    filename === path.basename(filename) &&
    !filename.includes("..") &&
    /^[\w.-]+\.sql$/.test(filename)
  );
}

export async function listSeedSqlFiles(): Promise<SeedFileInfo[]> {
  const found = new Map<string, SeedFileInfo>();
  const [rootDir, seedsDir] = seedDirectories();

  for (const directory of [rootDir, seedsDir]) {
    let entries: string[] = [];
    try {
      entries = await readdir(directory);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!isSafeSqlFilename(entry)) continue;

      const fullPath = path.join(directory, entry);
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) continue;

      const location = directory === seedsDir ? ("seeds" as const) : ("project" as const);

      found.set(entry, {
        filename: entry,
        location,
        byteSize: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      });
    }
  }

  return [...found.values()].sort((a, b) =>
    b.modifiedAt.localeCompare(a.modifiedAt),
  );
}

export async function resolveSeedSqlPath(filename: string): Promise<string> {
  if (!isSafeSqlFilename(filename)) {
    throw new Error("Invalid seed filename.");
  }

  for (const directory of seedDirectories()) {
    const fullPath = path.join(directory, filename);
    try {
      const fileStat = await stat(fullPath);
      if (fileStat.isFile()) return fullPath;
    } catch {
      /* try next directory */
    }
  }

  throw new Error(`Seed file not found: ${filename}`);
}

async function runPsqlFile(databaseUrl: string, filePath: string) {
  try {
    await execFileAsync("psql", [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      filePath,
    ]);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("ENOENT") && !message.includes("not found")) {
      throw error;
    }
  }

  if (!isRunningInContainer() && isDockerCliAvailable()) {
    const dumpUrl = resolveDatabaseUrlForCli(databaseUrl);
    await execFileAsync(
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${path.dirname(filePath)}:/work`,
        "-e",
        `DATABASE_URL=${dumpUrl}`,
        "postgres:16-alpine",
        "sh",
        "-c",
        `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /work/${path.basename(filePath)}`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return;
  }

  await executeSqlFileWithNode(databaseUrl, filePath);
}

export async function wipeAndRestoreSeedFile(filename: string): Promise<{
  filename: string;
  tablesTruncated: number;
}> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const seedPath = await resolveSeedSqlPath(filename);
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    const tableList = APPLICATION_TABLES.map((table) => `"${table}"`).join(
      ", ",
    );
    await sql.unsafe(
      `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
    );

    await sql.end();

    await runPsqlFile(databaseUrl, seedPath);
    await bumpSyncVersion();

    return {
      filename,
      tablesTruncated: APPLICATION_TABLES.length,
    };
  } catch (error) {
    await sql.end({ timeout: 1 }).catch(() => undefined);
    throw error;
  }
}

export async function readSeedPreview(filename: string, maxLines = 5) {
  const seedPath = await resolveSeedSqlPath(filename);
  const contents = await readFile(seedPath, "utf8");
  const lines = contents.split("\n").slice(0, maxLines);
  return lines.join("\n");
}
