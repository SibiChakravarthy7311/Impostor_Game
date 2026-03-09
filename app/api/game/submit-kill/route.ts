import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";
import { submitKillSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = submitKillSchema.safeParse({
    gameId: formData.get("gameId"),
    roundNumber: formData.get("roundNumber"),
    targetPlayerId: formData.get("targetPlayerId")
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
    .select("player_id")
    .eq("session_token", sessionToken)
    .eq("game_id", parsed.data.gameId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session does not belong to this game" }, { status: 403 });
  }

  const [{ data: round }, { data: leadRole }, { data: target }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, phase, voting_ends_at")
      .eq("game_id", parsed.data.gameId)
      .eq("round_number", parsed.data.roundNumber)
      .single(),
    supabase
      .from("roles")
      .select("player_id, role, is_lead_impostor")
      .eq("game_id", parsed.data.gameId)
      .eq("player_id", session.player_id)
      .maybeSingle(),
    supabase
      .from("players")
      .select("id, is_alive")
      .eq("game_id", parsed.data.gameId)
      .eq("id", parsed.data.targetPlayerId)
      .maybeSingle()
  ]);

  if (!round || round.phase !== "voting_open") {
    return NextResponse.json({ error: "Kill action is only available during voting" }, { status: 400 });
  }

  if (round.voting_ends_at && Date.now() >= new Date(round.voting_ends_at).getTime()) {
    return NextResponse.json({ error: "Voting timer expired" }, { status: 400 });
  }

  if (!leadRole || leadRole.role !== "impostor" || !leadRole.is_lead_impostor) {
    return NextResponse.json({ error: "Only active lead impostor can submit kill" }, { status: 403 });
  }

  if (parsed.data.targetPlayerId === session.player_id) {
    return NextResponse.json({ error: "Lead impostor cannot kill self" }, { status: 400 });
  }

  if (!target?.is_alive) {
    return NextResponse.json({ error: "Target must be alive" }, { status: 400 });
  }

  const { error } = await supabase.from("kills").upsert(
    {
      round_id: round.id,
      lead_player_id: session.player_id,
      target_player_id: parsed.data.targetPlayerId
    },
    { onConflict: "round_id,lead_player_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
}
