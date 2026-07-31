// API Route: GET /api/auth/me
// Returns current authenticated user profile from HttpOnly session cookie.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        companyId: session.companyId,
        companyName: session.companyName,
        mustChangePassword: Boolean(session.mustChangePassword)
      }
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Falha ao verificar sessão." },
      { status: 500 }
    );
  }
}
