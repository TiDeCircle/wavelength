import type { TopicCard } from "@/types/game";
import topics from "./topics.json";

type DeckEntry = Omit<TopicCard, "custom">;

/**
 * The random deck. Add a JSON file beside this one and merge it here to
 * extend it — nothing else in the app hard-codes card data.
 */
export const DECK: TopicCard[] = (topics as DeckEntry[]).map((c) => ({
  ...c,
  custom: false,
}));

/**
 * Draw a card the game has not confirmed yet. Once the deck runs dry the used
 * list is ignored and cards start repeating.
 */
export function drawCard(usedCardIds: string[]): TopicCard {
  const pool = DECK.filter((c) => c.id && !usedCardIds.includes(c.id));
  const from = pool.length > 0 ? pool : DECK;
  return from[Math.floor(Math.random() * from.length)];
}
