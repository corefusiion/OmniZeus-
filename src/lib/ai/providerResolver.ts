import { readDb } from "@/lib/db/localDb";

// Edge-safe: lê variáveis de ambiente sem quebrar em Cloudflare Workers (onde `process` pode não existir).
function envOrEmpty(key: string): string {
  try {
    return typeof process !== "undefined" && process.env ? (process.env[key] || "") : "";
  } catch {
    return "";
  }
}

export interface ResolvedAIProvider {
  apiUrl: string;
  apiKey: string;
  model: string;
  credentialSource: 'company_openrouter' | 'master_fallback' | 'superadmin_openrouter_master' | 'superadmin_custom_endpoint';
  isCustomEndpoint: boolean;
  providerName: string;
}

export function maskApiKey(key?: string): string {
  if (!key || key.trim().length === 0) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  const prefix = trimmed.substring(0, 8);
  const suffix = trimmed.substring(trimmed.length - 4);
  return `${prefix}-••••••••${suffix}`;
}

export async function resolveAIProvider(options: {
  companyId?: string;
  userRole?: string;
  userEmail?: string;
  requestedModel?: string;
}): Promise<ResolvedAIProvider> {
  const db = await readDb();

  const settings = db.settings || {};
  const companies: any[] = db.companies || [];

  const isSuperAdmin = options.userRole === 'super_adm';

  // 1. SUPER ADMIN DEDICATED RESOLUTION PATH
  if (isSuperAdmin) {
    const selectedProvider = settings.super_admin_ai_provider || 'openrouter_master';

    if (selectedProvider === 'custom_endpoint' && settings.custom_ai_enabled && settings.custom_ai_url) {
      const baseUrl = settings.custom_ai_url.replace(/\/$/, "");
      const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      return {
        apiUrl,
        apiKey: settings.custom_ai_key || 'sk-custom-proxy',
        model: settings.custom_ai_model || options.requestedModel || 'auto',
        credentialSource: 'superadmin_custom_endpoint',
        isCustomEndpoint: true,
        providerName: 'Endpoint Customizado / Proxy'
      };
    }

    // Default to OpenRouter Master for Super Admin
    const masterKey = settings.openrouter_api_key || envOrEmpty('OPENROUTER_API_KEY');
    return {
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: masterKey,
      model: options.requestedModel || "anthropic/claude-3.7-sonnet",
      credentialSource: 'superadmin_openrouter_master',
      isCustomEndpoint: false,
      providerName: 'OpenRouter API Master'
    };
  }

  // 2. TENANT / COMPANY RESOLUTION PATH
  const companyId = options.companyId || "comp_zenitus";
  const tenantComp = companies.find((c: any) => c.id === companyId);

  const compKey = tenantComp?.openrouter_api_key || tenantComp?.openrouterApiKey;

  if (compKey && compKey.trim().length > 5) {
    return {
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: compKey.trim(),
      model: options.requestedModel || "anthropic/claude-3.7-sonnet",
      credentialSource: 'company_openrouter',
      isCustomEndpoint: false,
      providerName: `OpenRouter Próprio (${tenantComp?.corporate_name || tenantComp?.corporateName || 'Empresa'})`
    };
  }

  // Fallback to OpenRouter Master
  const masterKey = settings.openrouter_api_key || envOrEmpty('OPENROUTER_API_KEY');
  return {
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: masterKey,
    model: options.requestedModel || "anthropic/claude-3.7-sonnet",
    credentialSource: 'master_fallback',
    isCustomEndpoint: false,
    providerName: 'OpenRouter API Master (Fallback)'
  };
}
