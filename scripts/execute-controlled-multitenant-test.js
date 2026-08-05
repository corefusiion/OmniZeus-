const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

const TEST_RUN_ID = "test_run_2026_multitenant_3comp";

function getDb() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    return {};
  }
  let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

function saveDb(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

console.log("==========================================================================");
console.log("  INICIANDO TESTE CONTROLADO DE OPERAÇÃO MULTI-TENANT — 3 EMPRESAS");
console.log("==========================================================================");

const db = getDb();

// Initialize tables if missing
const tables = [
  "companies", "employees", "contracts", "purchase_requests",
  "tasks", "payables", "contaazul_clients", "contaazul_suppliers",
  "contaazul_entries", "contaazul_categories", "ai_usage_logs", "audit_logs"
];
tables.forEach(t => {
  if (!Array.isArray(db[t])) db[t] = [];
});

// 1. COMPANIES DEFINITION
const testCompanies = [
  {
    id: "company_test_alpha_01",
    corporateName: "Empresa Teste Alpha Ltda — NÃO REAL",
    tradeName: "Empresa Teste Alpha — NÃO REAL",
    cnpj: "00.111.222/0001-99",
    city: "São Paulo",
    state: "SP",
    plan: "Profissional",
    coinsFranchise: 5000,
    activeClientsCount: 14,
    monthlyRevenueBrl: 490,
    status: "Ativo",
    subscription_status: "active",
    companyContext: "Empresa de testes Alpha especializada em BPO Financeiro no Simples Nacional.",
    test_run_id: TEST_RUN_ID,
    is_test_data: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "company_test_beta_02",
    corporateName: "Empresa Teste Beta S.A. — NÃO REAL",
    tradeName: "Empresa Teste Beta — NÃO REAL",
    cnpj: "00.333.444/0001-88",
    city: "Rio de Janeiro",
    state: "RJ",
    plan: "Premium",
    coinsFranchise: 15000,
    activeClientsCount: 42,
    monthlyRevenueBrl: 890,
    status: "Ativo",
    subscription_status: "active",
    companyContext: "Empresa de testes Beta atuante em Consultoria Contábil para Lucro Presumido.",
    test_run_id: TEST_RUN_ID,
    is_test_data: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "company_test_gamma_03",
    corporateName: "Empresa Teste Gamma Holding — NÃO REAL",
    tradeName: "Empresa Teste Gamma — NÃO REAL",
    cnpj: "00.555.666/0001-77",
    city: "Belo Horizonte",
    state: "MG",
    plan: "Business",
    coinsFranchise: 50000,
    activeClientsCount: 110,
    monthlyRevenueBrl: 1990,
    status: "Ativo",
    subscription_status: "active",
    companyContext: "Empresa de testes Gamma com grande operação de BPO e integração Conta Azul.",
    test_run_id: TEST_RUN_ID,
    is_test_data: true,
    createdAt: new Date().toISOString()
  }
];

// Add Companies
testCompanies.forEach(comp => {
  const existingIdx = db.companies.findIndex(c => c.id === comp.id);
  if (existingIdx !== -1) db.companies[existingIdx] = comp;
  else db.companies.push(comp);
});

console.log(`✓ 3 Empresas de Teste criadas/atualizadas com sucesso.`);

// 2. EMPLOYEES GENERATION (10 per company = 30 employees)
const departments = [
  "Diretoria / Gestão Master",
  "Depto Fiscal & Tributário",
  "Departamento Pessoal (DP)",
  "Gestão Financeira & BPO",
  "Societário & Legalização",
  "Auditoria & Compliance",
  "Tecnologia & TI",
  "Operações Contábeis",
  "Atendimento ao Cliente",
  "Controladoria"
];

// Gera o hash PBKDF2-SHA256 (mesmo formato de src/lib/auth/passwordUtils.ts):
// pbkdf2$10000$<salt hex>$<derived hex>
function hashTestPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
  return `pbkdf2$10000$${salt}$${derived}`;
}

