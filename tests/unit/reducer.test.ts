import { describe, expect, it } from "vitest";
import { createGame, gameReducer } from "@/lib/game/reducer";
import { SHARED_DIAL_KEY } from "@/types/game";
import type { GameConfig, GameState, Player, TopicCard } from "@/types/game";

const players: Player[] = [
  { id: "p1", name: "Ake", score: 0 },
  { id: "p2", name: "Bee", score: 0 },
  { id: "p3", name: "Cat", score: 0 },
];

const online: GameConfig = { rounds: 3, discussionSeconds: null, sharedDial: false };
const local: GameConfig = { ...online, sharedDial: true };

const card: TopicCard = {
  id: "t-001",
  category: "Movie",
  left: "Forgotten",
  right: "Iconic",
  custom: false,
};

/** Walk a fresh game to the guess phase. */
function toGuess(config: GameConfig, target = 50): GameState {
  let s = createGame(players, config, target);
  s = gameReducer(s, { type: "CONFIRM_CHOOSER" });
  s = gameReducer(s, { type: "SET_CARD", card });
  return gameReducer(s, { type: "SUBMIT_SUBJECT", subject: "Titanic" });
}

describe("createGame", () => {
  it("opens on the pass screen with round 1 and no card", () => {
    const s = createGame(players, online, 42);
    expect(s.phase).toBe("pass");
    expect(s.round?.number).toBe(1);
    expect(s.round?.chooserId).toBe("p1");
    expect(s.round?.card).toBeNull();
    expect(s.round?.target).toBe(42);
    expect(s.usedCardIds).toEqual([]);
  });
});

describe("phase transitions", () => {
  it("walks pass -> topic -> subject -> guess", () => {
    let s = createGame(players, online, 50);
    s = gameReducer(s, { type: "CONFIRM_CHOOSER" });
    expect(s.phase).toBe("topic");
    s = gameReducer(s, { type: "SET_CARD", card });
    expect(s.phase).toBe("subject");
    expect(s.usedCardIds).toEqual(["t-001"]);
    s = gameReducer(s, { type: "SUBMIT_SUBJECT", subject: "Titanic" });
    expect(s.phase).toBe("guess");
    expect(s.round?.subject).toBe("Titanic");
  });

  it("does not record a used id for a custom card", () => {
    let s = createGame(players, online, 50);
    s = gameReducer(s, { type: "CONFIRM_CHOOSER" });
    s = gameReducer(s, {
      type: "SET_CARD",
      card: { ...card, id: null, custom: true },
    });
    expect(s.usedCardIds).toEqual([]);
  });

  it("ignores an empty subject", () => {
    let s = createGame(players, online, 50);
    s = gameReducer(s, { type: "CONFIRM_CHOOSER" });
    s = gameReducer(s, { type: "SET_CARD", card });
    s = gameReducer(s, { type: "SUBMIT_SUBJECT", subject: "   " });
    expect(s.phase).toBe("subject");
  });

  it("rejects actions from the wrong phase", () => {
    const s = createGame(players, online, 50);
    expect(gameReducer(s, { type: "SUBMIT_SUBJECT", subject: "x" })).toBe(s);
  });
});

describe("guessing", () => {
  it("keeps one guess per key and clamps to the dial", () => {
    let s = toGuess(online);
    s = gameReducer(s, { type: "SET_GUESS", key: "p2", value: 120 });
    s = gameReducer(s, { type: "SET_GUESS", key: "p3", value: -5 });
    expect(s.round?.guesses).toEqual({ p2: 100, p3: 0 });
  });

  it("will not move a guess that is already locked", () => {
    let s = toGuess(online);
    s = gameReducer(s, { type: "SET_GUESS", key: "p2", value: 60 });
    s = gameReducer(s, { type: "LOCK_GUESS", key: "p2" });
    s = gameReducer(s, { type: "SET_GUESS", key: "p2", value: 10 });
    expect(s.round?.guesses.p2).toBe(60);
  });
});

describe("reveal", () => {
  it("defaults an untouched dial to 50 and scores everyone", () => {
    let s = toGuess(online, 50);
    s = gameReducer(s, { type: "SET_GUESS", key: "p2", value: 50 });
    s = gameReducer(s, { type: "REVEAL" });
    expect(s.phase).toBe("reveal");
    // p2 nailed it; p3 never moved so counts as 50, also a bullseye
    expect(s.round?.scores).toEqual({ p2: 4, p3: 4, p1: 4 });
    expect(s.players.find((p) => p.id === "p2")?.score).toBe(4);
    expect(s.players.find((p) => p.id === "p1")?.score).toBe(4);
  });

  it("adds to the group score in shared mode", () => {
    let s = toGuess(local, 50);
    s = gameReducer(s, { type: "SET_GUESS", key: SHARED_DIAL_KEY, value: 46 });
    s = gameReducer(s, { type: "REVEAL" });
    expect(s.groupScore).toBe(3);
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });
});

describe("round flow", () => {
  it("ends the game after the configured rounds", () => {
    let s = toGuess({ ...online, rounds: 1 });
    s = gameReducer(s, { type: "REVEAL" });
    s = gameReducer(s, { type: "SHOW_SCOREBOARD" });
    expect(s.phase).toBe("gameover");
  });

  it("deals the next round to the next chooser", () => {
    let s = toGuess(online);
    s = gameReducer(s, { type: "REVEAL" });
    s = gameReducer(s, { type: "SHOW_SCOREBOARD" });
    expect(s.phase).toBe("scoreboard");
    s = gameReducer(s, { type: "NEXT_ROUND", target: 30 });
    expect(s.phase).toBe("pass");
    expect(s.round?.number).toBe(2);
    expect(s.round?.chooserId).toBe("p2");
    expect(s.round?.card).toBeNull();
    expect(s.round?.target).toBe(30);
  });

  it("redeals to the next chooser on abort without scoring", () => {
    let s = toGuess(online);
    s = gameReducer(s, { type: "ABORT_ROUND", target: 20 });
    expect(s.phase).toBe("pass");
    expect(s.round?.number).toBe(1);
    expect(s.round?.chooserId).toBe("p2");
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });

  it("resets scores on rematch", () => {
    let s = toGuess(online);
    s = gameReducer(s, { type: "REVEAL" });
    s = gameReducer(s, { type: "REMATCH", target: 60 });
    expect(s.phase).toBe("pass");
    expect(s.round?.number).toBe(1);
    expect(s.groupScore).toBe(0);
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });
});
