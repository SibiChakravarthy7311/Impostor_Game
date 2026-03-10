import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AutoResolveOnTimeout } from "../../../components/AutoResolveOnTimeout";
import { GameQrCard } from "../../../components/GameQrCard";
import { GameRealtime } from "../../../components/GameRealtime";
import { LobbyRealtime } from "../../../components/LobbyRealtime";
import { PlayerList } from "../../../components/PlayerList";
import { RoundTimer } from "../../../components/RoundTimer";
import { SpeakingOrderPhase } from "../../../components/SpeakingOrderPhase";
import { VotingPhaseComponent } from "../../../components/VotingPhaseComponent";
import { ResultsScreenComponent } from "../../../components/ResultsScreenComponent";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

const CHARACTER_EMOJIS: { [key: string]: string } = {
  "emoji_1": "😀",
  "emoji_2": "🎮",
  "emoji_3": "👾",
  "emoji_4": "🎭",
  "emoji_5": "🕵️",
  "emoji_6": "🚀",
  "emoji_7": "🎸",
  "emoji_8": "🦸"
};

type PageProps = {
  params: Promise<{ gameId: string }>;
};

type SessionRecord = {
  player_id: string;
  is_host: boolean;
};

type CurrentRole = {
  role: "civilian" | "impostor";
  is_lead_impostor: boolean;
};

