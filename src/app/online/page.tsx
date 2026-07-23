"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useOnlineGame } from "@/lib/store/onlineGame";

export default function OnlineEntryPage() {
  const router = useRouter();
  const { status, createRoom, joinRoom, error, clearError } = useOnlineGame();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const offline = status !== "connected";
  const canCreate = name.trim().length > 0 && !offline && !busy;
  const canJoin = canCreate && code.trim().length >= 4;

  const handleCreate = async () => {
    setBusy(true);
    clearError();
    const result = await createRoom(name.trim());
    setBusy(false);
    if (result.ok) router.push(`/online/${result.room.code}`);
  };

  const handleJoin = async () => {
    setBusy(true);
    clearError();
    const result = await joinRoom(code, name.trim());
    setBusy(false);
    if (result.ok) router.push(`/online/${result.room.code}`);
  };

  return (
    <Screen
      footer={
        <Link
          href="/"
          className="py-2 text-center text-sm text-slate-500 hover:text-slate-300"
        >
          กลับหน้าแรก
        </Link>
      }
    >
      <div>
        <h1 className="text-3xl font-black">เล่นออนไลน์</h1>
        <p className="mt-1 text-sm text-slate-400">
          สร้างห้องแล้วส่ง code ให้เพื่อน แต่ละคนเล่นจากมือถือตัวเอง
        </p>
      </div>

      {offline && (
        <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-300">
          {status === "connecting" ? "กำลังต่อ server…" : "หลุดจาก server กำลังต่อใหม่…"}
        </p>
      )}

      {error && (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-semibold text-slate-300"
        >
          ชื่อของคุณ
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="off"
          placeholder="ชื่อเล่น"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <Button disabled={!canCreate} onClick={handleCreate}>
        สร้างห้องใหม่
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span className="h-px flex-1 bg-slate-700" />
        หรือเข้าห้องที่มีอยู่
        <span className="h-px flex-1 bg-slate-700" />
      </div>

      <div>
        <label
          htmlFor="code"
          className="mb-2 block text-sm font-semibold text-slate-300"
        >
          Room code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canJoin) handleJoin();
          }}
          maxLength={6}
          autoComplete="off"
          placeholder="ABCD"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.3em] uppercase outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <Button variant="secondary" disabled={!canJoin} onClick={handleJoin}>
        เข้าห้อง
      </Button>
    </Screen>
  );
}
