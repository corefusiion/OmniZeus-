// API Route: POST /api/auth/login
// Server-side authentication — sets a signed HttpOnly cookie with the session.
// This is the ONLY way the frontend should authenticate. Never trust client-side state for auth.
//
// EDGE-SAFE: todas as respostas usam `new Response(...)` nativo (não NextResponse.json)
// para compatibilidade total com Cloudflare Workers / next-on-pages.

import type { NextRequest } from "next/server";
import { createSessionCookie } from "@/lib/auth/session";
import { PRODUCTION_USERS } from "@/lib/auth/roles";
import { supabase } from "@/lib/db/supabaseClient";
import { getEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/passwordUtils";

export const runtime = "edge";

// ─── Helpers de resposta (nativos, sem NextResponse) ─────────────────────────

function jsonResponse(body: Record<string, any>, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function isProduction(): boolean {
  try {
    return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  } catch {
    return false;
  }
}

// ─── Rate limiter (por isolate — aceitável em edge) ──────────────────────────

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > LOCKOUT_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

function clearRateLimit(key: string): void {
  attempts.delete(key);
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON format." }, 400);
    }

    const { email, password } = body;
    if (!email || !password) {
      return jsonResponse({ error: "E-mail e senha são obrigatórios." }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 2. Rate limit
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rateKey = `${cleanEmail}|${clientIp}`;
    if (!checkRateLimit(rateKey)) {
      return jsonResponse(
        { success: false, error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
        429
      );
    }

    // 3. Check hardcoded production users (super admin)
    const prodUser = PRODUCTION_USERS.find(u => u.email.toLowerCase() === cleanEmail);
    const superAdminPassword = getEnv("SUPER_ADMIN_PASSWORD") || "Design20";

    if (prodUser && cleanPass === superAdminPassword) {
      clearRateLimit(rateKey);

      const userData = {
        id: prodUser.id,
        name: prodUser.name,
        email: prodUser.email,
        role: prodUser.role,
        companyId: prodUser.companyId,
        companyName: prodUser.companyName,
      };

      return await buildAuthResponse(
        { success: true, user: userData },
        {
          userId: prodUser.id,
          email: prodUser.email,
          name: prodUser.name,
          role: prodUser.role,
          companyId: prodUser.companyId,
          companyName: prodUser.companyName,
        }
      );
    }

    // 4. Check dynamically created employees in Supabase
    let employees: any[] = [];
    try {
      const { data } = await supabase.from("employees").select("*");
      employees = data || [];
    } catch (dbErr) {
      console.error("[LOGIN] Supabase employees fetch failed:", dbErr);
    }

    let empIndex = -1;
    for (let i = 0; i < employees.length; i++) {
      const e = employees[i];
      if ((e.email || "").toLowerCase() !== cleanEmail) continue;
      const stored = e.passwordHash || e.password_hash || e.password || e.temporary_password || e.temporaryPassword;
      if (stored && (await verifyPassword(cleanPass, stored))) {
        empIndex = i;
        break;
      }
    }

    if (empIndex >= 0) {
      const emp = employees[empIndex];
      clearRateLimit(rateKey);

      if (emp.status === "Bloqueado" || emp.status === "Inativo") {
        return jsonResponse(
          { success: false, error: "Esta conta está desativada ou bloqueada. Entre em contato com o Gestor da sua empresa." },
          403
        );
      }

      // Update last login (fire-and-forget)
      try {
        await supabase.from("employees").update({ last_login_at: new Date().toISOString() }).eq("id", emp.id);
      } catch {}

      const mustChangePassword = emp.must_change_password === true || emp.mustChangePassword === true;

      // Resolve company name
      let companyName = emp.companyName || emp.companyId || "";
      try {
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("id", emp.company_id || emp.companyId)
          .single();
        if (company) {
          companyName = company.tradeName || company.corporate_name || companyName;
        }
      } catch {}

      const userData = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        companyId: emp.company_id || emp.companyId,
        companyName,
        mustChangePassword,
        allowedModules: emp.allowed_modules || emp.allowedModules || [],
      };

      return await buildAuthResponse(
        { success: true, mustChangePassword, user: userData },
        {
          userId: emp.id,
          email: emp.email,
          name: emp.name,
          role: emp.role,
          companyId: emp.company_id || emp.companyId,
          companyName,
          mustChangePassword,
          allowedModules: emp.allowed_modules || emp.allowedModules || [],
        }
      );
    }

    // 5. No match
    return jsonResponse(
      { success: false, error: "E-mail ou senha incorretos. Verifique suas credenciais." },
      401
    );
  } catch (err: any) {
    console.error("[LOGIN CRITICAL ERROR]:", err);
    // Resposta nativa — nunca depende de NextResponse
    return jsonResponse(
      { success: false, error: err?.message || "Erro interno no servidor." },
      500
    );
  }
}

// ─── Constrói a resposta com Set-Cookie (autenticação) ───────────────────────
// Usa `new Response` nativo em vez de NextResponse.json + headers.set
// para evitar crashes do adapter next-on-pages em Cloudflare Workers.

async function buildAuthResponse(
  jsonBody: Record<string, any>,
  payload: {
    userId: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    companyName: string;
    mustChangePassword?: boolean;
    allowedModules?: string[];
  }
): Promise<Response> {
  try {
    const token = await createSessionCookie(payload as any);
    const isProd = isProduction();
    const cookieHeader = `omnizeus_session=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;

    return new Response(JSON.stringify(jsonBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
    });
  } catch (cookieErr: any) {
    // Se a criação do cookie falhar (crypto.subtle indisponível, etc.),
    // retornamos o JSON de sucesso SEM cookie — o frontend mostra o dashboard
    // mas o usuário precisará logar de novo no próximo refresh.
    console.error("[LOGIN] Cookie creation failed:", cookieErr);
    return jsonResponse(
      { ...jsonBody, warning: "Sessão não pôde ser criada. Tente novamente." },
      200
    );
  }
}

// ─── DELETE /api/auth/login (logout) ─────────────────────────────────────────

export async function DELETE() {
  return new Response(
    JSON.stringify({ success: true, message: "Sessão encerrada." }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "omnizeus_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      },
    }
  );
}
