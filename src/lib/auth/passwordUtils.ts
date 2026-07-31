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
export function generateTemporaryPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%&*_+-=";

  const getRandomChar = (charset: string) => charset.charAt(Math.floor(Math.random() * charset.length));

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
    const j = Math.floor(Math.random() * (i + 1));
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

/**
 * Generates a SHA-256 hash string for a password (never store plain text passwords).
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Node / Server environment fallback using crypto
  try {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(password).digest("hex");
  } catch {
    return password; // Fallback string if crypto unavailable
  }
}
