"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalGame } from "@/lib/store/localGame";
import { SHARED_DIAL_KEY } from "@/types/game";
import { PassDeviceScreen } from "@/components/game/PassDeviceScreen";
import { TopicPickerView } from "@/components/game/TopicPickerView";
import { SubjectView } from "@/components/game/SubjectView";
import { GuessView } from "@/components/game/GuessView";
import { RevealView } from "@/components/game/RevealView";
import { ScoreboardScreen } from "@/components/game/ScoreboardScreen";

/**
 * Phase router for the local game.
 *
 * Each phase mounts exactly one view. That is deliberate: the guess screen
 * simply never renders a component that knows the target, rather than
 * rendering it hidden.
 */
export default function LocalPlayPage() {
  const router = useRouter();
  const game = useLocalGame();
  const { state, ready } = game;

  useEffect(() => {
    if (ready && !state) router.replace("/local");
  }, [ready, state, router]);

  if (!ready || !state || !state.round) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-slate-500">
        กำลังโหลด…
      </main>
    );
  }

  const round = state.round;
  const chooser = state.players.find((p) => p.id === round.chooserId);
  const chooserName = chooser?.name ?? "?";

  switch (state.phase) {
    case "pass":
      return (
        <PassDeviceScreen
          chooserName={chooserName}
          roundNumber={round.number}
          onConfirm={game.confirmChooser}
        />
      );

    case "topic":
      return (
        <TopicPickerView
          card={game.randomCard}
          chooserName={chooserName}
          onReroll={game.reroll}
          onConfirm={game.setCard}
        />
      );

    case "subject":
      return round.card ? (
        <SubjectView
          card={round.card}
          target={round.target}
          chooserName={chooserName}
          onSubmit={game.submitSubject}
        />
      ) : null;

    case "guess":
      return round.card ? (
        <GuessView
          card={round.card}
          subject={round.subject}
          guess={round.guesses[SHARED_DIAL_KEY] ?? 50}
          discussionSeconds={state.config.discussionSeconds}
          onChange={game.setGuess}
          onLock={game.lockGuess}
        />
      ) : null;

    case "reveal":
      return (
        <RevealView
          round={round}
          players={state.players}
          sharedDial={state.config.sharedDial}
          onNext={game.showScoreboard}
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
            game.clear();
            router.push("/");
          }}
        />
      );
  }
}
