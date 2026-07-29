import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  let sqlData: any = {};
  let caData: any = [];
  try {
    const sqlPath = path.join(process.cwd(), "data", "omnizeus_local_sql_database.json");
    if (fs.existsSync(sqlPath)) {
      sqlData = JSON.parse(fs.readFileSync(sqlPath, 'utf8'));
    }
    const caPath = path.join(process.cwd(), "data", "omnizeus_contaazul_customers.json");
    if (fs.existsSync(caPath)) {
      caData = JSON.parse(fs.readFileSync(caPath, 'utf8'));
    }
  } catch (e) {}

  return NextResponse.json({ sqlData, caData });
}
