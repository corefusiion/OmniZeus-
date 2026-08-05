export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/db/supabaseClient';

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'NÃ£o autenticado.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (session.role !== 'super_adm') {
    return NextResponse.json({ error: 'Acesso negado.', code: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const [{ data: companies }, { data: employees }, { data: pedidos_saas }, { data: audit_logs }] = await Promise.all([
      supabase.from('companies').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('pedidos_saas').select('*'),
      supabase.from('audit_logs').select('*')
    ]);

    const sqlData = {
      companies: companies || [],
      employees: employees || [],
      pedidos_saas: pedidos_saas || [],
      audit_logs: audit_logs || []
    };

    const caData: any = [];

    return NextResponse.json({ sqlData, caData });
  } catch (err) {
    console.error('Falha ao carregar dados em /api/sync:', err);
    return NextResponse.json({ error: 'Falha ao carregar dados.' }, { status: 500 });
  }
}

