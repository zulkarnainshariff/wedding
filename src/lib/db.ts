import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./runtime-env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function getDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  const connectionString = resolveDatabaseUrl(raw);

  if (!globalForDb.db) {
    globalForDb.client = postgres(connectionString, { prepare: false });
    globalForDb.db = drizzle(globalForDb.client, { schema });
  }

  return globalForDb.db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});
