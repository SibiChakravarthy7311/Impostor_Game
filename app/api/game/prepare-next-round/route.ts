import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const gameId = formData.get("gameId") as string;
  const roundNumber = parseInt(formData.get("roundNumber") as string);

  const sessionToken = getSessionTokenFromRequest(request);
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data: session } = await supabase
    .from("player_sessions")
    .select("is_host")
    .eq("session_token", sessionToken)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!session?.is_host) {
    return NextResponse.json({ error: "Only host can prepare next round" }, { status: 403 });
  }

  // Get game to check if game is finished
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();

  if (game?.status === "finished") {
    // Game is over, just redirect
    return NextResponse.redirect(new URL(`/game/${gameId}`, request.url), 303);
  }

  // If game is not finished yet, prepare the next round
  // The next round was already created in the resolve_round function
  // Just redirect to the game page to load the new round
  return NextResponse.redirect(new URL(`/game/${gameId}`, request.url), 303);
}
