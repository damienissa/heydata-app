import { NextResponse } from "next/server";
import { processQuery } from "@/lib/orchestrator";
import { HeyDataError } from "@heydata/shared";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, sessionId } = body as { question?: string; sessionId?: string };

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const response = await processQuery({ question, sessionId });

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
