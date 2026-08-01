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

// Webhooks são chamados por serviços externos, que não possuem cookie de sessão.
// Cada um valida sua própria autenticidade (assinatura Stripe / token compartilhado).
const WEBHOOK_PATHS = [
  "/api/webhook/stripe",
  "/api/webhook/whatsapp",
  "/api/contaazul/callback",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

function isWebhook(pathname: string): boolean {
  return WEBHOOK_PATHS.some(p => pathname.startsWith(p));
}

// Verifica a assinatura HMAC do cookie usando Web Crypto (compatível com Edge runtime)
async function verifyAndDecode(token: string): Promise<any | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(encoded));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;

    const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    if (typeof payload?.expiresAt !== "number" || Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublic(pathname) || isWebhook(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;

  const unauthorized = () => {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado. Faça login novamente.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!sessionCookie) return unauthorized();

  // A assinatura precisa ser validada aqui: sem isso, um cookie forjado com
  // role "super_adm" passaria pelas checagens de RBAC abaixo.
  const decoded = await verifyAndDecode(sessionCookie);
  if (!decoded) return unauthorized();

  const userRole = decoded.role;

  // 1. /super-adm & /empresas -> Only super_adm
  if ((pathname.startsWith("/super-adm") || pathname.startsWith("/empresas")) && userRole !== "super_adm") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2. /configuracoes & /usuarios -> Exclusive to super_adm & gestor (block funcionario)
  if ((pathname.startsWith("/configuracoes") || pathname.startsWith("/usuarios")) && userRole === "funcionario") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}


export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
