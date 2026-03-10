export type GameStatus = "lobby" | "in_progress" | "finished";
export type RoundPhase = "discussion" | "voting_open" | "resolution" | "round_end";
export type Role = "civilian" | "impostor";

export type GameSettings = {
  impostorCount: number;
  votingSeconds: number;
};

export type Player = {
  id: string;
  game_id: string;
  name: string;
  is_alive: boolean;
  joined_at: string;
  character_emoji_id?: string | null;
};

export type RoleRecord = {
  player_id: string;
  role: Role;
  is_lead_impostor: boolean;
};

export type VoteRecord = {
  voter_player_id: string;
  target_player_id: string;
};

export type RoundResolution = {
  voteEliminatedPlayerId: string | null;
  killEliminatedPlayerId: string | null;
  leadSurvivedVote: boolean;
  remainingImpostors: number;
  nextLeadImpostorId: string | null;
  winner: Role | null;
};
