import { describe, expect, it } from "vitest";
import { publicRoom } from "@/server/redact";
import { createGame, gameReducer } from "@/lib/game/reducer";
import type { Room } from "@/server/rooms";
import type { GameState, Player, TopicCard } from "@/types/game";

const players: Player[] = [
  { id: "p1", name: "Ake", score: 0 },
  { id: "p2", name: "Bee", score: 0 },
  { id: "p3", name: "Cat", score: 0 },
];

const card: TopicCard = {
  id: "t-001",
  category: "Movie",
  left: "Forgotten",
  right: "Iconic",
  custom: false,
};

const TARGET = 37.4;

function roomWith(game: GameState): Room {
  return {
    code: "TEST",
    hostId: "p1",
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: true,
      socketId: `s-${p.id}`,
      disconnectedAt: null,
    })),
    config: { rounds: 3, discussionSeconds: null, sharedDial: false },
    game,
    randomCard: null,
    guessDeadlineAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  };
}

function atGuess(): GameState {
  let s = createGame(players, { rounds: 3, discussionSeconds: null, sharedDial: false }, TARGET);
  s = gameReducer(s, { type: "CONFIRM_CHOOSER" });
  s = gameReducer(s, { type: "SET_CARD", card });
  s = gameReducer(s, { type: "SUBMIT_SUBJECT", subject: "Titanic" });
  s = gameReducer(s, { type: "SET_GUESS", key: "p2", value: 80 });
  return gameReducer(s, { type: "SET_GUESS", key: "p3", value: 20 });
}

describe("publicRoom", () => {
  it("keeps the target out of the payload before reveal", () => {
    const wire = JSON.stringify(publicRoom(roomWith(atGuess()), "p2"));
    expect(wire).not.toContain(String(TARGET));
    expect(JSON.parse(wire).game.round.target).toBeUndefined();
  });

  it("shows a player only their own dial while guessing", () => {
    const view = publicRoom(roomWith(atGuess()), "p2");
    expect(view.game?.round?.guesses).toEqual({ p2: 80 });
  });

  it("gives the chooser no dials at all while guessing", () => {
    const view = publicRoom(roomWith(atGuess()), "p1");
    expect(view.game?.round?.guesses).toEqual({});
  });

  it("still reports who has locked", () => {
    const state = gameReducer(atGuess(), { type: "LOCK_GUESS", key: "p3" });
    const view = publicRoom(roomWith(state), "p2");
    expect(view.game?.round?.locked.p3).toBe(true);
  });

  it("publishes the target and every dial at reveal", () => {
    const state = gameReducer(atGuess(), { type: "REVEAL" });
    const view = publicRoom(roomWith(state), "p2");
    expect(view.game?.round?.target).toBe(TARGET);
    expect(view.game?.round?.guesses).toEqual({ p2: 80, p3: 20 });
  });
});
