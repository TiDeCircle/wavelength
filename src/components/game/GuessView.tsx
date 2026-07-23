"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen, SpectrumHeading } from "@/components/ui/Screen";
import { useCountdown } from "@/lib/hooks/useCountdown";
import type { SpectrumCard } from "@/types/game";

/**
 * The guessing team drags the dial.
 *
 * `<Dial>` gets no `target` prop, so the scoring band is never mounted — the
 * hidden position is not in the DOM on this screen.
 *
 * Online, everyone in the room renders this same screen and watches the needle
 * move; `canGuess` / `canLock` decide who is allowed to touch it. Local play
 * leaves both on, which is the hotseat behaviour.
 */
export function GuessView({
  card,
  clue,
  guess,
  teamName,
  teamColor,
  discussionSeconds,
  onChange,
  onLock,
  canGuess = true,
  canLock = true,
  watchingLabel,
}: {
  card: SpectrumCard;
  clue: string;
  guess: number;
  teamName: string;
  teamColor: string;
  discussionSeconds: number | null;
  onChange: (value: number) => void;
  onLock: () => void;
  canGuess?: boolean;
  canLock?: boolean;
  /** Shown instead of the lock button for players who are only watching. */
  watchingLabel?: string;
}) {
  // Only the players who can actually lock should race the clock to do it.
  const left = useCountdown(discussionSeconds, canLock ? onLock : undefined);

  return (
    <Screen
      footer={
        canLock ? (
          <Button onClick={onLock}>ล็อกคำตอบ</Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {watchingLabel ?? "รอทีมที่เดาล็อกคำตอบ"}
          </p>
        )
      }
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold" style={{ color: teamColor }}>
            {teamName} เดา
          </p>
          {left !== null && (
            <p
              className={`font-mono text-sm tabular-nums ${
                left <= 10 ? "text-amber-300" : "text-slate-500"
              }`}
            >
              {String(Math.floor(left / 60)).padStart(2, "0")}:
              {String(left % 60).padStart(2, "0")}
            </p>
          )}
        </div>
        <div className="mt-3">
          <SpectrumHeading left={card.left} right={card.right} />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-5 text-center">
        <p className="text-xs font-semibold tracking-widest text-amber-300/70 uppercase">
          Clue
        </p>
        <p className="mt-1 text-3xl font-black break-words text-amber-200">
          {clue}
        </p>
      </div>

      <div className="flex flex-col items-center">
        <Dial
          value={guess}
          onChange={canGuess ? onChange : undefined}
          leftLabel={card.left}
          rightLabel={card.right}
        />
        <p className="mt-1 text-xs text-slate-500">
          {canGuess ? "ลากเข็ม หรือใช้ปุ่มลูกศร" : "ดูเข็มขยับตามทีมที่เดา"}
        </p>
      </div>
    </Screen>
  );
}
