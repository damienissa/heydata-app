import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from "crypto";

const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";

// Lazily cached — avoids crashing on import when key is not set in tests
let _keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (!_keyCache) {
    const hex = process.env.CONNECTION_STRING_ENCRYPTION_KEY;
    if (!hex) throw new Error("[crypto] CONNECTION_STRING_ENCRYPTION_KEY is not set.");
    if (hex.length !== 64)
      throw new Error(`[crypto] Key must be 64 hex chars, got ${hex.length}.`);
    if (!/^[0-9a-fA-F]+$/.test(hex))
      throw new Error("[crypto] Key contains non-hex characters.");
    _keyCache = Buffer.from(hex, "hex");
  }
  return _keyCache;
}

/**
 * Encrypt a connection string with AES-256-GCM.
 * Returns a versioned opaque string: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * Each call uses a fresh random IV for semantic security.
 */
export function encryptConnectionString(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/**
 * Decrypt a value produced by encryptConnectionString().
 * Throws CryptoDecryptionError on wrong key, tampered data, or unknown format.
 */
export function decryptConnectionString(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts[0] !== "v1" || parts.length !== 4) {
    throw new CryptoDecryptionError(`Unknown format or version: "${parts[0]}"`);
  }
  const [, ivHex, tagHex, ctHex] = parts as [string, string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (cause) {
    throw new CryptoDecryptionError("Decryption failed — wrong key or tampered data.", { cause });
  }
}

export class CryptoDecryptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CryptoDecryptionError";
  }
}
