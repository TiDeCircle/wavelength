"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { playerColor } from "./ScoreBoard";
import { SHARED_DIAL_KEY, type Player, type Round } from "@/types/game";

export function RevealView({
  round,
  players,
  sharedDial,
  onNext,
  canAdvance = true,
  waitingLabel,
}: {
  round: Round;
  players: Player[];
  sharedDial: boolean;
  onNext: () => void;
  canAdvance?: boolean;
  waitingLabel?: string;
}) {
  const card = round.card;
  if (!card) return null;

  const chooser = players.find((p) => p.id === round.chooserId);
  const scores = round.scores ?? {};

  const needles = sharedDial
    ? [{ value: round.guesses[SHARED_DIAL_KEY] ?? 50 }]
    : players
        .filter((p) => p.id !== round.chooserId)
        .map((p) => ({
          value: round.guesses[p.id] ?? 50,
          label: p.name,
          color: playerColor(players, p.id),
        }));

  const rows = sharedDial
    ? [
        {
          key: SHARED_DIAL_KEY,
          name: "ทั้งกลุ่ม",
          value: round.guesses[SHARED_DIAL_KEY] ?? 50,
          points: scores[SHARED_DIAL_KEY] ?? 0,
          color: "var(--needle)",
        },
      ]
    : players
        .filter((p) => p.id !== round.chooserId)
        .map((p) => ({
          key: p.id,
          name: p.name,
          value: round.guesses[p.id] ?? 50,
          points: scores[p.id] ?? 0,
          color: playerColor(players, p.id),
        }));

  return (
    <Screen
      footer={
        canAdvance ? (
          <Button onClick={onNext}>ดูคะแนนรวม</Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {waitingLabel ?? "รอ host ไปต่อ"}
          </p>
        )
      }
    >
      <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          {card.category}
        </p>
        <p className="mt-1 text-lg font-bold">
          <span className="text-slate-400">{card.left}</span>
          <span className="mx-2 text-slate-600">↔</span>
          <span className="text-slate-100">{card.right}</span>
        </p>
        <p className="mt-2 text-2xl font-black text-amber-200">{round.subject}</p>
      </div>

      <div className="flex flex-col items-center">
        <Dial
          value={round.target}
          target={round.target}
          needles={needles}
          bandClassName="band-reveal"
          animateNeedle
          leftLabel={card.left}
          rightLabel={card.right}
        />
        <p className="mt-1 text-xs text-slate-500">
          target อยู่ที่ {round.target.toFixed(1)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-2xl bg-[var(--surface-raised)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-bold" style={{ color: row.color }}>
                {row.name}
              </p>
              <p className="text-xs text-slate-500">
                เข็ม {row.value.toFixed(1)} · ห่าง{" "}
                {Math.abs(row.value - round.target).toFixed(1)}
              </p>
            </div>
            <span className="shrink-0 text-3xl font-black text-amber-300">
              +{row.points}
            </span>
          </div>
        ))}

        {!sharedDial && chooser && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-700 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-300">
                {chooser.name}
              </p>
              <p className="text-xs text-slate-500">คนเลือก — ค่าเฉลี่ยของคนเดา</p>
            </div>
            <span className="shrink-0 text-3xl font-black text-amber-300">
              +{scores[chooser.id] ?? 0}
            </span>
          </div>
        )}
      </div>
    </Screen>
  );
}
