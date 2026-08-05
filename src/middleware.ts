import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // BYPASSED: The full middleware was causing a 500 error in Cloudflare Edge Runtime.
  // Validation is now handled at the API route and layout levels.
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