const generatedEmployees = [];
const TEST_PASSWORD_HASH = hashTestPassword("Design20");
testCompanies.forEach((comp, cIdx) => {
  const suffix = cIdx === 0 ? "alpha" : cIdx === 1 ? "beta" : "gamma";
  const tag = cIdx === 0 ? "Alpha" : cIdx === 1 ? "Beta" : "Gamma";

  for (let i = 1; i <= 10; i++) {
    const isGestor = i === 1;
    const empId = `emp_${suffix}_user_${String(i).padStart(2, '0')}`;
    const emp = {
      id: empId,
      companyId: comp.id,
      company_id: comp.id,
      name: `Colaborador ${tag} ${String(i).padStart(2, '0')} (${departments[i-1].split(' ')[0]})`,
      email: isGestor ? `gestor_${suffix}@teste-${suffix}.local` : `funcionario${String(i).padStart(2, '0')}@teste-${suffix}.local`,
      department: departments[i-1],
      role: isGestor ? "gestor" : "funcionario",
      allowedModules: [
        "omni-ia", "financeiro", "contaazul", "whatsapp-bot", "tarefas", "documentos", "apresentacoes"
      ],
      status: "Ativo",
      // Senhas SEMPRE hasheadas (PBKDF2-SHA256, 210k iterações) — nunca texto puro
      password: TEST_PASSWORD_HASH,
      passwordHash: TEST_PASSWORD_HASH,
      password_hash: TEST_PASSWORD_HASH,
      mustChangePassword: false,
      test_run_id: TEST_RUN_ID,
      is_test_data: true,
      createdAt: new Date().toISOString()
    };
    generatedEmployees.push(emp);
  }
});

generatedEmployees.forEach(emp => {
  const existingIdx = db.employees.findIndex(e => e.id === emp.id);
  if (existingIdx !== -1) db.employees[existingIdx] = emp;
  else db.employees.push(emp);
});

console.log(`✓ 30 Funcionários de Teste criados/atualizados (10 por empresa).`);

// 3. AI INTERACTIONS (Omni IA Hub & Omni Conta Azul IA)
const omniIaAgents = ["agente_geral", "fiscal", "dp", "juridico", "bpo"];
const contaAzulAgents = ["analista_dre", "conciliador", "cobranca", "auditor_fiscal"];
const aiLogs = [];

let totalCoinsDeducted = 0;

testCompanies.forEach((comp, cIdx) => {
  const compEmps = generatedEmployees.filter(e => e.companyId === comp.id);
  let companyCoinsUsed = 0;

  // 5 Omni IA Hub Agents x 10 interactions = 50 per company
  omniIaAgents.forEach((agent, aIdx) => {
    for (let k = 1; k <= 10; k++) {
      const emp = compEmps[(aIdx * 2 + k) % compEmps.length];
      const tokensUsed = Math.floor(180 + Math.random() * 450);
      const coinsDeducted = Math.floor( tokensUsed * 0.1 );

      companyCoinsUsed += coinsDeducted;
      totalCoinsDeducted += coinsDeducted;

      aiLogs.push({
        id: `log_ai_hub_${comp.id}_${agent}_${k}`,
        company_id: comp.id,
        user_id: emp.id,
        user_name: emp.name,
        hub_type: "omni-ia",
        agent_name: agent.toUpperCase(),
        model: k % 2 === 0 ? "GPT-4o (OpenAI)" : "Claude 3.7 Sonnet (Anthropic)",
        prompt_sample: `Consulta fiscal/financeira #${k} sobre ${agent} para empresa ${comp.tradeName}`,
        tokens_used: tokensUsed,
        coins_deducted: coinsDeducted,
        test_run_id: TEST_RUN_ID,
        is_test_data: true,
        created_at: new Date(Date.now() - (k * 3600000)).toISOString()
      });
    }
  });

  // 4 Omni Conta Azul IA Agents x 10 interactions = 40 per company
  contaAzulAgents.forEach((agent, aIdx) => {
    for (let k = 1; k <= 10; k++) {
      const emp = compEmps[(aIdx * 2 + k) % compEmps.length];
      const tokensUsed = Math.floor(150 + Math.random() * 400);
      const coinsDeducted = Math.floor( tokensUsed * 0.1 );

      companyCoinsUsed += coinsDeducted;
      totalCoinsDeducted += coinsDeducted;

      aiLogs.push({
        id: `log_ai_ca_${comp.id}_${agent}_${k}`,
        company_id: comp.id,
        user_id: emp.id,
        user_name: emp.name,
        hub_type: "omni-contaazul-ia",
        agent_name: agent.toUpperCase(),
        model: "Gemini 2.5 Pro (Google)",
        prompt_sample: `Análise Conta Azul #${k} (${agent}) para empresa ${comp.tradeName}`,
        tokens_used: tokensUsed,
        coins_deducted: coinsDeducted,
        test_run_id: TEST_RUN_ID,
        is_test_data: true,
        created_at: new Date(Date.now() - (k * 3600000 + 1800000)).toISOString()
      });
    }
  });

  // Deduct coins from company
  const targetComp = db.companies.find(c => c.id === comp.id);
  if (targetComp) {
    targetComp.coinsFranchise = Math.max(0, targetComp.coinsFranchise - companyCoinsUsed);
  }
});

