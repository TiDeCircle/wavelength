"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { RoomCode } from "./RoomCode";
import { TeamPicker } from "./TeamPicker";
import type { GameConfig } from "@/types/game";
import type { PublicRoom, RoomPlayer } from "@/types/online";

const TARGET_SCORES = [7, 10, 15];
const TIMERS: { label: string; value: number | null }[] = [
  { label: "ปิด", value: null },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "120s", value: 120 },
];

/** Below this the room plays co-op — mirrors `MIN_PLAYERS_FOR_TEAMS` on the server. */
const MIN_PLAYERS_FOR_TEAMS = 4;
const MIN_PLAYERS = 2;

export function Lobby({
  room,
  me,
  isHost,
  onMove,
  onConfig,
  onStart,
  onLeave,
}: {
  room: PublicRoom;
  me: RoomPlayer | null;
  isHost: boolean;
  onMove: (playerId: string, teamId: string) => void;
  onConfig: (config: Partial<GameConfig>) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const coop = room.players.length < MIN_PLAYERS_FOR_TEAMS;
  const teamsFilled =
    coop ||
    (room.players.some((p) => p.teamId === "team-0") &&
      room.players.some((p) => p.teamId === "team-1"));
  const enough = room.players.length >= MIN_PLAYERS;
  const canStart = isHost && enough && teamsFilled;

  const pill = (active: boolean) =>
    `flex-1 rounded-2xl py-3 text-sm font-bold ${
      active
        ? "bg-amber-400 text-slate-900"
        : "bg-[var(--surface-raised)] text-slate-300"
    } ${isHost ? "" : "cursor-not-allowed opacity-60"}`;

  return (
    <Screen
      footer={
        <>
          {isHost ? (
            <Button disabled={!canStart} onClick={onStart}>
              เริ่มเกม
            </Button>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">
              รอ host กดเริ่ม
            </p>
          )}
          <Button variant="ghost" onClick={onLeave}>
            ออกจากห้อง
          </Button>
        </>
      }
    >
      <RoomCode code={room.code} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          ผู้เล่น ({room.players.length})
          {!coop && (
            <span className="ml-2 font-normal text-slate-500">
              แตะชื่อเพื่อย้ายทีม
            </span>
          )}
        </h2>
        <TeamPicker
          players={room.players}
          meId={me?.id ?? null}
          hostId={room.hostId}
          coop={coop}
          onMove={onMove}
        />
        {!enough && (
          <p className="mt-3 text-center text-xs text-slate-500">
            ต้องมีอย่างน้อย {MIN_PLAYERS} คน
          </p>
        )}
        {enough && coop && (
          <p className="mt-3 rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            น้อยกว่า {MIN_PLAYERS_FOR_TEAMS} คน → โหมดร่วมมือ ทีมเดียว
            ไม่มีการเดาซ้าย/ขวา
          </p>
        )}
        {enough && !coop && !teamsFilled && (
          <p className="mt-3 text-center text-xs text-amber-300">
            ต้องมีคนอยู่ทั้งสองทีม
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เล่นถึงกี่คะแนน
          </h2>
          <div className="flex gap-2">
            {TARGET_SCORES.map((s) => (
              <button
                key={s}
                disabled={!isHost}
                onClick={() => onConfig({ targetScore: s })}
                className={pill(room.config.targetScore === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เวลาถกกัน
          </h2>
          <div className="flex gap-2">
            {TIMERS.map((t) => (
              <button
                key={t.label}
                disabled={!isHost}
                onClick={() => onConfig({ discussionSeconds: t.value })}
                className={pill(room.config.discussionSeconds === t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!coop && (
          <label
            className={`flex items-center justify-between rounded-2xl bg-[var(--surface-raised)] px-4 py-3 ${
              isHost ? "" : "opacity-60"
            }`}
          >
            <span className="text-sm font-semibold text-slate-300">
              ให้อีกทีมเดาซ้าย/ขวา
            </span>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={room.config.leftRightBet}
              onChange={(e) => onConfig({ leftRightBet: e.target.checked })}
              className="h-5 w-5 accent-amber-400"
            />
          </label>
        )}

        {!isHost && (
          <p className="text-center text-xs text-slate-600">
            เฉพาะ host ปรับตั้งค่าได้
          </p>
        )}
      </section>
    </Screen>
  );
}
