"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { ScoreBoard } from "./ScoreBoard";
import type { GameState } from "@/types/game";
import type { PublicGameState } from "@/types/online";

/** Between-rounds standings, and the end-of-game screen. */
export function ScoreboardScreen({
  state,
  onNext,
  onRematch,
  onExit,
  canAdvance = true,
  waitingLabel,
  exitLabel = "ออก",
}: {
  state: GameState | PublicGameState;
  onNext: () => void;
  onRematch: () => void;
  onExit: () => void;
  canAdvance?: boolean;
  waitingLabel?: string;
  exitLabel?: string;
}) {
  const over = state.phase === "gameover";
  const sharedDial = state.config.sharedDial;
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const winner = !sharedDial && ranked.length > 0 ? ranked[0] : null;
  const delta = state.round?.scores ?? undefined;

  return (
    <Screen
      footer={
        over ? (
          <>
            {canAdvance && <Button onClick={onRematch}>เล่นอีกรอบ</Button>}
            <Button variant="ghost" onClick={onExit}>
              {exitLabel}
            </Button>
          </>
        ) : canAdvance ? (
          <Button onClick={onNext}>รอบต่อไป</Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {waitingLabel ?? "รอ host เริ่มรอบต่อไป"}
          </p>
        )
      }
    >
      <div className="text-center">
        {over ? (
          <>
            <p className="text-5xl">🏆</p>
            <p className="mt-3 text-2xl font-black">
              {sharedDial ? "จบเกม" : `${winner?.name} ชนะ`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
              จบรอบที่ {state.round?.number} / {state.config.rounds}
            </p>
            <p className="mt-2 text-2xl font-black">คะแนนรวม</p>
          </>
        )}
      </div>

      <ScoreBoard
        players={state.players}
        groupScore={state.groupScore}
        sharedDial={sharedDial}
        rounds={state.config.rounds}
        delta={delta}
      />
    </Screen>
  );
}
