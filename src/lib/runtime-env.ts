import { existsSync } from "node:fs";

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

function rewriteLocalhostForDockerReachability(databaseUrl: string): string {
  if (databaseUrl.includes("@localhost")) {
    return databaseUrl.replace("@localhost", "@host.docker.internal");
  }
  if (databaseUrl.includes("127.0.0.1")) {
    return databaseUrl.replace("127.0.0.1", "host.docker.internal");
  }
  return databaseUrl;
}

/** Resolve DATABASE_URL for app/CLI use inside or via Docker. */
export function resolveDatabaseUrl(databaseUrl: string): string {
  // migrate service uses network_mode: host — localhost is the host Postgres.
  if (process.env.MIGRATE_HOST_NETWORK === "1") {
    return databaseUrl;
  }
  if (isRunningInContainer() || isDockerCliAvailable()) {
    return rewriteLocalhostForDockerReachability(databaseUrl);
  }
  return databaseUrl;
}

/** @deprecated Use resolveDatabaseUrl */
export function resolveDatabaseUrlForCli(databaseUrl: string): string {
  return resolveDatabaseUrl(databaseUrl);
}

export function defaultDumpDirectory(): string {
  if (isRunningInContainer() && existsSync("/app/data/dumps")) {
    return "/app/data/dumps";
  }
  return process.cwd();
}
