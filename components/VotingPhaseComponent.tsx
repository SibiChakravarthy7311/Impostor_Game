"use client";

import { useState } from "react";
import type { Player } from "../lib/types";

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

const VOTE_COLORS = [
  "from-red-600 to-red-700",
  "from-blue-600 to-blue-700",
  "from-green-600 to-emerald-700",
  "from-yellow-600 to-amber-700",
  "from-purple-600 to-indigo-700",
  "from-pink-600 to-rose-700",
  "from-cyan-600 to-teal-700",
  "from-orange-600 to-amber-700"
];

type Props = {
  players: Player[];
  currentPlayerId: string | null;
  currentRole: { role: "civilian" | "impostor"; is_lead_impostor: boolean } | null;
  gameId: string;
  roundNumber: number;
  votingEndsAt: string;
  isHost: boolean;
  votedIds: Set<string>;
  leadPlayerId: string | null;
};

export function VotingPhaseComponent({
  players,
  currentPlayerId,
  currentRole,
  gameId,
  roundNumber,
  votingEndsAt,
  isHost,
  votedIds,
  leadPlayerId
}: Props) {
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [selectedKill, setSelectedKill] = useState<string | null>(null);

  const alivePlayers = players.filter((p) => p.is_alive);
  const voteTargets = alivePlayers.filter((p) => p.id !== currentPlayerId);
  const killTargets = alivePlayers.filter((p) => p.id !== currentPlayerId);

  const isLeadImpostor = Boolean(currentRole?.role === "impostor" && currentRole?.is_lead_impostor);
  const canVote = currentRole?.role !== "impostor" || !isLeadImpostor;
  const hasVoted = votedIds.has(currentPlayerId || "");

  return (
    <section className="space-y-6">
      {/* Voting Section */}
      {canVote && !hasVoted && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-red-500 bg-gradient-to-br from-red-900/20 to-orange-900/20 p-6">
            <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-red-300">
              🗳️ Cast Your Vote
            </p>
            <form action="/api/game/submit-vote" method="post" className="space-y-3">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={roundNumber} />
              <input type="hidden" name="targetPlayerId" value={selectedVote || ""} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {voteTargets.map((player, idx) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedVote(player.id)}
                    className={`rounded-lg border-2 p-4 transition-all font-semibold ${
                      selectedVote === player.id
                        ? `border-white bg-gradient-to-br ${VOTE_COLORS[idx % VOTE_COLORS.length]} shadow-lg scale-105 text-white`
                        : "border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500 hover:bg-slate-600"
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {CHARACTER_EMOJIS[player.character_emoji_id || "emoji_4"] || "🎭"}
                    </div>
                    <div className="text-xs sm:text-sm truncate">{player.name}</div>
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!selectedVote}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-orange-600 px-6 py-3 font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:from-red-500 hover:to-orange-500 active:scale-95 shadow-lg"
              >
                VOTE NOW
              </button>
            </form>
          </div>
        </div>
      )}

      {hasVoted && !isLeadImpostor && (
        <div className="rounded-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-900/20 to-teal-900/20 p-4 text-center">
          <p className="text-emerald-300 font-semibold">✓ Your vote has been submitted</p>
        </div>
      )}

      {/* Kill Section (Lead Only) */}
      {isLeadImpostor && !currentRole?.is_lead_impostor === false && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-purple-500 bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-6">
            <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-purple-300">
              ⚔️ Lead Impostor Kill Target
            </p>
            <form action="/api/game/submit-kill" method="post" className="space-y-3">
              <input type="hidden" name="gameId" value={gameId} />
              <input type="hidden" name="roundNumber" value={roundNumber} />
              <input type="hidden" name="targetPlayerId" value={selectedKill || ""} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {killTargets.map((player, idx) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedKill(player.id)}
                    className={`rounded-lg border-2 p-4 transition-all font-semibold ${
                      selectedKill === player.id
                        ? `border-white bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg scale-105 text-white`
                        : "border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500 hover:bg-slate-600"
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {CHARACTER_EMOJIS[player.character_emoji_id || "emoji_4"] || "🎭"}
                    </div>
                    <div className="text-xs sm:text-sm truncate">{player.name}</div>
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!selectedKill}
                className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-500 hover:to-pink-500 active:scale-95 shadow-lg"
              >
                SUBMIT KILL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Voting Progress (Host) */}
      {isHost && (
        <div className="rounded-lg border-2 border-cyan-500 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 p-4 space-y-3">
          <p className="font-semibold text-cyan-300">📊 Voting Progress</p>
          <div className="space-y-2">
            {alivePlayers.map((player) => {
              const hasVoted = votedIds.has(player.id);
              const isMuted = leadPlayerId === player.id;
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="text-lg">
                    {CHARACTER_EMOJIS[player.character_emoji_id || "emoji_4"] || "🎭"}
                  </span>
                  <span className={`flex-1 text-sm ${isMuted ? "line-through text-gray-500" : "text-gray-300"}`}>
                    {player.name}
                    {isMuted && " (Lead - Not voting)"}
                  </span>
                  <span className={`font-bold ${hasVoted ? "text-emerald-400" : "text-gray-500"}`}>
                    {hasVoted ? "✓" : "○"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolve Button (Host) */}
      {isHost && (
        <form action="/api/game/resolve-round" method="post">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="roundNumber" value={roundNumber} />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3 font-bold text-white transition-all hover:from-orange-500 hover:to-red-500 active:scale-95 shadow-lg"
          >
            ⚔️ RESOLVE & SHOW RESULTS
          </button>
        </form>
      )}
    </section>
  );
}
