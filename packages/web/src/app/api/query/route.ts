import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processQueryForConnection } from "@/lib/process-query-for-connection";
import { HeyDataError } from "@heydata/shared";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, sessionId, connectionId } = body as {
      question?: string;
      sessionId?: string;
      connectionId?: string;
    };

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required. Select a connection to query your data." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const response = await processQueryForConnection(
      supabase as unknown as import("@supabase/supabase-js").SupabaseClient<import("@heydata/supabase").Database>,
      { connectionId, question, sessionId },
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Query error:", error);

    if (error instanceof HeyDataError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          agent: error.agent,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
