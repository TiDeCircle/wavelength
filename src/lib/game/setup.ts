import type { Player, Team } from "@/types/game";

export const MIN_PLAYERS = 2;
/** Below this the game drops to co-op: one team, no left-right bet. */
export const MIN_PLAYERS_FOR_TEAMS = 4;

export interface SetupResult {
  players: Player[];
  teams: Team[];
  coop: boolean;
}

/**
 * Turn a list of names into players and teams.
 *
 * Names alternate between the two teams so seating order does not decide the
 * split. With fewer than four players there is only one team.
 */
export function buildRoster(
  names: string[],
  teamNames: [string, string],
): SetupResult {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  const coop = clean.length < MIN_PLAYERS_FOR_TEAMS;

  const teams: Team[] = (coop ? [teamNames[0]] : teamNames).map((name, i) => ({
    id: `team-${i}`,
    name,
    score: 0,
    psychicIndex: 0,
  }));

  const players: Player[] = clean.map((name, i) => ({
    id: `p-${i}`,
    name,
    teamId: coop ? "team-0" : `team-${i % 2}`,
  }));

  return { players, teams, coop };
}

/** Every team needs at least one player before the game can start. */
export function rosterIsPlayable(result: SetupResult): boolean {
  if (result.players.length < MIN_PLAYERS) return false;
  return result.teams.every((t) =>
    result.players.some((p) => p.teamId === t.id),
  );
}
