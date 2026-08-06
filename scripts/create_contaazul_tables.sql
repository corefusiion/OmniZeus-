-- Tabelas necessárias para a integração Conta Azul funcionar no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Clientes sincronizados da Conta Azul
CREATE TABLE IF NOT EXISTS public.contaazul_clients (
  id text NOT NULL,
  company_id text NOT NULL DEFAULT 'comp_techcontabil_01',
  nome text,
  name text,
  fantasia text,
  email text,
  cpf_cnpj text,
  document text,
  telefone text,
  phone text,
  telefone_celular text,
  tipo_pessoa text,
  person_type text,
  perfis jsonb,
  endereco jsonb,
  codigo text,
  observacoes text,
  ativo boolean DEFAULT true,
  status text DEFAULT 'Ativo',
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id, company_id)
);

-- 2. Fornecedores sincronizados da Conta Azul
CREATE TABLE IF NOT EXISTS public.contaazul_suppliers (
  id text NOT NULL,
  company_id text NOT NULL DEFAULT 'comp_techcontabil_01',
  nome text,
  name text,
  fantasia text,
  email text,
  cpf_cnpj text,
  document text,
  telefone text,
  phone text,
  tipo_pessoa text,
  person_type text,
  perfis jsonb,
  ativo boolean DEFAULT true,
  status text DEFAULT 'Ativo',
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id, company_id)
);

-- 3. Lançamentos financeiros (receitas e despesas)
CREATE TABLE IF NOT EXISTS public.contaazul_entries (
  id text NOT NULL,
  company_id text NOT NULL DEFAULT 'comp_techcontabil_01',
  description text,
  "desc" text,
  value numeric,
  val numeric,
  valor numeric,
  due_date text,
  vencimento text,
  status text,
  situacao text,
  category text,
  tipo text,
  type text,
  id_evento text,
  nome_pessoa text,
  cliente text,
  fornecedor text,
  data_pagamento text,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id, company_id)
);

-- 4. Categorias de lançamentos
CREATE TABLE IF NOT EXISTS public.contaazul_categories (
  id text NOT NULL PRIMARY KEY,
  name text,
  nome text,
  type text,
  tipo text,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Logs de sincronização
CREATE TABLE IF NOT EXISTS public.contaazul_sync_logs (
  id text NOT NULL PRIMARY KEY,
  company_id text,
  company_name text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  duration_ms integer,
  total_fetched integer DEFAULT 0,
  new_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  status text,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Config da integração (se não existir)
CREATE TABLE IF NOT EXISTS public.contaazul_config (
  id text NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id text UNIQUE,
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  redirect_uri text DEFAULT 'https://contaazul.com',
  is_connected boolean DEFAULT false,
  last_sync_at timestamp with time zone,
  next_sync_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

-- 7. Contas a Pagar (usada na reconciliação)
CREATE TABLE IF NOT EXISTS public.payables (
  id text NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id text,
  creditor text,
  fornecedor text,
  valor numeric,
  value_brl numeric,
  status text DEFAULT 'Pendente',
  paid_at timestamp with time zone,
  conta_azul_id text,
  reconciliation_status text,
  created_at timestamp with time zone DEFAULT now()
);

-- Desabilitar RLS em todas as tabelas Conta Azul
ALTER TABLE public.contaazul_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contaazul_suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contaazul_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contaazul_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contaazul_sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contaazul_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables DISABLE ROW LEVEL SECURITY;

-- Conceder acesso completo
GRANT ALL ON public.contaazul_clients TO anon, authenticated, service_role;
GRANT ALL ON public.contaazul_suppliers TO anon, authenticated, service_role;
GRANT ALL ON public.contaazul_entries TO anon, authenticated, service_role;
GRANT ALL ON public.contaazul_categories TO anon, authenticated, service_role;
GRANT ALL ON public.contaazul_sync_logs TO anon, authenticated, service_role;
GRANT ALL ON public.contaazul_config TO anon, authenticated, service_role;
GRANT ALL ON public.payables TO anon, authenticated, service_role;

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';
