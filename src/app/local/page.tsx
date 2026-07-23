"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { PLAYER_COLORS } from "@/components/game/ScoreBoard";
import { DEFAULT_CONFIG } from "@/lib/game/reducer";
import { buildPlayers, MIN_PLAYERS, rotationIsEven } from "@/lib/game/setup";
import { useLocalGame } from "@/lib/store/localGame";

const ROUND_COUNTS = [5, 10, 15];
const TIMERS: { label: string; value: number | null }[] = [
  { label: "ปิด", value: null },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "120s", value: 120 },
];

export default function LocalSetupPage() {
  const router = useRouter();
  const { state, startGame, clear } = useLocalGame();

  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [rounds, setRounds] = useState(DEFAULT_CONFIG.rounds);
  const [discussionSeconds, setDiscussionSeconds] = useState<number | null>(
    DEFAULT_CONFIG.discussionSeconds,
  );

  const players = useMemo(() => buildPlayers(names), [names]);
  const playable = players.length >= MIN_PLAYERS;
  const evenRotation = rotationIsEven(players.length, rounds);

  const addName = () => {
    const n = draft.trim();
    if (!n) return;
    setNames((prev) => [...prev, n]);
    setDraft("");
  };

  const start = () => {
    if (!playable) return;
    startGame(players, {
      rounds,
      discussionSeconds,
      // The device sits on the table: one dial, one score for everyone.
      sharedDial: true,
    });
    router.push("/local/play");
  };

  return (
    <Screen
      footer={
        <>
          {state && (
            <Button variant="secondary" onClick={() => router.push("/local/play")}>
              เล่นเกมที่ค้างอยู่ต่อ (รอบ {state.round?.number})
            </Button>
          )}
          <Button disabled={!playable} onClick={start}>
            {state ? "เริ่มเกมใหม่" : "เริ่มเกม"}
          </Button>
          <Link
            href="/"
            className="py-2 text-center text-sm text-slate-500 hover:text-slate-300"
          >
            กลับหน้าแรก
          </Link>
        </>
      }
    >
      <div>
        <h1 className="text-3xl font-black">ตั้งค่าเกม</h1>
        <p className="mt-1 text-sm text-slate-400">
          ใส่ชื่อผู้เล่น แล้วส่งเครื่องต่อกันไปเรื่อย ๆ
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          ผู้เล่น ({names.length})
        </h2>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addName();
              }
            }}
            placeholder="ชื่อผู้เล่น"
            maxLength={20}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={addName}
            className="shrink-0 rounded-2xl bg-slate-700 px-5 font-bold hover:bg-slate-600"
          >
            เพิ่ม
          </button>
        </div>

        {players.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {players.map((p, i) => (
              <li key={p.id}>
                <button
                  onClick={() =>
                    setNames((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-900"
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                  title="แตะเพื่อลบ"
                >
                  {p.name} ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {names.length > 0 && names.length < MIN_PLAYERS && (
          <p className="mt-3 rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            ต้องมีอย่างน้อย {MIN_PLAYERS} คน (คนเลือก 1 + คนเดา 1)
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
                onClick={() => setRounds(r)}
                className={`flex-1 rounded-2xl py-3 font-bold ${
                  rounds === r
                    ? "bg-amber-400 text-slate-900"
                    : "bg-[var(--surface-raised)] text-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {playable && !evenRotation && (
            <p className="mt-2 text-xs text-amber-300/80">
              {rounds} รอบ หารกับ {players.length} คนไม่ลงตัว
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
                onClick={() => setDiscussionSeconds(t.value)}
                className={`flex-1 rounded-2xl py-3 text-sm font-bold ${
                  discussionSeconds === t.value
                    ? "bg-amber-400 text-slate-900"
                    : "bg-[var(--surface-raised)] text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {state && (
        <button
          onClick={clear}
          className="text-xs text-slate-600 underline hover:text-slate-400"
        >
          ล้างเกมที่ค้างอยู่
        </button>
      )}
    </Screen>
  );
}
