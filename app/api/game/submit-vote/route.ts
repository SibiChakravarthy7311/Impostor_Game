import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";
import { submitVoteSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = submitVoteSchema.safeParse({
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

  const [{ data: actor }, { data: target }, { data: round }] = await Promise.all([
    supabase
      .from("players")
      .select("id, is_alive")
      .eq("id", session.player_id)
      .eq("game_id", parsed.data.gameId)
      .maybeSingle(),
    supabase
      .from("players")
      .select("id, is_alive")
      .eq("id", parsed.data.targetPlayerId)
      .eq("game_id", parsed.data.gameId)
      .maybeSingle(),
    supabase
      .from("rounds")
      .select("id, phase, voting_ends_at")
      .eq("game_id", parsed.data.gameId)
      .eq("round_number", parsed.data.roundNumber)
      .single()
  ]);

  if (!actor?.is_alive) {
    return NextResponse.json({ error: "Only alive players can vote" }, { status: 403 });
  }

  if (!target?.is_alive) {
    return NextResponse.json({ error: "Target must be an alive player" }, { status: 400 });
  }

  if (target.id === session.player_id) {
    return NextResponse.json({ error: "You cannot vote for yourself" }, { status: 400 });
  }

  if (!round || round.phase !== "voting_open") {
    return NextResponse.json({ error: "Voting is closed" }, { status: 400 });
  }

  if (round.voting_ends_at && Date.now() >= new Date(round.voting_ends_at).getTime()) {
    return NextResponse.json({ error: "Voting timer expired" }, { status: 400 });
  }

  const { error } = await supabase.from("votes").upsert(
    {
      round_id: round.id,
      voter_player_id: session.player_id,
      target_player_id: parsed.data.targetPlayerId
    },
    { onConflict: "round_id,voter_player_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
}
