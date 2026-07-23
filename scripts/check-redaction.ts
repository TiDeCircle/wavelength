/**
 * Standing check that the hidden target and other players' dials never leave
 * the server early.
 *
 * Runs the reducer through a whole round and asserts, at every phase, that the
 * serialized payload a client would receive contains no trace of the target
 * until the reveal, and no trace of another player's dial until the reveal.
 * Run it with:
 *
 *   npx tsx scripts/check-redaction.ts
 *
 * This is deliberately a plain script rather than a test-runner file: there is
 * no runner wired up yet (see PROJECT.md, Phase 1 backlog), and this check is
 * too important to wait for one.
 */

import assert from "node:assert/strict";
import { createGame, gameReducer } from "../src/lib/game/reducer";
import { publicRoom } from "../src/server/redact";
import type { Room } from "../src/server/rooms";
import type { GameState, Player, TopicCard } from "../src/types/game";

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

const config = { rounds: 3, discussionSeconds: null, sharedDial: false };

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
    config,
    game,
    randomCard: null,
    guessDeadlineAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  };
}

/** What actually goes over the wire for p2. */
function wire(game: GameState): string {
  return JSON.stringify(publicRoom(roomWith(game), "p2"));
}

function assertHidden(game: GameState, label: string): void {
  const payload = wire(game);
  assert.ok(
    !payload.includes(String(TARGET)),
    `${label}: target value ${TARGET} leaked into the broadcast payload`,
  );
  const parsed = JSON.parse(payload);
  assert.ok(
    !("target" in (parsed.game?.round ?? {})),
    `${label}: a "target" key is present in the broadcast payload`,
  );
  console.log(`  ok  ${label} — no target in payload`);
}

let game = createGame(players, config, TARGET);

assertHidden(game, "phase=pass");

game = gameReducer(game, { type: "CONFIRM_CHOOSER" });
assertHidden(game, "phase=topic");

game = gameReducer(game, { type: "SET_CARD", card });
assertHidden(game, "phase=subject");

game = gameReducer(game, { type: "SUBMIT_SUBJECT", subject: "Titanic" });
assertHidden(game, "phase=guess (subject is public)");

game = gameReducer(game, { type: "SET_GUESS", key: "p2", value: 80 });
game = gameReducer(game, { type: "SET_GUESS", key: "p3", value: 20 });
assertHidden(game, "phase=guess after dials moved");

// p2 must not be able to see p3's dial.
const p2View = JSON.parse(JSON.stringify(publicRoom(roomWith(game), "p2")));
assert.deepEqual(
  p2View.game.round.guesses,
  { p2: 80 },
  "phase=guess: another player's dial leaked into the payload",
);
console.log("  ok  phase=guess — a player sees only their own dial");

// From here both the target and every dial are public on purpose.
game = gameReducer(game, { type: "REVEAL" });
const revealed = JSON.parse(JSON.stringify(publicRoom(roomWith(game), "p2")));
assert.equal(
  revealed.game.round.target,
  TARGET,
  "phase=reveal: target should now be public",
);
assert.deepEqual(
  revealed.game.round.guesses,
  { p2: 80, p3: 20 },
  "phase=reveal: every dial should now be public",
);
console.log("  ok  phase=reveal — target and dials are published as expected");

console.log("\nredaction check passed");
