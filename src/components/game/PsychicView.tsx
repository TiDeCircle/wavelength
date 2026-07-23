"use client";

import { useState } from "react";
import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen, SpectrumHeading } from "@/components/ui/Screen";
import type { SpectrumCard } from "@/types/game";

/** The only screen that renders the target. */
export function PsychicView({
  card,
  target,
  psychicName,
  onSubmit,
}: {
  card: SpectrumCard;
  target: number;
  psychicName: string;
  onSubmit: (clue: string) => void;
}) {
  const [clue, setClue] = useState("");

  return (
    <Screen
      footer={
        <>
          <Button disabled={!clue.trim()} onClick={() => onSubmit(clue)}>
            ส่ง clue — ซ่อน target
          </Button>
          <p className="text-center text-xs text-slate-500">
            กดแล้วจะซ่อน target ทันที ส่งเครื่องให้ทีมเดาต่อ
          </p>
        </>
      }
    >
      <div>
        <p className="text-center text-sm text-slate-400">
          <span className="font-bold text-slate-200">{psychicName}</span> คือ
          psychic รอบนี้
        </p>
        <div className="mt-4">
          <SpectrumHeading left={card.left} right={card.right} />
        </div>
      </div>

      <Dial
        value={target}
        target={target}
        showNeedle={false}
        leftLabel={card.left}
        rightLabel={card.right}
      />

      <div>
        <label
          htmlFor="clue"
          className="mb-2 block text-sm font-semibold text-slate-300"
        >
          Clue (คำหรือวลีสั้น)
        </label>
        <input
          id="clue"
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="พิมพ์ clue…"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />
        <p className="mt-2 text-xs text-slate-500">
          ห้ามใช้ตัวเลข ทิศทาง หรือคำที่อยู่บนการ์ด
        </p>
      </div>
    </Screen>
  );
}
