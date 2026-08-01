import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth/session';

// Esta rota devolvia o banco inteiro (todas as empresas, credenciais e senhas)
// para qualquer requisição anônima. Agora é restrita ao super_adm.
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (session.role !== 'super_adm') {
    return NextResponse.json({ error: 'Acesso negado.', code: 'FORBIDDEN' }, { status: 403 });
  }

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
  } catch (err) {
    console.error('Falha ao ler arquivos de dados em /api/sync:', err);
    return NextResponse.json({ error: 'Falha ao carregar dados.' }, { status: 500 });
  }

  return NextResponse.json({ sqlData, caData });
}
