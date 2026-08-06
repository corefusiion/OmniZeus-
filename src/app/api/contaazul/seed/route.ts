export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens } from "@/lib/contaazul/store";

export const runtime = "edge";

function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const CLIENTES = [
  { name: "Construtora Horizonte SA", email: "financeiro@horizonte.com.br", document: "12.345.678/0001-90", phone: "(71) 3322-1100", person_type: "LEGAL_PERSON" },
  { name: "Padaria Sabor Real Ltda", email: "contato@saborreal.com.br", document: "23.456.789/0001-01", phone: "(71) 3455-2200", person_type: "LEGAL_PERSON" },
  { name: "Academia Corpo em Forma", email: "admin@corpoemforma.com.br", document: "34.567.890/0001-12", phone: "(71) 3566-3300", person_type: "LEGAL_PERSON" },
  { name: "Clinica Saude Plena Ltda", email: "faturamento@saudeplena.med.br", document: "45.678.901/0001-23", phone: "(71) 3677-4400", person_type: "LEGAL_PERSON" },
  { name: "Escola de Idiomas Fluente", email: "matriculas@fluente.edu.br", document: "56.789.012/0001-34", phone: "(71) 3788-7700", person_type: "LEGAL_PERSON" },
  { name: "Restaurante Sabores da Bahia", email: "reservas@saboresbahia.com.br", document: "67.890.123/0001-45", phone: "(71) 3899-8800", person_type: "LEGAL_PERSON" },
  { name: "Tech Solutions Informatica Ltda", email: "ti@techsolutions.com.br", document: "78.901.234/0001-56", phone: "(71) 3910-9900", person_type: "LEGAL_PERSON" },
  { name: "Auto Pecas Norte Ltda", email: "vendas@autopecasnorte.com.br", document: "89.012.345/0001-67", phone: "(71) 4021-0011", person_type: "LEGAL_PERSON" },
  { name: "Carlos Eduardo Mendes", email: "carlosmendes@gmail.com", document: "123.456.789-00", phone: "(71) 98811-5500", person_type: "NATURAL_PERSON" },
  { name: "Ana Paula Santos Ferreira", email: "anapaula.sf@hotmail.com", document: "234.567.890-11", phone: "(71) 99922-6600", person_type: "NATURAL_PERSON" },
];

const FORNECEDORES = [
  { name: "Distribuidora Nacional de Papeis SA", email: "vendas@distpapeis.com.br", document: "78.901.234/0002-37", phone: "(11) 3001-1234", person_type: "LEGAL_PERSON" },
  { name: "TechSoft Sistemas de TI Ltda", email: "comercial@techsoft.com.br", document: "89.012.345/0002-48", phone: "(11) 4002-5678", person_type: "LEGAL_PERSON" },
  { name: "Clean Max Servicos de Limpeza Ltda", email: "orcamento@cleanmax.com.br", document: "90.123.456/0002-59", phone: "(71) 3500-2345", person_type: "LEGAL_PERSON" },
  { name: "Office Supplies Materiais de Escritorio", email: "pedidos@officesupplies.com.br", document: "01.234.567/0002-60", phone: "(11) 3003-3456", person_type: "LEGAL_PERSON" },
  { name: "Energia Solar Nordeste Ltda", email: "projetos@energiasolar-ne.com.br", document: "12.345.679/0002-71", phone: "(71) 3600-4567", person_type: "LEGAL_PERSON" },
  { name: "Grafica Premium Impressoes Ltda", email: "arte@graficapremium.com.br", document: "23.456.780/0002-82", phone: "(71) 3700-5678", person_type: "LEGAL_PERSON" },
];