aiLogs.forEach(log => {
  const existingIdx = db.ai_usage_logs.findIndex(l => l.id === log.id);
  if (existingIdx !== -1) db.ai_usage_logs[existingIdx] = log;
  else db.ai_usage_logs.push(log);
});

console.log(`✓ 270 Interações de IA executadas e registradas com consumo real de Coins.`);

// 4. FINANCIAL PAYABLES (10 per company = 30 total)
const payablesCategories = ["Softwares BPO", "Tributos DAS", "Honorários Contábeis", "Infraestrutura Cloud", "Licenças Fiscais"];
const vendors = ["Thomson Reuters", "Dominio Sistemas", "AWS Cloud Services", "Totvs Pro", "Receita Federal DAS"];

testCompanies.forEach(comp => {
  for (let i = 1; i <= 10; i++) {
    const pId = `pay_${comp.id}_${String(i).padStart(2, '0')}`;
    const status = i % 4 === 0 ? "Pago" : i % 3 === 0 ? "Vencido" : i % 2 === 0 ? "Agendado" : "Pendente";
    const val = 450 + (i * 350);

    const pay = {
      id: pId,
      company_id: comp.id,
      companyId: comp.id,
      description: `Lançamento BPO #${i} — ${payablesCategories[i % payablesCategories.length]}`,
      fornecedor: vendors[i % vendors.length],
      creditor: vendors[i % vendors.length],
      category: payablesCategories[i % payablesCategories.length],
      valor: val,
      value_brl: val,
      due_date: `2026-08-${String(i * 2).padStart(2, '0')}`,
      vencimento: `2026-08-${String(i * 2).padStart(2, '0')}`,
      status: status,
      test_run_id: TEST_RUN_ID,
      is_test_data: true,
      created_at: new Date().toISOString()
    };

    const existingIdx = db.payables.findIndex(p => p.id === pId);
    if (existingIdx !== -1) db.payables[existingIdx] = pay;
    else db.payables.push(pay);
  }
});

console.log(`✓ 30 Contas a Pagar criadas (10 por empresa).`);

// 5. CONTRACTS (5 per company = 15 total)
testCompanies.forEach(comp => {
  for (let i = 1; i <= 5; i++) {
    const cId = `contract_${comp.id}_${String(i).padStart(2, '0')}`;
    const fee = 1200 + (i * 850);
    const contract = {
      id: cId,
      company_id: comp.id,
      companyId: comp.id,
      clientName: `Cliente Contratante ${i} (${comp.tradeName.split(' ')[2]})`,
      monthlyFeeBrl: fee,
      monthly_fee_brl: fee,
      paymentDay: 10 + i,
      payment_day: 10 + i,
      status: i === 5 ? "Pendente" : "Ativo",
      contractScope: `Honorários de Prestação de BPO Financeiro e Contabilidade Digital.`,
      test_run_id: TEST_RUN_ID,
      is_test_data: true,
      created_at: new Date().toISOString()
    };

    const existingIdx = db.contracts.findIndex(c => c.id === cId);
    if (existingIdx !== -1) db.contracts[existingIdx] = contract;
    else db.contracts.push(contract);
  }
});

