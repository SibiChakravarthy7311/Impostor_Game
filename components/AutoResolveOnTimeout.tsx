"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  gameId: string;
  roundNumber: number;
  votingEndsAt: string;
};

export function AutoResolveOnTimeout({ enabled, gameId, roundNumber, votingEndsAt }: Props) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const endsAt = new Date(votingEndsAt).getTime();

    const triggerResolve = async () => {
      if (triggered.current) return;
      triggered.current = true;
      const data = new FormData();
      data.set("gameId", gameId);
      data.set("roundNumber", String(roundNumber));
      await fetch("/api/game/resolve-round", {
        method: "POST",
        body: data,
        credentials: "include"
      });
      window.location.reload();
    };

    const delay = endsAt - Date.now();
    if (delay <= 0) {
      void triggerResolve();
      return;
    }

    const timeout = setTimeout(() => {
      void triggerResolve();
    }, delay);

    return () => clearTimeout(timeout);
  }, [enabled, gameId, roundNumber, votingEndsAt]);

  return null;
}
