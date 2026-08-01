// OmniCoins Store — Per-Company Wallet
// Each company has its own coins_franchise balance stored in companies[id].coins_franchise
// Global settings.coins_balance is NO LONGER used for tenant deductions

export interface CoinTransaction {
  id: string;
  company_id: string;
  timestamp: string;
  type: 'usage' | 'recharge';
  action: string;
  coins: number;
  costBrl: number;
  agent?: string;
  model?: string;
  tokens?: number;
  messages?: number;
  balanceAfter?: number;
}

export const COIN_CONVERSION = {
  BRL_PER_COIN: 0.10,
  ACTION_COSTS: {
    CHAT_SIMPLE: 5,
    ANALYSIS_SPED: 25,
    DOCUMENT_PDF: 30,
    SLIDES_DECK: 80,
    WHATSAPP_MSG: 3,
  }
};

// Per-company in-memory cache: { [companyId]: balance }
let inMemoryBalances: Record<string, number> = {};
// In-memory transaction log (no mock data — all real)
let inMemoryTransactions: CoinTransaction[] = [];

// Limpa todo o cache de coins ao trocar de empresa (impede vazamento entre tenants)
export function resetCoinStore(): void {
  inMemoryBalances = {};
  inMemoryTransactions = [];
}

// ─── Fetch balance for a specific company from server ──────────────────────

export async function fetchCoinBalanceFromServer(companyId: string): Promise<number> {
  try {
    const res = await fetch(`/api/db?table=companies`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const companies: any[] = Array.isArray(json.data) ? json.data : [];
      const company = companies.find((c: any) => c.id === companyId);
      const balance = company
        ? (typeof company.coins_franchise === 'number'
          ? company.coins_franchise
          : (typeof company.coinsFranchise === 'number' ? company.coinsFranchise : 0))
        : 0;
      // Sempre popular o cache (mesmo quando a empresa não é encontrada),
      // caso contrário o getCoinBalance() entra em loop infinito de fetch + evento.
      inMemoryBalances[companyId] = balance;
      return balance;
    }
  } catch (err) {
    console.error(`[Coins] Error fetching balance for company ${companyId}:`, err);
  }
  // Popula cache com fallback para evitar re-fetch infinito.
  if (!(companyId in inMemoryBalances)) {
    inMemoryBalances[companyId] = 0;
  }
  return inMemoryBalances[companyId] ?? 0;
}

// ─── Get cached balance (triggers async fetch on first call) ───────────────

function resolveDefaultCompanyId(): string {
  if (typeof window === 'undefined') return 'comp_zenitus';
  return localStorage.getItem('omnizeus_active_company_id') || 'comp_zenitus';
}

export function getCoinBalance(companyId?: string): number {
  const effectiveCompanyId = companyId || resolveDefaultCompanyId();
  if (typeof window !== 'undefined' && !(effectiveCompanyId in inMemoryBalances)) {
    fetchCoinBalanceFromServer(effectiveCompanyId).then((balance) => {
      // Só notifica os listeners quando o saldo realmente muda, evitando
      // cascatas de re-render e re-fetch no Header.
      if (inMemoryBalances[effectiveCompanyId] !== balance) {
        window.dispatchEvent(new Event('omnizeus_coins_change'));
      }
    }).catch(() => {});
  }
  return inMemoryBalances[effectiveCompanyId] ?? 0;
}

// ─── Get usage logs, optionally filtered by company ────────────────────────

export function getCoinUsageLogs(companyId?: string): CoinTransaction[] {
  if (!companyId) return inMemoryTransactions;
  return inMemoryTransactions.filter(t => t.company_id === companyId);
}

// ─── Deduct coins from a specific company ──────────────────────────────────

export async function deductCoinsFromCompany(
  companyId: string,
  amount: number,
  actionName: string,
  meta?: { agent?: string; model?: string; tokens?: number }
): Promise<boolean> {
  const current = await fetchCoinBalanceFromServer(companyId);
  if (current < amount) return false;

  const updated = Math.max(0, current - amount);
  inMemoryBalances[companyId] = updated;

  // Persist via the consume API (which updates companies table)
  try {
    await fetch('/api/coins/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        coins_consumed: amount,
        funcionalidade: actionName,
        agente_nome: meta?.agent || 'Omni IA Hub',
        modelo: meta?.model || 'OpenRouter LLM',
        tokens_input: meta?.tokens || Math.floor(amount * 450),
        tokens_output: 0,
      })
    });
  } catch (e) {}

  inMemoryTransactions.unshift({
    id: `tx-${Date.now()}`,
    company_id: companyId,
    timestamp: new Date().toISOString(),
    type: 'usage',
    action: actionName,
    agent: meta?.agent || 'Omni IA Hub',
    model: meta?.model || 'OpenRouter LLM',
    tokens: meta?.tokens || Math.floor(amount * 450),
    messages: 1,
    coins: amount,
    costBrl: Number((amount * COIN_CONVERSION.BRL_PER_COIN).toFixed(2)),
    balanceAfter: updated
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_coins_change'));
  }
  return true;
}

// ─── Legacy sync shim — components not yet updated can still call deductCoins

export function deductCoins(amount: number, actionName: string, meta?: { agent?: string; model?: string; tokens?: number }): boolean {
  const companyId = resolveDefaultCompanyId();
  deductCoinsFromCompany(companyId, amount, actionName, meta).catch(() => {});
  const current = inMemoryBalances[companyId] ?? 0;
  inMemoryBalances[companyId] = Math.max(0, current - amount);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_coins_change'));
  }
  return true;
}

// ─── Add coins to a company (recharge) ────────────────────────────────────

export async function addCoinsToCompany(companyId: string, amount: number): Promise<void> {
  const current = await fetchCoinBalanceFromServer(companyId);
  const updated = current + amount;
  inMemoryBalances[companyId] = updated;

  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        table: 'companies',
        record: { id: companyId, coins_franchise: updated }
      })
    });
  } catch (e) {}

  inMemoryTransactions.unshift({
    id: `tx-rec-${Date.now()}`,
    company_id: companyId,
    timestamp: new Date().toISOString(),
    type: 'recharge',
    action: `Recarga de Franquia (+${amount.toLocaleString('pt-BR')} Coins)`,
    agent: 'Plano SaaS Master',
    coins: amount,
    costBrl: Number((amount * COIN_CONVERSION.BRL_PER_COIN).toFixed(2)),
    balanceAfter: updated
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_coins_change'));
  }
}

// Legacy shim
export function addCoins(amount: number): void {
  addCoinsToCompany(resolveDefaultCompanyId(), amount).catch(() => {});
}


