import type { RoleRecord, RoundResolution, VoteRecord } from "../types";

type ResolveInput = {
  alivePlayerIds: string[];
  roleRecords: RoleRecord[];
  votes: VoteRecord[];
  leadKillTargetId: string | null;
};

export function resolveRound(input: ResolveInput): RoundResolution {
  const aliveSet = new Set(input.alivePlayerIds);
  const aliveRoles = input.roleRecords.filter((r) => aliveSet.has(r.player_id));
  const aliveImpostors = aliveRoles.filter((r) => r.role === "impostor");
  const lead = aliveImpostors.find((r) => r.is_lead_impostor) ?? null;

  const leadVoterId = lead?.player_id ?? null;
  const votesWithoutLead = input.votes.filter((v) => v.voter_player_id !== leadVoterId);

  const tally = new Map<string, number>();
  for (const vote of votesWithoutLead) {
    if (!aliveSet.has(vote.target_player_id)) continue;
    tally.set(vote.target_player_id, (tally.get(vote.target_player_id) ?? 0) + 1);
  }

  let voteEliminatedPlayerId: string | null = null;
  if (tally.size > 0) {
    const highest = Math.max(...Array.from(tally.values()));
    const tied = Array.from(tally.entries())
      .filter(([, score]) => score === highest)
      .map(([playerId]) => playerId);

    if (tied.length === 1) {
      voteEliminatedPlayerId = tied[0];
    }
  }

  const leadSurvivedVote = leadVoterId !== null && voteEliminatedPlayerId !== leadVoterId;

  let killEliminatedPlayerId: string | null = null;
  if (
    leadSurvivedVote &&
    input.leadKillTargetId &&
    input.leadKillTargetId !== leadVoterId &&
    aliveSet.has(input.leadKillTargetId) &&
    input.leadKillTargetId !== voteEliminatedPlayerId
  ) {
    killEliminatedPlayerId = input.leadKillTargetId;
  }

  const eliminated = new Set<string>();
  if (voteEliminatedPlayerId) eliminated.add(voteEliminatedPlayerId);
  if (killEliminatedPlayerId) eliminated.add(killEliminatedPlayerId);

  const remainingImpostorIds = aliveImpostors
    .map((r) => r.player_id)
    .filter((id) => !eliminated.has(id));
  const remainingCivilians = aliveRoles
    .filter((r) => r.role === "civilian")
    .map((r) => r.player_id)
    .filter((id) => !eliminated.has(id)).length;

  const winner: "civilian" | "impostor" | null =
    remainingImpostorIds.length === 0
      ? "civilian"
      : remainingImpostorIds.length >= remainingCivilians
        ? "impostor"
        : null;

  const leadStillAlive = leadVoterId && remainingImpostorIds.includes(leadVoterId);
  const nextLeadImpostorId = leadStillAlive ? leadVoterId : (remainingImpostorIds[0] ?? null);

  return {
    voteEliminatedPlayerId,
    killEliminatedPlayerId,
    leadSurvivedVote,
    remainingImpostors: remainingImpostorIds.length,
    nextLeadImpostorId,
    winner
  };
}
