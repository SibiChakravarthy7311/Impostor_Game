import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RoleRevealCard } from "../../../../components/RoleRevealCard";
import { SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function RolePage({ params }: PageProps) {
  const { gameId } = await params;
  const supabase = createServerSupabaseClient();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) notFound();

  const { data: session } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!session) notFound();

  const { data: game } = await supabase.from("games").select("round_number").eq("id", gameId).maybeSingle();
  if (!game) notFound();

  const [{ data: role }, { data: player }, { data: round }] = await Promise.all([
    supabase
      .from("roles")
      .select("role, is_lead_impostor")
      .eq("game_id", gameId)
      .eq("player_id", session.player_id)
      .maybeSingle(),
    supabase.from("players").select("name").eq("id", session.player_id).maybeSingle(),
    supabase
      .from("rounds")
      .select("secret_word")
      .eq("game_id", gameId)
      .eq("round_number", game.round_number)
      .maybeSingle()
  ]);

  if (!role || !player) {
    return (
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">Role Not Available Yet</h1>
        <p className="text-slate-600">Roles are assigned when host starts the game.</p>
        <Link className="inline-block rounded bg-slate-800 px-4 py-2 text-white" href={`/game/${gameId}`}>
          Back To Game
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-sm uppercase tracking-[0.16em] text-teal-800">Private View: {player.name}</p>
      <RoleRevealCard
        role={role.role as "civilian" | "impostor"}
        isLeadImpostor={Boolean(role.is_lead_impostor)}
        roundNumber={game.round_number}
        secretWord={role.role === "civilian" ? round?.secret_word ?? null : null}
      />
      <Link className="inline-block rounded bg-slate-800 px-4 py-2 text-white" href={`/game/${gameId}`}>
        Back To Game
      </Link>
    </section>
  );
}
