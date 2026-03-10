import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getSessionTokenFromRequest } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const gameId = formData.get("gameId") as string;
  const roundNumber = formData.get("roundNumber") as string;

  const sessionToken = getSessionTokenFromRequest(request);
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data: session } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session does not belong to this game" }, { status: 403 });
  }

  // Get current round
  const { data: round } = await supabase
    .from("rounds")
    .select("id, current_speaker_id, speaking_order, speakers_completed")
    .eq("game_id", gameId)
    .eq("round_number", parseInt(roundNumber))
    .single();

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // Verify player is current speaker
  if (round.current_speaker_id !== session.player_id) {
    return NextResponse.json({ error: "You are not the current speaker" }, { status: 403 });
  }

  const speakingOrder = (round.speaking_order as string[]) || [];
  const speakersCompleted = (round.speakers_completed as string[]) || [];

  // Add current speaker to completed list
  const updatedCompleted = [...new Set([...speakersCompleted, session.player_id])];

  // Find next speaker
  const currentIndex = speakingOrder.findIndex((id) => id === round.current_speaker_id);
  const nextIndex = speakingOrder.findIndex((id, idx) => idx > currentIndex && !updatedCompleted.includes(id));

  const nextSpeakerId = nextIndex >= 0 ? speakingOrder[nextIndex] : null;

  // Update round
  await supabase
    .from("rounds")
    .update({
      current_speaker_id: nextSpeakerId,
      speakers_completed: updatedCompleted
    })
    .eq("id", round.id);

  return NextResponse.redirect(new URL(`/game/${gameId}`, request.url), 303);
}
