import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  connectionId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/sessions — List chat sessions for the authenticated user.
 * Optional query: ?connectionId=uuid to filter by connection
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  let query = supabase
    .from("chat_sessions")
    .select("id, title, connection_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/sessions — Create a new chat session
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSessionSchema.safeParse(body);

  const insertData = {
    user_id: user.id,
    title: parsed.success && parsed.data.title ? parsed.data.title : "New Chat",
    connection_id: parsed.success && parsed.data.connectionId
      ? parsed.data.connectionId
      : null,
  };

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert(insertData as never)
    .select("id, title, connection_id, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
