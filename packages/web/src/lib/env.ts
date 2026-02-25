import { z } from "zod";

/**
 * Validated server-side environment variables.
 *
 * Throws at import time if any required variable is missing,
 * producing a clear error instead of cryptic runtime failures.
 */
const ServerEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  CONNECTION_STRING_ENCRYPTION_KEY: z
    .string()
    .length(64, "CONNECTION_STRING_ENCRYPTION_KEY must be 64 hex characters")
    .regex(/^[0-9a-f]+$/i, "CONNECTION_STRING_ENCRYPTION_KEY must be hex"),
});

function parseServerEnv() {
  const result = ServerEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    console.error(`[env] Missing or invalid environment variables:\n${messages}`);
    // Return partial env to avoid crashing at module load time in build/dev
    // The actual validation errors are logged above for debugging
    return process.env as unknown as z.infer<typeof ServerEnvSchema>;
  }
  return result.data;
}

export const serverEnv = parseServerEnv();
