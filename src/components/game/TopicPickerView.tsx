"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

const MAX_FIELD = 24;

/**
 * The chooser settles on a category and spectrum before seeing the target.
 *
 * Order matters: if the target were visible first, a custom spectrum could be
 * written to suit it.
 */
export function TopicPickerView({
  card,
  chooserName,
  onReroll,
  onConfirm,
}: {
  /** The currently drawn random card. */
  card: TopicCard;
  chooserName: string;
  onReroll: () => void;
  onConfirm: (card: TopicCard) => void;
}) {
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [category, setCategory] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const customReady =
    category.trim().length > 0 && left.trim().length > 0 && right.trim().length > 0;

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        maxLength={MAX_FIELD}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <Screen
      footer={
        mode === "random" ? (
          <>
            <Button onClick={() => onConfirm(card)}>ใช้หัวข้อนี้</Button>
            <Button variant="secondary" onClick={onReroll}>
              สุ่มใหม่
            </Button>
          </>
        ) : (
          <Button
            disabled={!customReady}
            onClick={() =>
              onConfirm({
                id: null,
                category: category.trim(),
                left: left.trim(),
                right: right.trim(),
                custom: true,
              })
            }
          >
            ใช้หัวข้อนี้
          </Button>
        )
      }
    >
      <div className="text-center">
        <p className="text-sm text-slate-400">
          <span className="font-bold text-slate-200">{chooserName}</span> เลือกหัวข้อ
        </p>
      </div>

      <div className="flex gap-2">
        {(["random", "custom"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold ${
              mode === m
                ? "bg-amber-400 text-slate-900"
                : "bg-[var(--surface-raised)] text-slate-300"
            }`}
          >
            {m === "random" ? "สุ่มให้" : "ตั้งเอง"}
          </button>
        ))}
      </div>

      {mode === "random" ? (
        <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            หมวด
          </p>
          <p className="mt-1 text-3xl font-black">{card.category}</p>
          <p className="mt-5 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {field("category", "หมวด", category, setCategory, "เช่น Movie")}
          {field("left", "ฝั่งซ้าย (0)", left, setLeft, "เช่น Forgotten")}
          {field("right", "ฝั่งขวา (100)", right, setRight, "เช่น Iconic")}
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-slate-500">
        เลือกหัวข้อก่อน แล้วค่อยเห็นว่า target อยู่ตรงไหน
      </p>
    </Screen>
  );
}
