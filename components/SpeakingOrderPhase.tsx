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

type Props = {
  players: Player[];
  currentSpeakerId: string | null;
  speakersCompleted: string[];
  currentPlayerId: string | null;
  gameId: string;
  roundNumber: number;
};

export function SpeakingOrderPhase({
  players,
  currentSpeakerId,
  speakersCompleted,
  currentPlayerId,
  gameId,
  roundNumber
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const alivePlayers = players.filter((p) => p.is_alive);
  const isCurrentPlayerSpeaking = currentPlayerId === currentSpeakerId;

  const emoji = currentSpeakerId
    ? (CHARACTER_EMOJIS[
        players.find((p) => p.id === currentSpeakerId)?.character_emoji_id || "emoji_4"
      ] || "🎭")
    : "";

  return (
    <section className="space-y-6">
      {/* Word Display */}
      <div className="rounded-lg border-2 border-purple-500 bg-gradient-to-br from-purple-900/30 to-purple-800/20 p-6">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-purple-300 mb-3">
          {isCurrentPlayerSpeaking ? "Your Word to Say:" : "Current Word:"}
        </p>
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="w-full rounded-lg border-2 border-dashed border-purple-400 bg-slate-800/50 p-6 transition-all hover:border-purple-300 active:scale-95"
        >
          {revealed ? (
            <p className="text-3xl font-bold text-purple-300">📝</p>
          ) : (
            <p className="text-4xl font-bold text-purple-400">?</p>
          )}
        </button>
        {revealed && (
          <p className="mt-4 text-center text-2xl font-bold text-cyan-300 animate-pulse">
            [Word shown to you]
          </p>
        )}
        <p className="mt-2 text-center text-xs text-gray-400">
          {revealed ? "Hide" : "Show"} your word (say it aloud to others)
        </p>
      </div>

      {/* Current Speaker */}
      {currentSpeakerId && (
        <div className="rounded-lg border-2 border-cyan-400 bg-gradient-to-r from-cyan-900/40 to-blue-900/40 p-6 shadow-lg shadow-cyan-500/20">
          <p className="mb-4 text-center text-sm uppercase tracking-widest text-cyan-300">Now Speaking</p>
          <div className="flex flex-col items-center gap-3">
            <span className="text-5xl animate-bounce">{emoji}</span>
            <p className="text-xl font-bold text-cyan-100">
              {players.find((p) => p.id === currentSpeakerId)?.name}
            </p>
            {isCurrentPlayerSpeaking && (
              <div className="mt-2 text-xs text-emerald-400 font-semibold">
                ✓ IT'S YOUR TURN
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pass On Button */}
      {isCurrentPlayerSpeaking && (
        <form action="/api/game/pass-speaking-turn" method="post" className="space-y-3">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="roundNumber" value={roundNumber} />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-lg hover:shadow-emerald-500/50"
          >
            ✓ SAID & PASS ON
          </button>
          <p className="text-center text-xs text-gray-400">
            Press when you've said your word aloud
          </p>
        </form>
      )}

      {/* Speaking Progress */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-300">
          Speaking Progress: {speakersCompleted.length} / {alivePlayers.length}
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alivePlayers.map((player) => {
            const hasSpoken = speakersCompleted.includes(player.id);
            const isCurrent = player.id === currentSpeakerId;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                  isCurrent
                    ? "border-2 border-cyan-400 bg-gradient-to-r from-cyan-900/40 to-blue-900/40 shadow-lg shadow-cyan-500/20"
                    : hasSpoken
                      ? "border border-emerald-600/50 bg-slate-700/50"
                      : "border border-slate-600 bg-slate-800"
                }`}
              >
                <span className="text-2xl">
                  {CHARACTER_EMOJIS[player.character_emoji_id || "emoji_4"] || "🎭"}
                </span>
                <span className="flex-1 font-medium">
                  {player.name}
                </span>
                {hasSpoken && (
                  <span className="text-emerald-400 text-sm font-bold">✓</span>
                )}
                {isCurrent && (
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Voting (Host only) */}
      {speakersCompleted.length === alivePlayers.length && (
        <form action="/api/game/start-voting" method="post">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="roundNumber" value={roundNumber} />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-orange-600 px-6 py-3 font-bold text-white transition-all hover:from-red-500 hover:to-orange-500 active:scale-95 shadow-lg hover:shadow-red-500/50"
          >
            🗳️  START VOTING PHASE
          </button>
        </form>
      )}
    </section>
  );
}
