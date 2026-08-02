// Migração one-off de segredos em repouso:
// 1) Senhas legadas (texto puro / SHA-256 hex) em employees → PBKDF2-SHA256 (210k iterações)
// 2) Campos secretos do contaazul_config (DB) e tokens Conta Azul → AES-256-GCM (enc:v1:)
// Uso: node scripts/migrate-secrets-at-rest.js
// Usa a MESMA chave do app (OMNIZEUS_ENCRYPTION_KEY do .env.local / fallback de dev).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");
const TOKENS_FILE = path.join(DATA_DIR, "omnizeus_contaazul_tokens.json");

const PREFIX = "enc.v1:";
const SECRET_KEYS = ["access_token", "refresh_token", "client_secret", "accessToken", "refreshToken", "clientSecret"];
const PASSWORD_FIELDS = ["password", "passwordHash", "password_hash", "temporary_password", "temporaryPassword"];

function loadEnvLocal() {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return {};
  const out = {};
  for (const line of fs.readFileSync(envFile, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnvLocal();
const encKey =
  (env.OMNIZEUS_ENCRYPTION_KEY && env.OMNIZEUS_ENCRYPTION_KEY.length >= 32)
    ? env.OMNIZEUS_ENCRYPTION_KEY
    : "omnizeus_local_dev_encryption_key_at_rest_32b";
const aesKey = crypto.createHash("sha256").update(encKey).digest();

function encryptSecret(plaintext) {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function encryptFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of SECRET_KEYS) {
    if (typeof obj[key] === "string" && obj[key] && !isEncrypted(obj[key])) {
      obj[key] = encryptSecret(obj[key]);
    }
  }
  return obj;
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(plain, salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2$210000$${salt}$${derived}`;
}

function looksLikeLegacyPassword(value) {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("pbkdf2$")) return false;
  if (/^[a-f0-9]{64}$/i.test(value)) return true; // SHA-256 hex legado
  return true; // texto puro
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  let raw = fs.readFileSync(file, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ── 1) Tokens Conta Azul ──────────────────────────────────────────────────────
let tokenCount = 0;
const tokens = readJson(TOKENS_FILE);
if (tokens && typeof tokens === "object") {
  for (const companyId of Object.keys(tokens)) {
    const entry = tokens[companyId];
    if (entry && typeof entry === "object") {
      const before = JSON.stringify(entry);
      encryptFields(entry);
      if (JSON.stringify(entry) !== before) tokenCount++;
    }
  }
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
  console.log(`✓ omnizeus_contaazul_tokens.json: ${tokenCount} entradas criptografadas.`);
} else {
  console.log("• omnizeus_contaazul_tokens.json ausente/inválido — nada a migrar.");
}

// ── 2) DB local: contaazul_config + employees ────────────────────────────────
const db = readJson(DB_FILE_PATH);
if (db) {
  let cfgCount = 0;
  if (Array.isArray(db.contaazul_config)) {
    for (const cfg of db.contaazul_config) {
      const before = JSON.stringify(cfg);
      encryptFields(cfg);
      if (JSON.stringify(cfg) !== before) cfgCount++;
    }
  } else if (db.contaazul_config && typeof db.contaazul_config === "object") {
    const before = JSON.stringify(db.contaazul_config);
    encryptFields(db.contaazul_config);
    if (JSON.stringify(db.contaazul_config) !== before) cfgCount++;
  }

  let pwdCount = 0;
  if (Array.isArray(db.employees)) {
    for (const emp of db.employees) {
      for (const field of PASSWORD_FIELDS) {
        if (looksLikeLegacyPassword(emp[field])) {
          emp[field] = hashPassword(emp[field]);
          pwdCount++;
        }
      }
    }
  }

  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  console.log(`✓ DB: ${cfgCount} configs Conta Azul criptografadas; ${pwdCount} senhas re-hasheadas (PBKDF2).`);
} else {
  console.log("• DB local ausente/inválido — nada a migrar.");
}

console.log("Migração concluída.");
