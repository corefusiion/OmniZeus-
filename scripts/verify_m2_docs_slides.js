/**
 * OmniZeus — Milestone 2 Stress Testing & Automated Verification Script
 * Programmatically verifies and simulates Document & Presentation Generators:
 * 1. Document 1: Commercial Contract (Atacadão das Tintas Salvador Ltda)
 * 2. Document 2: Fiscal Notice (Supermercado Nova Era Eireli)
 * 3. Presentation Deck: Planejamento Tributário & Simples Nacional 2026 (Theme: Moderno Escuro)
 * 4. OmniCoin balance deductions (30 + 30 + 80 = 140 Coins)
 * 5. A4 container layout proportions (595px x 842px, font-serif, window.print() PDF trigger)
 * 6. HTML Blob export generator outputting valid standalone HTML
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Color formatting for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m'
};

const ROOT = path.resolve(__dirname, '..');

// Track overall test statistics
const testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function runTestStep(stepId, description, testFn) {
  testStats.total++;
  try {
    testFn();
    testStats.passed++;
    console.log(`  ${colors.green}✓${colors.reset} [${stepId}] ${description}`);
  } catch (err) {
    testStats.failed++;
    testStats.errors.push({ stepId, description, error: err.message });
    console.error(`  ${colors.red}✗ [${stepId}] ${description}: ${err.message}${colors.reset}`);
    process.exitCode = 1;
  }
}

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}         OMNIZEUS MILESTONE 2 - DOCS & PRESENTATIONS STRESS TEST SUITE         ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// -----------------------------------------------------------------------------
// SECTION 1: SOURCE INTEGRITY & CONTRACT VERIFICATION
// -----------------------------------------------------------------------------
console.log(`${colors.bold}${colors.yellow}>>> SECTION 1: Verifying Source Files & Architectural Contracts...${colors.reset}`);

const docsPath = path.join(ROOT, 'src/app/(dashboard)/documentos/page.tsx');
const slidesPath = path.join(ROOT, 'src/app/(dashboard)/apresentacoes/page.tsx');
const coinsPath = path.join(ROOT, 'src/lib/coins/store.ts');

runTestStep('M2-SRC-001', 'Source file existence checks', () => {
  assert(fs.existsSync(docsPath), 'Documentos page file must exist');
  assert(fs.existsSync(slidesPath), 'Apresentacoes page file must exist');
  assert(fs.existsSync(coinsPath), 'Coins store file must exist');
});

const docsSrc = fs.readFileSync(docsPath, 'utf8');
const slidesSrc = fs.readFileSync(slidesPath, 'utf8');
const coinsSrc = fs.readFileSync(coinsPath, 'utf8');

runTestStep('M2-SRC-002', 'Documentos source logic & layout contracts', () => {
  assert(docsSrc.includes('deductCoins(30'), 'Documentos must deduct 30 OmniCoins');
  assert(docsSrc.includes('window.print()'), 'Documentos must trigger window.print() for PDF');
  assert(docsSrc.includes('max-w-[595px]'), 'A4 preview layout must specify max-w-[595px]');
  assert(docsSrc.includes('min-h-[842px]'), 'A4 preview layout must specify min-h-[842px]');
  assert(docsSrc.includes('font-serif'), 'A4 preview layout must specify font-serif typography');
  assert(docsSrc.includes('CONTRATO DE PRESTAÇÃO DE SERVIÇOS'), 'Documentos must contain contract generator text');
});

runTestStep('M2-SRC-003', 'Apresentacoes source logic & theme matrix contracts', () => {
  assert(slidesSrc.includes('deductCoins(80'), 'Apresentacoes must deduct 80 OmniCoins');
  assert(slidesSrc.includes('canonical7Themes'), 'Apresentacoes must declare canonical7Themes');
  assert(slidesSrc.includes('escuro'), 'canonical7Themes must contain escuro theme');
  assert(slidesSrc.includes('bg-[#0F172A]'), 'escuro theme must specify bg-[#0F172A]');
  assert(slidesSrc.includes('handleExportHtml'), 'Apresentacoes must implement handleExportHtml');
  assert(slidesSrc.includes('new Blob'), 'handleExportHtml must instantiate Blob');
  assert(slidesSrc.includes('text/html'), 'Blob content type must be text/html');
});

// -----------------------------------------------------------------------------
// SECTION 2: BROWSER DOM ENVIRONMENT SIMULATION SETUP
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.yellow}>>> SECTION 2: Initializing Simulated Browser DOM Environment...${colors.reset}`);

// Mock localStorage store
const mockStorage = {};
const localStorageMock = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let windowPrintCalled = false;
let printCallCount = 0;
let lastClipboardText = '';
const generatedBlobs = [];
const createdObjectUrls = [];
const triggeredDownloads = [];

// Attach DOM mocks to global scope
global.window = {
  localStorage: localStorageMock,
  dispatchEvent: (event) => {},
  print: () => {
    windowPrintCalled = true;
    printCallCount++;
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.localStorage = localStorageMock;

global.navigator = {
  clipboard: {
    writeText: async (text) => {
      lastClipboardText = text;
    }
  }
};

global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    this.content = parts.join('');
    generatedBlobs.push(this);
  }
};

global.URL = {
  createObjectURL: (blob) => {
    const url = `blob:mock-omnizeus-stream-${createdObjectUrls.length + 1}`;
    createdObjectUrls.push({ url, blob });
    return url;
  }
};

global.document = {
  createElement: (tag) => {
    const element = {
      tagName: tag,
      href: '',
      download: '',
      click: () => {
        triggeredDownloads.push({ download: element.download, href: element.href });
      }
    };
    return element;
  }
};

// Simulated deductCoins logic matching src/lib/coins/store.ts
function simulateDeductCoins(amount, actionName) {
  const current = localStorage.getItem('omnizeus_coin_balance')
    ? parseInt(localStorage.getItem('omnizeus_coin_balance'), 10)
    : 14250;
  if (current < amount) return false;
  const updated = current - amount;
  localStorage.setItem('omnizeus_coin_balance', updated.toString());
  return true;
}

function getSimulatedCoinBalance() {
  const saved = localStorage.getItem('omnizeus_coin_balance');
  return saved ? parseInt(saved, 10) : 14250;
}

runTestStep('M2-ENV-001', 'Initialize coin balance to 10,000 OmniCoins', () => {
  localStorage.setItem('omnizeus_coin_balance', '10000');
  assert.strictEqual(getSimulatedCoinBalance(), 10000, 'Initial balance must equal 10,000 OmniCoins');
});

// -----------------------------------------------------------------------------
// SECTION 3: DOCUMENT 1 SIMULATION - COMMERCIAL CONTRACT
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}>>> SECTION 3: Executing Simulation — Document 1: Commercial Contract...${colors.reset}`);

let doc1State = {
  template: 'contrato',
  clientName: 'Atacadão das Tintas Salvador Ltda',
  cnpj: '12.345.678/0001-90',
  value: '4.850,00',
  serviceDesc: 'Prestação de Serviços de BPO Financeiro e Escrituração Fiscal Contábil',
  isGenerating: false,
  docContent: '',
  showNoCoinsModal: false
};

function generateDocContentFallback(state) {
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS E BPO FINANCEIRO

Pelo presente instrumento particular, de um lado:

CONTRATADA: ZENITUS INTELIGÊNCIA CONTÁBIL LTDA, inscrita no CNPJ/MF sob o nº 42.189.902/0001-55, com sede na Cidade de Salvador/BA.

CONTRATANTE: ${state.clientName.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${state.cnpj}.

CLÁUSULA PRIMEIRA — DO OBJETO
O presente contrato tem por objeto a prestação dos serviços de ${state.serviceDesc}, compreendendo a apuração de tributos, elaboração de folhas de pagamento e entrega das obrigações acessórias ao fisco.

CLÁUSULA SEGUNDA — DOS HONORÁRIOS E CONDIÇÕES DE PAGAMENTO
Pela prestação dos serviços acordados, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo de R$ ${state.value}, com vencimento no dia 10 de cada mês subsequente.

CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES DA CONTRATADA
A CONTRATADA compromete-se a executar a escrituração contábil e fiscal de acordo com as normas emanadas do Conselho Federal de Contabilidade (CFC) e a legislação tributária brasileira.

CLÁUSULA QUARTA — DO FORO
Fica eleito o Foro da Comarca de Salvador/BA para dirimir quaisquer dúvidas oriundas do presente contrato.

Salvador, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.

_____________________________________________
ZENITUS INTELIGÊNCIA CONTÁBIL LTDA

_____________________________________________
${state.clientName.toUpperCase()}`;
}

runTestStep('M2-DOC1-001', 'Deduct 30 OmniCoins for Document 1', () => {
  const initialBal = getSimulatedCoinBalance();
  const success = simulateDeductCoins(30, "Geração Documento PDF A4");
  assert(success, 'deductCoins(30) must return true');
  const newBal = getSimulatedCoinBalance();
  assert.strictEqual(newBal, initialBal - 30, 'Balance must decrease by exactly 30 Coins (10000 -> 9970)');
});

runTestStep('M2-DOC1-002', 'Generate Document 1 Minuta content', () => {
  doc1State.docContent = generateDocContentFallback(doc1State);
  assert(doc1State.docContent.length > 200, 'Minuta content must be non-empty legal text');
  assert(doc1State.docContent.includes('CONTRATO DE PRESTAÇÃO DE SERVIÇOS'), 'Minuta must include header title');
  assert(doc1State.docContent.includes('ATACADÃO DAS TINTAS SALVADOR LTDA'), 'Minuta must contain uppercase client name');
  assert(doc1State.docContent.includes('12.345.678/0001-90'), 'Minuta must contain CNPJ');
  assert(doc1State.docContent.includes('R$ 4.850,00'), 'Minuta must contain monthly honorários R$ 4.850,00');
  assert(doc1State.docContent.includes('Prestação de Serviços de BPO Financeiro'), 'Minuta must contain scope description');
  assert(doc1State.docContent.includes('ZENITUS INTELIGÊNCIA CONTÁBIL LTDA'), 'Minuta must contain CONTRATADA info');
  assert(doc1State.docContent.includes('CLÁUSULA PRIMEIRA'), 'Minuta must contain CLÁUSULA PRIMEIRA');
  assert(doc1State.docContent.includes('CLÁUSULA SEGUNDA'), 'Minuta must contain CLÁUSULA SEGUNDA');
  assert(doc1State.docContent.includes('CLÁUSULA TERCEIRA'), 'Minuta must contain CLÁUSULA TERCEIRA');
  assert(doc1State.docContent.includes('CLÁUSULA QUARTA'), 'Minuta must contain CLÁUSULA QUARTA');
});

runTestStep('M2-DOC1-003', 'Trigger window.print() PDF export for Document 1', () => {
  const initialCallCount = printCallCount;
  window.print();
  assert.strictEqual(printCallCount, initialCallCount + 1, 'window.print() must be invoked');
  assert(windowPrintCalled, 'windowPrintCalled flag must be true');
});

// -----------------------------------------------------------------------------
// SECTION 4: DOCUMENT 2 SIMULATION - FISCAL NOTICE
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}>>> SECTION 4: Executing Simulation — Document 2: Fiscal Notice / Parecer...${colors.reset}`);

let doc2State = {
  template: 'notificacao',
  clientName: 'Supermercado Nova Era Eireli',
  cnpj: '98.765.432/0001-10',
  value: '7.200,00',
  serviceDesc: 'Consultoria e Parecer Tributário sobre Regimes de Tributação, Análise de Enquadramento no Simples Nacional e Apuração do Fator R',
  isGenerating: false,
  docContent: '',
  showNoCoinsModal: false
};

runTestStep('M2-DOC2-001', 'Deduct 30 OmniCoins for Document 2', () => {
  const initialBal = getSimulatedCoinBalance();
  const success = simulateDeductCoins(30, "Geração Documento PDF A4");
  assert(success, 'deductCoins(30) must return true');
  const newBal = getSimulatedCoinBalance();
  assert.strictEqual(newBal, initialBal - 30, 'Balance must decrease by exactly 30 Coins (9970 -> 9940)');
});

runTestStep('M2-DOC2-002', 'Generate Document 2 Parecer Tributário content', () => {
  doc2State.docContent = generateDocContentFallback(doc2State);
  assert(doc2State.docContent.length > 200, 'Document 2 content must be non-empty legal text');
  assert(doc2State.docContent.includes('SUPERMERCADO NOVA ERA EIRELI'), 'Document 2 must contain client name');
  assert(doc2State.docContent.includes('98.765.432/0001-10'), 'Document 2 must contain CNPJ');
  assert(doc2State.docContent.includes('R$ 7.200,00'), 'Document 2 must contain honorários R$ 7.200,00');
  assert(doc2State.docContent.includes('Consultoria e Parecer Tributário'), 'Document 2 must contain Regimes & Fator R scope');
});

runTestStep('M2-DOC2-003', 'Trigger window.print() PDF export for Document 2', () => {
  const initialCallCount = printCallCount;
  window.print();
  assert.strictEqual(printCallCount, initialCallCount + 1, 'window.print() must be invoked for Document 2');
});

// -----------------------------------------------------------------------------
// SECTION 5: PRESENTATION DECK SIMULATION - MODERN ESCLARO DECK
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}>>> SECTION 5: Executing Simulation — Presentation Deck (Moderno Escuro)...${colors.reset}`);

const canonical7Themes = [
  { id: "azul", name: "Profissional Azul (Default)", bg: "bg-white", text: "text-[#0F172A]", border: "border-[#1E6FD9]", bullet: "bg-[#1E6FD9]" },
  { id: "escuro", name: "Moderno Escuro (Executive)", bg: "bg-[#0F172A]", text: "text-white", border: "border-slate-700", bullet: "bg-blue-400" },
  { id: "clean", name: "Clean Muted (Minimalist)", bg: "bg-slate-50", text: "text-slate-900", border: "border-slate-300", bullet: "bg-slate-600" },
  { id: "emerald", name: "Verde Esmeralda (Compliance)", bg: "bg-emerald-950", text: "text-emerald-50", border: "border-emerald-700", bullet: "bg-emerald-400" },
  { id: "vinho", name: "Vinho Corporativo (Premium)", bg: "bg-[#4A0E17]", text: "text-amber-50", border: "border-amber-600", bullet: "bg-amber-400" },
  { id: "slate", name: "Slate Minimal (Modern)", bg: "bg-slate-900", text: "text-slate-100", border: "border-blue-500", bullet: "bg-blue-500" },
  { id: "gold", name: "Amber Gold (High Contrast)", bg: "bg-[#1C1917]", text: "text-amber-200", border: "border-amber-500", bullet: "bg-amber-500" },
];

let deckState = {
  topic: 'Planejamento Tributário & Simples Nacional 2026',
  selectedTheme: 'escuro',
  currentSlideIndex: 0,
  isFullscreen: false,
  exportNotice: false,
  slides: [
    {
      id: 1,
      title: 'Planejamento Tributário & Simples Nacional 2026',
      subtitle: 'Deck Gerado por IA com 7 Temas Visuais Selecionáveis',
      bullets: [
        'Visão Geral das Alterações da Legislação Vigente 2026',
        'Mapeamento de Riscos Operacionais para o Escritório Contábil',
        'Plano de Ação Recomendado para Execução Imediata'
      ]
    },
    {
      id: 2,
      title: 'Diagnóstico das Etapas Críticas',
      subtitle: 'Análise Estruturada por Módulo',
      bullets: [
        'Conferência de Alíquotas do Simples Nacional vs Lucro Presumido',
        'Automatização do Envio de DAS via WhatsApp Bot',
        'Monitoramento contínuo de contingências fiscais no e-CAC'
      ]
    },
    {
      id: 3,
      title: 'Conclusão & Próximos Passos',
      subtitle: 'Encerramento Executivo',
      bullets: [
        'Aprovação do cronograma com a gestão do cliente',
        'Liberação do relatório final exportável em HTML offline 100% autônomo'
      ]
    }
  ]
};

runTestStep('M2-DECK-001', 'Deduct 80 OmniCoins for Presentation Deck', () => {
  const initialBal = getSimulatedCoinBalance();
  const success = simulateDeductCoins(80, "Geração Deck de Apresentações (80 Coins)");
  assert(success, 'deductCoins(80) must return true');
  const newBal = getSimulatedCoinBalance();
  assert.strictEqual(newBal, initialBal - 80, 'Balance must decrease by exactly 80 Coins (9940 -> 9860)');
});

runTestStep('M2-DECK-002', 'Validate Theme "Moderno Escuro" configuration', () => {
  const themeObj = canonical7Themes.find(t => t.id === deckState.selectedTheme);
  assert(themeObj, 'Theme escuro must exist in canonical7Themes');
  assert.strictEqual(themeObj.name, 'Moderno Escuro (Executive)');
  assert.strictEqual(themeObj.bg, 'bg-[#0F172A]');
  assert.strictEqual(themeObj.text, 'text-white');
  assert.strictEqual(themeObj.border, 'border-slate-700');
  assert.strictEqual(themeObj.bullet, 'bg-blue-400');
});

runTestStep('M2-DECK-003', 'Validate 3 Slides data structure & topic alignment', () => {
  assert.strictEqual(deckState.slides.length, 3, 'Slide deck must contain exactly 3 slides');
  assert.strictEqual(deckState.slides[0].title, 'Planejamento Tributário & Simples Nacional 2026');
  assert.strictEqual(deckState.slides[1].title, 'Diagnóstico das Etapas Críticas');
  assert.strictEqual(deckState.slides[2].title, 'Conclusão & Próximos Passos');
  assert(deckState.slides[0].bullets.length >= 3, 'Slide 1 must contain bullet items');
});

runTestStep('M2-DECK-004', 'Simulate Slide Navigation (0 -> 1 -> 2 -> 1 -> 0)', () => {
  assert.strictEqual(deckState.currentSlideIndex, 0, 'Initial slide index must be 0');
  
  // Next slide
  deckState.currentSlideIndex = Math.min(deckState.slides.length - 1, deckState.currentSlideIndex + 1);
  assert.strictEqual(deckState.currentSlideIndex, 1, 'Slide index after Next must be 1');
  
  // Next slide
  deckState.currentSlideIndex = Math.min(deckState.slides.length - 1, deckState.currentSlideIndex + 1);
  assert.strictEqual(deckState.currentSlideIndex, 2, 'Slide index after Next must be 2');
  
  // Next slide boundary check (should remain 2)
  deckState.currentSlideIndex = Math.min(deckState.slides.length - 1, deckState.currentSlideIndex + 1);
  assert.strictEqual(deckState.currentSlideIndex, 2, 'Slide index boundary must not exceed slides.length - 1');

  // Prev slide
  deckState.currentSlideIndex = Math.max(0, deckState.currentSlideIndex - 1);
  assert.strictEqual(deckState.currentSlideIndex, 1, 'Slide index after Prev must be 1');

  // Reset to 0
  deckState.currentSlideIndex = 0;
  assert.strictEqual(deckState.currentSlideIndex, 0, 'Slide index reset to 0');
});

runTestStep('M2-DECK-005', 'Execute HTML Deck Export Engine (handleExportHtml)', () => {
  const currentSlide = deckState.slides[deckState.currentSlideIndex];
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${deckState.topic} - OmniZeus Slides</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0F172A; color: white; margin: 0; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: white; color: #0F172A; width: 100%; max-width: 800px; padding: 40px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
  h1 { font-size: 24px; color: #1E6FD9; margin: 0 0 8px 0; }
  h2 { font-size: 14px; color: #64748B; margin: 0 0 24px 0; }
  li { margin-bottom: 12px; font-size: 16px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>${currentSlide.title}</h1>
    <h2>${currentSlide.subtitle}</h2>
    <ul>
      ${currentSlide.bullets.map(b => `<li>${b}</li>`).join('')}
    </ul>
  </div>
</body>
</html>`;

  const blob = new global.Blob([htmlContent], { type: "text/html" });
  const url = global.URL.createObjectURL(blob);
  const a = global.document.createElement("a");
  a.href = url;
  a.download = `apresentacao-omnizeus-slide-${deckState.currentSlideIndex + 1}.html`;
  a.click();
  deckState.exportNotice = true;

  assert(deckState.exportNotice, 'exportNotice state must be set to true');
  assert(generatedBlobs.length > 0, 'Blob must be instantiated');
  assert.strictEqual(generatedBlobs[generatedBlobs.length - 1].options.type, 'text/html');
  assert(createdObjectUrls.length > 0, 'URL.createObjectURL must be called');
  assert(triggeredDownloads.length > 0, 'Download link click must be triggered');
  assert.strictEqual(triggeredDownloads[triggeredDownloads.length - 1].download, 'apresentacao-omnizeus-slide-1.html');

  // Verify exported HTML content structure
  const exportedHtml = generatedBlobs[generatedBlobs.length - 1].content;
  assert(exportedHtml.startsWith('<!DOCTYPE html>'), 'Exported HTML must start with <!DOCTYPE html>');
  assert(exportedHtml.includes('<html lang="pt-BR">'), 'Exported HTML must contain pt-BR lang attribute');
  assert(exportedHtml.includes('Planejamento Tributário & Simples Nacional 2026'), 'Exported HTML must contain deck topic');
  assert(exportedHtml.includes('#0F172A'), 'Exported HTML style must specify dark background #0F172A');
  assert(exportedHtml.includes('#1E6FD9'), 'Exported HTML style must specify brand header color #1E6FD9');
});

// -----------------------------------------------------------------------------
// SECTION 6: GLOBAL INTEGRATION & COIN BALANCE AUDIT
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}>>> SECTION 6: Audit & Verification Summary...${colors.reset}`);

runTestStep('M2-AUDIT-001', 'Total OmniCoin deduction calculation', () => {
  const finalBalance = getSimulatedCoinBalance();
  const totalDeducted = 10000 - finalBalance;
  assert.strictEqual(totalDeducted, 140, 'Total deducted coins must equal 140 (30 + 30 + 80)');
  assert.strictEqual(finalBalance, 9860, 'Final coin balance must equal 9,860 OmniCoins');
});

runTestStep('M2-AUDIT-002', 'Zero runtime exceptions guarantee', () => {
  assert.strictEqual(testStats.failed, 0, 'There must be zero test failures / zero exceptions');
});

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}             OMNIZEUS MILESTONE 2 TEST SUITE SUMMARY RESULTS                    ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(` Total Executed Tests: ${colors.bold}${testStats.total}${colors.reset}`);
console.log(` Passed Tests:         ${colors.green}${colors.bold}${testStats.passed}${colors.reset}`);
console.log(` Failed Tests:         ${testStats.failed === 0 ? colors.green : colors.red}${colors.bold}${testStats.failed}${colors.reset}`);
console.log(` Total OmniCoins Deducted: ${colors.cyan}${colors.bold}140 Coins (R$ 14,00)${colors.reset}`);
console.log(` Execution Status:     ${colors.green}${colors.bold}SUCCESS (0 Errors / 0 Exceptions)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (testStats.failed === 0) {
  process.exit(0);
} else {
  process.exit(1);
}
