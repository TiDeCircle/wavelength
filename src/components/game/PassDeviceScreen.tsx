"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

/**
 * Hand-off gate for shared-dial play. Nothing secret is rendered here — this
 * screen exists so the target is never on display while the device changes
 * hands. After the chooser submits their subject the device goes back on the
 * table; there is no second hand-off in a round.
 */
export function PassDeviceScreen({
  chooserName,
  roundNumber,
  onConfirm,
}: {
  chooserName: string;
  roundNumber: number;
  onConfirm: () => void;
}) {
  return (
    <Screen
      footer={
        <Button onClick={onConfirm}>ฉันคือ {chooserName} — เลือกหัวข้อ</Button>
      }
    >
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
        <p className="mt-8 text-lg text-slate-400">ส่งเครื่องให้</p>
        <p className="mt-2 text-4xl font-black break-words">{chooserName}</p>
        <p className="mt-10 text-sm leading-relaxed text-slate-500">
          คนอื่นอย่ามอง
          <br />
          กดปุ่มข้างล่างเมื่อ {chooserName} ถือเครื่องแล้ว
        </p>
      </div>
    </Screen>
  );
}
