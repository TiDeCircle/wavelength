"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen, SpectrumHeading } from "@/components/ui/Screen";
import { actualSide } from "@/lib/game/scoring";
import type { Round, SpectrumCard, Team } from "@/types/game";

const SIDE_LABEL = { left: "ซ้าย", right: "ขวา" } as const;

export function RevealView({
  card,
  round,
  teams,
  onNext,
  canAdvance = true,
  waitingLabel,
}: {
  card: SpectrumCard;
  round: Round;
  teams: Team[];
  onNext: () => void;
  /** Online: only the host moves the room on. */
  canAdvance?: boolean;
  waitingLabel?: string;
}) {
  const scores = round.scores;
  const guessTeam = teams.find((t) => t.id === round.guessTeamId);
  const betTeam = teams.find((t) => t.id === round.betTeamId);
  const side = actualSide(round.guess, round.target);

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
      <SpectrumHeading left={card.left} right={card.right} />

      <div className="flex flex-col items-center">
        <Dial
          value={round.guess}
          target={round.target}
          bandClassName="band-reveal"
          animateNeedle
          leftLabel={card.left}
          rightLabel={card.right}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {guessTeam?.name} เดา
            </span>
            <span className="text-3xl font-black text-amber-300">
              +{scores?.guess ?? 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            เข็ม {round.guess.toFixed(1)} · target {round.target.toFixed(1)} ·
            ห่าง {Math.abs(round.guess - round.target).toFixed(1)}
          </p>
        </div>

        {betTeam && (
          <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {betTeam.name} เดา {round.bet ? SIDE_LABEL[round.bet] : "-"}
              </span>
              <span className="text-3xl font-black text-amber-300">
                +{scores?.bet ?? 0}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {side ? `target อยู่ทาง${SIDE_LABEL[side]}` : "เข้าเป้าพอดี ไม่มีฝั่ง"}
            </p>
          </div>
        )}
      </div>
    </Screen>
  );
}
