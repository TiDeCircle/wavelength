"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useCountdown } from "@/lib/hooks/useCountdown";
import type { TopicCard } from "@/types/game";

/**
 * Placing the dial.
 *
 * `<Dial>` gets no `target` prop, so the scoring band is never mounted — the
 * hidden position is not in the DOM on this screen. Online, every player sees
 * only their own needle; the shared-dial device shows the one everybody moves.
 */
export function GuessView({
  card,
  subject,
  guess,
  discussionSeconds,
  onChange,
  onLock,
  canGuess = true,
  canLock = true,
  watchingLabel,
  waitingCount,
}: {
  card: TopicCard;
  subject: string;
  guess: number;
  discussionSeconds: number | null;
  onChange: (value: number) => void;
  onLock: () => void;
  canGuess?: boolean;
  canLock?: boolean;
  /** Shown instead of the lock button for players who are only watching. */
  watchingLabel?: string;
  /** "รออีก N คน" line under the button. */
  waitingCount?: number;
}) {
  const left = useCountdown(discussionSeconds, canLock ? onLock : undefined);

  return (
    <Screen
      footer={
        canLock ? (
          <>
            <Button onClick={onLock}>ล็อกคำตอบ</Button>
            {waitingCount !== undefined && waitingCount > 0 && (
              <p className="text-center text-xs text-slate-500">
                รออีก {waitingCount} คน
              </p>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {watchingLabel ?? "รอคนอื่นล็อกคำตอบ"}
          </p>
        )
      }
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
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
        <div className="mt-2 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-5 text-center">
        <p className="text-3xl font-black break-words text-amber-200">
          {subject}
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
          {canGuess ? "ลากเข็ม หรือใช้ปุ่มลูกศร" : "ดูอย่างเดียว"}
        </p>
      </div>
    </Screen>
  );
}
