export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptContaAzulFields } from "@/lib/crypto/atRest";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

const SUPER_ADMIN_ONLY_TABLES = [
  "settings",
  "purchase_requests",
  "custom_job_roles",
  "dashboard_metrics",
  "ai_stress_test_logs"
];

const GLOBAL_TABLES = [
  "companies",
  "settings",
  "purchase_requests",
  "custom_job_roles",
  "dashboard_metrics",
  "ai_stress_test_logs",
  "pedidos_saas"
];

const SENSITIVE_FIELDS = [
  "openrouter_api_key",
  "lobehub_api_key",
  "evolution_api_key",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "custom_ai_key",
  "client_secret",
  "access_token",
  "refresh_token",
  "password_hash"
];

const WRITABLE_TABLES = new Set([
  "settings", "companies", "employees", "pedidos_saas",
  "ai_usage_logs", "custom_agents", "contaazul_config",
  "purchase_requests", "contracts", "tasks", "payables",
  "contaazul_customers", "contaazul_clients", "contaazul_suppliers",
  "contaazul_entries", "custom_job_roles", "dashboard_metrics",
  "ai_stress_test_logs", "ai_usage_metrics", "audit_logs",
  "contaazul_categories"
]);

function isWritableTable(table: string): boolean {
  return WRITABLE_TABLES.has(table);
}

function maskSecret(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.length <= 8 ? "********" : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function redact<T>(input: T): T {
  if (Array.isArray(input)) return input.map(item => redact(item)) as unknown as T;
  if (input && typeof input === "object") {
    const out: any = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        out[key] = val ? maskSecret(val) : val;
      } else {
        out[key] = redact(val);
      }
    }
    return out;
  }
  return input;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const table = url.searchParams.get("table");

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso negado.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const isSuperAdmin = session.role === "super_adm";
  const requestedCompanyId = url.searchParams.get("company_id") || url.searchParams.get("companyId") || req.headers.get("x-company-id");

  if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global" && requestedCompanyId !== session.companyId) {
    return NextResponse.json({ error: "Acesso negado.", code: "FORBIDDEN" }, { status: 403 });
  }

  if (!table) {
    return NextResponse.json({ error: "Parâmetro 'table' é obrigatório.", code: "TABLE_REQUIRED" }, { status: 400 });
  }

  if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) {
    return NextResponse.json({ error: "Acesso negado.", code: "FORBIDDEN" }, { status: 403 });
  }

  const effectiveCompanyId = isSuperAdmin 
    ? ((requestedCompanyId && requestedCompanyId !== "global") ? requestedCompanyId : (session.companyId || "global")) 
    : session.companyId;

  try {
    let query = supabase.from(table).select('*');
    
    if (table === "companies" && !isSuperAdmin) {
      query = query.eq('id', session.companyId);
    } else if (!GLOBAL_TABLES.includes(table)) {
      if (effectiveCompanyId && effectiveCompanyId !== "global") {
        query = query.eq('company_id', effectiveCompanyId);
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`Supabase GET Error on ${table}:`, error);
      return NextResponse.json({ data: [] });
    }

    if (table === "settings" && data && data.length > 0) {
      return NextResponse.json({ data: redact(data[0]) });
    }

    return NextResponse.json({ data: redact(data || []) });
  } catch (err) {
    console.error("Supabase GET exception:", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table, settings, contaazul_config } = body;
    let record = body.record;

    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Acesso negado.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const isSuperAdmin = session.role === "super_adm";
    const canManageEmployees = session.role === "super_adm" || session.role === "gestor";
    const requestedCompanyId = req.headers.get("x-company-id") || body.company_id || body.companyId;

    if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== session.companyId) {
      return NextResponse.json({ error: "Acesso negado.", code: "FORBIDDEN" }, { status: 403 });
    }

    const effectiveCompanyId = isSuperAdmin 
      ? ((requestedCompanyId && requestedCompanyId !== "global") ? requestedCompanyId : (session.companyId || "comp_techcontabil_01")) 
      : session.companyId;

    if (action === "update_settings" && settings) {
      if (!isSuperAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      const { data, error } = await supabase
        .from('settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', 'master_config')
        .select()
        .single();
        
      if (error && error.code === 'PGRST116') {
        // Se não existir, faz insert
        const { data: inserted } = await supabase.from('settings').insert({ id: 'master_config', ...settings }).select().single();
        return NextResponse.json({ success: true, settings: inserted });
      }
      return NextResponse.json({ success: true, settings: data });
    }

    if (action === "update_contaazul_config" && contaazul_config) {
      // Gestores and Super Admins can manage their own company's Conta Azul config
      const canManageContaAzul = isSuperAdmin || session.role === "gestor";
      if (!canManageContaAzul) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      const compId = contaazul_config.company_id || effectiveCompanyId;
      const encryptedConfig = await encryptContaAzulFields(contaazul_config);
      const payload = { ...encryptedConfig, company_id: compId, updated_at: new Date().toISOString() };

      // Check if a row already exists (upsert with onConflict fails without unique constraint on company_id)
      const { data: existing } = await supabase
        .from('contaazul_config')
        .select('id')
        .eq('company_id', compId)
        .maybeSingle();

      let data, error;
      if (existing?.id) {
        ({ data, error } = await supabase
          .from('contaazul_config')
          .update(payload)
          .eq('company_id', compId)
          .select()
          .single());
      } else {
        ({ data, error } = await supabase
          .from('contaazul_config')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select()
          .single());
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, contaazul_config: data });
    }


    if (action === "delete" && table && record?.id) {
      if (!isWritableTable(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      const { error } = await supabase.from(table).delete().eq('id', record.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "insert" && table && record) {
      if (!isWritableTable(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      if (table === "employees" && !canManageEmployees) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      if (!GLOBAL_TABLES.includes(table)) {
        record.company_id = effectiveCompanyId;
        delete record.companyId;
      }
      
      const { data, error } = await supabase.from(table).insert(record).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, record: data?.[0] || record });
    }

    if (action === "update" && table && record && record.id) {
      if (!isWritableTable(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      if (table === "employees" && !canManageEmployees) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      const { data, error } = await supabase.from(table).update(record).eq('id', record.id).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, record: data?.[0] || record });
    }

    if (action === "set_table" && table && record) {
      if (!isWritableTable(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      
      const canExecuteSetTable = isSuperAdmin || session.role === "gestor";
      if (!canExecuteSetTable) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

      if (Array.isArray(record) && record.length > 0) {
         const recordsWithTenant = record.map((item: any) => {
           if (!GLOBAL_TABLES.includes(table) && typeof item === "object" && item !== null) {
             return { ...item, company_id: item.company_id || item.companyId || effectiveCompanyId };
           }
           return item;
         });
         const { error } = await supabase.from(table).upsert(recordsWithTenant);
         if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/db error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



