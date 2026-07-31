import { fetchServerTable } from "@/lib/db/serverDb";

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

const swrMemoryMap = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export function getActiveTenantKey(companyId?: string): string {
  if (companyId) return companyId;
  if (typeof window !== "undefined") {
    return localStorage.getItem("omnizeus_active_company_id") || "global";
  }
  return "global";
}

/**
 * High-speed SWR (Stale-While-Revalidate) fetcher for server tables.
 * Returns cached data instantly (0ms) if available, and silently revalidates in background.
 */
export async function swrFetchServerTable<T = any>(
  table: string, 
  companyId?: string,
  forceRefresh = false
): Promise<T[]> {
  const tenantKey = getActiveTenantKey(companyId);
  const cacheKey = `${table}_${tenantKey}`;
  const now = Date.now();

  const cached = swrMemoryMap.get(cacheKey);

  // If cached and valid, return cached data immediately
  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    // Background silent revalidation if older than 5 seconds
    if ((now - cached.timestamp) > 5000) {
      fetchServerTable<T>(table, tenantKey).then(freshData => {
        if (Array.isArray(freshData)) {
          swrMemoryMap.set(cacheKey, { data: freshData, timestamp: Date.now() });
        }
      }).catch(() => {});
    }
    return cached.data;
  }

  // Fetch fresh data
  const freshData = await fetchServerTable<T>(table, tenantKey);
  if (Array.isArray(freshData)) {
    swrMemoryMap.set(cacheKey, { data: freshData, timestamp: now });
  }
  return freshData;
}

/**
 * Clear cache for a specific table or all cache when changing company context
 */
export function invalidateSwrCache(table?: string, companyId?: string) {
  if (table) {
    const tenantKey = getActiveTenantKey(companyId);
    swrMemoryMap.delete(`${table}_${tenantKey}`);
  } else {
    swrMemoryMap.clear();
  }
}

// Auto-clear SWR cache when switching company context
if (typeof window !== "undefined") {
  window.addEventListener("omnizeus_company_context_change", () => invalidateSwrCache());
  window.addEventListener("omnizeus_role_change", () => invalidateSwrCache());
}
