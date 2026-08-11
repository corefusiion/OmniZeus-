export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getContaAzulTokens } from "@/lib/contaazul/store";
import { decryptContaAzulFields } from "@/lib/crypto/atRest";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

/**
 * GET /api/contaazul/debug?companyId=...
 *
 * Endpoint de diagnóstico: faz as mesmas chamadas que o auto-sync e retorna
 * status HTTP, tamanho da resposta, primeiros 800 chars do body e estrutura
 * detectada. NÃO grava nada no banco.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || url.searchParams.get("company_id") || "comp_techcontabil_01";

  // ── 1. Carregar tokens do Supabase ────────────────────────────────────────
  let accessToken = "";
  let refreshToken = "";
  let clientId = "";
  let clientSecret = "";
  let tokenSource = "none";

  const { data: cfgRows } = await supabase
    .from("contaazul_config")
    .select("*")
    .eq("company_id", companyId);

  const cfgRow = cfgRows?.[0];
  if (cfgRow) {
    const decrypted = await decryptContaAzulFields(cfgRow);
    accessToken = decrypted.access_token || decrypted.accessToken || "";
    refreshToken = decrypted.refresh_token || decrypted.refreshToken || "";
    clientId = decrypted.client_id || decrypted.clientId || "";
    clientSecret = decrypted.client_secret || decrypted.clientSecret || "";
    tokenSource = "supabase_config";
  }

  // Fallback via getContaAzulTokens
  if (!accessToken) {
    const t = await getContaAzulTokens(companyId);
    if (t.accessToken) {
      accessToken = t.accessToken;
      refreshToken = t.refreshToken;
      clientId = t.clientId;
      clientSecret = t.clientSecret;
      tokenSource = "getContaAzulTokens";
    }
  }

  const authHeader = `Bearer ${accessToken.trim()}`;

  // ── 2. Helper para chamar um endpoint e retornar diagnóstico ──────────────
  async function probe(label: string, urlStr: string) {
    if (!accessToken) {
      return { label, url: urlStr, status: 0, ok: false, error: "Sem token de acesso", bodyPreview: "", keys: [], arrayLen: null };
    }
    try {
      const res = await fetch(urlStr, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      });

      const text = await res.text().catch(() => "");
      const isHtml = text.trimStart().startsWith("<");
      let parsed: any = null;
      let keys: string[] = [];
      let arrayLen: number | null = null;
      let arrayPreview: string[] = [];

      if (!isHtml && text) {
        try {
          parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            arrayLen = parsed.length;
            arrayPreview = parsed.slice(0, 2).map((i: any) => JSON.stringify(i).substring(0, 120));
          } else if (parsed && typeof parsed === "object") {
            keys = Object.keys(parsed);
            // Encontrar qual chave tem array
            for (const k of keys) {
              if (Array.isArray(parsed[k])) {
                arrayLen = (parsed[k] as any[]).length;
                arrayPreview = (parsed[k] as any[]).slice(0, 2).map((i: any) => JSON.stringify(i).substring(0, 120));
                break;
              }
            }
          }
        } catch {
          // JSON inválido
        }
      }

      return {
        label,
        url: urlStr,
        status: res.status,
        ok: res.ok,
        isHtml,
        bodyPreview: text.substring(0, 10000),
        keys,
        arrayLen,
        arrayPreview,
        bodySize: text.length
      };
    } catch (err: any) {
      return {
        label,
        url: urlStr,
        status: 0,
        ok: false,
        error: err.message || "Erro de rede",
        bodyPreview: "",
        keys: [],
        arrayLen: null
      };
    }
  }

  // ── 3. Executar sondas em paralelo (salvo as que dependem de token) ────────
  const results = await Promise.all([
    probe(
      "pessoas_v2",
      `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=50&size=50`
    ),
    probe(
      "pessoas_v2_filtro_cliente",
      `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=50&perfis=CLIENTE`
    ),
    probe(
      "pessoas_v2_filtro_fornecedor",
      `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=50&perfis=FORNECEDOR`
    ),
    probe(
      "fornecedores_v1_compras",
      `https://api.contaazul.com/v1/compras/fornecedores?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "clientes_v1_vendas",
      `https://api.contaazul.com/v1/vendas/clientes?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "eventos_financeiros",
      `https://api.contaazul.com/v1/financeiro/eventos-financeiros?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "lancamentos_financeiros",
      `https://api.contaazul.com/v1/financeiro/lancamentos?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "categorias_v1",
      `https://api.contaazul.com/v1/financeiro/categorias`
    ),
    probe(
      "categorias_v2",
      `https://api-v2.contaazul.com/v1/financeiro/categorias`
    ),
    probe(
      "receitas_v1",
      `https://api.contaazul.com/v1/receitas?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "despesas_v1",
      `https://api.contaazul.com/v1/despesas?pagina=1&tamanho_pagina=50`
    ),
    probe(
      "v1_sales",
      `https://api.contaazul.com/v1/sales`
    ),
    probe(
      "v1_purchases",
      `https://api.contaazul.com/v1/purchases`
    ),
    probe(
      "v1_services",
      `https://api.contaazul.com/v1/services`
    ),
    probe(
      "v1_contracts",
      `https://api.contaazul.com/v1/contracts`
    ),
    probe(
      "v2_vendas",
      `https://api-v2.contaazul.com/v1/vendas`
    ),
    probe(
      "v2_compras",
      `https://api-v2.contaazul.com/v1/compras`
    )
  ]);

  const debugPessoas = results[0]?.ok ? (results[0] as any).arrayPreview || [] : [];

  return NextResponse.json({
    diagnostics: {
      companyId,
      tokenSource,
      hasToken: !!accessToken,
      tokenPreview: accessToken ? `${accessToken.substring(0, 12)}...` : "VAZIO",
      clientId: clientId ? `${clientId.substring(0, 8)}...` : "VAZIO",
      testedAt: new Date().toISOString()
    },
    pessoasCount: results[0]?.arrayLen || 0,
    results
  });
}
