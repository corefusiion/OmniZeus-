// Next.js Middleware — OmniZeus Multi-Tenant Auth Guard
// Runs at the Edge before every request.
// Protected routes require a valid omnizeus_session cookie.
// If not present, redirects to /login.

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "omnizeus_session";

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/_next",
  "/favicon.ico",
  "/fonts",
  "/images",
  "/robots.txt",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;

  // If no session cookie → redirect to login (for page routes) or 401 (for API routes)
  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado. Faça login novamente.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Parse session payload for RBAC checks
  try {
    const rawPayload = sessionCookie.split(".")[0];
    if (rawPayload) {
      const decoded = JSON.parse(Buffer.from(rawPayload, "base64").toString("utf-8"));
      const userRole = decoded.role;

      // 1. /super-adm & /empresas -> Only super_adm
      if ((pathname.startsWith("/super-adm") || pathname.startsWith("/empresas")) && userRole !== "super_adm") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      // 2. /configuracoes & /usuarios -> Exclusive to super_adm & gestor (block funcionario)
      if ((pathname.startsWith("/configuracoes") || pathname.startsWith("/usuarios")) && userRole === "funcionario") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  } catch {}

  // Forward request with session info in headers (for API routes to use)
  const response = NextResponse.next();
  return response;
}


export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
