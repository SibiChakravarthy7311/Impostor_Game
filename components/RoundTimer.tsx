"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  votingEndsAt: string;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RoundTimer({ votingEndsAt }: Props) {
  const endsAt = useMemo(() => new Date(votingEndsAt).getTime(), [votingEndsAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = endsAt - nowMs;

  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {remaining > 0 ? `Voting ends in ${formatRemaining(remaining)}` : "Voting timer expired"}
    </div>
  );
}
