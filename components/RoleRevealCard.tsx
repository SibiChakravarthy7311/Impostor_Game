"use client";

import { useState } from "react";

type Props = {
  role: "civilian" | "impostor";
  isLeadImpostor: boolean;
  roundNumber: number;
  secretWord: string | null;
};

export function RoleRevealCard({ role, isLeadImpostor, roundNumber, secretWord }: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold">Your Role</h1>
      <p className="text-sm text-slate-600">Round {roundNumber}</p>

      {revealed ? (
        <div className="rounded border border-slate-300 bg-white p-4">
          <p className="text-lg font-semibold">
            {role === "impostor" ? "Impostor" : "Civilian"}
            {isLeadImpostor ? " (Lead)" : ""}
          </p>
          {role === "civilian" && secretWord ? (
            <p className="mt-2 text-sm font-semibold text-teal-800">Secret word: {secretWord}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            {role === "impostor"
              ? isLeadImpostor
                ? "You can only choose kill target. You cannot vote this round."
                : "You can vote. Only the lead impostor can kill."
              : "Use the secret word to describe related clues and identify impostors."}
          </p>
        </div>
      ) : (
        <div className="rounded border border-dashed border-slate-400 px-4 py-6 text-center text-slate-600">
          Role hidden. Reveal when everyone is ready.
        </div>
      )}

      <button
        type="button"
        className="rounded bg-slate-800 px-4 py-2 text-white"
        onClick={() => setRevealed((v) => !v)}
      >
        {revealed ? "Hide Role" : "Reveal Role"}
      </button>
    </section>
  );
}
