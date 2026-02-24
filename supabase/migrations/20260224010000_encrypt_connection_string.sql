-- Phase 19: connection_string is now AES-256-GCM encrypted at the application layer.
-- Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
-- Key: CONNECTION_STRING_ENCRYPTION_KEY env var (64 hex chars / 32 bytes)
--
-- EXISTING ROWS: contain plaintext and must be re-added via the UI after deployment.
-- Plaintext rows produce CryptoDecryptionError on read (unknown format/version).
--
-- No DDL change needed — TEXT column stores the versioned ciphertext string.

COMMENT ON COLUMN public.connections.connection_string
  IS 'AES-256-GCM encrypted. Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>. Key: CONNECTION_STRING_ENCRYPTION_KEY.';
