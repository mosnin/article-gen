/**
 * Server-side AES-256-GCM encryption for WordPress credentials.
 *
 * Set WP_ENCRYPTION_KEY to a 32-byte hex string (64 hex chars) in your
 * environment. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Encrypted values are prefixed with "enc:" so callers can detect them and
 * fall back gracefully for legacy plaintext values already in the database.
 */

const ENCRYPTED_PREFIX = "enc:";
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.WP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "WP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a plaintext string. Returns "enc:<base64(iv+authTag+ciphertext)>". */
export function encryptCredential(plaintext: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + packed.toString("base64");
}

/** Decrypt a value previously produced by encryptCredential.
 *  Returns the plaintext. Throws if the value is tampered or the key is wrong.
 *  If the value is not prefixed with "enc:" it is returned as-is (legacy plaintext). */
export function decryptCredential(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy plaintext — return unchanged for backward compatibility
    return value;
  }
  const crypto = require("crypto") as typeof import("crypto");
  const key = getKey();
  const packed = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Returns true if the value was encrypted by encryptCredential. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
