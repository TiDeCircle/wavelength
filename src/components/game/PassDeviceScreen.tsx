"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

/**
 * Hotseat gate. Nothing secret is rendered here — this screen exists so the
 * target is never on display while the device changes hands.
 */
export function PassDeviceScreen({
  psychicName,
  teamName,
  teamColor,
  roundNumber,
  onConfirm,
}: {
  psychicName: string;
  teamName: string;
  teamColor: string;
  roundNumber: number;
  onConfirm: () => void;
}) {
  return (
    <Screen
      footer={
        <Button onClick={onConfirm}>ฉันคือ {psychicName} — เปิดดู target</Button>
      }
    >
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
        <p className="mt-8 text-lg text-slate-400">ส่งเครื่องให้</p>
        <p className="mt-2 text-4xl font-black break-words">{psychicName}</p>
        <p className="mt-3 text-base font-bold" style={{ color: teamColor }}>
          {teamName}
        </p>
        <p className="mt-10 text-sm leading-relaxed text-slate-500">
          คนอื่นอย่ามอง
          <br />
          กดปุ่มข้างล่างเมื่อ {psychicName} ถือเครื่องแล้ว
        </p>
      </div>
    </Screen>
  );
}
