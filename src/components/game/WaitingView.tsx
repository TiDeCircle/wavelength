"use client";

import { Screen, SpectrumHeading } from "@/components/ui/Screen";
import type { SpectrumCard } from "@/types/game";

/**
 * What everyone except the psychic looks at while the clue is being written.
 *
 * Online only — hotseat uses `PassDeviceScreen` instead. Note there is no dial
 * here at all: with no needle and no band, there is nothing on this screen that
 * could hint at the target.
 */
export function WaitingView({
  card,
  psychicName,
  teamName,
  teamColor,
  roundNumber,
}: {
  card: SpectrumCard;
  psychicName: string;
  teamName: string;
  teamColor: string;
  roundNumber: number;
}) {
  return (
    <Screen>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
      </div>

      <SpectrumHeading left={card.left} right={card.right} />

      <div className="text-center">
        <div className="mx-auto mb-6 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-600"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-2xl font-black break-words">{psychicName}</p>
        <p className="mt-1 text-sm font-bold" style={{ color: teamColor }}>
          {teamName}
        </p>
        <p className="mt-4 text-slate-400">กำลังคิด clue อยู่</p>
      </div>
    </Screen>
  );
}
