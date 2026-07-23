import { describe, expect, it } from "vitest";
import { scoreGuess, scoreRound, bandSegments } from "@/lib/game/scoring";
import { SHARED_DIAL_KEY } from "@/types/game";

describe("scoreGuess", () => {
  it("scores by distance band", () => {
    expect(scoreGuess(50, 50)).toBe(4);
    expect(scoreGuess(52.5, 50)).toBe(4);
    expect(scoreGuess(52.6, 50)).toBe(3);
    expect(scoreGuess(57.5, 50)).toBe(3);
    expect(scoreGuess(57.6, 50)).toBe(2);
    expect(scoreGuess(62.5, 50)).toBe(2);
    expect(scoreGuess(62.6, 50)).toBe(0);
  });

  it("is symmetric around the target", () => {
    expect(scoreGuess(45, 50)).toBe(scoreGuess(55, 50));
  });
});

describe("bandSegments", () => {
  it("clamps to the dial at the edges", () => {
    const segments = bandSegments(13);
    expect(segments[0].from).toBe(0.5);
    expect(segments.every((s) => s.to > s.from)).toBe(true);
  });
});

describe("scoreRound", () => {
  it("scores the single dial in shared mode", () => {
    const scores = scoreRound(
      { [SHARED_DIAL_KEY]: 48 },
      50,
      "p1",
      true,
    );
    expect(scores).toEqual({ [SHARED_DIAL_KEY]: 4 });
  });

  it("scores each guesser and gives the chooser their average", () => {
    // p2 is 4 points, p3 is 2 points -> chooser gets round((4 + 2) / 2) = 3
    const scores = scoreRound(
      { p2: 50, p3: 60 },
      50,
      "p1",
      false,
    );
    expect(scores).toEqual({ p2: 4, p3: 2, p1: 3 });
  });

  it("rounds the chooser's average half up", () => {
    // 4 and 3 -> 3.5 -> 4
    const scores = scoreRound({ p2: 50, p3: 55 }, 50, "p1", false);
    expect(scores.p1).toBe(4);
  });

  it("gives the chooser nothing when nobody guessed", () => {
    expect(scoreRound({}, 50, "p1", false)).toEqual({ p1: 0 });
  });
});
