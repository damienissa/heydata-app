import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/connections/:id/commands
 * Returns all slash commands for the connection, ordered by sort_order.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: connectionId } = await params;

  const { data, error } = await supabase
    .from("connection_commands")
    .select("id, slash_command, description, prompt, sort_order")
    .eq("connection_id", connectionId)
    .order("sort_order", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}

/**
 * PUT /api/connections/:id/commands
 * Full replace: delete all existing commands, then insert the new set.
 * Body: { commands: Array<{ slashCommand: string; description: string; prompt: string }> }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: connectionId } = await params;

  let body: { commands?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.commands)) {
    return Response.json({ error: "commands must be an array" }, { status: 400 });
  }

  type CommandInput = { slashCommand: string; description: string; prompt: string };
  const commands = body.commands as CommandInput[];

  // Validate each entry
  for (const cmd of commands) {
    if (typeof cmd.slashCommand !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(cmd.slashCommand)) {
      return Response.json(
        { error: `Invalid slashCommand: "${cmd.slashCommand}"` },
        { status: 400 },
      );
    }
    if (typeof cmd.description !== "string" || cmd.description.trim() === "") {
      return Response.json({ error: "description is required" }, { status: 400 });
    }
    if (typeof cmd.prompt !== "string" || cmd.prompt.trim() === "") {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }
  }

  // Full replace
  const { error: deleteError } = await supabase
    .from("connection_commands")
    .delete()
    .eq("connection_id", connectionId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  if (commands.length === 0) {
    return Response.json([]);
  }

  const { data, error: insertError } = await supabase
    .from("connection_commands")
    .insert(
      commands.map((c, i) => ({
        connection_id: connectionId,
        slash_command: c.slashCommand,
        description: c.description,
        prompt: c.prompt,
        sort_order: i,
      })) as never,
    )
    .select("id, slash_command, description, prompt, sort_order");

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}
