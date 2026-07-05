import { existsSync } from "node:fs";

import {
  rewriteLocalhostForDockerReachability,
  resolveDatabaseUrl,
} from "./database-url";

export { resolveDatabaseUrl };

export function isRunningInContainer(): boolean {
  if (process.env.RUNNING_IN_CONTAINER === "1") return true;
  return existsSync("/.dockerenv");
}

export function isDockerCliAvailable(): boolean {
  const home = process.env.HOME?.trim();
  return (
    existsSync("/var/run/docker.sock") ||
    Boolean(home && existsSync(`${home}/.docker/run/docker.sock`))
  );
}

/** CLI dump/restore: also rewrite when host tools talk to Dockerized Postgres. */
export function resolveDatabaseUrlForCli(databaseUrl: string): string {
  if (process.env.MIGRATE_HOST_NETWORK === "1") {
    return databaseUrl;
  }
  if (isRunningInContainer() || isDockerCliAvailable()) {
    return rewriteLocalhostForDockerReachability(databaseUrl);
  }
  return databaseUrl;
}

export function defaultDumpDirectory(): string {
  if (isRunningInContainer() && existsSync("/app/data/dumps")) {
    return "/app/data/dumps";
  }
  return process.cwd();
}
