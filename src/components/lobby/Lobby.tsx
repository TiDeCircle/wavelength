"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { RoomCode } from "./RoomCode";
import { PLAYER_COLORS } from "@/components/game/ScoreBoard";
import { rotationIsEven } from "@/lib/game/setup";
import type { GameConfig } from "@/types/game";
import type { PublicRoom, RoomPlayer } from "@/types/online";

const ROUND_COUNTS = [5, 10, 15];
const TIMERS: { label: string; value: number | null }[] = [
  { label: "ปิด", value: null },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "120s", value: 120 },
];

const MIN_PLAYERS = 2;

export function Lobby({
  room,
  me,
  isHost,
  onConfig,
  onStart,
  onLeave,
}: {
  room: PublicRoom;
  me: RoomPlayer | null;
  isHost: boolean;
  onConfig: (config: Partial<GameConfig>) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const canStart = isHost && room.players.length >= MIN_PLAYERS;

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
        </h2>
        <ul className="flex flex-wrap gap-2">
          {room.players.map((p, i) => (
            <li key={p.id}>
              <span
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
                  p.connected
                    ? "bg-slate-700 text-slate-100"
                    : "bg-slate-800 text-slate-500 line-through"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                />
                <span className="truncate">{p.name}</span>
                {p.id === room.hostId && <span title="host">👑</span>}
                {p.id === me?.id && (
                  <span className="text-xs text-amber-300">(คุณ)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {room.players.length < MIN_PLAYERS && (
          <p className="mt-3 text-center text-xs text-slate-500">
            ต้องมีอย่างน้อย {MIN_PLAYERS} คน
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เล่นกี่รอบ
          </h2>
          <div className="flex gap-2">
            {ROUND_COUNTS.map((r) => (
              <button
                key={r}
                disabled={!isHost}
                onClick={() => onConfig({ rounds: r })}
                className={pill(room.config.rounds === r)}
              >
                {r}
              </button>
            ))}
          </div>
          {!rotationIsEven(room.players.length, room.config.rounds) && (
            <p className="mt-2 text-xs text-amber-300/80">
              {room.config.rounds} รอบ หารกับ {room.players.length} คนไม่ลงตัว
              บางคนจะได้เลือกมากกว่าคนอื่น
            </p>
          )}
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

        {!isHost && (
          <p className="text-center text-xs text-slate-600">
            เฉพาะ host ปรับตั้งค่าได้
          </p>
        )}
      </section>
    </Screen>
  );
}