export default async function GamePage({ params }: PageProps) {
  const { gameId } = await params;
  const supabase = createServerSupabaseClient();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let session: SessionRecord | null = null;
  if (sessionToken) {
    const { data } = await supabase
      .from("player_sessions")
      .select("player_id, is_host")
      .eq("session_token", sessionToken)
      .eq("game_id", gameId)
      .maybeSingle();
    session = data ?? null;
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, join_code, status, round_number, winner, rotation_direction, starting_player_id")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) notFound();

  const [{ data: players }, { data: latestRoundEvent }, roundResult, { data: leadRole }, eliminationsResult, { data: roles }] = await Promise.all([
    supabase.from("players").select("id, game_id, name, is_alive, joined_at, character_emoji_id").eq("game_id", gameId).order("joined_at"),
    supabase
      .from("events")
      .select("payload_json, created_at")
      .eq("game_id", gameId)
      .eq("type", "round_resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("rounds")
      .select("id, phase, voting_ends_at, secret_word, current_speaker_id, speaking_order, speakers_completed")
      .eq("game_id", gameId)
      .eq("round_number", game.round_number)
      .maybeSingle(),
    game.status !== "lobby"
      ? await supabase
          .from("roles")
          .select("player_id")
          .eq("game_id", gameId)
          .eq("is_lead_impostor", true)
          .maybeSingle()
      : { data: null },
    null,
    game.status !== "lobby"
      ? await supabase
          .from("roles")
          .select("player_id, role")
          .eq("game_id", gameId)
      : { data: [] }
  ]);

  const { data: round } = roundResult as any;

  let eliminations: Array<{ player_id: string; reason: "vote" | "kill" }> = [];
  if (round) {
    const { data: eliminationsData } = await supabase
      .from("eliminations")
      .select("player_id, reason")
      .eq("round_id", round.id);
    eliminations = (eliminationsData as any) ?? [];
  }

  let currentRole: CurrentRole | null = null;
  if (session && game.status !== "lobby") {
    const { data } = await supabase
      .from("roles")
      .select("role, is_lead_impostor")
      .eq("game_id", gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();
    currentRole = (data as CurrentRole | null) ?? null;
  }

  const { data: votes } = round && game.status !== "lobby"
    ? await supabase.from("votes").select("voter_player_id").eq("round_id", round.id)
    : { data: [] as { voter_player_id: string }[] };

  const currentPlayer = players?.find((p) => p.id === session?.player_id) ?? null;
  const fixedPlayerOrder = players ?? [];
  const alivePlayers = (players ?? []).filter((p) => p.is_alive);
  const leadPlayerId = leadRole?.player_id ?? null;
  const leadAlive = leadPlayerId ? alivePlayers.some((p) => p.id === leadPlayerId) : false;
  const eligibleVoterCount = Math.max(0, alivePlayers.length - (leadAlive ? 1 : 0));

  const votedIds = new Set((votes ?? []).map((v) => v.voter_player_id));
  const votesSubmittedCount = alivePlayers.filter((p) => p.id !== leadPlayerId && votedIds.has(p.id)).length;

  const voteTargets = alivePlayers.filter((p) => p.id !== currentPlayer?.id);
  const killTargets = alivePlayers.filter((p) => p.id !== currentPlayer?.id);

  const isLeadImpostor = Boolean(currentRole?.role === "impostor" && currentRole?.is_lead_impostor);

  const canVote = Boolean(
    currentPlayer?.is_alive &&
      !isLeadImpostor &&
      game.status === "in_progress" &&
      voteTargets.length > 0 &&
      round?.phase === "voting_open"
  );
  const canKill = Boolean(
    currentPlayer?.is_alive &&
      isLeadImpostor &&
      game.status === "in_progress" &&
      killTargets.length > 0 &&
      round?.phase === "voting_open"
  );

  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  const joinUrl = `${origin}/join/${game.join_code}`;

  let speakingOrder: typeof fixedPlayerOrder = [];
  if (fixedPlayerOrder.length > 0) {
    const total = fixedPlayerOrder.length;
    const startIndex = Math.max(
      0,
      fixedPlayerOrder.findIndex((p) => p.id === game.starting_player_id)
    );
    const shift = (game.round_number - 1) % total;
    const roundStartIndex =
      game.rotation_direction === "anticlockwise"
        ? (startIndex - shift + total) % total
        : (startIndex + shift) % total;

    speakingOrder = Array.from({ length: total }, (_, i) => {
      const idx =
        game.rotation_direction === "anticlockwise"
          ? (roundStartIndex - i + total) % total
          : (roundStartIndex + i) % total;
      return fixedPlayerOrder[idx];
    });
  }

  return (
    <section className="space-y-6">
      {game.status === "lobby" ? <LobbyRealtime gameId={gameId} /> : <GameRealtime gameId={gameId} />}

      {session?.is_host && round?.voting_ends_at && game.status === "in_progress" && round.phase === "voting_open" ? (
        <AutoResolveOnTimeout
          enabled
          gameId={gameId}
          roundNumber={game.round_number}
          votingEndsAt={round.voting_ends_at}
        />
      ) : null}

      <header className="space-y-3">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-cyan-400 font-semibold">Imposter Game</p>
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Round {game.round_number}
          </h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            game.status === "lobby"
              ? "bg-yellow-900/40 border border-yellow-600 text-yellow-300"
              : game.status === "finished"
                ? "bg-emerald-900/40 border border-emerald-600 text-emerald-300"
                : "bg-blue-900/40 border border-blue-600 text-blue-300"
          }`}>
            {game.status === "lobby" ? "⏳ LOBBY" : game.status === "finished" ? "✓ FINISHED" : "▶️ IN PROGRESS"}
          </div>
          {round && (
            <div className="rounded-lg px-3 py-2 text-sm font-semibold bg-purple-900/40 border border-purple-600 text-purple-300">
              {round.phase === "speaking_order" && "🗣️ SPEAKING"}
              {round.phase === "voting_open" && "🗳️ VOTING"}
              {round.phase === "resolution" && "📊 RESOLUTION"}
            </div>
          )}
          {game.winner && (
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              game.winner === "civilian"
                ? "bg-emerald-900/40 border border-emerald-600 text-emerald-300"
                : "bg-red-900/40 border border-red-600 text-red-300"
            }`}>
              {game.winner === "civilian" ? "👥 CIVILIANS WIN" : "👹 IMPOSTORS WIN"}
            </div>
          )}
        </div>
      </header>

      {currentPlayer ? (
        <div className="rounded-lg border-2 border-cyan-500 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-4 flex items-center gap-3">
          <span className="text-3xl">{CHARACTER_EMOJIS[currentPlayer.character_emoji_id || "emoji_4"] || "🎭"}</span>
          <div>
            <p className="text-sm text-gray-400">Your Player</p>
            <p className="font-bold text-cyan-100">{currentPlayer.name}</p>
          </div>
          {session?.is_host && (
            <span className="ml-auto text-xs font-bold bg-cyan-600 text-white px-3 py-1 rounded-full">HOST</span>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-yellow-500 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 p-4">
          <p className="text-yellow-300 text-sm font-semibold">👁️ Spectator Mode - You are viewing this game without a player session</p>
        </div>
      )}

      {game.status !== "lobby" && session ? (
        <Link className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-white font-semibold text-sm hover:from-purple-500 hover:to-pink-500 transition-all" href={`/game/${gameId}/role`}>
          👤 View Your Private Role Card
        </Link>
      ) : null}

      {/* {round?.voting_ends_at && game.status === "in_progress" && round.phase === "voting_open" && (
        <RoundTimer votingEndsAt={round.voting_ends_at} />
      )} */}

      {session?.is_host ? <GameQrCard joinUrl={joinUrl} joinCode={game.join_code} /> : null}

      {game.status === "lobby" && session?.is_host && (
        <form action="/api/game/start" method="post" className="space-y-3">
          <input type="hidden" name="gameId" value={gameId} />
          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-bold text-white transition-all hover:from-cyan-500 hover:to-blue-500 active:scale-95 shadow-lg">
            🚀 START GAME
          </button>
        </form>
      )}

      {/* Lobby Player List */}
      {game.status === "lobby" && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Waiting Players ({(players ?? []).length})</h2>
          <PlayerList players={players ?? []} showStatus={false} />
        </section>
      )}

      {/* Speaking Order Phase */}
      {game.status === "in_progress" && round?.phase === "speaking_order" && currentPlayer && (
        <SpeakingOrderPhase
          players={players ?? []}
          currentSpeakerId={round.current_speaker_id || null}
          speakersCompleted={(round.speakers_completed as string[]) || []}
          currentPlayerId={currentPlayer.id}
          gameId={gameId}
          roundNumber={game.round_number}
        />
      )}

      {/* Voting Phase */}
      {game.status === "in_progress" && round?.phase === "voting_open" && currentPlayer && (
        <VotingPhaseComponent
          players={players ?? []}
          currentPlayerId={currentPlayer.id}
          currentRole={currentRole}
          gameId={gameId}
          roundNumber={game.round_number}
          votingEndsAt={round.voting_ends_at || ""}
          isHost={session?.is_host || false}
          votedIds={votedIds}
          leadPlayerId={leadPlayerId}
        />
      )}

      {/* Results Phase */}
      {game.status === "in_progress" && round?.phase === "resolution" && (
        <ResultsScreenComponent
          players={players ?? []}
          eliminations={(eliminations ?? []) as Array<{ player_id: string; reason: "vote" | "kill" }>}
          remainingImpostors={latestRoundEvent?.payload_json?.remaining_impostors ?? 0}
          winner={game.winner}
          isHost={session?.is_host || false}
          gameId={gameId}
          roundNumber={game.round_number}
          roleMap={
            roles?.reduce(
              (acc, r: { player_id: string; role: string }) => ({
                ...acc,
                [r.player_id]: r.role as "civilian" | "impostor"
              }),
              {}
            ) || {}
          }
        />
      )}

      {/* All Players List */}
      {game.status !== "lobby" && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Players ({(players ?? []).filter(p => p.is_alive).length} Alive)</h2>
          <PlayerList players={players ?? []} showStatus={true} highlightPlayerId={round?.current_speaker_id || undefined} />
        </section>
      )}
    </section>
  );
}
