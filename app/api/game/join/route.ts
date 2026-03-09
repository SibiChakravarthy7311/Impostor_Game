import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { joinGameSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = joinGameSchema.safeParse({
    joinCode: formData.get("joinCode"),
    playerName: formData.get("playerName")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status")
    .eq("join_code", parsed.data.joinCode)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message ?? "Game not found" }, { status: 404 });
  }

  if (game.status !== "lobby") {
    return NextResponse.json({ error: "Game has already started" }, { status: 400 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name: parsed.data.playerName,
      is_alive: true
    })
    .select("id")
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: playerError?.message ?? "Unable to join game" }, { status: 500 });
  }

  const sessionToken = createSessionToken();
  const { error: sessionError } = await supabase.from("player_sessions").insert({
    session_token: sessionToken,
    game_id: game.id,
    player_id: player.id,
    is_host: false
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
