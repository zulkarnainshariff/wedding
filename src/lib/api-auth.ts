import { NextResponse } from "next/server";
import {
  canEditItinerary,
  canManageUsers,
  type SessionUser,
} from "./permissions";
import { getSessionUser } from "./auth";

export async function getAuthUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export async function requireEditAccess(): Promise<SessionUser | NextResponse> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;
  if (!canEditItinerary(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function requireAdminAccess(): Promise<SessionUser | NextResponse> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function requireSuperuserAccess(): Promise<SessionUser | NextResponse> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;
  const { isSuperuser } = await import("./permissions");
  if (!isSuperuser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export function isAuthError(
  value: SessionUser | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
