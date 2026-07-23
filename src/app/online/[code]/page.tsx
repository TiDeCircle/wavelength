"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOnlineGame } from "@/lib/store/onlineGame";
import { Lobby } from "@/components/lobby/Lobby";
import { TopicPickerView } from "@/components/game/TopicPickerView";
import { SubjectView } from "@/components/game/SubjectView";
import { WaitingView } from "@/components/game/WaitingView";
import { GuessView } from "@/components/game/GuessView";
import { RevealView } from "@/components/game/RevealView";
import { ScoreboardScreen } from "@/components/game/ScoreboardScreen";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import type { Round } from "@/types/game";

/**
 * Lobby + phase router for an online room.
 *
 * Same job as `app/local/play/page.tsx`, and it mounts the same view
 * components — the only difference is where state comes from and which players
 * are allowed to act. Nothing here decides game rules; the server does.
 */
export default function OnlineRoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const game = useOnlineGame();
  const { room, me, status } = game;

  const inRoom = room?.code === code;

  if (!inRoom) return <JoinPrompt code={code} />;

  const banner =
    status !== "connected" ? (
      <div className="fixed inset-x-0 top-0 z-50 bg-amber-400 py-1.5 text-center text-xs font-bold text-slate-900">
        {status === "connecting" ? "กำลังต่อ server…" : "เน็ตหลุด กำลังต่อใหม่…"}
      </div>
    ) : null;

  if (!room.game) {
    return (
      <>
        {banner}
        <Lobby
          room={room}
          me={me}
          isHost={game.isHost}
          onConfig={game.setConfig}
          onStart={game.startGame}
          onLeave={() => {
            game.leaveRoom();
            router.push("/");
          }}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      <RoomGame />
    </>
  );
}

function RoomGame() {
  const router = useRouter();
  const game = useOnlineGame();
  const { room, needle, target } = game;
  const state = room?.game;
  const round = state?.round;

  // The countdown is driven by the server's deadline so every client agrees,
  // and so a reconnect mid-round picks up the right amount of time left.
  const secondsLeft = useMemo(() => {
    const at = room?.guessDeadlineAt;
    return at ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : null;
  }, [room?.guessDeadlineAt]);

  if (!state || !round) return <Loading />;

  const chooser = state.players.find((p) => p.id === round.chooserId);
  const chooserName = chooser?.name ?? "?";

  switch (state.phase) {
    // `pass` is walked through server-side; it only shows up in a race.
    case "pass":
    case "topic":
      if (game.isChooser && game.randomCard) {
        return (
          <TopicPickerView
            card={game.randomCard}
            chooserName={chooserName}
            onReroll={game.reroll}
            onConfirm={game.setCard}
          />
        );
      }
      return (
        <WaitingView
          card={null}
          chooserName={chooserName}
          roundNumber={round.number}
          note="กำลังเลือกหัวข้อ"
        />
      );

    case "subject":
      if (game.isChooser && round.card && target !== undefined) {
        return (
          <SubjectView
            card={round.card}
            target={target}
            chooserName={chooserName}
            onSubmit={game.submitSubject}
          />
        );
      }
      return (
        <WaitingView
          card={round.card}
          chooserName={chooserName}
          roundNumber={round.number}
          note="กำลังคิดคำตอบ"
        />
      );

    case "guess":
      return round.card ? (
        <GuessView
          card={round.card}
          subject={round.subject}
          guess={needle}
          discussionSeconds={secondsLeft}
          onChange={game.setGuess}
          onLock={game.lockGuess}
          canGuess={game.canGuess}
          canLock={game.canLock}
          waitingCount={game.waitingCount}
          watchingLabel={
            game.isChooser
              ? "คุณเป็นคนเลือก — รอคนอื่นเดา"
              : "ล็อกแล้ว รอคนอื่น"
          }
        />
      ) : null;

    case "reveal":
      return (
        <RevealView
          round={{ ...round, target: target ?? 50 } as Round}
          players={state.players}
          sharedDial={state.config.sharedDial}
          onNext={game.showScoreboard}
          canAdvance={game.isHost}
        />
      );

    case "scoreboard":
    case "gameover":
      return (
        <ScoreboardScreen
          state={state}
          onNext={game.nextRound}
          onRematch={game.rematch}
          onExit={() => {
            game.leaveRoom();
            router.push("/");
          }}
          canAdvance={game.isHost}
          exitLabel="ออกจากห้อง"
        />
      );

    default:
      return <Loading />;
  }
}

/** Shown when this browser has no seat in the room yet (share link, refresh). */
function JoinPrompt({ code }: { code: string }) {
  const router = useRouter();
  const { joinRoom, rejoin, status, error, clearError } = useOnlineGame();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // A stored identity for this room means we can slip back into the same seat.
  useEffect(() => {
    if (status === "connected") rejoin(code);
  }, [status, code, rejoin]);

  const submit = async () => {
    setBusy(true);
    clearError();
    await joinRoom(code, name.trim());
    setBusy(false);
  };

  return (
    <Screen
      footer={
        <>
          <Button
            disabled={!name.trim() || status !== "connected" || busy}
            onClick={submit}
          >
            เข้าห้อง {code}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/online")}>
            กลับ
          </Button>
        </>
      }
    >
      <div className="text-center">
        <p className="text-sm text-slate-400">เข้าร่วมห้อง</p>
        <p className="mt-2 font-mono text-5xl font-black tracking-[0.3em] text-amber-300">
          {code}
        </p>
      </div>

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
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) submit();
          }}
          maxLength={20}
          autoComplete="off"
          placeholder="ชื่อเล่น"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
    </Screen>
  );
}

function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center text-slate-500">
      กำลังโหลด…
    </main>
  );
}
