// Password Utilities — Random Generator, Security Validation & Hashing
// Used for Temporary Passwords & First Login Security Requirements

export interface PasswordValidationResult {
  isValid: boolean;
  checks: {
    minLength: boolean;   // >= 8 chars
    hasUpper: boolean;    // >= 1 A-Z
    hasLower: boolean;    // >= 1 a-z
    hasNumber: boolean;   // >= 1 0-9
    hasSpecial: boolean;  // >= 1 @#$%^&*!
  };
}

/**
 * Generates a random, secure, 12-character temporary password.
 * Guaranteed to satisfy all 5 security requirements.
 */
// Inteiro aleatório criptograficamente seguro em [0, max). Math.random é previsível
// e não pode ser usado para gerar credenciais.
function secureRandomInt(max: number): number {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    // Rejeição do resto para evitar viés de módulo
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    let value: number;
    do {
      globalThis.crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }
  const nodeCrypto = require("crypto");
  return nodeCrypto.randomInt(max);
}

export function generateTemporaryPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%&*_+-=";

  const getRandomChar = (charset: string) => charset.charAt(secureRandomInt(charset.length));

  // Guarantee at least 1 of each required class
  const requiredChars = [
    getRandomChar(uppers),
    getRandomChar(uppers),
    getRandomChar(lowers),
    getRandomChar(lowers),
    getRandomChar(numbers),
    getRandomChar(numbers),
    getRandomChar(specials),
    getRandomChar(specials)
  ];

  const allChars = uppers + lowers + numbers + specials;
  while (requiredChars.length < 12) {
    requiredChars.push(getRandomChar(allChars));
  }

  // Fisher-Yates shuffle
  for (let i = requiredChars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
  }

  return requiredChars.join("");
}

/**
 * Validates password against required security policy.
 */
export function validatePasswordRequirements(password: string): PasswordValidationResult {
  const minLength = (password || "").length >= 8;
  const hasUpper = /[A-Z]/.test(password || "");
  const hasLower = /[a-z]/.test(password || "");
  const hasNumber = /[0-9]/.test(password || "");
  const hasSpecial = /[^A-Za-z0-9]/.test(password || "");

  const isValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial;

  return {
    isValid,
    checks: {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial
    }
  };
}

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const enc = new TextEncoder();
    const key = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      key,
      PBKDF2_KEYLEN * 8
    );
    return toHex(new Uint8Array(bits));
  }
  const nodeCrypto = require("crypto");
  return new Promise<string>((resolve, reject) => {
    nodeCrypto.pbkdf2(password, saltHex, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, "sha256", (err: any, derived: Buffer) => {
      if (err) reject(err);
      else resolve(derived.toString("hex"));
    });
  });
}

/**
 * Deriva o hash da senha com PBKDF2-SHA256 e salt aleatório.
 * Formato: pbkdf2$<iteracoes>$<salt>$<hash>
 */
export async function hashPassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(saltBytes);
  } else {
    const nodeCrypto = require("crypto");
    saltBytes.set(nodeCrypto.randomBytes(16));
  }
  const salt = toHex(saltBytes);
  const derived = await pbkdf2(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

/**
 * Confere a senha contra o valor armazenado.
 * Aceita o formato PBKDF2 atual e os formatos legados (SHA-256 hex e texto puro)
 * para que contas criadas antes da migração continuem conseguindo entrar.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;

  if (stored.startsWith("pbkdf2$")) {
    const [, , salt, expected] = stored.split("$");
    if (!salt || !expected) return false;
    const derived = await pbkdf2(password, salt);
    return timingSafeEqualHex(derived, expected);
  }

  // Legado: SHA-256 sem salt (64 chars hex)
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const subtle = globalThis.crypto?.subtle;
    let sha: string;
    if (subtle) {
      const buf = await subtle.digest("SHA-256", new TextEncoder().encode(password));
      sha = toHex(new Uint8Array(buf));
    } else {
      sha = require("crypto").createHash("sha256").update(password).digest("hex");
    }
    return timingSafeEqualHex(sha, stored.toLowerCase());
  }

  // Legado: senha em texto puro persistida pelo seed antigo
  return timingSafeEqualHex(password, stored);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
