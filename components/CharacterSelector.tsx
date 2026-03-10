"use client";

import { useState } from "react";

const CHARACTER_EMOJIS = [
  { id: "emoji_1", emoji: "😀", name: "Happy" },
  { id: "emoji_2", emoji: "🎮", name: "Gamer" },
  { id: "emoji_3", emoji: "👾", name: "Alien" },
  { id: "emoji_4", emoji: "🎭", name: "Actor" },
  { id: "emoji_5", emoji: "🕵️", name: "Detective" },
  { id: "emoji_6", emoji: "🚀", name: "Rocket" },
  { id: "emoji_7", emoji: "🎸", name: "Rockstar" },
  { id: "emoji_8", emoji: "🦸", name: "Hero" }
];

type Props = {
  onSelect: (id: string) => void;
  selected?: string;
};

export function CharacterSelector({ onSelect, selected }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-semibold text-gray-300">Choose Your Character</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {CHARACTER_EMOJIS.map((char) => (
          <button
            key={char.id}
            type="button"
            onClick={() => onSelect(char.id)}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-lg p-3 transition-all ${
              selected === char.id
                ? "bg-gradient-to-br from-cyan-500 to-purple-600 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/50"
                : "bg-slate-700 hover:bg-slate-600"
            }`}
            title={char.name}
          >
            <span className="text-2xl sm:text-3xl">{char.emoji}</span>
            <span className="text-xs text-gray-200">{char.name}</span>
          </button>
        ))}
      </div>
      <input type="hidden" name="characterEmojiId" value={selected || ""} />
    </fieldset>
  );
}
