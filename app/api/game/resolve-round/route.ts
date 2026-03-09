import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";
import { resolveRoundSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = resolveRoundSchema.safeParse({
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
    return NextResponse.json({ error: "Only host can resolve rounds" }, { status: 403 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("phase")
    .eq("game_id", parsed.data.gameId)
    .eq("round_number", parsed.data.roundNumber)
    .maybeSingle();

  if (!round || round.phase !== "voting_open") {
    return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
  }

  const { error } = await supabase.rpc("resolve_round", {
    p_game_id: parsed.data.gameId,
    p_round_number: parsed.data.roundNumber
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/game/${parsed.data.gameId}`, request.url), 303);
}
