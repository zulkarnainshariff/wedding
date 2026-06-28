import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";
import { APPLICATION_TABLES } from "@/lib/database-tables";
import { executeSqlFileWithNode } from "@/lib/database-sql-node";
import {
  executeSequenceResetSql,
  resetApplicationSequences,
} from "@/lib/database-sequences";
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
    if (existsSync("/app/data/dumps")) dirs.push("/app/data/dumps");
  }

  return [...new Set(dirs.map((dir) => path.resolve(dir)))];
}

export type SeedFileLocation = "project" | "seeds" | "dumps";

export type SeedFileInfo = {
  filename: string;
  location: SeedFileLocation;
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

function seedLocationLabel(directory: string): SeedFileLocation {
  const normalized = path.resolve(directory);
  if (normalized.endsWith(`${path.sep}data${path.sep}dumps`)) {
    return "dumps";
  }
  if (normalized.endsWith(`${path.sep}seeds`) || normalized === "/app/seeds") {
    return "seeds";
  }
  return "project";
}

function isNewerSeedCandidate(
  candidate: SeedFileInfo,
  existing: SeedFileInfo,
): boolean {
  return candidate.modifiedAt.localeCompare(existing.modifiedAt) > 0;
}

export async function listSeedSqlFiles(): Promise<SeedFileInfo[]> {
  const found = new Map<string, SeedFileInfo>();

  for (const directory of seedDirectories()) {
    let entries: string[] = [];
    try {
      entries = await readdir(directory);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!isSafeSqlFilename(entry)) continue;

      const fullPath = path.join(directory, entry);
      let fileStat;
      try {
        fileStat = await stat(fullPath);
      } catch {
        continue;
      }
      if (!fileStat.isFile()) continue;

      const candidate: SeedFileInfo = {
        filename: entry,
        location: seedLocationLabel(directory),
        byteSize: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      };

      const existing = found.get(entry);
      if (!existing || isNewerSeedCandidate(candidate, existing)) {
        found.set(entry, candidate);
      }
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

  let newestPath: string | null = null;
  let newestModifiedAt = "";

  for (const directory of seedDirectories()) {
    const fullPath = path.join(directory, filename);
    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) continue;

      const modifiedAt = fileStat.mtime.toISOString();
      if (!newestPath || modifiedAt.localeCompare(newestModifiedAt) > 0) {
        newestPath = fullPath;
        newestModifiedAt = modifiedAt;
      }
    } catch {
      /* try next directory */
    }
  }

  if (!newestPath) {
    throw new Error(`Seed file not found: ${filename}`);
  }

  return newestPath;
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
  sequencesReset: number;
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
    await executeSequenceResetSql(databaseUrl);
    const sequencesReset = await resetApplicationSequences(databaseUrl);
    await bumpSyncVersion();

    return {
      filename,
      tablesTruncated: APPLICATION_TABLES.length,
      sequencesReset,
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
