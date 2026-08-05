import { NextResponse } from "next/server";
export const runtime = "edge";
export async function GET() {
  return NextResponse.json({ version: "DEBUG_VERSION_1" });
}
