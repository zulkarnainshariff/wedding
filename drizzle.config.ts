import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(databaseUrl),
  },
});
