-- Migração de dados legados do comp_zenitus para comp_techcontabil_01
-- Execute no SQL Editor do Supabase se desejar transferir dados sincronizados anteriormente

UPDATE public.contaazul_config SET company_id = 'comp_techcontabil_01' WHERE company_id = 'comp_zenitus' OR company_id IS NULL;
UPDATE public.contaazul_clients SET company_id = 'comp_techcontabil_01' WHERE company_id = 'comp_zenitus' OR company_id IS NULL;
UPDATE public.contaazul_suppliers SET company_id = 'comp_techcontabil_01' WHERE company_id = 'comp_zenitus' OR company_id IS NULL;
UPDATE public.contaazul_entries SET company_id = 'comp_techcontabil_01' WHERE company_id = 'comp_zenitus' OR company_id IS NULL;
UPDATE public.contaazul_sync_logs SET company_id = 'comp_techcontabil_01' WHERE company_id = 'comp_zenitus' OR company_id IS NULL;
NOTIFY pgrst, 'reload schema';
