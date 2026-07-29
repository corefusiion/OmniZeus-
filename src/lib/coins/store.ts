import { fetchServerSettings, updateServerSettings } from "../db/serverDb";

export interface CoinTransaction {
  id: string;
  timestamp: string;
  type: 'usage' | 'recharge';
  action: string;
  coins: number;
  costBrl: number;
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

let inMemoryCoinBalance = 14250;
let isInitialized = false;

export async function fetchCoinBalanceFromServer(): Promise<number> {
  try {
    const settings = await fetchServerSettings();
    if (settings && typeof settings.coins_balance === 'number') {
      inMemoryCoinBalance = settings.coins_balance;
      isInitialized = true;
    }
  } catch (err) {
    console.error("Error fetching coin balance from server:", err);
  }
  return inMemoryCoinBalance;
}

export function getCoinBalance(): number {
  if (typeof window !== 'undefined' && !isInitialized) {
    isInitialized = true;
    fetchCoinBalanceFromServer().then(() => {
      window.dispatchEvent(new Event('omnizeus_coins_change'));
    }).catch(() => {});
  }
  return inMemoryCoinBalance;
}

export function deductCoins(amount: number, actionName: string): boolean {
  const current = getCoinBalance();
  if (current < amount) return false;
  
  const updated = current - amount;
  inMemoryCoinBalance = updated;
  updateServerSettings({ coins_balance: updated }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_coins_change'));
  }
  return true;
}

export function addCoins(amount: number): void {
  const current = getCoinBalance();
  const updated = current + amount;
  inMemoryCoinBalance = updated;
  updateServerSettings({ coins_balance: updated }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_coins_change'));
  }
}