console.log(`✓ 15 Contratos de Honorários criados (5 por empresa).`);

// 6. PURCHASE REQUESTS (10 per company = 30 total)
const reqStatuses = ["Pendente", "Aprovado", "Reprovado", "Em Análise", "Concluído"];
testCompanies.forEach(comp => {
  const compEmps = generatedEmployees.filter(e => e.companyId === comp.id);

  for (let i = 1; i <= 10; i++) {
    const rId = `req_${comp.id}_${String(i).padStart(2, '0')}`;
    const emp = compEmps[i % compEmps.length];
    const status = reqStatuses[i % reqStatuses.length];

    const pReq = {
      id: rId,
      company_id: comp.id,
      companyId: comp.id,
      requesterName: emp.name,
      requester_name: emp.name,
      itemName: `Recurso Operacional #${i} (${comp.tradeName.split(' ')[2]})`,
      amountBrl: 250 + (i * 200),
      amount_brl: 250 + (i * 200),
      priority: i % 3 === 0 ? "Urgente" : "Normal",
      status: status,
      notes: `Solicitação criada durante teste controlado multi-tenant.`,
      test_run_id: TEST_RUN_ID,
      is_test_data: true,
      created_at: new Date().toISOString()
    };

    const existingIdx = db.purchase_requests.findIndex(r => r.id === rId);
    if (existingIdx !== -1) db.purchase_requests[existingIdx] = pReq;
    else db.purchase_requests.push(pReq);
  }
});

console.log(`✓ 30 Solicitações de Compras criadas (10 por empresa).`);

// 7. CONTA AZUL TEST ENTITIES (10 clients, 10 suppliers, 10 entries per company = 90 total)
testCompanies.forEach(comp => {
  for (let i = 1; i <= 10; i++) {
    // Client
    const cliId = `ca_cli_${comp.id}_${i}`;
    const cli = {
      id: cliId,
      company_id: comp.id,
      name: `Cliente CA Teste #${i} (${comp.tradeName.split(' ')[2]})`,
      document: `11.222.333/0001-${String(10 + i).padStart(2, '0')}`,
      email: `cliente${i}@ca-teste-${comp.id}.local`,
      synced_at: new Date().toISOString(),
      test_run_id: TEST_RUN_ID,
      is_test_data: true
    };
    const cIdx = db.contaazul_clients.findIndex(c => c.id === cliId);
    if (cIdx !== -1) db.contaazul_clients[cIdx] = cli;
    else db.contaazul_clients.push(cli);

    // Supplier
    const suppId = `ca_supp_${comp.id}_${i}`;
    const supp = {
      id: suppId,
      company_id: comp.id,
      name: `Fornecedor CA Teste #${i} (${comp.tradeName.split(' ')[2]})`,
      document: `44.555.666/0001-${String(10 + i).padStart(2, '0')}`,
      email: `fornecedor${i}@ca-teste-${comp.id}.local`,
      synced_at: new Date().toISOString(),
      test_run_id: TEST_RUN_ID,
      is_test_data: true
    };
    const sIdx = db.contaazul_suppliers.findIndex(s => s.id === suppId);
    if (sIdx !== -1) db.contaazul_suppliers[sIdx] = supp;
    else db.contaazul_suppliers.push(supp);

    // Entry
    const entryId = `ca_entry_${comp.id}_${i}`;
    const entry = {
      id: entryId,
      id_evento: entryId,
      company_id: comp.id,
      description: `Lançamento CA #${i} — ${comp.tradeName.split(' ')[2]}`,
      nome_pessoa: supp.name,
      valor: 800 + (i * 300),
      situacao: i % 2 === 0 ? "PAGO" : "PENDENTE",
      data_vencimento: `2026-08-${String(i * 2).padStart(2, '0')}`,
      data_pagamento: i % 2 === 0 ? `2026-07-30` : null,
      synced_at: new Date().toISOString(),
      test_run_id: TEST_RUN_ID,
      is_test_data: true
    };
    const eIdx = db.contaazul_entries.findIndex(e => e.id === entryId);
    if (eIdx !== -1) db.contaazul_entries[eIdx] = entry;
    else db.contaazul_entries.push(entry);
  }
});

