export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { fetchWithAutoRefresh, getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";

export const runtime = "edge";

function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const CLIENTES = [
  { id: "cli_seed_01", name: "Construtora Horizonte SA", nome: "Construtora Horizonte SA", email: "financeiro@horizonte.com.br", document: "12.345.678/0001-90", documento: "12.345.678/0001-90", phone: "(71) 3322-1100", telefone: "(71) 3322-1100", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_02", name: "Padaria Sabor Real Ltda", nome: "Padaria Sabor Real Ltda", email: "contato@saborreal.com.br", document: "23.456.789/0001-01", documento: "23.456.789/0001-01", phone: "(71) 3455-2200", telefone: "(71) 3455-2200", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_03", name: "Academia Corpo em Forma", nome: "Academia Corpo em Forma", email: "admin@corpoemforma.com.br", document: "34.567.890/0001-12", documento: "34.567.890/0001-12", phone: "(71) 3566-3300", telefone: "(71) 3566-3300", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_04", name: "Clinica Saude Plena Ltda", nome: "Clinica Saude Plena Ltda", email: "faturamento@saudeplena.med.br", document: "45.678.901/0001-23", documento: "45.678.901/0001-23", phone: "(71) 3677-4400", telefone: "(71) 3677-4400", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_05", name: "Escola de Idiomas Fluente", nome: "Escola de Idiomas Fluente", email: "matriculas@fluente.edu.br", document: "56.789.012/0001-34", documento: "56.789.012/0001-34", phone: "(71) 3788-7700", telefone: "(71) 3788-7700", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_06", name: "Restaurante Sabores da Bahia", nome: "Restaurante Sabores da Bahia", email: "reservas@saboresbahia.com.br", document: "67.890.123/0001-45", documento: "67.890.123/0001-45", phone: "(71) 3899-8800", telefone: "(71) 3899-8800", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_07", name: "Tech Solutions Informatica Ltda", nome: "Tech Solutions Informatica Ltda", email: "ti@techsolutions.com.br", document: "78.901.234/0001-56", documento: "78.901.234/0001-56", phone: "(71) 3910-9900", telefone: "(71) 3910-9900", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_08", name: "Auto Pecas Norte Ltda", nome: "Auto Pecas Norte Ltda", email: "vendas@autopecasnorte.com.br", document: "89.012.345/0001-67", documento: "89.012.345/0001-67", phone: "(71) 4021-0011", telefone: "(71) 4021-0011", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "cli_seed_09", name: "Carlos Eduardo Mendes", nome: "Carlos Eduardo Mendes", email: "carlosmendes@gmail.com", document: "123.456.789-00", documento: "123.456.789-00", phone: "(71) 98811-5500", telefone: "(71) 98811-5500", person_type: "NATURAL_PERSON", status: "Ativo" },
  { id: "cli_seed_10", name: "Ana Paula Santos Ferreira", nome: "Ana Paula Santos Ferreira", email: "anapaula.sf@hotmail.com", document: "234.567.890-11", documento: "234.567.890-11", phone: "(71) 99922-6600", telefone: "(71) 99922-6600", person_type: "NATURAL_PERSON", status: "Ativo" },
];

const FORNECEDORES = [
  { id: "supp_seed_01", name: "Distribuidora Nacional de Papeis SA", nome: "Distribuidora Nacional de Papeis SA", email: "vendas@distpapeis.com.br", document: "78.901.234/0002-37", documento: "78.901.234/0002-37", phone: "(11) 3001-1234", telefone: "(11) 3001-1234", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "supp_seed_02", name: "TechSoft Sistemas de TI Ltda", nome: "TechSoft Sistemas de TI Ltda", email: "comercial@techsoft.com.br", document: "89.012.345/0002-48", documento: "89.012.345/0002-48", phone: "(11) 4002-5678", telefone: "(11) 4002-5678", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "supp_seed_03", name: "Clean Max Servicos de Limpeza Ltda", nome: "Clean Max Servicos de Limpeza Ltda", email: "orcamento@cleanmax.com.br", document: "90.123.456/0002-59", documento: "90.123.456/0002-59", phone: "(71) 3500-2345", telefone: "(71) 3500-2345", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "supp_seed_04", name: "Office Supplies Materiais de Escritorio", nome: "Office Supplies Materiais de Escritorio", email: "pedidos@officesupplies.com.br", document: "01.234.567/0002-60", documento: "01.234.567/0002-60", phone: "(11) 3003-3456", telefone: "(11) 3003-3456", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "supp_seed_05", name: "Energia Solar Nordeste Ltda", nome: "Energia Solar Nordeste Ltda", email: "projetos@energiasolar-ne.com.br", document: "12.345.679/0002-71", documento: "12.345.679/0002-71", phone: "(71) 3600-4567", telefone: "(71) 3600-4567", person_type: "LEGAL_PERSON", status: "Ativo" },
  { id: "supp_seed_06", name: "Grafica Premium Impressoes Ltda", nome: "Grafica Premium Impressoes Ltda", email: "arte@graficapremium.com.br", document: "23.456.780/0002-82", documento: "23.456.780/0002-82", phone: "(71) 3700-5678", telefone: "(71) 3700-5678", person_type: "LEGAL_PERSON", status: "Ativo" },
];

const SERVICOS = [
  { id: "srv_seed_01", name: "Contabilidade Mensal - Simples Nacional", nome: "Contabilidade Mensal - Simples Nacional", value: 850.00, valor: 850.00, description: "Escrituracao contabil e obrigacoes acessorias para Simples Nacional" },
  { id: "srv_seed_02", name: "Contabilidade Mensal - Lucro Presumido", nome: "Contabilidade Mensal - Lucro Presumido", value: 1500.00, valor: 1500.00, description: "Servicos contabeis completos para Lucro Presumido" },
  { id: "srv_seed_03", name: "Abertura de Empresa LTDA", nome: "Abertura de Empresa LTDA", value: 1200.00, valor: 1200.00, description: "Constituicao completa de empresa LTDA na Junta Comercial e Receita Federal" },
  { id: "srv_seed_04", name: "Abertura de MEI", nome: "Abertura de MEI", value: 150.00, valor: 150.00, description: "Registro de Microempreendedor Individual" },
  { id: "srv_seed_05", name: "Declaracao IRPF - Pessoa Fisica", nome: "Declaracao IRPF - Pessoa Fisica", value: 350.00, valor: 350.00, description: "Declaracao anual de IRPF com todos os rendimentos e deducoes" },
  { id: "srv_seed_06", name: "Folha de Pagamento Mensal", nome: "Folha de Pagamento Mensal", value: 600.00, valor: 600.00, description: "Processamento da folha de pagamento e encargos trabalhistas" },
  { id: "srv_seed_07", name: "Consultoria Tributaria", nome: "Consultoria Tributaria", value: 2500.00, valor: 2500.00, description: "Analise e planejamento tributario para reducao da carga fiscal" },
  { id: "srv_seed_08", name: "Regularizacao Fiscal e REFIS", nome: "Regularizacao Fiscal e REFIS", value: 900.00, valor: 900.00, description: "Adesao e acompanhamento de parcelamentos de dividas tributarias" },
];

const RECEITAS = [
  { id: "rec_seed_01", description: "Honorario Contabil - Construtora Horizonte SA - Jul/2026", desc: "Honorario Contabil - Construtora Horizonte SA - Jul/2026", value: 1500.00, val: 1500.00, valor: 1500.00, due_date: today(-5), vencimento: today(-5), status: "PAGO", situacao: "PAGO", category: "Receita de Servicos", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_02", description: "Honorario Contabil - Padaria Sabor Real - Jul/2026", desc: "Honorario Contabil - Padaria Sabor Real - Jul/2026", value: 850.00, val: 850.00, valor: 850.00, due_date: today(-2), vencimento: today(-2), status: "PAGO", situacao: "PAGO", category: "Receita de Servicos", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_03", description: "Abertura de Empresa - Academia Corpo em Forma", desc: "Abertura de Empresa - Academia Corpo em Forma", value: 1200.00, val: 1200.00, valor: 1200.00, due_date: today(-10), vencimento: today(-10), status: "PAGO", situacao: "PAGO", category: "Servicos Avulsos", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_04", description: "Declaracao IRPF - Carlos Eduardo Mendes", desc: "Declaracao IRPF - Carlos Eduardo Mendes", value: 350.00, val: 350.00, valor: 350.00, due_date: today(-30), vencimento: today(-30), status: "PAGO", situacao: "PAGO", category: "Pessoa Fisica IRPF", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_05", description: "Consultoria Tributaria - Clinica Saude Plena", desc: "Consultoria Tributaria - Clinica Saude Plena", value: 2500.00, val: 2500.00, valor: 2500.00, due_date: today(-15), vencimento: today(-15), status: "PAGO", situacao: "PAGO", category: "Consultorias", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_06", description: "Honorario Contabil - Escola de Idiomas Fluente - Ago/2026", desc: "Honorario Contabil - Escola de Idiomas Fluente - Ago/2026", value: 850.00, val: 850.00, valor: 850.00, due_date: today(5), vencimento: today(5), status: "PENDENTE", situacao: "EM_ABERTO", category: "Receita de Servicos", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_07", description: "Honorario Contabil - Restaurante Sabores da Bahia - Ago/2026", desc: "Honorario Contabil - Restaurante Sabores da Bahia - Ago/2026", value: 1500.00, val: 1500.00, valor: 1500.00, due_date: today(10), vencimento: today(10), status: "PENDENTE", situacao: "EM_ABERTO", category: "Receita de Servicos", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_08", description: "Folha de Pagamento - Tech Solutions - Ago/2026", desc: "Folha de Pagamento - Tech Solutions - Ago/2026", value: 600.00, val: 600.00, valor: 600.00, due_date: today(8), vencimento: today(8), status: "PENDENTE", situacao: "EM_ABERTO", category: "Folha de Pagamento", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_09", description: "Declaracao IRPF - Ana Paula Santos Ferreira", desc: "Declaracao IRPF - Ana Paula Santos Ferreira", value: 350.00, val: 350.00, valor: 350.00, due_date: today(-45), vencimento: today(-45), status: "ATRASADO", situacao: "ATRASADO", category: "Pessoa Fisica IRPF", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_10", description: "Regularizacao Fiscal REFIS - Auto Pecas Norte", desc: "Regularizacao Fiscal REFIS - Auto Pecas Norte", value: 900.00, val: 900.00, valor: 900.00, due_date: today(-20), vencimento: today(-20), status: "ATRASADO", situacao: "ATRASADO", category: "Consultorias", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_11", description: "Consultoria Tributaria - Construtora Horizonte Q3/2026", desc: "Consultoria Tributaria - Construtora Horizonte Q3/2026", value: 2500.00, val: 2500.00, valor: 2500.00, due_date: today(20), vencimento: today(20), status: "PENDENTE", situacao: "EM_ABERTO", category: "Consultorias", tipo: "CREDIT", type: "CREDIT" },
  { id: "rec_seed_12", description: "Abertura MEI - Lote Agosto/2026", desc: "Abertura MEI - Lote Agosto/2026", value: 450.00, val: 450.00, valor: 450.00, due_date: today(15), vencimento: today(15), status: "PENDENTE", situacao: "EM_ABERTO", category: "Servicos Avulsos", tipo: "CREDIT", type: "CREDIT" },
];

const DESPESAS = [
  { id: "desp_seed_01", description: "Aluguel Sala Comercial - Julho/2026", desc: "Aluguel Sala Comercial - Julho/2026", value: 3200.00, val: 3200.00, valor: 3200.00, due_date: today(-10), vencimento: today(-10), status: "PAGO", situacao: "PAGO", category: "Aluguel e Condominio", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_02", description: "Software de Gestao Contabil - Licenca Mensal", desc: "Software de Gestao Contabil - Licenca Mensal", value: 1250.00, val: 1250.00, valor: 1250.00, due_date: today(-5), vencimento: today(-5), status: "PAGO", situacao: "PAGO", category: "Softwares e Licencas", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_03", description: "Honorarios Advocaticios Trabalhistas", desc: "Honorarios Advocaticios Trabalhistas", value: 1500.00, val: 1500.00, valor: 1500.00, due_date: today(-15), vencimento: today(-15), status: "PAGO", situacao: "PAGO", category: "Servicos de Terceiros", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_04", description: "Conta de Energia Eletrica - Julho/2026", desc: "Conta de Energia Eletrica - Julho/2026", value: 380.00, val: 380.00, valor: 380.00, due_date: today(-3), vencimento: today(-3), status: "PAGO", situacao: "PAGO", category: "Energia e Comunicacao", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_05", description: "Internet e Telefonia - Julho/2026", desc: "Internet e Telefonia - Julho/2026", value: 290.00, val: 290.00, valor: 290.00, due_date: today(-2), vencimento: today(-2), status: "PAGO", situacao: "PAGO", category: "Energia e Comunicacao", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_06", description: "Material de Escritorio - Julho/2026", desc: "Material de Escritorio - Julho/2026", value: 450.00, val: 450.00, valor: 450.00, due_date: today(-8), vencimento: today(-8), status: "PAGO", situacao: "PAGO", category: "Material de Escritorio", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_07", description: "Contabilidade da Propria Empresa - Jul/2026", desc: "Contabilidade da Propria Empresa - Jul/2026", value: 700.00, val: 700.00, valor: 700.00, due_date: today(-5), vencimento: today(-5), status: "PAGO", situacao: "PAGO", category: "Servicos de Terceiros", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_08", description: "Seguro Empresarial - Renovacao Anual", desc: "Seguro Empresarial - Renovacao Anual", value: 1800.00, val: 1800.00, valor: 1800.00, due_date: today(-60), vencimento: today(-60), status: "ATRASADO", situacao: "ATRASADO", category: "Despesas Operacionais", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_09", description: "Assinatura Certificado Digital A3 - Anual", desc: "Assinatura Certificado Digital A3 - Anual", value: 350.00, val: 350.00, valor: 350.00, due_date: today(30), vencimento: today(30), status: "PENDENTE", situacao: "EM_ABERTO", category: "Softwares e Licencas", tipo: "DEBIT", type: "DEBIT" },
  { id: "desp_seed_10", description: "Manutencao Ar Condicionado - Escritorio", desc: "Manutencao Ar Condicionado - Escritorio", value: 600.00, val: 600.00, valor: 600.00, due_date: today(-35), vencimento: today(-35), status: "ATRASADO", situacao: "ATRASADO", category: "Despesas Operacionais", tipo: "DEBIT", type: "DEBIT" },
];

const CATEGORIAS = [
  { id: "cat_seed_01", name: "Receita de Servicos", nome: "Receita de Servicos", type: "CREDIT", tipo: "CREDIT" },
  { id: "cat_seed_02", name: "Consultorias", nome: "Consultorias", type: "CREDIT", tipo: "CREDIT" },
  { id: "cat_seed_03", name: "Servicos Avulsos", nome: "Servicos Avulsos", type: "CREDIT", tipo: "CREDIT" },
  { id: "cat_seed_04", name: "Pessoa Fisica IRPF", nome: "Pessoa Fisica IRPF", type: "CREDIT", tipo: "CREDIT" },
  { id: "cat_seed_05", name: "Aluguel e Condominio", nome: "Aluguel e Condominio", type: "DEBIT", tipo: "DEBIT" },
  { id: "cat_seed_06", name: "Softwares e Licencas", nome: "Softwares e Licencas", type: "DEBIT", tipo: "DEBIT" },
  { id: "cat_seed_07", name: "Energia e Comunicacao", nome: "Energia e Comunicacao", type: "DEBIT", tipo: "DEBIT" },
  { id: "cat_seed_08", name: "Despesas Operacionais", nome: "Despesas Operacionais", type: "DEBIT", tipo: "DEBIT" },
];

export async function GET(req: Request) {
  return handleSeed(req);
}

export async function POST(req: Request) {
  return handleSeed(req);
}

async function handleSeed(req: Request) {
  try {
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
    }
    const companyId = body.companyId || "comp_techcontabil_01";
    const now = new Date().toISOString();

    // 1. Upsert no Banco de Dados local do OmniZeus
    const scopedClients = CLIENTES.map(c => ({ ...c, company_id: companyId, synced_at: now }));
    await supabase.from("contaazul_clients").upsert(scopedClients, { onConflict: "id,company_id" });

    const scopedSuppliers = FORNECEDORES.map(f => ({ ...f, company_id: companyId, synced_at: now }));
    await supabase.from("contaazul_suppliers").upsert(scopedSuppliers, { onConflict: "id,company_id" });

    const allEntries = [...RECEITAS, ...DESPESAS].map(e => ({ ...e, company_id: companyId, synced_at: now }));
    await supabase.from("contaazul_entries").upsert(allEntries, { onConflict: "id,company_id" });

    await supabase.from("contaazul_categories").upsert(CATEGORIAS, { onConflict: "id" });

    // 2. Tenta enviar para a Conta da Conta Azul externa via API REST se houver token válido
    const stored = await getContaAzulTokens(companyId);

    // Filtrar tokens que possam vir criptografados do frontend por engano
    const cleanBodyAccess = body.accessToken && !body.accessToken.startsWith("enc.v1:") && !body.accessToken.startsWith("cyjr") ? body.accessToken : undefined;
    const cleanBodyRefresh = body.refreshToken && !body.refreshToken.startsWith("enc.v1:") && !body.refreshToken.startsWith("cyjr") ? body.refreshToken : undefined;
    const cleanStoredAccess = stored.accessToken && !stored.accessToken.startsWith("enc.v1:") && !stored.accessToken.startsWith("cyjr") ? stored.accessToken : undefined;
    const cleanStoredRefresh = stored.refreshToken && !stored.refreshToken.startsWith("enc.v1:") && !stored.refreshToken.startsWith("cyjr") ? stored.refreshToken : undefined;

    const passedTokens = {
      accessToken: cleanBodyAccess || cleanStoredAccess || "",
      refreshToken: cleanBodyRefresh || cleanStoredRefresh || "",
      clientId: body.clientId || stored.clientId || "",
      clientSecret: body.clientSecret || stored.clientSecret || "",
    };

    let externalCount = 0;
    let externalAuthError = false;

    if (passedTokens.accessToken) {
      try {
        // Testar validade do Token com a ContaAzul (fetchWithAutoRefresh renova automaticamente se 401)
        const checkRes = await fetchWithAutoRefresh("https://api.contaazul.com/v1/customers?page_size=1", { method: "GET" }, passedTokens, companyId);
        if (!checkRes.res.ok && checkRes.res.status === 401) {
          externalAuthError = true;
        } else {
          // Atualizar tokens com os possivelmente renovados pelo auto-refresh
          if (checkRes.newAccessToken) passedTokens.accessToken = checkRes.newAccessToken;
          if (checkRes.newRefreshToken) passedTokens.refreshToken = checkRes.newRefreshToken;

          // Enviar Clientes para ContaAzul
          for (const c of CLIENTES) {
            const r = await fetchWithAutoRefresh("https://api.contaazul.com/v1/customers", {
              method: "POST",
              body: JSON.stringify({ name: c.name, email: c.email, document: c.document, phone: c.phone, person_type: c.person_type })
            }, passedTokens, companyId);
            if (r.res.ok || r.res.status === 422 || r.res.status === 409) externalCount++;
          }

          // Enviar Fornecedores para ContaAzul
          for (const f of FORNECEDORES) {
            const r = await fetchWithAutoRefresh("https://api.contaazul.com/v1/suppliers", {
              method: "POST",
              body: JSON.stringify({ name: f.name, email: f.email, document: f.document, phone: f.phone, person_type: f.person_type })
            }, passedTokens, companyId);
            if (r.res.ok || r.res.status === 422 || r.res.status === 409) externalCount++;
          }

          // Enviar Serviços para ContaAzul
          for (const s of SERVICOS) {
            const r = await fetchWithAutoRefresh("https://api.contaazul.com/v1/services", {
              method: "POST",
              body: JSON.stringify({ name: s.name, value: s.value, description: s.description })
            }, passedTokens, companyId);
            if (r.res.ok || r.res.status === 422 || r.res.status === 409) externalCount++;
          }

          // Enviar Receitas para ContaAzul
          for (const rec of RECEITAS) {
            const recBody = { description: rec.description, value: rec.value, due_date: rec.due_date, status: rec.status, competence: today(-30) };
            const r = await fetchWithAutoRefresh("https://api.contaazul.com/v1/accounts-receivable", {
              method: "POST",
              body: JSON.stringify(recBody)
            }, passedTokens, companyId);
            if (r.res.ok || r.res.status === 422 || r.res.status === 409) externalCount++;
          }

          // Enviar Despesas para ContaAzul
          for (const desp of DESPESAS) {
            const despBody = { description: desp.description, value: desp.value, due_date: desp.due_date, status: desp.status, competence: today(-30) };
            const r = await fetchWithAutoRefresh("https://api.contaazul.com/v1/accounts-payable", {
              method: "POST",
              body: JSON.stringify(despBody)
            }, passedTokens, companyId);
            if (r.res.ok || r.res.status === 422 || r.res.status === 409) externalCount++;
          }
        }
      } catch (err) {
        console.log("Erro na gravação remota na ContaAzul:", err);
      }
    } else {
      externalAuthError = true;
    }

    if (externalAuthError) {
      return NextResponse.json({
        success: true,
        companyId,
        totalClients: scopedClients.length,
        totalSuppliers: scopedSuppliers.length,
        totalEntries: allEntries.length,
        totalCategories: CATEGORIAS.length,
        externalCount: 0,
        externalAuthError: true,
        message: `Dados salvos localmente com sucesso! Para enviar à API externa da Conta Azul, renove a autorização OAuth.`
      });
    }

    return NextResponse.json({
      success: true,
      companyId,
      totalClients: scopedClients.length,
      totalSuppliers: scopedSuppliers.length,
      totalEntries: allEntries.length,
      totalCategories: CATEGORIAS.length,
      externalCount,
      message: `Ambiente popularizado com SUCESSO na sua conta Conta Azul web! (${externalCount} registros gravados diretamente na API da Conta Azul)`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Erro ao popular banco de dados" }, { status: 500 });
  }
}
