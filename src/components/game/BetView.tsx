"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen, SpectrumHeading } from "@/components/ui/Screen";
import type { BetSide, SpectrumCard } from "@/types/game";

/**
 * The opposing team bets which side of the locked needle the target sits on.
 *
 * Online, everyone renders this; `canBet` gates who may actually pick.
 */
export function BetView({
  card,
  guess,
  bet,
  teamName,
  teamColor,
  onSelect,
  onLock,
  canBet = true,
  watchingLabel,
}: {
  card: SpectrumCard;
  guess: number;
  bet: BetSide | null;
  teamName: string;
  teamColor: string;
  onSelect: (side: BetSide) => void;
  onLock: () => void;
  canBet?: boolean;
  watchingLabel?: string;
}) {
  const choice = (side: BetSide, label: string) => (
    <button
      onClick={() => onSelect(side)}
      disabled={!canBet}
      className={`flex-1 rounded-2xl py-6 text-2xl font-black transition-colors disabled:cursor-not-allowed ${
        bet === side
          ? "bg-amber-400 text-slate-900"
          : "bg-[var(--surface-raised)] text-slate-300 enabled:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Screen
      footer={
        canBet ? (
          <Button disabled={!bet} onClick={onLock}>
            ยืนยัน
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {watchingLabel ?? `รอ${teamName}เดาซ้าย/ขวา`}
          </p>
        )
      }
    >
      <div>
        <p className="text-sm font-bold" style={{ color: teamColor }}>
          {teamName} เดาซ้าย/ขวา
        </p>
        <div className="mt-3">
          <SpectrumHeading left={card.left} right={card.right} />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <Dial value={guess} leftLabel={card.left} rightLabel={card.right} />
      </div>

      <div>
        <p className="mb-3 text-center text-sm text-slate-400">
          target อยู่ฝั่งไหนของเข็ม?
        </p>
        <div className="flex gap-3">
          {choice("left", "◀ ซ้าย")}
          {choice("right", "ขวา ▶")}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          เดาถูก +1 คะแนน (ถ้าอีกทีมได้ 4 เต็ม ไม่มีคะแนนนี้)
        </p>
      </div>
    </Screen>
  );
}
