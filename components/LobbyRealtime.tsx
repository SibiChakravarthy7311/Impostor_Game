"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../lib/supabase/client";

type Props = {
  gameId: string;
};

export function LobbyRealtime({ gameId }: Props) {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        router.refresh();
        refreshTimer = null;
      }, 250);
    };

    const channel = supabaseClient
      .channel(`lobby-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabaseClient.removeChannel(channel);
    };
  }, [gameId, router]);

  return null;
}
