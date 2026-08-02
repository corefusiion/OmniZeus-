export const dynamic = "force-dynamic";
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

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        companyId: session.companyId,
        companyName: session.companyName,
        mustChangePassword: Boolean(session.mustChangePassword),
        allowedModules: session.allowedModules || []
      }
    });
    
    // Completely disable caching for this endpoint to prevent session leaks
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Falha ao verificar sessão." },
      { status: 500 }
    );
  }
}

