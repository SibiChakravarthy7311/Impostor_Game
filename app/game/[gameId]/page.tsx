import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AutoResolveOnTimeout } from "../../../components/AutoResolveOnTimeout";
import { GameQrCard } from "../../../components/GameQrCard";
import { GameRealtime } from "../../../components/GameRealtime";
import { PlayerList } from "../../../components/PlayerList";
import { RoundTimer } from "../../../components/RoundTimer";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

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

  const [{ data: players }, { data: latestRoundEvent }, { data: round }, { data: leadRole }] = await Promise.all([
    supabase.from("players").select("id, game_id, name, is_alive, joined_at").eq("game_id", gameId).order("joined_at"),
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
      .select("id, phase, voting_ends_at, secret_word")
      .eq("game_id", gameId)
      .eq("round_number", game.round_number)
      .maybeSingle(),
    supabase
      .from("roles")
      .select("player_id")
      .eq("game_id", gameId)
      .eq("is_lead_impostor", true)
      .maybeSingle()
  ]);

  let currentRole: CurrentRole | null = null;
  if (session) {
    const { data } = await supabase
      .from("roles")
      .select("role, is_lead_impostor")
      .eq("game_id", gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();
    currentRole = (data as CurrentRole | null) ?? null;
  }

  const { data: votes } = round
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
    <section className="space-y-5">
      <GameRealtime gameId={gameId} />

      {session?.is_host && round?.voting_ends_at && game.status === "in_progress" && round.phase === "voting_open" ? (
        <AutoResolveOnTimeout
          enabled
          gameId={gameId}
          roundNumber={game.round_number}
          votingEndsAt={round.voting_ends_at}
        />
      ) : null}

      <header className="card space-y-2">
        <p className="text-sm uppercase tracking-[0.15em] text-teal-800">Game Room</p>
        <h1 className="text-3xl font-bold">Round {game.round_number}</h1>
        <p>
          Status: <span className="font-semibold">{game.status}</span>
        </p>
        {round ? <p className="text-sm text-slate-700">Phase: <span className="font-semibold">{round.phase}</span></p> : null}
        {game.winner ? (
          <p className="font-semibold text-emerald-800">Winner: {game.winner === "civilian" ? "Civilians" : "Impostors"}</p>
        ) : null}
        {currentPlayer ? (
          <p className="text-sm text-slate-700">
            You are <span className="font-semibold">{currentPlayer.name}</span>
            {session?.is_host ? " (Host)" : ""}
          </p>
        ) : (
          <p className="text-sm text-amber-700">You are viewing this game without a player session.</p>
        )}
        {session ? (
          <Link className="text-sm font-semibold text-teal-800 underline" href={`/game/${gameId}/role`}>
            Open Private Role Screen
          </Link>
        ) : null}
      </header>

      {currentRole?.role === "civilian" && round?.secret_word ? (
        <section className="card">
          <p className="text-sm uppercase tracking-[0.15em] text-teal-700">Civilian Secret Word</p>
          <p className="text-2xl font-bold text-teal-900">{round.secret_word}</p>
          <p className="text-sm text-slate-600">Do not reveal this word directly. Give related clues during discussion.</p>
        </section>
      ) : null}

      {round?.voting_ends_at && game.status === "in_progress" && round.phase === "voting_open" ? (
        <RoundTimer votingEndsAt={round.voting_ends_at} />
      ) : null}

      {session?.is_host ? <GameQrCard joinUrl={joinUrl} joinCode={game.join_code} /> : null}

      {latestRoundEvent?.payload_json?.remaining_impostors !== undefined ? (
        <section className="card">
          <p className="font-semibold">Remaining impostors: {String(latestRoundEvent.payload_json.remaining_impostors)}</p>
        </section>
      ) : null}

      {session?.is_host && game.status === "in_progress" && round?.phase === "voting_open" ? (
        <section className="card space-y-2">
          <h2 className="text-lg font-semibold">Voting Progress</h2>
          <p className="text-sm text-slate-700">
            {votesSubmittedCount} / {eligibleVoterCount} eligible players voted
          </p>
          <p className="text-xs text-slate-500">Lead impostor is excluded from voting by rule.</p>
        </section>
      ) : null}

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Players</h2>
        <PlayerList players={players ?? []} />
      </section>

      {game.status === "lobby" && session?.is_host ? (
        <form action="/api/game/start" method="post" className="card">
          <input type="hidden" name="gameId" value={gameId} />
          <button type="submit" className="rounded bg-teal-700 px-4 py-2 font-semibold text-white">
            Start Game
          </button>
        </form>
      ) : null}

      {game.status === "in_progress" && round?.phase === "discussion" ? (
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Discussion Phase</h2>
          <p className="text-sm text-slate-700">
            Players discuss spoken clues now. Voting timer has not started yet.
          </p>
          {speakingOrder.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Speaking direction: <span className="font-semibold">{game.rotation_direction}</span>
              </p>
              <ol className="grid gap-1 text-sm sm:grid-cols-2">
                {speakingOrder.map((player, index) => (
                  <li key={player.id} className="rounded border border-slate-200 px-2 py-1">
                    {index + 1}. {player.name} {player.is_alive ? "" : "(Eliminated)"}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {session?.is_host ? (
            <form action="/api/game/start-voting" method="post">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={game.round_number} />
              <button type="submit" className="rounded bg-amber-700 px-4 py-2 font-semibold text-white">
                Start Voting Timer
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">Waiting for host to start voting timer.</p>
          )}
        </section>
      ) : null}

      {game.status === "in_progress" && round?.phase === "voting_open" ? (
        <section className="card space-y-4">
          <h2 className="text-xl font-semibold">Voting Phase</h2>

          {canVote ? (
            <form action="/api/game/submit-vote" method="post" className="space-y-2">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={game.round_number} />
              <label className="flex flex-col gap-1 text-sm">
                Vote Target
                <select name="targetPlayerId" required className="rounded border border-slate-300 px-3 py-2">
                  <option value="">Select player</option>
                  {voteTargets.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-white">Submit Vote</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              {isLeadImpostor ? "Lead impostor cannot vote this round." : "Voting unavailable for your current session."}
            </p>
          )}

          {canKill ? (
            <form action="/api/game/submit-kill" method="post" className="space-y-2">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={game.round_number} />
              <label className="flex flex-col gap-1 text-sm">
                Lead Kill Target
                <select name="targetPlayerId" required className="rounded border border-slate-300 px-3 py-2">
                  <option value="">Select player</option>
                  {killTargets.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded bg-red-700 px-4 py-2 text-white">Submit Kill</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">Only active lead impostor can submit kill.</p>
          )}

          {session?.is_host ? (
            <form action="/api/game/resolve-round" method="post">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={game.round_number} />
              <button type="submit" className="rounded bg-amber-700 px-4 py-2 font-semibold text-white">Resolve Round</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
