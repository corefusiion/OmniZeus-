// Server-Side Session Management — OmniZeus Multi-Tenant
// Uses signed HttpOnly cookies so the server always determines the user's companyId.
// companyId from the frontend body/query is NEVER trusted for authorization.
//
// EDGE-COMPATIBLE: usa Web Crypto API (crypto.subtle) — roda no Edge Runtime,
// Cloudflare Workers e Node 20+. O formato da assinatura (HMAC-SHA256 base64url)
// é idêntico ao usado pelo middleware (src/middleware.ts), garantindo que
// cookies emitidos por um lado são validados pelo outro.

import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "./roles";

import { getEnv } from "@/lib/env";

const SESSION_COOKIE = "omnizeus_session";

function getSessionSecret(): string {
  const fromEnv = getEnv("SESSION_SECRET");
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  return "omnizeus_default_local_dev_session_secret_key_32bytes_long";
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  mustChangePassword?: boolean;
  allowedModules?: string[];
  issuedAt: number;
  expiresAt: number;
}

// ─── Base64URL helpers (sem Buffer — Edge-safe) ────────────────────────────────

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
  const binary = atob(pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Assinatura HMAC-SHA256 com comparação em tempo constante ──────────────────

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

async function encodeSession(payload: SessionPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const encoded = bytesToBase64Url(encoder.encode(json));
  return `${encoded}.${await sign(encoded)}`;
}

async function decodeSession(token: string): Promise<SessionPayload | null> {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;

    const expectedSig = await sign(encoded);
    // comparação em tempo constante (mesmo comprimento já exclui mismatch)
    if (sig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    if (diff !== 0) return null;

    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encoded))
    );
    if (typeof payload?.expiresAt !== "number" || Date.now() > payload.expiresAt) return null;
    if (!payload.userId || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Create a session cookie response ──────────────────────────────────────────

export async function createSessionCookie(payload: Omit<SessionPayload, "issuedAt" | "expiresAt">): Promise<string> {
  const now = Date.now();
  const fullPayload: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
  };
  return encodeSession(fullPayload);
}

export async function createAuthResponse(
  jsonBody: Record<string, any>,
  payload: Omit<SessionPayload, "issuedAt" | "expiresAt">,
  status: number = 200
): Promise<NextResponse> {
  const token = await createSessionCookie(payload);
  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;

  return new NextResponse(JSON.stringify(jsonBody), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader,
    },
  });
}

export async function setSessionCookie(res: NextResponse, payload: Omit<SessionPayload, "issuedAt" | "expiresAt">): Promise<NextResponse> {
  const token = await createSessionCookie(payload);
  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
  
  try {
    res.headers.set("Set-Cookie", cookieHeader);
  } catch {}

  try {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
  } catch {}

  return res;
}

// ─── Clear session (logout) ──────────────────────────────────────────────────

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

// ─── Read session from request ──────────────────────────────────────────────

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

// ─── Require session or return 401 ─────────────────────────────────────────

export async function requireSession(req: NextRequest): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession(req);
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Não autenticado. Faça login novamente.", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    };
  }
  return { session };
}

// ─── Get companyId from session (safe — never from body/query) ─────────────

export async function getSessionCompanyId(req: NextRequest, superAdminOverride?: string): Promise<string | null> {
  const session = await getSession(req);
  if (!session) return null;

  // Super Admin can impersonate any company via a verified override
  if (session.role === "super_adm" && superAdminOverride) {
    return superAdminOverride;
  }

  return session.companyId;
}

// ─── Assert tenant access (throws if wrong company) ─────────────────────────

export function assertTenantAccess(session: SessionPayload, requestedCompanyId: string): boolean {
  if (session.role === "super_adm") return true; // Super Admin has global access
  return session.companyId === requestedCompanyId;
}
