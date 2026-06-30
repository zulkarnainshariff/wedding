import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sessionCookieName } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}?`))) {
    return true;
  }
  if (
    pathname === "/" ||
    pathname.startsWith("/api/public/") ||
    pathname === "/rsvp" ||
    pathname === "/guestbook" ||
    pathname.startsWith("/guestbook?") ||
    pathname === "/gallery" ||
    pathname.startsWith("/gallery?") ||
    pathname === "/api/guestbook" ||
    pathname.startsWith("/api/guestbook") ||
    pathname === "/api/gallery" ||
    pathname.startsWith("/api/gallery")
  ) {
    return true;
  }
  return false;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return false;

  const secret = getSessionSecret();
  if (!secret) return false;

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && (await hasValidSession(request))) {
      return NextResponse.redirect(new URL("/itinerary", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  if (!(await hasValidSession(request))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
