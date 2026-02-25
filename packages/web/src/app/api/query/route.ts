export const maxDuration = 60;

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processQueryForConnection } from "@/lib/process-query-for-connection";
import { apiError, handleApiError } from "@/lib/api-error";

const QuerySchema = z.object({
  question: z.string().min(1, "Question is required"),
  connectionId: z.string().uuid("connectionId must be a valid UUID"),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = QuerySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(400, "Invalid request body", {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { question, connectionId, sessionId } = parsed.data;

    const supabase = await createClient();
    const response = await processQueryForConnection(
      supabase as unknown as import("@supabase/supabase-js").SupabaseClient<import("@heydata/supabase").Database>,
      { connectionId, question, sessionId },
    );

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
