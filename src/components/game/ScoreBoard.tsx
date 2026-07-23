import type { Player } from "@/types/game";

export const PLAYER_COLORS = [
  "#f472b6",
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#c084fc",
  "#fb923c",
  "#22d3ee",
  "#a3e635",
] as const;

export function playerColor(players: Player[], playerId: string | null): string {
  const i = players.findIndex((p) => p.id === playerId);
  return PLAYER_COLORS[(i === -1 ? 0 : i) % PLAYER_COLORS.length];
}

/**
 * Standings. Individual play ranks players; shared-dial play has one number
 * for the table, so it shows that instead.
 */
export function ScoreBoard({
  players,
  groupScore,
  sharedDial,
  rounds,
  delta,
}: {
  players: Player[];
  groupScore: number;
  sharedDial: boolean;
  /** Total rounds in the game, shown as the ceiling. */
  rounds: number;
  /** Points added this round, keyed by player id. */
  delta?: Record<string, number>;
}) {
  if (sharedDial) {
    const max = rounds * 4;
    return (
      <div className="rounded-2xl bg-[var(--surface-raised)] p-5 text-center">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          คะแนนกลุ่ม
        </p>
        <p className="mt-2 text-5xl font-black text-amber-300">{groupScore}</p>
        <p className="mt-1 text-sm text-slate-500">เต็ม {max}</p>
      </div>
    );
  }

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {ranked.map((player) => {
        const gained = delta?.[player.id] ?? 0;
        const pct = top > 0 ? (player.score / top) * 100 : 0;
        return (
          <div
            key={player.id}
            className="rounded-2xl bg-[var(--surface-raised)] p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="truncate text-base font-bold"
                style={{ color: playerColor(players, player.id) }}
              >
                {player.name}
              </span>
              <span className="shrink-0 text-sm text-slate-400">
                {gained > 0 && (
                  <span className="mr-2 rounded-full bg-amber-400/15 px-2 py-0.5 font-bold text-amber-300">
                    +{gained}
                  </span>
                )}
                <span className="text-2xl font-black text-slate-100">
                  {player.score}
                </span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: playerColor(players, player.id),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
