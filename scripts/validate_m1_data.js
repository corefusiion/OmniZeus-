const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CUSTOMERS_FILE = path.join(ROOT_DIR, 'data', 'omnizeus_contaazul_customers.json');
const LOCAL_DB_FILE = path.join(ROOT_DIR, 'data', 'omnizeus_local_sql_database.json');

let errors = [];
let warnings = [];
let passCount = 0;

function assert(condition, message) {
  if (!condition) {
    errors.push(`FAIL: ${message}`);
  } else {
    passCount++;
  }
}

console.log('=== OmniZeus M1 Data Population Validation ===\n');

// 1. Validate omnizeus_contaazul_customers.json
try {
  assert(fs.existsSync(CUSTOMERS_FILE), `File exists: ${CUSTOMERS_FILE}`);
  const rawCustomers = fs.readFileSync(CUSTOMERS_FILE, 'utf-8');
  const customers = JSON.parse(rawCustomers);
  assert(Array.isArray(customers), 'omnizeus_contaazul_customers.json is a JSON array');
  assert(customers.length >= 10, `ContaAzul customers count (${customers.length}) >= 10`);

  customers.forEach((c, idx) => {
    assert(!!c.id, `Customer #${idx + 1} has ID`);
    assert(!!(c.nome || c.name), `Customer #${idx + 1} (${c.id}) has Name/Razão Social`);
    assert(!!c.cpf_cnpj && String(c.cpf_cnpj).replace(/\D/g, '').length >= 11, `Customer #${idx + 1} (${c.id}) has valid CPF/CNPJ digits`);
    assert(!!c.email && c.email.includes('@'), `Customer #${idx + 1} (${c.id}) has valid Email`);
    assert(!!(c.telefone_celular || c.phone || c.whatsapp), `Customer #${idx + 1} (${c.id}) has Telefone/WhatsApp`);
    assert(typeof (c.optante_simples ?? c.is_simples) === 'boolean', `Customer #${idx + 1} (${c.id}) has optante_simples boolean`);
    assert(Array.isArray(c.perfis) && c.perfis.length > 0, `Customer #${idx + 1} (${c.id}) has perfis array`);
    assert(!!(c.endereco || c.address), `Customer #${idx + 1} (${c.id}) has Endereço object`);
  });

  console.log(`[PASS] Customer JSON valid: ${customers.length} records verified.`);
} catch (err) {
  errors.push(`Customer JSON parsing error: ${err.message}`);
}

// 2. Validate omnizeus_local_sql_database.json
try {
  assert(fs.existsSync(LOCAL_DB_FILE), `File exists: ${LOCAL_DB_FILE}`);
  const rawDb = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
  const db = JSON.parse(rawDb);
  assert(typeof db === 'object' && db !== null, 'omnizeus_local_sql_database.json is a valid JSON object');

  // Validate contracts table
  const contracts = db.contracts || [];
  assert(Array.isArray(contracts), 'Table contracts is an array');
  assert(contracts.length >= 4, `Contracts count (${contracts.length}) >= 4`);
  
  const reqContractNumbers = ['CTR-2026-001', 'CTR-2026-002', 'CTR-2026-003', 'CTR-2026-004'];
  reqContractNumbers.forEach(cNum => {
    const found = contracts.find(c => (c.contract_number || c.contractNumber) === cNum);
    assert(!!found, `Contract ${cNum} present in database`);
    if (found) {
      assert(typeof (found.monthly_fee_brl ?? found.monthlyFeeBrl) === 'number', `Contract ${cNum} has monthly fee number`);
      assert(!!(found.adjustment_index || found.adjustmentIndex), `Contract ${cNum} has adjustment index`);
      assert(!!(found.cost_center || found.costCenter), `Contract ${cNum} has cost center`);
      assert(typeof (found.allocated_hours_month ?? found.allocatedHoursMonth) === 'number', `Contract ${cNum} has allocated hours`);
      assert(!!found.status, `Contract ${cNum} has status`);
    }
  });

  // Validate purchase_requests table
  const purchaseRequests = db.purchase_requests || [];
  assert(Array.isArray(purchaseRequests), 'Table purchase_requests is an array');
  assert(purchaseRequests.length >= 3, `Purchase requests count (${purchaseRequests.length}) >= 3`);

  const reqRequestNumbers = ['REQ-2026-001', 'REQ-2026-002', 'REQ-2026-003'];
  reqRequestNumbers.forEach(rNum => {
    const found = purchaseRequests.find(r => (r.req_number || r.reqNumber) === rNum);
    assert(!!found, `Purchase Request ${rNum} present in database`);
    if (found) {
      assert(typeof (found.value_brl ?? found.valueBrl) === 'number', `Purchase Request ${rNum} has value BRL`);
      assert(!!found.type, `Purchase Request ${rNum} has type`);
      assert(!!found.description, `Purchase Request ${rNum} has description`);
      assert(!!found.status, `Purchase Request ${rNum} has status`);
    }
  });

  // Validate tasks table
  const tasks = db.tasks || [];
  assert(Array.isArray(tasks), 'Table tasks is an array');
  assert(tasks.length >= 4, `Tasks count (${tasks.length}) >= 4`);

  const reqTaskIds = ['t_501', 't_502', 't_503', 't_504'];
  reqTaskIds.forEach(tId => {
    const found = tasks.find(t => t.id === tId);
    assert(!!found, `Task ${tId} present in database`);
    if (found) {
      assert(['alta', 'media', 'baixa'].includes(found.priority), `Task ${tId} has valid priority`);
      assert(['pendente', 'em_andamento', 'concluido'].includes(found.status), `Task ${tId} has valid status`);
      assert(typeof (found.time_spent_sec ?? found.timeSpentSec) === 'number', `Task ${tId} has time_spent_sec number`);
      assert(!!(found.gemini_suggestion || found.geminiSuggestion), `Task ${tId} has Gemini suggestion`);
    }
  });

  // Validate payables table
  const payables = db.payables || db.payables_list || db.omnizeus_payables_list || [];
  assert(Array.isArray(payables), 'Table payables/payables_list is an array');
  assert(payables.length >= 10, `Payables count (${payables.length}) >= 10`);

  const reqPayableIds = Array.from({ length: 10 }, (_, i) => `pag_2026${String(i + 1).padStart(2, '0')}`);
  reqPayableIds.forEach(pId => {
    const found = payables.find(p => p.id === pId);
    assert(!!found, `Payable ${pId} present in database`);
    if (found) {
      assert(!!(found.fornecedor || found.vendor), `Payable ${pId} has vendor/fornecedor`);
      assert(typeof (found.valor ?? found.value_brl ?? found.value) === 'number', `Payable ${pId} has numeric value`);
      assert(!!(found.vencimento || found.due_date), `Payable ${pId} has due date`);
      assert(['Pendente', 'Pago', 'Agendado'].includes(found.status), `Payable ${pId} has valid status`);
    }
  });

  console.log(`[PASS] Local SQL Database JSON valid: ${contracts.length} contracts, ${purchaseRequests.length} purchase requests, ${tasks.length} tasks, ${payables.length} payables verified.`);
} catch (err) {
  errors.push(`Local SQL Database JSON parsing error: ${err.message}`);
}

console.log('\n=== Summary ===');
console.log(`Assertions Passed: ${passCount}`);
console.log(`Errors Found: ${errors.length}`);

if (errors.length > 0) {
  console.error('\nValidation Errors:');
  errors.forEach(e => console.error(` - ${e}`));
  process.exit(1);
} else {
  console.log('\nSUCCESS: All OmniZeus M1 data population requirements passed 100%!');
  process.exit(0);
}
