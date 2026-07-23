import type { Player, Team } from "@/types/game";

export function teamPlayers(players: Player[], teamId: string): Player[] {
  return players.filter((p) => p.teamId === teamId);
}

export interface RoundRoles {
  psychicId: string;
  guessTeamId: string;
  betTeamId: string | null;
}

/**
 * Work out who is psychic for a given round.
 *
 * Teams take turns round by round, and within a team the psychic role moves
 * round-robin: `A1 -> B1 -> A2 -> B2 -> ...`
 *
 * @param roundNumber 1-based.
 */
export function rolesForRound(
  players: Player[],
  teams: Team[],
  roundNumber: number,
): RoundRoles {
  const guessTeam = teams[(roundNumber - 1) % teams.length];
  const roster = teamPlayers(players, guessTeam.id);
  const psychic = roster[guessTeam.psychicIndex % roster.length];
  const betTeam = teams.find((t) => t.id !== guessTeam.id) ?? null;

  return {
    psychicId: psychic.id,
    guessTeamId: guessTeam.id,
    betTeamId: betTeam?.id ?? null,
  };
}

/** Advance the psychic pointer of the team that just played. */
export function advancePsychic(teams: Team[], guessTeamId: string): Team[] {
  return teams.map((t) =>
    t.id === guessTeamId ? { ...t, psychicIndex: t.psychicIndex + 1 } : t,
  );
}
