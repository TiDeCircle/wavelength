import type { SpectrumCard } from "@/types/game";
import thCore from "./th-core.json";

/**
 * The active deck. Add a JSON file next to this one and merge it here to
 * extend the deck — nothing else in the app hard-codes card data.
 */
export const DECK: SpectrumCard[] = thCore as SpectrumCard[];

export function getCard(id: string): SpectrumCard {
  const card = DECK.find((c) => c.id === id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

/**
 * Draw a card that has not been played yet this game. Once the deck runs out
 * the used list is ignored and cards start repeating.
 */
export function drawCardId(usedCardIds: string[]): string {
  const pool = DECK.filter((c) => !usedCardIds.includes(c.id));
  const from = pool.length > 0 ? pool : DECK;
  return from[Math.floor(Math.random() * from.length)].id;
}
