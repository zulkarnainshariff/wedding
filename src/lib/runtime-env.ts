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

/** When the app runs in Docker, use the service DATABASE_URL as-is. */
export function resolveDatabaseUrlForCli(databaseUrl: string): string {
  if (isRunningInContainer()) {
    return databaseUrl;
  }

  if (databaseUrl.includes("@localhost")) {
    return databaseUrl.replace("@localhost", "@host.docker.internal");
  }
  if (databaseUrl.includes("127.0.0.1")) {
    return databaseUrl.replace("127.0.0.1", "host.docker.internal");
  }
  return databaseUrl;
}

export function defaultDumpDirectory(): string {
  if (isRunningInContainer() && existsSync("/app/data/dumps")) {
    return "/app/data/dumps";
  }
  return process.cwd();
}
