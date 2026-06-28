import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  isPostgresUniqueViolation,
  resetApplicationSequences,
} from "@/lib/database-sequences";
import { db } from "@/lib/db";
import {
  auditLogs,
  loginLogs,
  usageLogs,
  userActivitySessions,
  users,
} from "@/lib/schema";
import type { SessionUser } from "@/lib/permissions";

export const USAGE_IDLE_MS = 3 * 60 * 60 * 1000;
export const USAGE_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function requestMetaFrom(request?: Request | null): RequestMeta {
  if (!request) return {};
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

async function resolveLogUserId(user: SessionUser): Promise<number | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, user.username.toLowerCase()))
    .limit(1);
  return row?.id ?? null;
}

async function withSequenceRecovery<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isPostgresUniqueViolation(error)) throw error;
    await resetApplicationSequences();
    return operation();
  }
}

export async function startUserSession(
  user: SessionUser,
  eventType: "login" | "session_resume",
  request?: Request | null,
): Promise<string> {
  const sessionId = randomUUID();
  const meta = requestMetaFrom(request);
  const now = new Date();
  const userId = await resolveLogUserId(user);
  if (!userId) return sessionId;

  await withSequenceRecovery(() =>
    db.insert(userActivitySessions).values({
      userId,
      sessionId,
      startedAt: now,
      lastSeenAt: now,
    }),
  );

  await withSequenceRecovery(() =>
    db.insert(loginLogs).values({
      userId,
      username: user.username,
      eventType,
      sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }),
  );

  await withSequenceRecovery(() =>
    db.insert(usageLogs).values({
      userId,
      username: user.username,
      sessionId,
      eventType: "session_start",
      path: null,
      metadata: { trigger: eventType },
    }),
  );

  return sessionId;
}

export async function logLogout(
  user: SessionUser,
  sessionId?: string | null,
  request?: Request | null,
): Promise<void> {
  const meta = requestMetaFrom(request);
  const userId = await resolveLogUserId(user);
  await withSequenceRecovery(() =>
    db.insert(loginLogs).values({
      userId,
      username: user.username,
      eventType: "logout",
      sessionId: sessionId ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }),
  );

  if (sessionId) {
    await db
      .update(userActivitySessions)
      .set({ endedAt: new Date() })
      .where(eq(userActivitySessions.sessionId, sessionId));
  }
}

export async function logLoginFailed(
  username: string,
  request?: Request | null,
): Promise<void> {
  const meta = requestMetaFrom(request);
  await withSequenceRecovery(() =>
    db.insert(loginLogs).values({
      username: username.toLowerCase(),
      eventType: "login_failed",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }),
  );
}

export async function recordUsageHeartbeat(input: {
  user: SessionUser;
  path?: string | null;
  detailed?: boolean;
  request?: Request | null;
}): Promise<{ sessionId: string; resumed: boolean }> {
  const now = new Date();
  const [latest] = await db
    .select()
    .from(userActivitySessions)
    .where(
      and(
        eq(userActivitySessions.userId, input.user.id),
        sql`${userActivitySessions.endedAt} IS NULL`,
      ),
    )
    .orderBy(desc(userActivitySessions.lastSeenAt))
    .limit(1);

  let sessionId = latest?.sessionId;
  let resumed = false;

  if (
    !sessionId ||
    !latest ||
    now.getTime() - latest.lastSeenAt.getTime() > USAGE_IDLE_MS
  ) {
    sessionId = await startUserSession(input.user, "session_resume", input.request);
    resumed = true;
  } else {
    await db
      .update(userActivitySessions)
      .set({ lastSeenAt: now })
      .where(eq(userActivitySessions.sessionId, sessionId));
  }

  const eventType = input.detailed ? "page_view" : "heartbeat";
  if (input.detailed || eventType === "heartbeat") {
    const userId = await resolveLogUserId(input.user);
    await withSequenceRecovery(() =>
      db.insert(usageLogs).values({
        userId,
        username: input.user.username,
        sessionId,
        eventType,
        path: input.path ?? null,
      }),
    );
  }

  return { sessionId, resumed };
}

