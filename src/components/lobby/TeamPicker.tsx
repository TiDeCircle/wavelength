"use client";

import { TEAM_COLORS } from "@/components/game/ScoreBoard";
import type { RoomPlayer } from "@/types/online";

export const TEAM_IDS = ["team-0", "team-1"] as const;
export const TEAM_NAMES = ["ทีมชมพู", "ทีมเขียว"] as const;

/**
 * Two team columns. Tapping a player moves them; the server decides whether
 * the tap was allowed (you may always move yourself, the host may move anyone).
 */
export function TeamPicker({
  players,
  meId,
  hostId,
  coop,
  onMove,
}: {
  players: RoomPlayer[];
  meId: string | null;
  hostId: string;
  coop: boolean;
  onMove: (playerId: string, teamId: string) => void;
}) {
  if (coop) {
    return (
      <div className="rounded-2xl bg-[var(--surface-raised)] p-4">
        <p className="mb-3 text-sm font-semibold text-slate-300">
          โหมดร่วมมือ (น้อยกว่า 4 คน)
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id}>
              <PlayerChip player={p} meId={meId} hostId={hostId} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {TEAM_IDS.map((teamId, i) => (
        <div
          key={teamId}
          className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-raised)] p-3"
        >
          <p
            className="mb-3 text-sm font-bold"
            style={{ color: TEAM_COLORS[i] }}
          >
            {TEAM_NAMES[i]}
          </p>
          <ul className="flex flex-col gap-2">
            {players
              .filter((p) => p.teamId === teamId)
              .map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onMove(p.id, TEAM_IDS[1 - i])}
                    className="w-full text-left"
                    title="แตะเพื่อย้ายทีม"
                  >
                    <PlayerChip player={p} meId={meId} hostId={hostId} />
                  </button>
                </li>
              ))}
            {players.filter((p) => p.teamId === teamId).length === 0 && (
              <li className="py-2 text-center text-xs text-slate-600">
                ยังไม่มีคน
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PlayerChip({
  player,
  meId,
  hostId,
}: {
  player: RoomPlayer;
  meId: string | null;
  hostId: string;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
        player.connected
          ? "bg-slate-700 text-slate-100"
          : "bg-slate-800 text-slate-500 line-through"
      }`}
    >
      <span className="truncate">{player.name}</span>
      {player.id === hostId && <span title="host">👑</span>}
      {player.id === meId && (
        <span className="text-xs text-amber-300">(คุณ)</span>
      )}
    </span>
  );
}
