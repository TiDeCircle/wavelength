"use client";

import { useState } from "react";

/** The code people read out loud, plus a one-tap copy of the join link. */
export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/online/${code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code on screen is still readable.
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-5 text-center">
      <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
        Room code
      </p>
      <p className="mt-2 font-mono text-5xl font-black tracking-[0.3em] text-amber-300">
        {code}
      </p>
      <button
        onClick={copy}
        className="mt-3 text-sm text-slate-400 underline hover:text-slate-200"
      >
        {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ชวนเพื่อน"}
      </button>
    </div>
  );
}