const SERVICOS = [
  { name: "Contabilidade Mensal - Simples Nacional", value: 850.00, description: "Escrituracao contabil e obrigacoes acessorias para Simples Nacional" },
  { name: "Contabilidade Mensal - Lucro Presumido", value: 1500.00, description: "Servicos contabeis completos para Lucro Presumido" },
  { name: "Abertura de Empresa LTDA", value: 1200.00, description: "Constituicao completa de empresa LTDA na Junta Comercial e Receita Federal" },
  { name: "Abertura de MEI", value: 150.00, description: "Registro de Microempreendedor Individual" },
  { name: "Declaracao IRPF - Pessoa Fisica", value: 350.00, description: "Declaracao anual de IRPF com todos os rendimentos e deducoes" },
  { name: "Folha de Pagamento Mensal", value: 600.00, description: "Processamento da folha de pagamento e encargos trabalhistas" },
  { name: "Consultoria Tributaria", value: 2500.00, description: "Analise e planejamento tributario para reducao da carga fiscal" },
  { name: "Regularizacao Fiscal e REFIS", value: 900.00, description: "Adesao e acompanhamento de parcelamentos de dividas tributarias" },
];

const RECEITAS = [
  { description: "Honorario Contabil - Construtora Horizonte SA - Jul/2026", value: 1500.00, due_date: today(-5), status: "RECEIVED" },
  { description: "Honorario Contabil - Padaria Sabor Real - Jul/2026", value: 850.00, due_date: today(-2), status: "RECEIVED" },
  { description: "Abertura de Empresa - Academia Corpo em Forma", value: 1200.00, due_date: today(-10), status: "RECEIVED" },
  { description: "Declaracao IRPF - Carlos Eduardo Mendes", value: 350.00, due_date: today(-30), status: "RECEIVED" },
  { description: "Consultoria Tributaria - Clinica Saude Plena", value: 2500.00, due_date: today(-15), status: "RECEIVED" },
  { description: "Honorario Contabil - Escola de Idiomas Fluente - Ago/2026", value: 850.00, due_date: today(5), status: "PENDING" },
  { description: "Honorario Contabil - Restaurante Sabores da Bahia - Ago/2026", value: 1500.00, due_date: today(10), status: "PENDING" },
  { description: "Folha de Pagamento - Tech Solutions - Ago/2026", value: 600.00, due_date: today(8), status: "PENDING" },
  { description: "Declaracao IRPF - Ana Paula Santos Ferreira", value: 350.00, due_date: today(-45), status: "OVERDUE" },
  { description: "Regularizacao Fiscal REFIS - Auto Pecas Norte", value: 900.00, due_date: today(-20), status: "OVERDUE" },
  { description: "Consultoria Tributaria - Construtora Horizonte Q3/2026", value: 2500.00, due_date: today(20), status: "PENDING" },
  { description: "Abertura MEI - Lote Agosto/2026", value: 450.00, due_date: today(15), status: "PENDING" },
];

const DESPESAS = [
  { description: "Aluguel Escritorio - Agosto/2026", value: 3500.00, due_date: today(5), status: "PENDING" },
  { description: "Folha de Pagamento Equipe - Agosto/2026", value: 8500.00, due_date: today(8), status: "PENDING" },
  { description: "Licenca Software Contabil Dominio - Ago/2026", value: 1200.00, due_date: today(3), status: "PENDING" },
  { description: "Conta de Energia Eletrica - Julho/2026", value: 380.00, due_date: today(-3), status: "PAID" },
  { description: "Internet e Telefonia - Julho/2026", value: 290.00, due_date: today(-2), status: "PAID" },
  { description: "Material de Escritorio - Julho/2026", value: 450.00, due_date: today(-8), status: "PAID" },
  { description: "Contabilidade da Propria Empresa - Jul/2026", value: 700.00, due_date: today(-5), status: "PAID" },
  { description: "Seguro Empresarial - Renovacao Anual", value: 1800.00, due_date: today(-60), status: "OVERDUE" },
  { description: "Assinatura Certificado Digital A3 - Anual", value: 350.00, due_date: today(30), status: "PENDING" },
  { description: "Manutencao Ar Condicionado - Escritorio", value: 600.00, due_date: today(-35), status: "OVERDUE" },
];

