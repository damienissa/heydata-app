export const maxDuration = 120;

import { createClient } from "@/lib/supabase/server";
import { generateCommandsFromSemantic } from "@heydata/core";

/**
 * POST /api/connections/:id/commands/generate
 * Generates slash commands from the connection's existing semantic layer.
 *
 * Returns: { commands: Array<{ slashCommand, description, prompt }> }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: connectionId } = await params;

  // ── Fetch existing semantic layer ─────────────────────────────────────────
  const { data: layer, error: layerError } = (await supabase
    .from("semantic_layers" as never)
    .select("semantic_md")
    .eq("connection_id", connectionId)
    .single()) as { data: { semantic_md: string } | null; error: unknown };

  if (layerError || !layer) {
    return new Response(
      JSON.stringify({ error: "Semantic layer not found. Generate it first." }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Generate commands ─────────────────────────────────────────────────────
  console.log(`[commands/generate] Generating commands for connection ${connectionId}`);
  let commands: Array<{ slashCommand: string; description: string; prompt: string }>;
  try {
    const output = await generateCommandsFromSemantic(layer.semantic_md);
    commands = output.commands;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[commands/generate] Generation failed:", error);
    return new Response(
      JSON.stringify({ error: `Command generation failed: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Save commands ─────────────────────────────────────────────────────────
  await supabase.from("connection_commands").delete().eq("connection_id", connectionId);

  if (commands.length > 0) {
    await supabase.from("connection_commands").insert(
      commands.map((c, i) => ({
        connection_id: connectionId,
        slash_command: c.slashCommand,
        description: c.description,
        prompt: c.prompt,
        sort_order: i,
      })) as never,
    );
  }

  console.log(`[commands/generate] Saved ${commands.length} commands for connection ${connectionId}`);

  return new Response(JSON.stringify({ commands }), {
    headers: { "Content-Type": "application/json" },
  });
}
