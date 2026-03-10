import { z } from "zod";

export const createGameSchema = z.object({
  hostName: z.string().trim().min(2).max(24),
  impostorCount: z.coerce.number().int().min(1).max(4),
  votingSeconds: z.coerce.number().int().min(30).max(600)
});

export const joinGameSchema = z.object({
  joinCode: z.string().trim().min(4).max(12).toUpperCase(),
  playerName: z.string().trim().min(2).max(24)
});

export const startGameSchema = z.object({
  gameId: z.string().uuid()
});

export const startVotingSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.coerce.number().int().positive()
});

export const submitVoteSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.coerce.number().int().positive(),
  targetPlayerId: z.string().uuid()
});

export const submitKillSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.coerce.number().int().positive(),
  targetPlayerId: z.string().uuid()
});

export const resolveRoundSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.coerce.number().int().positive()
});
