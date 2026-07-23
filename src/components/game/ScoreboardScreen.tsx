"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { ScoreBoard } from "./ScoreBoard";
import type { GameState } from "@/types/game";
import type { PublicGameState } from "@/types/online";

/**
 * Between-rounds totals, and the end-of-game screen.
 *
 * Takes the public state shape so online can pass its snapshot straight in —
 * nothing here reads the target.
 */
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
  /** Online: only the host starts the next round. */
  canAdvance?: boolean;
  waitingLabel?: string;
  exitLabel?: string;
}) {
  const over = state.phase === "gameover";
  const winner = state.teams.find((t) => t.id === state.winningTeamId) ?? null;
  const delta = state.round?.scores
    ? {
        [state.round.scores.guessTeamId]: state.round.scores.guess,
        ...(state.round.scores.betTeamId
          ? { [state.round.scores.betTeamId]: state.round.scores.bet }
          : {}),
      }
    : undefined;

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
            <p className="text-5xl">{winner ? "🏆" : "⌛"}</p>
            <p className="mt-3 text-2xl font-black">
              {winner
                ? `${winner.name} ชนะ`
                : "หมดรอบแล้ว ยังไม่ถึงเป้า"}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
              จบรอบที่ {state.round?.number}
            </p>
            <p className="mt-2 text-2xl font-black">คะแนนรวม</p>
          </>
        )}
      </div>

      <ScoreBoard
        teams={state.teams}
        targetScore={state.config.targetScore}
        delta={delta}
        winningTeamId={state.winningTeamId}
      />

      {state.coop && (
        <p className="text-center text-sm text-slate-500">
          รอบ {state.round?.number} / {state.config.coopRounds}
        </p>
      )}
    </Screen>
  );
}
