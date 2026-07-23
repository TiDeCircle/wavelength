"use client";

import { useState } from "react";
import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

/** The only screen that renders the target. */
export function SubjectView({
  card,
  target,
  chooserName,
  onSubmit,
}: {
  card: TopicCard;
  target: number;
  chooserName: string;
  onSubmit: (subject: string) => void;
}) {
  const [subject, setSubject] = useState("");

  return (
    <Screen
      footer={
        <>
          <Button disabled={!subject.trim()} onClick={() => onSubmit(subject)}>
            ส่งคำตอบ — ซ่อน target
          </Button>
          <p className="text-center text-xs text-slate-500">
            กดแล้วจะซ่อน target ทันที
          </p>
        </>
      }
    >
      <div>
        <p className="text-center text-sm text-slate-400">
          <span className="font-bold text-slate-200">{chooserName}</span> เลือกหัวข้อแล้ว
        </p>
        <div className="mt-3 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
          </p>
          <p className="mt-1 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
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
          htmlFor="subject"
          className="mb-2 block text-sm font-semibold text-slate-300"
        >
          อะไรใน &ldquo;{card.category}&rdquo; ที่อยู่ตรงโซนนั้น
        </label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={40}
          autoComplete="off"
          placeholder="พิมพ์ชื่อ…"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />
        <p className="mt-2 text-xs text-slate-500">
          ต้องเป็นของจริงในหมวดนี้ ห้ามบอกตัวเลขหรือทิศทาง
        </p>
      </div>
    </Screen>
  );
}
