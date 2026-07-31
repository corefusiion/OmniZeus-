// Server-Side Session Management — OmniZeus Multi-Tenant
// Uses signed HttpOnly cookies so the server always determines the user's companyId.
// companyId from the frontend body/query is NEVER trusted for authorization.

import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "./roles";

const SESSION_COOKIE = "omnizeus_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "omnizeus_super_secret_2026_change_in_prod";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  mustChangePassword?: boolean;
  issuedAt: number;
  expiresAt: number;
}


// ─── Simple HMAC-free base64 encoding (suitable for dev; swap with jose in prod) ────

function encodeSession(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  // Sign with a simple HMAC-like checksum (XOR of chars with secret)
  const sig = Buffer.from(simpleSign(encoded, SESSION_SECRET)).toString("base64url");
  return `${encoded}.${sig}`;
}

function decodeSession(token: string): SessionPayload | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expectedSig = Buffer.from(simpleSign(encoded, SESSION_SECRET)).toString("base64url");
    if (sig !== expectedSig) return null;
    const payload: SessionPayload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

function simpleSign(data: string, secret: string): string {
  // Deterministic string signature using char codes
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

// ─── Create a session cookie response ──────────────────────────────────────────

export function createSessionCookie(payload: Omit<SessionPayload, "issuedAt" | "expiresAt">): string {
  const now = Date.now();
  const fullPayload: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
  };
  return encodeSession(fullPayload);
}

// ─── Set session on a NextResponse ─────────────────────────────────────────────

export function setSessionCookie(res: NextResponse, payload: Omit<SessionPayload, "issuedAt" | "expiresAt">): NextResponse {
  const token = createSessionCookie(payload);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  });
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

export function getSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

// ─── Require session or return 401 ─────────────────────────────────────────

export function requireSession(req: NextRequest): { session: SessionPayload } | { error: NextResponse } {
  const session = getSession(req);
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

export function getSessionCompanyId(req: NextRequest, superAdminOverride?: string): string | null {
  const session = getSession(req);
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
