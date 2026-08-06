import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabaseClient';

export async function GET() {
  const newEmp = {
    id: `emp_${Date.now()}`,
    company_id: 'comp_default',
    name: 'Test Name',
    email: 'test@t.com',
    department: 'Test Dept',
    role: 'gestor',
    allowed_modules: [],
    status: 'Primeiro acesso pendente',
    must_change_password: true,
    password_hash: 'pbkdf2$10000$salt$hash',
    password_changed_at: undefined,
    last_login_at: undefined,
    birth_date: undefined,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('employees').insert(newEmp).select();
  return NextResponse.json({ data, error });
}
