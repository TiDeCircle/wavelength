"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCard } from "@/lib/cards";
import { useLocalGame } from "@/lib/store/localGame";
import { teamColor } from "@/components/game/ScoreBoard";
import { PassDeviceScreen } from "@/components/game/PassDeviceScreen";
import { PsychicView } from "@/components/game/PsychicView";
import { GuessView } from "@/components/game/GuessView";
import { BetView } from "@/components/game/BetView";
import { RevealView } from "@/components/game/RevealView";
import { ScoreboardScreen } from "@/components/game/ScoreboardScreen";

/**
 * Phase router for the local game.
 *
 * Each phase mounts exactly one view. That is deliberate: the guess and bet
 * screens simply never render a component that knows the target, rather than
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
  const card = getCard(round.cardId);
  const psychic = state.players.find((p) => p.id === round.psychicId);
  const guessTeam = state.teams.find((t) => t.id === round.guessTeamId);
  const betTeam = state.teams.find((t) => t.id === round.betTeamId);

  switch (state.phase) {
    case "pass":
      return (
        <PassDeviceScreen
          psychicName={psychic?.name ?? "?"}
          teamName={guessTeam?.name ?? ""}
          teamColor={teamColor(state.teams, round.guessTeamId)}
          roundNumber={round.number}
          onConfirm={game.confirmPsychic}
        />
      );

    case "psychic":
      return (
        <PsychicView
          card={card}
          target={round.target}
          psychicName={psychic?.name ?? "?"}
          onSubmit={game.submitClue}
        />
      );

    case "guess":
      return (
        <GuessView
          card={card}
          clue={round.clue}
          guess={round.guess}
          teamName={guessTeam?.name ?? ""}
          teamColor={teamColor(state.teams, round.guessTeamId)}
          discussionSeconds={state.config.discussionSeconds}
          onChange={game.setGuess}
          onLock={game.lockGuess}
        />
      );

    case "bet":
      return (
        <BetView
          card={card}
          guess={round.guess}
          bet={round.bet}
          teamName={betTeam?.name ?? ""}
          teamColor={teamColor(state.teams, round.betTeamId)}
          onSelect={game.setBet}
          onLock={game.lockBet}
        />
      );

    case "reveal":
      return (
        <RevealView
          card={card}
          round={round}
          teams={state.teams}
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