async function tryPost(endpoint: string, body: any, passedTokens: any) {
  const { res } = await fetchWithAutoRefresh(
    https://api.contaazul.com,
    { method: "POST", body: JSON.stringify(body) },
    passedTokens
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const companyId = (body as any).companyId || "comp_techcontabil_01";

    const stored = await getContaAzulTokens(companyId);
    const passedTokens = {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
    };

    const { res: checkRes } = await fetchWithAutoRefresh(
      "https://api.contaazul.com/v1/customers?page_size=1",
      { method: "GET" },
      passedTokens
    );
    if (!checkRes.ok && checkRes.status === 401) {
      return NextResponse.json({ success: false, error: "Token invalido. Refaca a autorizacao OAuth." }, { status: 401 });
    }

    const results: Record<string, { ok: number; warn: number; err: number }> = {
      clientes: { ok: 0, warn: 0, err: 0 },
      fornecedores: { ok: 0, warn: 0, err: 0 },
      servicos: { ok: 0, warn: 0, err: 0 },
      receitas: { ok: 0, warn: 0, err: 0 },
      despesas: { ok: 0, warn: 0, err: 0 },
    };
    const log: string[] = [];

    for (const c of CLIENTES) {
      const r = await tryPost("/v1/customers", { name: c.name, email: c.email, document: c.document, phone: c.phone, person_type: c.person_type }, passedTokens);
      if (r.ok) { results.clientes.ok++; log.push([OK] Cliente: ); }
      else if (r.status === 422 || r.status === 409) { results.clientes.warn++; log.push([JA EXISTE] ); }
      else { results.clientes.err++; log.push([ERRO ] Cliente: ); }
      await sleep(300);
    }

    for (const f of FORNECEDORES) {
      const r = await tryPost("/v1/suppliers", { name: f.name, email: f.email, document: f.document, phone: f.phone, person_type: f.person_type }, passedTokens);
      if (r.ok) { results.fornecedores.ok++; log.push([OK] Fornecedor: ); }
      else if (r.status === 422 || r.status === 409) { results.fornecedores.warn++; log.push([JA EXISTE] ); }
      else { results.fornecedores.err++; log.push([ERRO ] Fornecedor: ); }
      await sleep(300);
    }

    for (const s of SERVICOS) {
      const r = await tryPost("/v1/services", { name: s.name, value: s.value, description: s.description }, passedTokens);
      if (r.ok) { results.servicos.ok++; log.push([OK] Servico: ); }
      else if (r.status === 404) { results.servicos.warn++; log.push([N/A] Servico - endpoint indisponivel no plano); }
      else if (r.status === 422 || r.status === 409) { results.servicos.warn++; log.push([JA EXISTE] ); }
      else { results.servicos.err++; log.push([ERRO ] Servico: ); }
      await sleep(300);
    }

    for (const rec of RECEITAS) {
      const recBody = { description: rec.description, value: rec.value, due_date: rec.due_date, status: rec.status, competence: today(-30) };
      let r = await tryPost("/v1/accounts-receivable", recBody, passedTokens);
      if (!r.ok && r.status === 404) r = await tryPost("/v1/entries", { ...recBody, type: "CREDIT" }, passedTokens);
      if (r.ok) { results.receitas.ok++; log.push([OK] Receita: ); }
      else if (r.status === 422 || r.status === 409) { results.receitas.warn++; log.push([JA EXISTE] ); }
      else { results.receitas.err++; log.push([ERRO ] Receita: ); }
      await sleep(300);
    }

    for (const desp of DESPESAS) {
      const despBody = { description: desp.description, value: desp.value, due_date: desp.due_date, status: desp.status, competence: today(-30) };
      let r = await tryPost("/v1/accounts-payable", despBody, passedTokens);
      if (!r.ok && r.status === 404) r = await tryPost("/v1/entries", { ...despBody, type: "DEBIT" }, passedTokens);
      if (r.ok) { results.despesas.ok++; log.push([OK] Despesa: ); }
      else if (r.status === 422 || r.status === 409) { results.despesas.warn++; log.push([JA EXISTE] ); }
      else { results.despesas.err++; log.push([ERRO ] Despesa: ); }
      await sleep(300);
    }

    const totalOk = Object.values(results).reduce((a, b) => a + b.ok, 0);
    const totalErr = Object.values(results).reduce((a, b) => a + b.err, 0);

    return NextResponse.json({
      success: true,
      summary: results,
      totalCreated: totalOk,
      totalErrors: totalErr,
      log,
      message: Seed concluido!  itens cadastrados no ContaAzul.,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
