import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const info: any = {};
  try {
    info.cryptoType = typeof crypto;
    info.globalCryptoType = typeof globalThis.crypto;
    info.subtleType = typeof globalThis.crypto?.subtle;
    info.processType = typeof process;
  } catch (err: any) {
    info.error = err?.message;
  }
  return NextResponse.json(info);
}
