import { NextResponse } from "next/server";
import { HeyDataError } from "@heydata/shared";

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Create a standardized JSON error response.
 */
export function apiError(
  status: number,
  message: string,
  opts?: { code?: string; details?: unknown },
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        message,
        code: opts?.code,
        details: opts?.details,
      },
    },
    { status },
  );
}

/**
 * Convert a caught error to a standardized API error response.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof HeyDataError) {
    return apiError(500, error.message, {
      code: error.code,
      details: error.agent ? { agent: error.agent } : undefined,
    });
  }

  console.error("[api] Unhandled error:", error);
  return apiError(500, "Internal server error");
}
