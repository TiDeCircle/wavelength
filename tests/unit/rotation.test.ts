import { describe, expect, it } from "vitest";
import { chooserForRound } from "@/lib/game/rotation";
import type { Player } from "@/types/game";

const players: Player[] = [
  { id: "p1", name: "Ake", score: 0 },
  { id: "p2", name: "Bee", score: 0 },
  { id: "p3", name: "Cat", score: 0 },
];

describe("chooserForRound", () => {
  it("walks the roster in order", () => {
    expect(chooserForRound(players, 1)).toBe("p1");
    expect(chooserForRound(players, 2)).toBe("p2");
    expect(chooserForRound(players, 3)).toBe("p3");
  });

  it("wraps around", () => {
    expect(chooserForRound(players, 4)).toBe("p1");
    expect(chooserForRound(players, 7)).toBe("p1");
  });

  it("throws when given an empty player list", () => {
    expect(() => chooserForRound([], 1)).toThrow(
      "chooserForRound: cannot choose from an empty player list",
    );
  });
});
