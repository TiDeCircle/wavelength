import type { Team } from "@/types/game";

export const TEAM_COLORS = ["var(--team-a)", "var(--team-b)"] as const;

export function teamColor(teams: Team[], teamId: string | null): string {
  const i = teams.findIndex((t) => t.id === teamId);
  return TEAM_COLORS[i === -1 ? 0 : i % TEAM_COLORS.length];
}

/**
 * Running totals. Mode-agnostic: it takes plain team data, so the online mode
 * renders the same component from server state.
 */
export function ScoreBoard({
  teams,
  targetScore,
  /** Points added this round, keyed by team id — shown as a `+n` badge. */
  delta,
  winningTeamId,
}: {
  teams: Team[];
  targetScore: number;
  delta?: Record<string, number>;
  winningTeamId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {teams.map((team, i) => {
        const gained = delta?.[team.id] ?? 0;
        const pct = Math.min(100, (team.score / targetScore) * 100);
        return (
          <div
            key={team.id}
            className={`rounded-2xl bg-[var(--surface-raised)] p-4 ${
              winningTeamId === team.id ? "ring-2 ring-amber-400" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="truncate text-base font-bold"
                style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}
              >
                {team.name}
              </span>
              <span className="shrink-0 text-sm text-slate-400">
                {gained > 0 && (
                  <span className="mr-2 rounded-full bg-amber-400/15 px-2 py-0.5 font-bold text-amber-300">
                    +{gained}
                  </span>
                )}
                <span className="text-2xl font-black text-slate-100">
                  {team.score}
                </span>
                <span className="ml-1">/ {targetScore}</span>
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: TEAM_COLORS[i % TEAM_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
