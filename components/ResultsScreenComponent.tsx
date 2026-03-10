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
  eliminations: Array<{ player_id: string; reason: "vote" | "kill" }>;
  remainingImpostors: number;
  winner?: string | null;
  isHost: boolean;
  gameId: string;
  roundNumber: number;
  roleMap: { [key: string]: "civilian" | "impostor" };
};

export function ResultsScreenComponent({
  players,
  eliminations,
  remainingImpostors,
  winner,
  isHost,
  gameId,
  roundNumber,
  roleMap
}: Props) {
  const [revealedRoles, setRevealedRoles] = useState<Set<string>>(new Set());

  const toggleRole = (playerId: string) => {
    const newSet = new Set(revealedRoles);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setRevealedRoles(newSet);
  };

  return (
    <section className="space-y-6">
      {/* Game Over */}
      {winner && (
        <div className={`rounded-lg border-4 p-8 text-center ${
          winner === "civilian"
            ? "border-emerald-500 bg-gradient-to-br from-emerald-900/40 to-teal-900/40"
            : "border-red-500 bg-gradient-to-br from-red-900/40 to-orange-900/40"
        }`}>
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-300">Game Over</p>
          <p className={`text-4xl font-black mb-2 ${
            winner === "civilian" ? "text-emerald-300" : "text-red-300"
          }`}>
            {winner === "civilian" ? "👥 CIVILIANS WIN" : "👹 IMPOSTORS WIN"}
          </p>
          <p className="text-gray-300 text-sm">The game has ended. Thank you for playing!</p>
        </div>
      )}

      {/* No Eliminations */}
      {eliminations.length === 0 && !winner && (
        <div className="rounded-lg border-2 border-yellow-500 bg-gradient-to-br from-yellow-900/20 to-amber-900/20 p-6 text-center">
          <p className="text-2xl mb-2">🤝</p>
          <p className="font-semibold text-yellow-300">No one was eliminated this round</p>
          <p className="text-xs text-gray-400 mt-2">A tie prevented any eliminations</p>
        </div>
      )}

      {/* Eliminations */}
      {eliminations.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-red-300 mb-4">
            ⚠️ {eliminations.length} Player{eliminations.length > 1 ? "s" : ""} Eliminated
          </p>
          {eliminations.map((elim) => {
            const player = players.find((p) => p.id === elim.player_id);
            if (!player) return null;

            const emoji = CHARACTER_EMOJIS[player.character_emoji_id || "emoji_4"] || "🎭";
            const role = roleMap[player.id];
            const isRevealed =revealedRoles.has(player.id);

            return (
              <div
                key={player.id}
                className={`rounded-lg border-2 p-6 transition-all ${
                  elim.reason === "vote"
                    ? "border-red-500 bg-gradient-to-br from-red-900/30 to-orange-900/20"
                    : "border-purple-500 bg-gradient-to-br from-purple-900/30 to-pink-900/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{emoji}</span>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-100">{player.name}</p>
                    <p className={`text-sm font-semibold mt-1 ${
                      elim.reason === "vote"
                        ? "text-red-300"
                        : "text-purple-300"
                    }`}>
                      {elim.reason === "vote" ? "🗳️ Voted Out" : "⚔️ Killed"}
                    </p>

                    {/* Role Reveal Button */}
                    <button
                      type="button"
                      onClick={() => toggleRole(player.id)}
                      className={`mt-3 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        isRevealed
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white"
                          : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                      }`}
                    >
                      {isRevealed ? "Hide Role" : "Reveal Role"}
                    </button>

                    {isRevealed && role && (
                      <div className="mt-3 rounded-lg border border-dashed border-cyan-400 bg-slate-800/50 p-3 animate-in">
                        <p className="text-xs uppercase tracking-wider text-cyan-300 mb-2">Their Role</p>
                        <p className="text-xl font-bold text-cyan-100">
                          {role === "impostor" ? "👹 IMPOSTOR" : "👥 CIVILIAN"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!winner && (
        <div className="rounded-lg border-2 border-cyan-500 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 p-6 space-y-3">
          <p className="font-semibold text-cyan-300">📊 Round Summary</p>
          <div className="space-y-2 text-sm">
            <p className="text-gray-300">
              Remaining Impostors: <span className="font-bold text-red-300">{remainingImpostors}</span>
            </p>
          </div>
        </div>
      )}

      {/* Continue Button (Host) */}
      {isHost && !winner && (
        <form action="/api/game/prepare-next-round" method="post">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="roundNumber" value={roundNumber} />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-bold text-white transition-all hover:from-cyan-500 hover:to-blue-500 active:scale-95 shadow-lg"
          >
            ➜ NEXT ROUND
          </button>
        </form>
      )}
    </section>
  );
}