export async function logAuditEvent(input: {
  user: SessionUser;
  action: "create" | "update" | "delete";
  resourceType: string;
  resourceId?: string | number | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await withSequenceRecovery(async () => {
    const userId = await resolveLogUserId(input.user);
    await db.insert(auditLogs).values({
      userId,
      username: input.user.username,
      action: input.action,
      resourceType: input.resourceType,
      resourceId:
        input.resourceId == null ? null : String(input.resourceId),
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    });
  });
}

export async function listLoginLogs(filters: {
  from?: Date;
  to?: Date;
  username?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(loginLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(loginLogs.createdAt, filters.to));
  if (filters.username) {
    conditions.push(eq(loginLogs.username, filters.username.toLowerCase()));
  }

  let query = db.select().from(loginLogs).orderBy(desc(loginLogs.createdAt));
  if (conditions.length === 1) {
    query = query.where(conditions[0]) as typeof query;
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions)) as typeof query;
  }
  return query.limit(filters.limit ?? 500);
}

export async function listAuditLogs(filters: {
  from?: Date;
  to?: Date;
  username?: string;
  resourceType?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
  if (filters.username) {
    conditions.push(eq(auditLogs.username, filters.username.toLowerCase()));
  }
  if (filters.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  let query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  if (conditions.length === 1) {
    query = query.where(conditions[0]) as typeof query;
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions)) as typeof query;
  }
  return query.limit(filters.limit ?? 500);
}

export async function listUsageLogs(filters: {
  from?: Date;
  to?: Date;
  username?: string;
  eventType?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(usageLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(usageLogs.createdAt, filters.to));
  if (filters.username) {
    conditions.push(eq(usageLogs.username, filters.username.toLowerCase()));
  }
  if (filters.eventType) {
    conditions.push(eq(usageLogs.eventType, filters.eventType));
  }

  let query = db.select().from(usageLogs).orderBy(desc(usageLogs.createdAt));
  if (conditions.length === 1) {
    query = query.where(conditions[0]) as typeof query;
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions)) as typeof query;
  }
  return query.limit(filters.limit ?? 500);
}

export async function listActiveUsers(withinMs = USAGE_ACTIVE_WINDOW_MS) {
  const since = new Date(Date.now() - withinMs);
  const rows = await db
    .select({
      userId: userActivitySessions.userId,
      username: users.username,
      lastSeenAt: userActivitySessions.lastSeenAt,
      sessionId: userActivitySessions.sessionId,
    })
    .from(userActivitySessions)
    .innerJoin(users, eq(users.id, userActivitySessions.userId))
    .where(
      and(
        gte(userActivitySessions.lastSeenAt, since),
        sql`${userActivitySessions.endedAt} IS NULL`,
      ),
    )
    .orderBy(desc(userActivitySessions.lastSeenAt));

  return rows;
}

export async function deleteLogRows(input: {
  kind: "login" | "audit" | "usage";
  ids: number[];
}) {
  if (input.ids.length === 0) return 0;
  const table =
    input.kind === "login"
      ? loginLogs
      : input.kind === "audit"
        ? auditLogs
        : usageLogs;
  const deleted = await db
    .delete(table)
    .where(inArray(table.id, input.ids))
    .returning({ id: table.id });
  return deleted.length;
}

export async function deleteLogsInRange(input: {
  kind: "login" | "audit" | "usage";
  from?: Date;
  to?: Date;
}) {
  const table =
    input.kind === "login"
      ? loginLogs
      : input.kind === "audit"
        ? auditLogs
        : usageLogs;
  const conditions = [];
  if (input.from) conditions.push(gte(table.createdAt, input.from));
  if (input.to) conditions.push(lte(table.createdAt, input.to));
  if (conditions.length === 0) return 0;

  const deleted = await db
    .delete(table)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .returning({ id: table.id });
  return deleted.length;
}
