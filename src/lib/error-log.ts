import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorLogs } from "@/lib/schema";

export type OperationErrorInput = {
  operation: string;
  resourceType: string;
  resourceId?: string | number | null;
  summary: string;
  error: unknown;
  userId?: number | null;
  username?: string | null;
  metadata?: Record<string, unknown>;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export async function logOperationError(input: OperationErrorInput): Promise<void> {
  try {
    await db.insert(errorLogs).values({
      operation: input.operation,
      resourceType: input.resourceType,
      resourceId:
        input.resourceId == null ? null : String(input.resourceId),
      summary: input.summary,
      errorMessage: errorMessage(input.error),
      userId: input.userId ?? null,
      username: input.username ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (logError) {
    console.error("Failed to write error log:", logError);
  }
}

export async function listErrorLogs(filters: {
  from?: Date;
  to?: Date;
  username?: string;
  operation?: string;
  resourceType?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(errorLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(errorLogs.createdAt, filters.to));
  if (filters.username) {
    conditions.push(eq(errorLogs.username, filters.username.toLowerCase()));
  }
  if (filters.operation) {
    conditions.push(eq(errorLogs.operation, filters.operation));
  }
  if (filters.resourceType) {
    conditions.push(eq(errorLogs.resourceType, filters.resourceType));
  }

  return db
    .select()
    .from(errorLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(errorLogs.createdAt))
    .limit(filters.limit ?? 1000);
}

export async function deleteErrorLogRows(ids: number[]) {
  if (ids.length === 0) return 0;
  await db.delete(errorLogs).where(inArray(errorLogs.id, ids));
  return ids.length;
}

export async function deleteErrorLogsInRange(filters: {
  from?: Date;
  to?: Date;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(errorLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(errorLogs.createdAt, filters.to));
  if (conditions.length === 0) return 0;

  await db.delete(errorLogs).where(and(...conditions));
  return 0;
}
