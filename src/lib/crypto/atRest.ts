// At-Rest Encryption — AES-256-GCM for secrets persisted on disk.
// Usado para tokens OAuth (Conta Azul) e outros segredos em repouso.
// Chave derivada de OMNIZEUS_ENCRYPTION_KEY (obrigatória em produção;
// em dev um fallback determinístico local mantém o ambiente de testes funcionando).
//
// Formato do valor criptografado: enc.v1:<iv base64url>:<tag base64url>:<cipher base64url>
// O prefixo "enc.v1:" não contém ":" interno → value.split(":") produz exatamente 4 partes.
// Valores que não iniciam com "enc.v1:" são tratados como legado em texto puro
// e retornados como estão (migração transparente para criptografia).
//
// EDGE-COMPATIBLE: usa Web Crypto API (crypto.subtle) — roda no Edge Runtime,
// Cloudflare Workers e Node 20+ (browsers também). Todas as funções são async.

const PREFIX = "enc.v1:";
const MIN_KEY_LEN = 32;
const IV_LEN = 12;

let cachedKey: string | null = null;

// Resolução LAZY da chave: só lança quando criptografia é de fato usada em
// runtime (produção). O import do módulo NUNCA lança, para o Next.js poder
// coletar dados de página (build) sem exigir variáveis de ambiente presentes.
function getEncryptionKey(): string {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.OMNIZEUS_ENCRYPTION_KEY;
  if (fromEnv && fromEnv.length >= MIN_KEY_LEN) {
    cachedKey = fromEnv;
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OMNIZEUS_ENCRYPTION_KEY ausente ou curta demais (mínimo 32 caracteres). " +
      "Defina a variável no ambiente de produção — sem ela os segredos em repouso não podem ser protegidos."
    );
  }
  return "omnizeus_local_dev_encryption_key_at_rest_32b";
}

async function deriveKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(getEncryptionKey()));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
  const binary = atob(pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Criptografa uma string em repouso. Retorna vazio se a entrada for vazia. */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );
  const cipherBytes = new Uint8Array(cipher);
  // AES-GCM: o tag de 16 bytes vem anexado ao final do ciphertext
  const tag = cipherBytes.slice(cipherBytes.length - 16);
  const data = cipherBytes.slice(0, cipherBytes.length - 16);
  return `${PREFIX}${bytesToBase64Url(iv)}:${bytesToBase64Url(tag)}:${bytesToBase64Url(data)}`;
}

/**
 * Descriptografa um valor em repouso.
 * Valores legado (texto puro, sem prefixo) passam direto — migração transparente.
 */
export async function decryptSecret(value: string): Promise<string> {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [, ivB64u, tagB64u, dataB64u] = value.split(":");
    if (!ivB64u || !tagB64u || !dataB64u) return "";
    const key = await deriveKey();
    const cipher = new Uint8Array([
      ...base64UrlToBytes(dataB64u),
      ...base64UrlToBytes(tagB64u),
    ]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(ivB64u), tagLength: 128 },
      key,
      cipher
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

/** True se o valor já está criptografado (formato enc:v1:). */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// ─── Helpers para registros Conta Azul (snake e camel) ───────────────────────

const SECRET_KEYS = ["access_token", "refresh_token", "client_secret", "accessToken", "refreshToken", "clientSecret"];

/** Criptografa os campos secretos de um registro Conta Azul, mantendo o resto. */
export async function encryptContaAzulFields<T extends Record<string, any>>(obj: T): Promise<T> {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = { ...obj };
  for (const key of SECRET_KEYS) {
    if (typeof out[key] === "string" && out[key] && !isEncrypted(out[key])) {
      out[key] = await encryptSecret(out[key]);
    }
  }
  return out as T;
}

/** Descriptografa os campos secretos de um registro Conta Azul, mantendo o resto. */
export async function decryptContaAzulFields<T extends Record<string, any>>(obj: T): Promise<T> {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = { ...obj };
  for (const key of SECRET_KEYS) {
    if (typeof out[key] === "string" && out[key]) {
      out[key] = await decryptSecret(out[key]);
    }
  }
  return out as T;
}
