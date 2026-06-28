import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "./db";
import {
  normalizePermissions,
  type SessionUser,
  type UserPermissions,
} from "./permissions";
import { isAdminSession, roleLevelFromDb } from "./role-levels";
import { users } from "./schema";
import {
  normalizeUserPreferences,
  type UserPreferences,
} from "./user-preferences";

const SESSION_COOKIE = "wedding_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type SessionPayload = {
  sub: string;
  username: string;
  isAdmin: boolean;
  permissions: UserPermissions;
  tokenVersion: number;
  preferences: UserPreferences;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(user: {
  id: number;
  username: string;
  isAdmin: boolean;
  permissions: UserPermissions;
  tokenVersion: number;
  preferences: UserPreferences;
}): Promise<string> {
  return new SignJWT({
    username: user.username,
    isAdmin: user.isAdmin,
    permissions: user.permissions,
    tokenVersion: user.tokenVersion,
    preferences: user.preferences,
  } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const username = String(payload.username).trim().toLowerCase();
    const id = Number(payload.sub);
    if (!id || !username) return null;

    const userColumns = {
      id: users.id,
      tokenVersion: users.tokenVersion,
      isAdmin: users.isAdmin,
      roleLevel: users.roleLevel,
      permissions: users.permissions,
      preferences: users.preferences,
      username: users.username,
    };

    let [matchedById] = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    let row =
      matchedById && matchedById.username.toLowerCase() === username
        ? matchedById
        : undefined;

    if (!row) {
      [row] = await db
        .select(userColumns)
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
    }

    if (!row) return null;

    const tokenVersion = Number(payload.tokenVersion ?? 0);
    if (tokenVersion !== row.tokenVersion) return null;

    const roleLevel = roleLevelFromDb(row.roleLevel, row.isAdmin);

    return {
      id: row.id,
      username: row.username,
      roleLevel,
      isAdmin: isAdminSession(roleLevel),
      permissions: normalizePermissions(row.permissions, row.isAdmin, row.username),
      preferences: normalizeUserPreferences(row.preferences),
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  const roleLevel = roleLevelFromDb(user.roleLevel, user.isAdmin);

  return {
    id: user.id,
    username: user.username,
    roleLevel,
    isAdmin: isAdminSession(roleLevel),
    permissions: normalizePermissions(user.permissions, user.isAdmin, user.username),
    preferences: normalizeUserPreferences(user.preferences),
  };
}

export async function issueSessionForUser(
  user: typeof users.$inferSelect,
): Promise<string> {
  return createSessionToken({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    permissions: normalizePermissions(user.permissions, user.isAdmin, user.username),
    tokenVersion: user.tokenVersion,
    preferences: normalizeUserPreferences(user.preferences),
  });
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}