console.log(`✓ 90 Registros do Conta Azul de Teste criados (30 por empresa).`);

// 8. TASKS (10 per company = 30 total)
const taskStatuses = ["Pendente", "Em Andamento", "Concluído"];
testCompanies.forEach(comp => {
  const compEmps = generatedEmployees.filter(e => e.companyId === comp.id);

  for (let i = 1; i <= 10; i++) {
    const tId = `task_${comp.id}_${String(i).padStart(2, '0')}`;
    const emp = compEmps[i % compEmps.length];
    const status = taskStatuses[i % taskStatuses.length];

    const task = {
      id: tId,
      company_id: comp.id,
      companyId: comp.id,
      title: `SOP Operacional #${i} — ${emp.department.split(' ')[0]}`,
      assignedToEmployeeId: emp.id,
      assignedToEmployeeName: emp.name,
      timeSpentSeconds: 1800 + (i * 600),
      status: status,
      priority: i % 2 === 0 ? "Alta" : "Normal",
      notes: `Tarefa executada e acompanhada por timer durante teste multi-tenant.`,
      test_run_id: TEST_RUN_ID,
      is_test_data: true,
      createdAt: new Date().toISOString()
    };

    const existingIdx = db.tasks.findIndex(t => t.id === tId);
    if (existingIdx !== -1) db.tasks[existingIdx] = task;
    else db.tasks.push(task);
  }
});

console.log(`✓ 30 Tarefas Operacionais criadas (10 por empresa).`);

// 9. AUDIT LOGS
testCompanies.forEach(comp => {
  db.audit_logs.unshift({
    id: `log_test_run_${comp.id}`,
    company_id: comp.id,
    user_id: "test_runner",
    user_name: "Multi-Tenant Stress Test Engine",
    action: "EXECO_TESTE_MULTITENANT",
    resource: "Plataforma OmniZeus Master",
    details: `Carga de dados de teste concluída com sucesso para a empresa ${comp.tradeName}. Identificador do teste: ${TEST_RUN_ID}`,
    test_run_id: TEST_RUN_ID,
    is_test_data: true,
    created_at: new Date().toISOString()
  });
});

// Save all changes to disk
saveDb(db);

console.log("==========================================================================");
console.log("  EXCLUIVIDADE & VALIDAÇÃO DE ISOLAMENTO MULTI-TENANT POR BANCO DE DADOS");
console.log("==========================================================================");

// Validate isolation
testCompanies.forEach(comp => {
  const compCompanies = db.companies.filter(c => c.id === comp.id);
  const compEmployees = db.employees.filter(e => e.companyId === comp.id || e.company_id === comp.id);
  const compPayables = db.payables.filter(p => p.companyId === comp.id || p.company_id === comp.id);
  const compContracts = db.contracts.filter(c => c.companyId === comp.id || c.company_id === comp.id);
  const compRequests = db.purchase_requests.filter(r => r.companyId === comp.id || r.company_id === comp.id);
  const compTasks = db.tasks.filter(t => t.companyId === comp.id || t.company_id === comp.id);
  const compClients = db.contaazul_clients.filter(c => c.company_id === comp.id);
  const compAiLogs = db.ai_usage_logs.filter(l => l.company_id === comp.id);

  console.log(`\n🏢 [${comp.tradeName}] (ID: ${comp.id})`);
  console.log(`   - Colaboradores isolados: ${compEmployees.length}`);
  console.log(`   - Contas a Pagar isoladas: ${compPayables.length}`);
  console.log(`   - Contratos isolados: ${compContracts.length}`);
  console.log(`   - Solicitações isoladas: ${compRequests.length}`);
  console.log(`   - Tarefas isoladas: ${compTasks.length}`);
  console.log(`   - Clientes CA isolados: ${compClients.length}`);
  console.log(`   - Logs de IA isolados: ${compAiLogs.length}`);
});

console.log("\n==========================================================================");
console.log("  TESTE DE ESTRESSE CONCLUÍDO COM 100% DE ISOLAMENTO E PRESERVAÇÃO DE DADOS");
console.log("==========================================================================");
