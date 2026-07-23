"use client";

import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

/**
 * What everyone except the chooser looks at while the topic and subject are
 * being picked. There is no dial and no band here, so nothing on this screen
 * can hint at the target.
 */
export function WaitingView({
  card,
  chooserName,
  roundNumber,
  note,
}: {
  /** null while the chooser is still picking a topic. */
  card: TopicCard | null;
  chooserName: string;
  roundNumber: number;
  note: string;
}) {
  return (
    <Screen>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
      </div>

      {card && (
        <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
          </p>
          <p className="mt-1 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      )}

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
        <p className="text-2xl font-black break-words">{chooserName}</p>
        <p className="mt-4 text-slate-400">{note}</p>
      </div>
    </Screen>
  );
}
