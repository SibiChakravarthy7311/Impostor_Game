import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { randomJoinCode } from "../../../../lib/game/code";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { createGameSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = createGameSchema.safeParse({
    hostName: formData.get("hostName"),
    impostorCount: formData.get("impostorCount"),
    votingSeconds: formData.get("votingSeconds")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const joinCode = randomJoinCode();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      join_code: joinCode,
      status: "lobby",
      round_number: 1,
      settings_json: {
        impostorCount: parsed.data.impostorCount,
        votingSeconds: parsed.data.votingSeconds
      }
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message ?? "Unable to create game" }, { status: 500 });
  }

  const { data: hostPlayer, error: playerError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name: parsed.data.hostName,
      is_alive: true
    })
    .select("id")
    .single();

  if (playerError || !hostPlayer) {
    return NextResponse.json({ error: playerError?.message ?? "Unable to create host player" }, { status: 500 });
  }

  await supabase.from("games").update({ host_player_id: hostPlayer.id }).eq("id", game.id);

  const sessionToken = createSessionToken();
  const { error: sessionError } = await supabase.from("player_sessions").insert({
    session_token: sessionToken,
    game_id: game.id,
    player_id: hostPlayer.id,
    is_host: true
  });
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL(`/game/${game.id}`, request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
