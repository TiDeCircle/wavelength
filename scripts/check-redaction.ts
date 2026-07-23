/**
 * Standing check that the hidden target never leaves the server early.
 *
 * Runs the reducer through a whole round and asserts, at every phase, that the
 * serialized payload a client would receive contains no trace of the target
 * until the reveal. Run it with:
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
import { TEAM_IDS, TEAM_NAMES } from "../src/server/rooms";
import type { GameState, Player, Team } from "../src/types/game";

const players: Player[] = [
  { id: "p1", name: "Ake", teamId: TEAM_IDS[0] },
  { id: "p2", name: "Bee", teamId: TEAM_IDS[1] },
  { id: "p3", name: "Cat", teamId: TEAM_IDS[0] },
  { id: "p4", name: "Dao", teamId: TEAM_IDS[1] },
];

const teams: Team[] = TEAM_IDS.map((id, i) => ({
  id,
  name: TEAM_NAMES[i],
  score: 0,
  psychicIndex: 0,
}));

const config = {
  targetScore: 10,
  discussionSeconds: null,
  leftRightBet: true,
  coopRounds: 8,
};

const TARGET = 37.4;

function roomWith(game: GameState): Room {
  return {
    code: "TEST",
    hostId: "p1",
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      connected: true,
      socketId: `s-${p.id}`,
      disconnectedAt: null,
    })),
    config,
    game,
    guessDeadlineAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  };
}

/** What actually goes over the wire. */
function wire(game: GameState): string {
  return JSON.stringify(publicRoom(roomWith(game)));
}

function assertHidden(game: GameState, label: string): void {
  const payload = wire(game);
  assert.ok(
    !payload.includes(String(TARGET)),
    `${label}: target value ${TARGET} leaked into the broadcast payload`,
  );
  const round = JSON.parse(payload).room ?? JSON.parse(payload);
  assert.ok(
    !("target" in (round.game?.round ?? {})),
    `${label}: a "target" key is present in the broadcast payload`,
  );
  console.log(`  ok  ${label} — no target in payload`);
}

let game = createGame(players, teams, config, {
  cardId: "th-001",
  target: TARGET,
});

assertHidden(game, "phase=pass");

game = gameReducer(game, { type: "CONFIRM_PSYCHIC" });
assertHidden(game, "phase=psychic");

game = gameReducer(game, { type: "SUBMIT_CLUE", clue: "ทดสอบ" });
assertHidden(game, "phase=guess (clue is public)");

game = gameReducer(game, { type: "SET_GUESS", value: 42 });
assertHidden(game, "phase=guess after needle moved");

game = gameReducer(game, { type: "LOCK_GUESS" });
assertHidden(game, "phase=bet");

game = gameReducer(game, { type: "SET_BET", side: "left" });
assertHidden(game, "phase=bet after side chosen");

// From here the target is public on purpose.
game = gameReducer(game, { type: "LOCK_BET" });
const revealed = JSON.parse(wire(game));
assert.equal(
  revealed.game.round.target,
  TARGET,
  "phase=reveal: target should now be public",
);
console.log("  ok  phase=reveal — target is published as expected");

console.log("\nredaction check passed");
