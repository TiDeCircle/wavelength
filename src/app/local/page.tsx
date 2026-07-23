"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TEAM_COLORS } from "@/components/game/ScoreBoard";
import { DEFAULT_CONFIG } from "@/lib/game/reducer";
import {
  buildRoster,
  MIN_PLAYERS_FOR_TEAMS,
  rosterIsPlayable,
} from "@/lib/game/setup";
import { useLocalGame } from "@/lib/store/localGame";

const TARGET_SCORES = [7, 10, 15];
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
  const [teamNames, setTeamNames] = useState<[string, string]>([
    "ทีมชมพู",
    "ทีมเขียว",
  ]);
  const [targetScore, setTargetScore] = useState(DEFAULT_CONFIG.targetScore);
  const [discussionSeconds, setDiscussionSeconds] = useState<number | null>(
    DEFAULT_CONFIG.discussionSeconds,
  );
  const [leftRightBet, setLeftRightBet] = useState(DEFAULT_CONFIG.leftRightBet);

  const roster = useMemo(
    () => buildRoster(names, teamNames),
    [names, teamNames],
  );
  const playable = rosterIsPlayable(roster);

  const addName = () => {
    const n = draft.trim();
    if (!n) return;
    setNames((prev) => [...prev, n]);
    setDraft("");
  };

  const start = () => {
    if (!playable) return;
    startGame(roster.players, roster.teams, {
      targetScore,
      discussionSeconds,
      leftRightBet,
      coopRounds: DEFAULT_CONFIG.coopRounds,
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

        {roster.players.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {roster.players.map((p, i) => (
              <li key={p.id}>
                <button
                  onClick={() =>
                    setNames((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-900"
                  style={{
                    background: roster.coop
                      ? "#94a3b8"
                      : TEAM_COLORS[
                          roster.teams.findIndex((t) => t.id === p.teamId)
                        ],
                  }}
                  title="แตะเพื่อลบ"
                >
                  {p.name} ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {names.length > 0 && names.length < MIN_PLAYERS_FOR_TEAMS && (
          <p className="mt-3 rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            น้อยกว่า {MIN_PLAYERS_FOR_TEAMS} คน → เล่นโหมดร่วมมือ ทีมเดียว
            ไม่มีการเดาซ้าย/ขวา
          </p>
        )}
      </section>

      {!roster.coop && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">ชื่อทีม</h2>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <input
                key={i}
                value={teamNames[i]}
                onChange={(e) =>
                  setTeamNames((prev) => {
                    const next = [...prev] as [string, string];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                maxLength={16}
                className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-400"
                style={{ color: TEAM_COLORS[i] }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เล่นถึงกี่คะแนน
          </h2>
          <div className="flex gap-2">
            {TARGET_SCORES.map((s) => (
              <button
                key={s}
                onClick={() => setTargetScore(s)}
                className={`flex-1 rounded-2xl py-3 font-bold ${
                  targetScore === s
                    ? "bg-amber-400 text-slate-900"
                    : "bg-[var(--surface-raised)] text-slate-300"
                }`}
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

        {!roster.coop && (
          <label className="flex items-center justify-between rounded-2xl bg-[var(--surface-raised)] px-4 py-3">
            <span className="text-sm font-semibold text-slate-300">
              ให้อีกทีมเดาซ้าย/ขวา
            </span>
            <input
              type="checkbox"
              checked={leftRightBet}
              onChange={(e) => setLeftRightBet(e.target.checked)}
              className="h-5 w-5 accent-amber-400"
            />
          </label>
        )}
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
