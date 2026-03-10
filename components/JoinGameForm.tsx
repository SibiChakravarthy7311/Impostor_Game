"use client";

import { useState } from "react";
import { CharacterSelector } from "./CharacterSelector";

type Props = {
  joinCode: string;
};

export function JoinGameForm({ joinCode }: Props) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");

  return (
    <form action="/api/game/join" method="post" className="card max-w-2xl space-y-6 bg-gradient-to-br from-slate-800 to-slate-900">
      <input type="hidden" name="joinCode" value={joinCode} />

      <div className="space-y-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-gray-300">Your Name</span>
          <input
            name="playerName"
            minLength={2}
            maxLength={24}
            required
            placeholder="Enter your name..."
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </label>
      </div>

      <CharacterSelector selected={selectedCharacter} onSelect={setSelectedCharacter} />

      <button
        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-cyan-500 hover:to-purple-500 active:scale-95 disabled:opacity-50"
        type="submit"
      >
        Join Game
      </button>
    </form>
  );
}
