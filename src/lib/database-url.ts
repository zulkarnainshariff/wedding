/** Edge-safe DATABASE_URL helpers (no node:fs or process.cwd). */

export function rewriteLocalhostForDockerReachability(
  databaseUrl: string,
): string {
  if (databaseUrl.includes("@localhost")) {
    return databaseUrl.replace("@localhost", "@host.docker.internal");
  }
  if (databaseUrl.includes("127.0.0.1")) {
    return databaseUrl.replace("127.0.0.1", "host.docker.internal");
  }
  return databaseUrl;
}

/** Resolve DATABASE_URL for the app and migrate container. */
export function resolveDatabaseUrl(databaseUrl: string): string {
  if (process.env.RUNNING_IN_CONTAINER === "1") {
    return rewriteLocalhostForDockerReachability(databaseUrl);
  }
  return databaseUrl;
}
