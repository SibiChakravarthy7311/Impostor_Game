import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";
import { startGameSchema } from "../../../../lib/validation";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = startGameSchema.safeParse({
    gameId: formData.get("gameId")
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionToken = getSessionTokenFromRequest(request);
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data: session } = await supabase
    .from("player_sessions")
    .select("player_id, is_host")
    .eq("session_token", sessionToken)
    .eq("game_id", parsed.data.gameId)
    .maybeSingle();

  if (!session || !session.is_host) {
    return NextResponse.json({ error: "Only host can start game" }, { status: 403 });
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status, settings_json")
    .eq("id", parsed.data.gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message ?? "Game not found" }, { status: 404 });
  }

  if (game.status !== "lobby") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const impostorCount = Math.max(1, Number(game.settings_json?.impostorCount ?? 1));
  const votingSeconds = Math.max(30, Number(game.settings_json?.votingSeconds ?? 90));

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", parsed.data.gameId)
    .eq("is_alive", true)
    .order("joined_at");

  if (playersError || !players || players.length < impostorCount + 1) {
    return NextResponse.json({ error: "Not enough players to start" }, { status: 400 });
  }

  const playerIds = shuffled(players.map((p) => p.id));
  const impostorIds = playerIds.slice(0, impostorCount);
  const leadId = impostorIds[0];

  const roleRows = players.map((p) => ({
    game_id: parsed.data.gameId,
    player_id: p.id,
    role: impostorIds.includes(p.id) ? "impostor" : "civilian",
    is_lead_impostor: p.id === leadId
  }));

  const { error: roleError } = await supabase.from("roles").insert(roleRows);
  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  const votingEndsAt = new Date(Date.now() + votingSeconds * 1000).toISOString();
  const { error: roundError } = await supabase
    .from("rounds")
    .insert({ game_id: parsed.data.gameId, round_number: 1, phase: "voting_open", voting_ends_at: votingEndsAt });

  if (roundError) {
    return NextResponse.json({ error: roundError.message }, { status: 500 });
  }

  await supabase.from("games").update({ status: "in_progress", round_number: 1 }).eq("id", parsed.data.gameId);

  return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
}
