export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { fetchContaAzulCategories, insertContaAzulCategory, updateContaAzulCategory, saveContaAzulCategories } from "@/lib/db/serverDb";

export async function GET() {
  try {
    const categories = await fetchContaAzulCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      await saveContaAzulCategories(body);
      return NextResponse.json({ success: true, data: body });
    }
    
    if (body.id) {
      await updateContaAzulCategory(body);
    } else {
      const newCat = { id: `cat_${Date.now()}`, ...body };
      await insertContaAzulCategory(newCat);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

