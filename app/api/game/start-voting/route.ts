import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";
import { startVotingSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = startVotingSchema.safeParse({
    gameId: formData.get("gameId"),
    roundNumber: formData.get("roundNumber")
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
    .select("is_host")
    .eq("session_token", sessionToken)
    .eq("game_id", parsed.data.gameId)
    .maybeSingle();

  if (!session?.is_host) {
    return NextResponse.json({ error: "Only host can start voting" }, { status: 403 });
  }

  const [{ data: game }, { data: round }] = await Promise.all([
    supabase.from("games").select("settings_json").eq("id", parsed.data.gameId).maybeSingle(),
    supabase
      .from("rounds")
      .select("id, phase")
      .eq("game_id", parsed.data.gameId)
      .eq("round_number", parsed.data.roundNumber)
      .maybeSingle()
  ]);

  if (!game || !round) {
    return NextResponse.json({ error: "Game or round not found" }, { status: 404 });
  }

  if (round.phase !== "speaking_order") {
    return NextResponse.json({ error: "Voting can only start from speaking_order phase" }, { status: 400 });
  }

  const votingSeconds = Math.max(30, Number(game.settings_json?.votingSeconds ?? 90));
  const votingEndsAt = new Date(Date.now() + votingSeconds * 1000).toISOString();

  const { error } = await supabase
    .from("rounds")
    .update({ phase: "voting_open", voting_ends_at: votingEndsAt })
    .eq("id", round.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
}
