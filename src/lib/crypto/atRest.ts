// At-Rest Encryption — AES-256-GCM for secrets persisted on disk.
// Usado para tokens OAuth (Conta Azul) e outros segredos em repouso.
// Chave derivada de OMNIZEUS_ENCRYPTION_KEY (obrigatória em produção;
// em dev um fallback determinístico local mantém o ambiente de testes funcionando).
//
// Formato do valor criptografado: enc.v1:<iv base64url>:<tag base64url>:<cipher base64url>
// O prefixo "enc.v1:" não contém ":" interno → value.split(":") produz exatamente 4 partes.
// Valores que não iniciam com "enc.v1:" são tratados como legado em texto puro
// e retornados como estão (migração transparente para criptografia).

import crypto from "crypto";

const PREFIX = "enc.v1:";
const MIN_KEY_LEN = 32;

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

function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(getEncryptionKey()).digest();
}

/** Criptografa uma string em repouso. Retorna vazio se a entrada for vazia. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Descriptografa um valor em repouso.
 * Valores legado (texto puro, sem prefixo) passam direto — migração transparente.
 */
export function decryptSecret(value: string): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [, ivB64u, tagB64u, dataB64u] = value.split(":");
    if (!ivB64u || !tagB64u || !dataB64u) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivB64u, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64u, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64u, "base64url")),
      decipher.final()
    ]);
    return decrypted.toString("utf-8");
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
export function encryptContaAzulFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = { ...obj };
  for (const key of SECRET_KEYS) {
    if (typeof out[key] === "string" && out[key] && !isEncrypted(out[key])) {
      out[key] = encryptSecret(out[key]);
    }
  }
  return out as T;
}

/** Descriptografa os campos secretos de um registro Conta Azul, mantendo o resto. */
export function decryptContaAzulFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = { ...obj };
  for (const key of SECRET_KEYS) {
    if (typeof out[key] === "string" && out[key]) {
      out[key] = decryptSecret(out[key]);
    }
  }
  return out as T;
}
