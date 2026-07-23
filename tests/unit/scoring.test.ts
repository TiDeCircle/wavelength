import { describe, expect, it } from "vitest";
import { scoreGuess } from "@/lib/game/scoring";

describe("scoreGuess", () => {
  it("gives 4 at the exact target", () => {
    expect(scoreGuess(50, 50)).toBe(4);
  });
});
