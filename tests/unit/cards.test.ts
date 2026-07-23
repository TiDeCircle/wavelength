import { describe, expect, it } from "vitest";
import { DECK, drawCard } from "@/lib/cards";

describe("DECK", () => {
  it("has at least 32 cards", () => {
    expect(DECK.length).toBeGreaterThanOrEqual(32);
  });

  it("gives every card a unique id and marks none custom", () => {
    const ids = DECK.map((c) => c.id);
    expect(new Set(ids).size).toBe(DECK.length);
    expect(DECK.every((c) => c.custom === false)).toBe(true);
  });

  it("fills in category, left and right on every card", () => {
    for (const card of DECK) {
      expect(card.category.length).toBeGreaterThan(0);
      expect(card.left.length).toBeGreaterThan(0);
      expect(card.right.length).toBeGreaterThan(0);
    }
  });
});

describe("drawCard", () => {
  it("skips cards already used this game", () => {
    const used = DECK.slice(0, DECK.length - 1).map((c) => c.id as string);
    const drawn = drawCard(used);
    expect(drawn.id).toBe(DECK[DECK.length - 1].id);
  });

  it("starts repeating once the deck is exhausted", () => {
    const used = DECK.map((c) => c.id as string);
    const drawn = drawCard(used);
    expect(drawn).toBeDefined();
    expect(DECK.some((c) => c.id === drawn.id)).toBe(true);
  });
});
