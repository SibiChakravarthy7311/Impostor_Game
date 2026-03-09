"use client";

import { useState } from "react";

type Props = {
  role: "civilian" | "impostor";
  isLeadImpostor: boolean;
  roundNumber: number;
};

export function RoleRevealCard({ role, isLeadImpostor, roundNumber }: Props) {
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
          <p className="mt-2 text-sm text-slate-600">
            {role === "impostor"
              ? isLeadImpostor
                ? "You can vote and choose one kill target each round."
                : "Blend in and support impostor strategy."
              : "Find and vote out impostors."}
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
