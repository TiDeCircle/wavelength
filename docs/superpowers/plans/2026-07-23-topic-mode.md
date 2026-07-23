# Topic Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the team-based Wavelength rules with a rotating "chooser" who picks a topic category (random or custom) and names something inside it, while everyone else guesses where it sits on the spectrum.

**Architecture:** The pure game layer (`src/types/game.ts`, `src/lib/game/*`, `src/lib/cards/*`) is rewritten from scratch — teams are threaded through all of it. The dial, geometry, scoring bands, socket transport, room store, redaction seam and deploy config are kept as-is. Local play shares one dial and one group score; online play gives each player their own hidden dial and an individual leaderboard.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Socket.io 4, Zod 4, Vitest (added by Task 1).

**Spec:** [docs/superpowers/specs/2026-07-23-topic-mode-redesign-design.md](../specs/2026-07-23-topic-mode-redesign-design.md)

## Global Constraints

- Node >= 20.9.0. Never run `npm install --production` — `next build` needs devDependencies.
- On the deploy host, every npm command needs `export NODE_OPTIONS=--dns-result-order=ipv4first` (IPv6 is broken there) and `. ~/.nvm/nvm.sh` first.
- Scoring bands are unchanged: `d <= 2.5` → 4, `d <= 7.5` → 3, `d <= 12.5` → 2, else 0.
- Targets stay inside `[12.5, 87.5]` so the band never overflows the dial.
- `src/server/redact.ts` remains the single place deciding what leaves the server.
- The dial renders `0` at `left` and `100` at `right`.
- `SHARED_DIAL_KEY = "__shared__"` is the guess key for local (shared-dial) play.
- All user-facing copy is Thai; code, comments and commit messages are English.
- Commit after every task. Never commit a red build.

## Build-breakage window

Tasks 2–4 rewrite types that the whole app imports, so `npm run build` will fail from Task 2 until Task 10 finishes. That is expected. During that window the test cycle is `npx vitest run <file>`, which type-checks and runs only the pure modules under test. Task 10 is the task that restores a green build; do not skip ahead past it.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `vitest.config.ts` | Test runner config |
| `src/lib/cards/topics.json` | 32-card deck: category + spectrum |
| `src/components/game/TopicPickerView.tsx` | Chooser picks random or custom card |
| `src/components/game/SubjectView.tsx` | Chooser sees target, types the subject |
| `tests/unit/scoring.test.ts` | Band + round scoring |
| `tests/unit/rotation.test.ts` | Chooser rotation |
| `tests/unit/cards.test.ts` | Deck draw + no-repeat |
| `tests/unit/reducer.test.ts` | Phase machine |
| `tests/unit/redact.test.ts` | Target and foreign guesses stay server-side |

**Rewrite**
| File | Responsibility |
|---|---|
| `src/types/game.ts` | TopicCard, Player, Round, GameConfig, Phase, GameState |
| `src/lib/game/scoring.ts` | Bands (unchanged) + `scoreRound` |
| `src/lib/game/rotation.ts` | `chooserForRound` |
| `src/lib/game/reducer.ts` | Whole phase machine |
| `src/lib/game/setup.ts` | Names → players, no teams |
| `src/lib/cards/index.ts` | Deck loader + `drawCard` |

**Modify**
`src/components/dial/Dial.tsx`, `src/components/game/{GuessView,RevealView,ScoreBoard,ScoreboardScreen,WaitingView,PassDeviceScreen}.tsx`, `src/lib/store/{localGame,onlineGame}.tsx`, `src/app/local/{page,play/page}.tsx`, `src/app/online/[code]/page.tsx`, `src/components/lobby/Lobby.tsx`, `src/lib/socket/events.ts`, `src/server/{rooms,handlers,redact}.ts`, `src/types/online.ts`, `scripts/check-redaction.ts`, `DESIGN.md`, `PROJECT.md`, `README.md`

**Delete**
`src/components/game/{BetView,PsychicView}.tsx`, `src/components/lobby/TeamPicker.tsx`, `src/lib/cards/th-core.json`

---

## Task 1: Test runner

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` runs Vitest once; `npx vitest run <path>` runs a single file.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Create the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Add the script**

In `package.json` `"scripts"`, add after `"typecheck"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `tests/unit/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreGuess } from "@/lib/game/scoring";

describe("scoreGuess", () => {
  it("gives 4 at the exact target", () => {
    expect(scoreGuess(50, 50)).toBe(4);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npx vitest run tests/unit/scoring.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/unit/scoring.test.ts
git commit -m "Add Vitest so the rewrite has a test cycle"
```

---

## Task 2: Types and deck

**Files:**
- Rewrite: `src/types/game.ts`
- Create: `src/lib/cards/topics.json`
- Rewrite: `src/lib/cards/index.ts`
- Create: `tests/unit/cards.test.ts`
- Delete: `src/lib/cards/th-core.json`

**Interfaces:**
- Produces: `TopicCard`, `Player`, `Round`, `GameConfig`, `Phase`, `GameState`, `SHARED_DIAL_KEY` from `@/types/game`; `DECK`, `drawCard(usedCardIds: string[]): TopicCard` from `@/lib/cards`.

- [ ] **Step 1: Write the failing deck test**

Create `tests/unit/cards.test.ts`:

```ts
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
    expect(drawCard(used).id).toBe(DECK[DECK.length - 1].id);
  });

  it("starts repeating once the deck is exhausted", () => {
    const used = DECK.map((c) => c.id as string);
    expect(DECK.some((c) => c.id === drawCard(used).id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/cards.test.ts`
Expected: FAIL — cannot resolve `drawCard` from `@/lib/cards`.

- [ ] **Step 3: Rewrite the types**

Replace all of `src/types/game.ts`:

```ts
/**
 * Shared game types.
 *
 * Nothing here is specific to local or online play — the server runs the same
 * reducer over the same state that a React context does locally.
 */

/** Key that shared-dial (local) play stores its single guess under. */
export const SHARED_DIAL_KEY = "__shared__";

/** A category plus the spectrum its subjects are placed on. */
export interface TopicCard {
  /** Deck id, used to avoid repeats. `null` when the chooser wrote it. */
  id: string | null;
  /** The bucket subjects must come from, e.g. "Movie". */
  category: string;
  /** Sits at dial 0. */
  left: string;
  /** Sits at dial 100. */
  right: string;
  custom: boolean;
}

export interface Player {
  id: string;
  name: string;
  /** Individual score. Unused while `config.sharedDial` is on. */
  score: number;
}

export interface Round {
  number: number;
  /** Player who picks the card and names the subject this round. */
  chooserId: string;
  /** null until the chooser confirms a card. */
  card: TopicCard | null;
  /**
   * Hidden dial position, 0-100.
   *
   * SECURITY: never serialize this into a payload broadcast to a whole room
   * before the reveal phase. See `src/server/redact.ts`.
   */
  target: number;
  /** What the chooser named. "" until submitted. */
  subject: string;
  /** Keyed by player id online, by `SHARED_DIAL_KEY` locally. */
  guesses: Record<string, number>;
  /** Same keys as `guesses`. */
  locked: Record<string, boolean>;
  /** Points earned this round, same keys plus the chooser. null until reveal. */
  scores: Record<string, number> | null;
}

export type Phase =
  /** Local only: "hand the device to <chooser>". */
  | "pass"
  /** Chooser picks random or custom card. */
  | "topic"
  /** Chooser sees the target and names a subject. */
  | "subject"
  /** Everyone else places the dial. */
  | "guess"
  /** Target and every dial revealed together. */
  | "reveal"
  /** Running totals between rounds. */
  | "scoreboard"
  /** All configured rounds played. */
  | "gameover";

export interface GameConfig {
  /** Total rounds in the game. */
  rounds: number;
  /** Seconds to guess, or null for no clock. */
  discussionSeconds: number | null;
  /** One dial and one group score, for a device passed around a table. */
  sharedDial: boolean;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  phase: Phase;
  round: Round | null;
  /** Cumulative score when `config.sharedDial` is on. */
  groupScore: number;
  /** Deck ids already confirmed this game. Rerolls do not count. */
  usedCardIds: string[];
}
```

- [ ] **Step 4: Create the deck**

Create `src/lib/cards/topics.json`:

```json
[
  { "id": "t-001", "category": "Movie", "left": "Forgotten", "right": "Iconic" },
  { "id": "t-002", "category": "Movie", "left": "ดูคนเดียว", "right": "ดูกับครอบครัว" },
  { "id": "t-003", "category": "อาหาร", "left": "จืด", "right": "จัดจ้าน" },
  { "id": "t-004", "category": "อาหาร", "left": "ถูก", "right": "แพง" },
  { "id": "t-005", "category": "อาหาร", "left": "กินเล่น", "right": "กินจริงจัง" },
  { "id": "t-006", "category": "สัตว์", "left": "น่ากลัว", "right": "น่ากอด" },
  { "id": "t-007", "category": "สัตว์", "left": "เลี้ยงง่าย", "right": "เลี้ยงยาก" },
  { "id": "t-008", "category": "เพลง", "left": "เศร้า", "right": "สนุก" },
  { "id": "t-009", "category": "เพลง", "left": "ฟังคนเดียว", "right": "ร้องกับเพื่อน" },
  { "id": "t-010", "category": "กีฬา", "left": "ใช้แรง", "right": "ใช้สมอง" },
  { "id": "t-011", "category": "กีฬา", "left": "ดูสนุก", "right": "เล่นสนุก" },
  { "id": "t-012", "category": "อาชีพ", "left": "งานสบาย", "right": "งานหนัก" },
  { "id": "t-013", "category": "อาชีพ", "left": "เงินน้อย", "right": "เงินเยอะ" },
  { "id": "t-014", "category": "แอป", "left": "เสียเวลา", "right": "มีประโยชน์" },
  { "id": "t-015", "category": "แอป", "left": "ใช้ทุกวัน", "right": "นาน ๆ เปิดที" },
  { "id": "t-016", "category": "สถานที่ในไทย", "left": "เงียบ", "right": "คนเยอะ" },
  { "id": "t-017", "category": "ที่เที่ยว", "left": "ไปง่าย", "right": "ไปยาก" },
  { "id": "t-018", "category": "ของหวาน", "left": "เบา", "right": "หนัก" },
  { "id": "t-019", "category": "เครื่องดื่ม", "left": "ดื่มตอนเช้า", "right": "ดื่มตอนดึก" },
  { "id": "t-020", "category": "ผลไม้", "left": "เด็กชอบ", "right": "ผู้ใหญ่ชอบ" },
  { "id": "t-021", "category": "วิชาเรียน", "left": "ง่าย", "right": "ยาก" },
  { "id": "t-022", "category": "วิชาเรียน", "left": "ไม่ได้ใช้จริง", "right": "ใช้จริงตลอด" },
  { "id": "t-023", "category": "ตัวละครการ์ตูน", "left": "น่ารำคาญ", "right": "น่าเอาใจช่วย" },
  { "id": "t-024", "category": "ซีรีส์", "left": "ดูรวดเดียวจบ", "right": "ดูยาว ๆ" },
  { "id": "t-025", "category": "เกม", "left": "เล่นคนเดียว", "right": "เล่นกับเพื่อน" },
  { "id": "t-026", "category": "ยานพาหนะ", "left": "ช้า", "right": "เร็ว" },
  { "id": "t-027", "category": "แบรนด์", "left": "เชย", "right": "เท่" },
  { "id": "t-028", "category": "งานอดิเรก", "left": "ใช้เงินน้อย", "right": "ใช้เงินเยอะ" },
  { "id": "t-029", "category": "เทศกาล", "left": "เงียบ", "right": "อึกทึก" },
  { "id": "t-030", "category": "ของใช้ในบ้าน", "left": "ไม่จำเป็น", "right": "ขาดไม่ได้" },
  { "id": "t-031", "category": "ประเทศ", "left": "อยากไปเที่ยว", "right": "อยากไปอยู่" },
  { "id": "t-032", "category": "ของกิน", "left": "คนไทยชอบ", "right": "ฝรั่งชอบ" }
]
```

> `t-023` deliberately avoids "ตัวร้าย ↔ ตัวดี" — that reads as a binary, not a spectrum, which the spec's card rules forbid.

- [ ] **Step 5: Rewrite the deck loader**

Replace all of `src/lib/cards/index.ts`:

```ts
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
```

- [ ] **Step 6: Delete the old deck**

```bash
git rm src/lib/cards/th-core.json
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/unit/cards.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add src/types/game.ts src/lib/cards/ tests/unit/cards.test.ts
git commit -m "Replace opposite-pair cards with category + spectrum topics"
```

---

## Task 3: Scoring and rotation

**Files:**
- Rewrite: `src/lib/game/scoring.ts`
- Rewrite: `src/lib/game/rotation.ts`
- Modify: `tests/unit/scoring.test.ts`
- Create: `tests/unit/rotation.test.ts`

**Interfaces:**
- Consumes: `SHARED_DIAL_KEY`, `Player` from Task 2.
- Produces: `scoreGuess(guess, target): number`, `bandSegments(target)`, `BAND_HALF_WIDTH`, `scoreRound(guesses, target, chooserId, sharedDial): Record<string, number>` from `@/lib/game/scoring`; `chooserForRound(players, roundNumber): string` from `@/lib/game/rotation`.

- [ ] **Step 1: Write the failing scoring test**

Replace all of `tests/unit/scoring.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/scoring.test.ts`
Expected: FAIL — `scoreRound` is not exported.

- [ ] **Step 3: Rewrite scoring**

Replace all of `src/lib/game/scoring.ts`:

```ts
import { SHARED_DIAL_KEY } from "@/types/game";

/**
 * Scoring band half-widths, from the target outwards.
 *
 *      2  |  3  |  4  |  3  |  2
 *   -12.5 -7.5  -2.5  +2.5  +7.5  +12.5
 *                  ^ target
 */
export const BAND_EDGES = [2.5, 7.5, 12.5] as const;
export const BAND_POINTS = [4, 3, 2] as const;

/** Total half-width of the band, used to keep targets away from the rim. */
export const BAND_HALF_WIDTH = BAND_EDGES[BAND_EDGES.length - 1];

/** Points for one dial: 4, 3, 2 or 0. */
export function scoreGuess(guess: number, target: number): number {
  const d = Math.abs(guess - target);
  for (let i = 0; i < BAND_EDGES.length; i++) {
    if (d <= BAND_EDGES[i]) return BAND_POINTS[i];
  }
  return 0;
}

/**
 * Points for everyone this round.
 *
 * Shared dial: one entry, the group's. Individual dials: one entry per
 * guesser plus the chooser, who earns the rounded average of what their
 * subject got everyone else — a subject nobody can place scores nothing.
 */
export function scoreRound(
  guesses: Record<string, number>,
  target: number,
  chooserId: string,
  sharedDial: boolean,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(guesses)) {
    scores[key] = scoreGuess(value, target);
  }
  if (sharedDial) return scores;

  const earned = Object.values(scores);
  const average =
    earned.length === 0
      ? 0
      : Math.round(earned.reduce((sum, n) => sum + n, 0) / earned.length);
  scores[chooserId] = average;
  return scores;
}

/**
 * The five scoring wedges as dial ranges, clamped to the dial. Used only for
 * drawing the band.
 */
export function bandSegments(
  target: number,
): { from: number; to: number; points: number }[] {
  const edges = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
  const points = [2, 3, 4, 3, 2];
  return points
    .map((p, i) => ({
      from: Math.max(0, target + edges[i]),
      to: Math.min(100, target + edges[i + 1]),
      points: p,
    }))
    .filter((s) => s.to > s.from);
}

/** Re-exported so callers do not need two imports to key a shared guess. */
export { SHARED_DIAL_KEY };
```

- [ ] **Step 4: Write the failing rotation test**

Create `tests/unit/rotation.test.ts`:

```ts
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
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/unit/rotation.test.ts`
Expected: FAIL — `chooserForRound` is not exported.

- [ ] **Step 6: Rewrite rotation**

Replace all of `src/lib/game/rotation.ts`:

```ts
import type { Player } from "@/types/game";

/**
 * Who chooses this round.
 *
 * Straight round-robin over join order — with no teams there is nothing to
 * alternate between.
 *
 * @param roundNumber 1-based.
 */
export function chooserForRound(players: Player[], roundNumber: number): string {
  return players[(roundNumber - 1) % players.length].id;
}
```

- [ ] **Step 7: Run both tests**

Run: `npx vitest run tests/unit/scoring.test.ts tests/unit/rotation.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/scoring.ts src/lib/game/rotation.ts tests/unit/
git commit -m "Score rounds per player and rotate the chooser without teams"
```

---

## Task 4: Reducer

**Files:**
- Rewrite: `src/lib/game/reducer.ts`
- Rewrite: `src/lib/game/setup.ts`
- Create: `tests/unit/reducer.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 and 3, plus `randomTarget()` from `@/lib/game/target` (unchanged).
- Produces: `createGame(players, config, target): GameState`, `gameReducer(state, action): GameState`, `GameAction`, `DEFAULT_CONFIG` from `@/lib/game/reducer`; `buildPlayers(names: string[]): Player[]`, `MIN_PLAYERS` from `@/lib/game/setup`.

- [ ] **Step 1: Write the failing reducer test**

Create `tests/unit/reducer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/reducer.test.ts`
Expected: FAIL — `createGame` signature does not match / actions unknown.

- [ ] **Step 3: Rewrite the reducer**

Replace all of `src/lib/game/reducer.ts`:

```ts
import type {
  GameConfig,
  GameState,
  Player,
  Round,
  TopicCard,
} from "@/types/game";
import { SHARED_DIAL_KEY } from "@/types/game";
import { chooserForRound } from "./rotation";
import { scoreRound } from "./scoring";

/**
 * The whole game as one pure reducer.
 *
 * Local play drives it from a React context; the server runs this exact
 * function and broadcasts the result minus the target. Keep it free of React,
 * timers, randomness and I/O — each round's target arrives in the action.
 */

export type GameAction =
  /** Pass screen: the named chooser has the device. Local only. */
  | { type: "CONFIRM_CHOOSER" }
  | { type: "SET_CARD"; card: TopicCard }
  | { type: "SUBMIT_SUBJECT"; subject: string }
  | { type: "SET_GUESS"; key: string; value: number }
  | { type: "LOCK_GUESS"; key: string }
  | { type: "REVEAL" }
  | { type: "SHOW_SCOREBOARD" }
  | { type: "NEXT_ROUND"; target: number }
  | { type: "REMATCH"; target: number }
  /** Bin the round and redeal it to the next chooser. Nobody scores. */
  | { type: "ABORT_ROUND"; target: number }
  | { type: "RESTORE"; state: GameState };

export const DEFAULT_CONFIG: GameConfig = {
  rounds: 10,
  discussionSeconds: 90,
  sharedDial: false,
};

function buildRound(
  players: Player[],
  roundNumber: number,
  target: number,
): Round {
  return {
    number: roundNumber,
    chooserId: chooserForRound(players, roundNumber),
    card: null,
    target,
    subject: "",
    guesses: {},
    locked: {},
    scores: null,
  };
}

/** Build a fresh game at round 1. Called by the store and by the server. */
export function createGame(
  players: Player[],
  config: GameConfig,
  target: number,
): GameState {
  return {
    config,
    players: players.map((p) => ({ ...p, score: 0 })),
    phase: "pass",
    round: buildRound(players, 1, target),
    groupScore: 0,
    usedCardIds: [],
  };
}

/** Everyone who is allowed a dial this round. */
function guessKeys(state: GameState): string[] {
  if (state.config.sharedDial) return [SHARED_DIAL_KEY];
  return state.players
    .filter((p) => p.id !== state.round?.chooserId)
    .map((p) => p.id);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESTORE":
      return action.state;

    case "CONFIRM_CHOOSER":
      if (state.phase !== "pass") return state;
      return { ...state, phase: "topic" };

    case "SET_CARD": {
      if (state.phase !== "topic" || !state.round) return state;
      const { card } = action;
      if (!card.category.trim() || !card.left.trim() || !card.right.trim()) {
        return state;
      }
      return {
        ...state,
        phase: "subject",
        round: { ...state.round, card },
        usedCardIds:
          card.id && !state.usedCardIds.includes(card.id)
            ? [...state.usedCardIds, card.id]
            : state.usedCardIds,
      };
    }

    case "SUBMIT_SUBJECT": {
      if (state.phase !== "subject" || !state.round) return state;
      const subject = action.subject.trim();
      if (!subject) return state;
      return { ...state, phase: "guess", round: { ...state.round, subject } };
    }

    case "SET_GUESS": {
      if (state.phase !== "guess" || !state.round) return state;
      if (state.round.locked[action.key]) return state;
      const value = Math.min(100, Math.max(0, action.value));
      return {
        ...state,
        round: {
          ...state.round,
          guesses: { ...state.round.guesses, [action.key]: value },
        },
      };
    }

    case "LOCK_GUESS": {
      if (state.phase !== "guess" || !state.round) return state;
      return {
        ...state,
        round: {
          ...state.round,
          locked: { ...state.round.locked, [action.key]: true },
        },
      };
    }

    case "REVEAL": {
      if (state.phase !== "guess" || !state.round) return state;
      const round = state.round;

      // A dial nobody touched still counts, from where it started.
      const guesses: Record<string, number> = {};
      for (const key of guessKeys(state)) {
        guesses[key] = round.guesses[key] ?? 50;
      }

      const scores = scoreRound(
        guesses,
        round.target,
        round.chooserId,
        state.config.sharedDial,
      );

      if (state.config.sharedDial) {
        return {
          ...state,
          phase: "reveal",
          groupScore: state.groupScore + (scores[SHARED_DIAL_KEY] ?? 0),
          round: { ...round, guesses, scores },
        };
      }

      return {
        ...state,
        phase: "reveal",
        players: state.players.map((p) => ({
          ...p,
          score: p.score + (scores[p.id] ?? 0),
        })),
        round: { ...round, guesses, scores },
      };
    }

    case "SHOW_SCOREBOARD": {
      if (state.phase !== "reveal" || !state.round) return state;
      const over = state.round.number >= state.config.rounds;
      return { ...state, phase: over ? "gameover" : "scoreboard" };
    }

    case "NEXT_ROUND": {
      if (state.phase !== "scoreboard" || !state.round) return state;
      return {
        ...state,
        phase: "pass",
        round: buildRound(state.players, state.round.number + 1, action.target),
      };
    }

    case "ABORT_ROUND": {
      if (!state.round || state.phase === "gameover") return state;
      // Same round number, next person in the roster takes it over.
      const rotated = [...state.players.slice(1), state.players[0]];
      return {
        ...state,
        players: rotated,
        phase: "pass",
        round: buildRound(rotated, state.round.number, action.target),
      };
    }

    case "REMATCH":
      return createGame(state.players, state.config, action.target);

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/reducer.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Rewrite setup**

Replace all of `src/lib/game/setup.ts`:

```ts
import type { Player } from "@/types/game";

/** One chooser plus one guesser. */
export const MIN_PLAYERS = 2;

/** Turn typed names into players, dropping blanks. */
export function buildPlayers(names: string[]): Player[] {
  return names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `p-${i}`, name, score: 0 }));
}

/**
 * True when the round count divides evenly among players, so everyone gets to
 * choose the same number of times. Only drives a warning — never blocks start.
 */
export function rotationIsEven(playerCount: number, rounds: number): boolean {
  return playerCount > 0 && rounds % playerCount === 0;
}
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: PASS, 27 tests across 4 files.

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/ tests/unit/reducer.test.ts
git commit -m "Rewrite the phase machine around a rotating chooser"
```

---

## Task 5: Multi-needle dial

**Files:**
- Modify: `src/components/dial/Dial.tsx`

**Interfaces:**
- Produces: `<Dial needles={[{ value, label, color }]} />` renders several labelled needles; the existing `value` prop still renders exactly one.

- [ ] **Step 1: Add the needle type and prop**

In `src/components/dial/Dial.tsx`, add above `export interface DialProps`:

```tsx
export interface DialNeedle {
  value: number;
  /** Short caption drawn at the needle tip. Omit for an unlabelled needle. */
  label?: string;
  /** CSS colour. Defaults to the standard needle colour. */
  color?: string;
}
```

Then inside `DialProps`, replace the `showNeedle` line with:

```tsx
  /** Hide the needle entirely — the chooser has no guess to show yet. */
  showNeedle?: boolean;
  /**
   * Draw several needles at once instead of the single `value` one. Used on
   * reveal, where every player's dial appears together.
   */
  needles?: DialNeedle[];
```

- [ ] **Step 2: Accept the prop**

In the component signature, after `showNeedle = true,` add:

```tsx
  needles,
```

- [ ] **Step 3: Render each needle**

Replace the whole `{showNeedle && ( … )}` block with:

```tsx
        {showNeedle &&
          (needles ?? [{ value }]).map((needle, i) => (
            <g key={i}>
              <g
                transform={`rotate(${(needle.value - 50) * 1.8} ${CX} ${CY})`}
                style={{
                  transition: animateNeedle
                    ? "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : undefined,
                }}
              >
                <polygon
                  points={`${CX - 7},${CY} ${CX + 7},${CY} ${CX + 2},${CY - R_OUTER - 4} ${CX - 2},${CY - R_OUTER - 4}`}
                  fill={needle.color ?? "var(--needle)"}
                  opacity={needles ? 0.85 : 1}
                />
                <circle
                  cx={CX}
                  cy={CY - R_OUTER - 4}
                  r={7}
                  fill={needle.color ?? "var(--needle)"}
                />
              </g>
              {needle.label && (
                <text
                  x={CX + (R_OUTER + 16) * Math.cos(((180 - needle.value * 1.8) * Math.PI) / 180)}
                  y={CY - (R_OUTER + 16) * Math.sin(((180 - needle.value * 1.8) * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[15px] font-bold"
                  fill={needle.color ?? "var(--needle)"}
                >
                  {needle.label}
                </text>
              )}
            </g>
          ))}
        {showNeedle && (
          <>
            <circle cx={CX} cy={CY} r={16} fill="var(--needle)" />
            <circle cx={CX} cy={CY} r={7} fill="var(--surface)" />
          </>
        )}
```

- [ ] **Step 4: Give labels room**

In the same file, change the `viewBox` on the `<svg>` from `` `0 0 ${VIEW_W} ${VIEW_H}` `` to:

```tsx
        viewBox={`-12 -14 ${VIEW_W + 24} ${VIEW_H + 14}`}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --strict --skipLibCheck src/components/dial/Dial.tsx 2>&1 | head -20`
Expected: errors only about `@/` path aliases, none about `DialNeedle` or `needles`.

- [ ] **Step 6: Commit**

```bash
git add src/components/dial/Dial.tsx
git commit -m "Let the dial draw several labelled needles at once"
```

---

## Task 6: Chooser views

**Files:**
- Create: `src/components/game/TopicPickerView.tsx`
- Create: `src/components/game/SubjectView.tsx`
- Delete: `src/components/game/PsychicView.tsx`, `src/components/game/BetView.tsx`

**Interfaces:**
- Consumes: `TopicCard` from Task 2, `drawCard` from Task 2, `Dial` from Task 5.
- Produces: `<TopicPickerView card onReroll onConfirm />`, `<SubjectView card target chooserName onSubmit />`.

- [ ] **Step 1: Create the topic picker**

Create `src/components/game/TopicPickerView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

const MAX_FIELD = 24;

/**
 * The chooser settles on a category and spectrum before seeing the target.
 *
 * Order matters: if the target were visible first, a custom spectrum could be
 * written to suit it.
 */
export function TopicPickerView({
  card,
  chooserName,
  onReroll,
  onConfirm,
}: {
  /** The currently drawn random card. */
  card: TopicCard;
  chooserName: string;
  onReroll: () => void;
  onConfirm: (card: TopicCard) => void;
}) {
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [category, setCategory] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const customReady =
    category.trim().length > 0 && left.trim().length > 0 && right.trim().length > 0;

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        maxLength={MAX_FIELD}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <Screen
      footer={
        mode === "random" ? (
          <>
            <Button onClick={() => onConfirm(card)}>ใช้หัวข้อนี้</Button>
            <Button variant="secondary" onClick={onReroll}>
              สุ่มใหม่
            </Button>
          </>
        ) : (
          <Button
            disabled={!customReady}
            onClick={() =>
              onConfirm({
                id: null,
                category: category.trim(),
                left: left.trim(),
                right: right.trim(),
                custom: true,
              })
            }
          >
            ใช้หัวข้อนี้
          </Button>
        )
      }
    >
      <div className="text-center">
        <p className="text-sm text-slate-400">
          <span className="font-bold text-slate-200">{chooserName}</span> เลือกหัวข้อ
        </p>
      </div>

      <div className="flex gap-2">
        {(["random", "custom"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold ${
              mode === m
                ? "bg-amber-400 text-slate-900"
                : "bg-[var(--surface-raised)] text-slate-300"
            }`}
          >
            {m === "random" ? "สุ่มให้" : "ตั้งเอง"}
          </button>
        ))}
      </div>

      {mode === "random" ? (
        <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            หมวด
          </p>
          <p className="mt-1 text-3xl font-black">{card.category}</p>
          <p className="mt-5 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {field("category", "หมวด", category, setCategory, "เช่น Movie")}
          {field("left", "ฝั่งซ้าย (0)", left, setLeft, "เช่น Forgotten")}
          {field("right", "ฝั่งขวา (100)", right, setRight, "เช่น Iconic")}
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-slate-500">
        เลือกหัวข้อก่อน แล้วค่อยเห็นว่า target อยู่ตรงไหน
      </p>
    </Screen>
  );
}
```

- [ ] **Step 2: Create the subject view**

Create `src/components/game/SubjectView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

/** The only screen that renders the target. */
export function SubjectView({
  card,
  target,
  chooserName,
  onSubmit,
}: {
  card: TopicCard;
  target: number;
  chooserName: string;
  onSubmit: (subject: string) => void;
}) {
  const [subject, setSubject] = useState("");

  return (
    <Screen
      footer={
        <>
          <Button disabled={!subject.trim()} onClick={() => onSubmit(subject)}>
            ส่งคำตอบ — ซ่อน target
          </Button>
          <p className="text-center text-xs text-slate-500">
            กดแล้วจะซ่อน target ทันที
          </p>
        </>
      }
    >
      <div>
        <p className="text-center text-sm text-slate-400">
          <span className="font-bold text-slate-200">{chooserName}</span> เลือกหัวข้อแล้ว
        </p>
        <div className="mt-3 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
          </p>
          <p className="mt-1 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      </div>

      <Dial
        value={target}
        target={target}
        showNeedle={false}
        leftLabel={card.left}
        rightLabel={card.right}
      />

      <div>
        <label
          htmlFor="subject"
          className="mb-2 block text-sm font-semibold text-slate-300"
        >
          อะไรใน &ldquo;{card.category}&rdquo; ที่อยู่ตรงโซนนั้น
        </label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={40}
          autoComplete="off"
          placeholder="พิมพ์ชื่อ…"
          className="w-full rounded-2xl bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />
        <p className="mt-2 text-xs text-slate-500">
          ต้องเป็นของจริงในหมวดนี้ ห้ามบอกตัวเลขหรือทิศทาง
        </p>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 3: Delete the replaced views**

```bash
git rm src/components/game/PsychicView.tsx src/components/game/BetView.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/components/game/TopicPickerView.tsx src/components/game/SubjectView.tsx
git commit -m "Add the topic picker and subject screens"
```

---

## Task 7: Guess, reveal and scoreboard views

**Files:**
- Modify: `src/components/game/GuessView.tsx`
- Modify: `src/components/game/RevealView.tsx`
- Modify: `src/components/game/ScoreBoard.tsx`
- Modify: `src/components/game/ScoreboardScreen.tsx`
- Modify: `src/components/game/WaitingView.tsx`
- Modify: `src/components/game/PassDeviceScreen.tsx`

**Interfaces:**
- Consumes: `Player`, `Round`, `TopicCard` from Task 2; `DialNeedle` from Task 5.
- Produces: `<GuessView card subject … />`, `<RevealView card round players groupScore sharedDial … />`, `<ScoreBoard players groupScore sharedDial rounds />`, `<ScoreboardScreen state … />`, `<WaitingView card chooserName note />`, `<PassDeviceScreen chooserName roundNumber onConfirm />`.

- [ ] **Step 1: Rewrite the scoreboard strip**

Replace all of `src/components/game/ScoreBoard.tsx`:

```tsx
import type { Player } from "@/types/game";

export const PLAYER_COLORS = [
  "#f472b6",
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#c084fc",
  "#fb923c",
  "#22d3ee",
  "#a3e635",
] as const;

export function playerColor(players: Player[], playerId: string | null): string {
  const i = players.findIndex((p) => p.id === playerId);
  return PLAYER_COLORS[(i === -1 ? 0 : i) % PLAYER_COLORS.length];
}

/**
 * Standings. Individual play ranks players; shared-dial play has one number
 * for the table, so it shows that instead.
 */
export function ScoreBoard({
  players,
  groupScore,
  sharedDial,
  rounds,
  delta,
}: {
  players: Player[];
  groupScore: number;
  sharedDial: boolean;
  /** Total rounds in the game, shown as the ceiling. */
  rounds: number;
  /** Points added this round, keyed by player id. */
  delta?: Record<string, number>;
}) {
  if (sharedDial) {
    const max = rounds * 4;
    return (
      <div className="rounded-2xl bg-[var(--surface-raised)] p-5 text-center">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          คะแนนกลุ่ม
        </p>
        <p className="mt-2 text-5xl font-black text-amber-300">{groupScore}</p>
        <p className="mt-1 text-sm text-slate-500">เต็ม {max}</p>
      </div>
    );
  }

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {ranked.map((player) => {
        const gained = delta?.[player.id] ?? 0;
        const pct = top > 0 ? (player.score / top) * 100 : 0;
        return (
          <div
            key={player.id}
            className="rounded-2xl bg-[var(--surface-raised)] p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="truncate text-base font-bold"
                style={{ color: playerColor(players, player.id) }}
              >
                {player.name}
              </span>
              <span className="shrink-0 text-sm text-slate-400">
                {gained > 0 && (
                  <span className="mr-2 rounded-full bg-amber-400/15 px-2 py-0.5 font-bold text-amber-300">
                    +{gained}
                  </span>
                )}
                <span className="text-2xl font-black text-slate-100">
                  {player.score}
                </span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: playerColor(players, player.id),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the guess view**

Replace all of `src/components/game/GuessView.tsx`:

```tsx
"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useCountdown } from "@/lib/hooks/useCountdown";
import type { TopicCard } from "@/types/game";

/**
 * Placing the dial.
 *
 * `<Dial>` gets no `target` prop, so the scoring band is never mounted — the
 * hidden position is not in the DOM on this screen. Online, every player sees
 * only their own needle; the shared-dial device shows the one everybody moves.
 */
export function GuessView({
  card,
  subject,
  guess,
  discussionSeconds,
  onChange,
  onLock,
  canGuess = true,
  canLock = true,
  watchingLabel,
  waitingCount,
}: {
  card: TopicCard;
  subject: string;
  guess: number;
  discussionSeconds: number | null;
  onChange: (value: number) => void;
  onLock: () => void;
  canGuess?: boolean;
  canLock?: boolean;
  /** Shown instead of the lock button for players who are only watching. */
  watchingLabel?: string;
  /** "รออีก N คน" line under the button. */
  waitingCount?: number;
}) {
  const left = useCountdown(discussionSeconds, canLock ? onLock : undefined);

  return (
    <Screen
      footer={
        canLock ? (
          <>
            <Button onClick={onLock}>ล็อกคำตอบ</Button>
            {waitingCount !== undefined && waitingCount > 0 && (
              <p className="text-center text-xs text-slate-500">
                รออีก {waitingCount} คน
              </p>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {watchingLabel ?? "รอคนอื่นล็อกคำตอบ"}
          </p>
        )
      }
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
          </p>
          {left !== null && (
            <p
              className={`font-mono text-sm tabular-nums ${
                left <= 10 ? "text-amber-300" : "text-slate-500"
              }`}
            >
              {String(Math.floor(left / 60)).padStart(2, "0")}:
              {String(left % 60).padStart(2, "0")}
            </p>
          )}
        </div>
        <div className="mt-2 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-5 text-center">
        <p className="text-3xl font-black break-words text-amber-200">
          {subject}
        </p>
      </div>

      <div className="flex flex-col items-center">
        <Dial
          value={guess}
          onChange={canGuess ? onChange : undefined}
          leftLabel={card.left}
          rightLabel={card.right}
        />
        <p className="mt-1 text-xs text-slate-500">
          {canGuess ? "ลากเข็ม หรือใช้ปุ่มลูกศร" : "ดูอย่างเดียว"}
        </p>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 3: Rewrite the reveal view**

Replace all of `src/components/game/RevealView.tsx`:

```tsx
"use client";

import { Dial } from "@/components/dial/Dial";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { playerColor } from "./ScoreBoard";
import { SHARED_DIAL_KEY, type Player, type Round } from "@/types/game";

export function RevealView({
  round,
  players,
  sharedDial,
  onNext,
  canAdvance = true,
  waitingLabel,
}: {
  round: Round;
  players: Player[];
  sharedDial: boolean;
  onNext: () => void;
  canAdvance?: boolean;
  waitingLabel?: string;
}) {
  const card = round.card;
  if (!card) return null;

  const chooser = players.find((p) => p.id === round.chooserId);
  const scores = round.scores ?? {};

  const needles = sharedDial
    ? [{ value: round.guesses[SHARED_DIAL_KEY] ?? 50 }]
    : players
        .filter((p) => p.id !== round.chooserId)
        .map((p) => ({
          value: round.guesses[p.id] ?? 50,
          label: p.name,
          color: playerColor(players, p.id),
        }));

  const rows = sharedDial
    ? [
        {
          key: SHARED_DIAL_KEY,
          name: "ทั้งกลุ่ม",
          value: round.guesses[SHARED_DIAL_KEY] ?? 50,
          points: scores[SHARED_DIAL_KEY] ?? 0,
          color: "var(--needle)",
        },
      ]
    : players
        .filter((p) => p.id !== round.chooserId)
        .map((p) => ({
          key: p.id,
          name: p.name,
          value: round.guesses[p.id] ?? 50,
          points: scores[p.id] ?? 0,
          color: playerColor(players, p.id),
        }));

  return (
    <Screen
      footer={
        canAdvance ? (
          <Button onClick={onNext}>ดูคะแนนรวม</Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {waitingLabel ?? "รอ host ไปต่อ"}
          </p>
        )
      }
    >
      <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          {card.category}
        </p>
        <p className="mt-1 text-lg font-bold">
          <span className="text-slate-400">{card.left}</span>
          <span className="mx-2 text-slate-600">↔</span>
          <span className="text-slate-100">{card.right}</span>
        </p>
        <p className="mt-2 text-2xl font-black text-amber-200">{round.subject}</p>
      </div>

      <div className="flex flex-col items-center">
        <Dial
          value={round.target}
          target={round.target}
          needles={needles}
          bandClassName="band-reveal"
          animateNeedle
          leftLabel={card.left}
          rightLabel={card.right}
        />
        <p className="mt-1 text-xs text-slate-500">
          target อยู่ที่ {round.target.toFixed(1)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-2xl bg-[var(--surface-raised)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-bold" style={{ color: row.color }}>
                {row.name}
              </p>
              <p className="text-xs text-slate-500">
                เข็ม {row.value.toFixed(1)} · ห่าง{" "}
                {Math.abs(row.value - round.target).toFixed(1)}
              </p>
            </div>
            <span className="shrink-0 text-3xl font-black text-amber-300">
              +{row.points}
            </span>
          </div>
        ))}

        {!sharedDial && chooser && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-700 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-300">
                {chooser.name}
              </p>
              <p className="text-xs text-slate-500">คนเลือก — ค่าเฉลี่ยของคนเดา</p>
            </div>
            <span className="shrink-0 text-3xl font-black text-amber-300">
              +{scores[chooser.id] ?? 0}
            </span>
          </div>
        )}
      </div>
    </Screen>
  );
}
```

- [ ] **Step 4: Rewrite the scoreboard screen**

Replace all of `src/components/game/ScoreboardScreen.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { ScoreBoard } from "./ScoreBoard";
import type { GameState } from "@/types/game";
import type { PublicGameState } from "@/types/online";

/** Between-rounds standings, and the end-of-game screen. */
export function ScoreboardScreen({
  state,
  onNext,
  onRematch,
  onExit,
  canAdvance = true,
  waitingLabel,
  exitLabel = "ออก",
}: {
  state: GameState | PublicGameState;
  onNext: () => void;
  onRematch: () => void;
  onExit: () => void;
  canAdvance?: boolean;
  waitingLabel?: string;
  exitLabel?: string;
}) {
  const over = state.phase === "gameover";
  const sharedDial = state.config.sharedDial;
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const winner = !sharedDial && ranked.length > 0 ? ranked[0] : null;
  const delta = state.round?.scores ?? undefined;

  return (
    <Screen
      footer={
        over ? (
          <>
            {canAdvance && <Button onClick={onRematch}>เล่นอีกรอบ</Button>}
            <Button variant="ghost" onClick={onExit}>
              {exitLabel}
            </Button>
          </>
        ) : canAdvance ? (
          <Button onClick={onNext}>รอบต่อไป</Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {waitingLabel ?? "รอ host เริ่มรอบต่อไป"}
          </p>
        )
      }
    >
      <div className="text-center">
        {over ? (
          <>
            <p className="text-5xl">🏆</p>
            <p className="mt-3 text-2xl font-black">
              {sharedDial ? "จบเกม" : `${winner?.name} ชนะ`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
              จบรอบที่ {state.round?.number} / {state.config.rounds}
            </p>
            <p className="mt-2 text-2xl font-black">คะแนนรวม</p>
          </>
        )}
      </div>

      <ScoreBoard
        players={state.players}
        groupScore={state.groupScore}
        sharedDial={sharedDial}
        rounds={state.config.rounds}
        delta={delta}
      />
    </Screen>
  );
}
```

- [ ] **Step 5: Rewrite the waiting view**

Replace all of `src/components/game/WaitingView.tsx`:

```tsx
"use client";

import { Screen } from "@/components/ui/Screen";
import type { TopicCard } from "@/types/game";

/**
 * What everyone except the chooser looks at while the topic and subject are
 * being picked. There is no dial and no band here, so nothing on this screen
 * can hint at the target.
 */
export function WaitingView({
  card,
  chooserName,
  roundNumber,
  note,
}: {
  /** null while the chooser is still picking a topic. */
  card: TopicCard | null;
  chooserName: string;
  roundNumber: number;
  note: string;
}) {
  return (
    <Screen>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
      </div>

      {card && (
        <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {card.category}
          </p>
          <p className="mt-1 text-lg font-bold">
            <span className="text-slate-400">{card.left}</span>
            <span className="mx-2 text-slate-600">↔</span>
            <span className="text-slate-100">{card.right}</span>
          </p>
        </div>
      )}

      <div className="text-center">
        <div className="mx-auto mb-6 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-600"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-2xl font-black break-words">{chooserName}</p>
        <p className="mt-4 text-slate-400">{note}</p>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 6: Retitle the pass screen**

Replace all of `src/components/game/PassDeviceScreen.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

/**
 * Hand-off gate for shared-dial play. Nothing secret is rendered here — this
 * screen exists so the target is never on display while the device changes
 * hands. After the chooser submits their subject the device goes back on the
 * table; there is no second hand-off in a round.
 */
export function PassDeviceScreen({
  chooserName,
  roundNumber,
  onConfirm,
}: {
  chooserName: string;
  roundNumber: number;
  onConfirm: () => void;
}) {
  return (
    <Screen
      footer={
        <Button onClick={onConfirm}>ฉันคือ {chooserName} — เลือกหัวข้อ</Button>
      }
    >
      <div className="text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase">
          รอบที่ {roundNumber}
        </p>
        <p className="mt-8 text-lg text-slate-400">ส่งเครื่องให้</p>
        <p className="mt-2 text-4xl font-black break-words">{chooserName}</p>
        <p className="mt-10 text-sm leading-relaxed text-slate-500">
          คนอื่นอย่ามอง
          <br />
          กดปุ่มข้างล่างเมื่อ {chooserName} ถือเครื่องแล้ว
        </p>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/game/
git commit -m "Rework the play screens for individual dials and scores"
```

---

## Task 8: Local mode end to end

**Files:**
- Modify: `src/lib/store/localGame.tsx`
- Modify: `src/app/local/page.tsx`
- Modify: `src/app/local/play/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: a playable offline game; `useLocalGame()` exposes `{ state, ready, startGame, confirmChooser, reroll, setCard, submitSubject, setGuess, lockGuess, reveal, showScoreboard, nextRound, rematch, clear, randomCard }`.

- [ ] **Step 1: Rewrite the local store**

In `src/lib/store/localGame.tsx`:

Change the storage key line to:

```tsx
const STORAGE_KEY = "wavelength:local:v2";
```

Replace the imports block with:

```tsx
import type { GameConfig, GameState, Player, TopicCard } from "@/types/game";
import { SHARED_DIAL_KEY } from "@/types/game";
import { createGame, gameReducer, type GameAction } from "@/lib/game/reducer";
import { drawCard } from "@/lib/cards";
import { randomTarget } from "@/lib/game/target";
```

Replace the `LocalGameContextValue` interface with:

```tsx
interface LocalGameContextValue {
  state: GameState | null;
  /** False until localStorage has been read — render a placeholder till then. */
  ready: boolean;
  /** The card currently offered by the random picker. */
  randomCard: TopicCard;
  startGame: (players: Player[], config: GameConfig) => void;
  confirmChooser: () => void;
  reroll: () => void;
  setCard: (card: TopicCard) => void;
  submitSubject: (subject: string) => void;
  setGuess: (value: number) => void;
  lockGuess: () => void;
  reveal: () => void;
  showScoreboard: () => void;
  nextRound: () => void;
  rematch: () => void;
  clear: () => void;
}
```

Add below the `rootReducer` function:

```tsx
/** The random pick lives outside game state — a reroll must not be a game event. */
function pickCard(state: GameState | null): TopicCard {
  return drawCard(state?.usedCardIds ?? []);
}
```

Inside `LocalGameProvider`, after the `ready` state line, add:

```tsx
  const [randomCard, setRandomCard] = useState<TopicCard>(() => drawCard([]));
```

Replace `startGame` and the `value` memo body with:

```tsx
  const startGame = useCallback(
    (players: Player[], config: GameConfig) => {
      dispatch({
        type: "RESTORE",
        state: createGame(players, config, randomTarget()),
      });
      setRandomCard(drawCard([]));
    },
    [],
  );

  const value = useMemo<LocalGameContextValue>(
    () => ({
      state,
      ready,
      randomCard,
      startGame,
      confirmChooser: () => dispatch({ type: "CONFIRM_CHOOSER" }),
      reroll: () => setRandomCard(pickCard(state)),
      setCard: (card) => dispatch({ type: "SET_CARD", card }),
      submitSubject: (subject) => dispatch({ type: "SUBMIT_SUBJECT", subject }),
      setGuess: (value) =>
        dispatch({ type: "SET_GUESS", key: SHARED_DIAL_KEY, value }),
      lockGuess: () => {
        dispatch({ type: "LOCK_GUESS", key: SHARED_DIAL_KEY });
        dispatch({ type: "REVEAL" });
      },
      reveal: () => dispatch({ type: "REVEAL" }),
      showScoreboard: () => dispatch({ type: "SHOW_SCOREBOARD" }),
      nextRound: () => {
        dispatch({ type: "NEXT_ROUND", target: randomTarget() });
        setRandomCard(pickCard(state));
      },
      rematch: () => {
        dispatch({ type: "REMATCH", target: randomTarget() });
        setRandomCard(drawCard([]));
      },
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state, ready, randomCard, startGame],
  );
```

Delete the `useCurrentCard`, `usePlayer` and `useTeam` selector hooks at the bottom of the file — the round now carries its own card and there are no teams.

- [ ] **Step 2: Rewrite the local setup page**

In `src/app/local/page.tsx`:

Replace the imports of `TEAM_COLORS`, `buildRoster`, `MIN_PLAYERS_FOR_TEAMS`, `rosterIsPlayable` with:

```tsx
import { PLAYER_COLORS } from "@/components/game/ScoreBoard";
import { buildPlayers, MIN_PLAYERS, rotationIsEven } from "@/lib/game/setup";
```

Replace the `TARGET_SCORES` constant with:

```tsx
const ROUND_COUNTS = [5, 10, 15];
```

Replace the state block for `teamNames`, `targetScore` and `leftRightBet` with:

```tsx
  const [rounds, setRounds] = useState(DEFAULT_CONFIG.rounds);
```

Replace the `roster` memo and `playable` with:

```tsx
  const players = useMemo(() => buildPlayers(names), [names]);
  const playable = players.length >= MIN_PLAYERS;
  const evenRotation = rotationIsEven(players.length, rounds);
```

Replace the `start` callback with:

```tsx
  const start = () => {
    if (!playable) return;
    startGame(players, {
      rounds,
      discussionSeconds,
      // The device sits on the table: one dial, one score for everyone.
      sharedDial: true,
    });
    router.push("/local/play");
  };
```

Replace the player chip list `style` prop with:

```tsx
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
```

Delete the whole team-names `<section>` and the left-right-bet `<label>`.

Replace the "เล่นถึงกี่คะแนน" section with:

```tsx
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เล่นกี่รอบ
          </h2>
          <div className="flex gap-2">
            {ROUND_COUNTS.map((r) => (
              <button
                key={r}
                onClick={() => setRounds(r)}
                className={`flex-1 rounded-2xl py-3 font-bold ${
                  rounds === r
                    ? "bg-amber-400 text-slate-900"
                    : "bg-[var(--surface-raised)] text-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {playable && !evenRotation && (
            <p className="mt-2 text-xs text-amber-300/80">
              {rounds} รอบ หารกับ {players.length} คนไม่ลงตัว
              บางคนจะได้เลือกมากกว่าคนอื่น
            </p>
          )}
        </div>
```

Change the minimum-players hint below the chips to:

```tsx
        {names.length > 0 && names.length < MIN_PLAYERS && (
          <p className="mt-3 rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            ต้องมีอย่างน้อย {MIN_PLAYERS} คน (คนเลือก 1 + คนเดา 1)
          </p>
        )}
```

- [ ] **Step 3: Rewrite the local play router**

Replace all of `src/app/local/play/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalGame } from "@/lib/store/localGame";
import { SHARED_DIAL_KEY } from "@/types/game";
import { PassDeviceScreen } from "@/components/game/PassDeviceScreen";
import { TopicPickerView } from "@/components/game/TopicPickerView";
import { SubjectView } from "@/components/game/SubjectView";
import { GuessView } from "@/components/game/GuessView";
import { RevealView } from "@/components/game/RevealView";
import { ScoreboardScreen } from "@/components/game/ScoreboardScreen";

/**
 * Phase router for the local game.
 *
 * Each phase mounts exactly one view. That is deliberate: the guess screen
 * simply never renders a component that knows the target, rather than
 * rendering it hidden.
 */
export default function LocalPlayPage() {
  const router = useRouter();
  const game = useLocalGame();
  const { state, ready } = game;

  useEffect(() => {
    if (ready && !state) router.replace("/local");
  }, [ready, state, router]);

  if (!ready || !state || !state.round) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-slate-500">
        กำลังโหลด…
      </main>
    );
  }

  const round = state.round;
  const chooser = state.players.find((p) => p.id === round.chooserId);
  const chooserName = chooser?.name ?? "?";

  switch (state.phase) {
    case "pass":
      return (
        <PassDeviceScreen
          chooserName={chooserName}
          roundNumber={round.number}
          onConfirm={game.confirmChooser}
        />
      );

    case "topic":
      return (
        <TopicPickerView
          card={game.randomCard}
          chooserName={chooserName}
          onReroll={game.reroll}
          onConfirm={game.setCard}
        />
      );

    case "subject":
      return round.card ? (
        <SubjectView
          card={round.card}
          target={round.target}
          chooserName={chooserName}
          onSubmit={game.submitSubject}
        />
      ) : null;

    case "guess":
      return round.card ? (
        <GuessView
          card={round.card}
          subject={round.subject}
          guess={round.guesses[SHARED_DIAL_KEY] ?? 50}
          discussionSeconds={state.config.discussionSeconds}
          onChange={game.setGuess}
          onLock={game.lockGuess}
        />
      ) : null;

    case "reveal":
      return (
        <RevealView
          round={round}
          players={state.players}
          sharedDial={state.config.sharedDial}
          onNext={game.showScoreboard}
        />
      );

    case "scoreboard":
    case "gameover":
      return (
        <ScoreboardScreen
          state={state}
          onNext={game.nextRound}
          onRematch={game.rematch}
          onExit={() => {
            game.clear();
            router.push("/");
          }}
        />
      );
  }
}
```

- [ ] **Step 4: Play a full offline game**

Run: `npm run dev`, open `http://localhost:3000/local`, add 3 players, pick 5 rounds, play to the end.
Expected: pass → topic (reroll works) → subject shows the band → guess hides it → reveal shows one needle and the group score → next round hands off to the second player → game ends after round 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/localGame.tsx src/app/local/
git commit -m "Wire local play to the chooser rules with a shared dial"
```

---

## Task 9: Socket contract and server

**Files:**
- Modify: `src/lib/socket/events.ts`
- Modify: `src/types/online.ts`
- Modify: `src/server/rooms.ts`
- Modify: `src/server/handlers.ts`

**Interfaces:**
- Consumes: the reducer and deck from Tasks 2–4.
- Produces: events `room:create`, `room:join`, `room:setConfig`, `room:leave`, `game:start`, `game:rematch`, `round:reroll`, `round:card`, `round:subject`, `round:guess`, `round:lockGuess`, `round:showScoreboard`, `round:next`; server-to-client `room:state`, `round:target`, `round:randomCard`, `room:error`.

- [ ] **Step 1: Rewrite the event contract**

In `src/lib/socket/events.ts`:

Replace `configSchema` with:

```ts
export const configSchema = z.object({
  rounds: z.number().int().min(1).max(50),
  discussionSeconds: z.number().int().min(10).max(600).nullable(),
  sharedDial: z.boolean(),
});
```

Replace `setTeamSchema`, `clueSchema` and `betSchema` with:

```ts
export const cardSchema = z.object({
  id: z.string().min(1).max(32).nullable(),
  category: z.string().trim().min(1).max(24),
  left: z.string().trim().min(1).max(24),
  right: z.string().trim().min(1).max(24),
  custom: z.boolean(),
});

export const subjectSchema = z.object({
  subject: z.string().trim().min(1).max(40),
});
```

Replace the payload type exports for the removed schemas with:

```ts
export type CardPayload = z.infer<typeof cardSchema>;
export type SubjectPayload = z.infer<typeof subjectSchema>;
```

Replace `ServerToClientEvents` and `ClientToServerEvents` with:

```ts
export interface ServerToClientEvents {
  /** Full room snapshot. Always target-free except during reveal. */
  "room:state": (room: PublicRoom) => void;
  /** Sent only to the chooser's socket, never broadcast. */
  "round:target": (payload: { roundNumber: number; target: number }) => void;
  /** The random card on offer. Chooser only — it is not part of game state. */
  "round:randomCard": (payload: { card: TopicCard }) => void;
  "room:error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: CreateRoomPayload,
    ack: (result: JoinResult) => void,
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: (result: JoinResult) => void,
  ) => void;
  "room:setConfig": (payload: Partial<CreateRoomPayload["config"]>) => void;
  "room:leave": () => void;
  "game:start": () => void;
  "game:rematch": () => void;
  "round:reroll": () => void;
  "round:card": (payload: CardPayload) => void;
  "round:subject": (payload: SubjectPayload) => void;
  "round:guess": (payload: GuessPayload) => void;
  "round:lockGuess": () => void;
  "round:showScoreboard": () => void;
  "round:next": () => void;
}
```

Add to the imports at the top:

```ts
import type { TopicCard } from "@/types/game";
```

- [ ] **Step 2: Rewrite the online types**

Replace `src/types/online.ts` with:

```ts
import type { GameConfig, GameState, Round } from "./game";

/** A person in a room. */
export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * The round as everyone in the room may see it.
 *
 * `target` is absent until reveal, and `guesses` holds only the entries this
 * client is allowed to see. Both are stripped in `src/server/redact.ts` — the
 * only place allowed to decide otherwise.
 */
export type PublicRound = Omit<Round, "target"> & { target?: number };

export type PublicGameState = Omit<GameState, "round"> & {
  round: PublicRound | null;
};

export interface PublicRoom {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  config: GameConfig;
  /** null while the room is still in the lobby. */
  game: PublicGameState | null;
  /** Epoch ms the guess phase closes, or null when no timer is running. */
  guessDeadlineAt: number | null;
}

/** Identity a client keeps so it can rejoin its seat after a disconnect. */
export interface OnlineIdentity {
  code: string;
  playerId: string;
  name: string;
}
```

- [ ] **Step 3: Strip teams out of the room store**

In `src/server/rooms.ts`:

Delete `TEAM_IDS`, `TEAM_NAMES`, `MIN_PLAYERS_FOR_TEAMS`, `lightestTeam`, `coopMode`, `buildRoster`, `rosterIsPlayable` and the `teamId` field on `ServerPlayer`. `MIN_PLAYERS` is already `2`; leave it. Add in their place:

```ts
/** Freeze the lobby into the roster the game runs on. Join order is turn order. */
export function buildPlayers(room: Room): Player[] {
  return room.players.map((p) => ({ id: p.id, name: p.name, score: 0 }));
}

export function rosterIsPlayable(room: Room): boolean {
  return room.players.length >= MIN_PLAYERS;
}
```

Change the `addPlayer` body to drop the team assignment:

```ts
export function addPlayer(room: Room, name: string): ServerPlayer {
  const player: ServerPlayer = {
    id: nextPlayerId(),
    name,
    connected: true,
    socketId: null,
    disconnectedAt: null,
  };
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
  touch(room);
  return player;
}
```

Add a field to `Room` for the chooser's pending random card:

```ts
  /** Card currently offered to the chooser. Not game state — a reroll replaces it. */
  randomCard: TopicCard | null;
```

and initialise it to `null` in `createRoom`. Import `Player` and `TopicCard` from `@/types/game`.

- [ ] **Step 4: Rewrite the handlers**

In `src/server/handlers.ts`:

Replace the imports from `./rooms` with:

```ts
import {
  addPlayer,
  buildPlayers,
  createRoom,
  deleteRoom,
  getRoom,
  MAX_PLAYERS,
  PSYCHIC_GRACE_MS,
  playerBySocket,
  promoteHost,
  removePlayer,
  rosterIsPlayable,
  sweep,
  touch,
  type Room,
  type ServerPlayer,
} from "./rooms";
```

and the schema imports with:

```ts
import {
  cardSchema,
  configSchema,
  createRoomSchema,
  guessSchema,
  joinRoomSchema,
  subjectSchema,
} from "@/lib/socket/events";
import { drawCard } from "@/lib/cards";
```

Delete `teamOf`, `sendTargetToPsychic`'s team references, and the `round:setTeam`, `round:bet`, `round:lockBet`, `round:clue` handlers.

Rename `sendTargetToPsychic` to `sendPrivateToChooser` and replace its body:

```ts
  /**
   * The target and the pending random card reach exactly one socket: the
   * chooser's. Neither goes into `room:state`, so no other client can read
   * them out of memory or devtools.
   */
  function sendPrivateToChooser(room: Room): void {
    const game = room.game;
    if (!game?.round) return;

    const chooser = room.players.find((p) => p.id === game.round!.chooserId);
    if (!chooser?.socketId) return;

    if (game.phase === "topic" && room.randomCard) {
      io.to(chooser.socketId).emit("round:randomCard", { card: room.randomCard });
    }
    // From `reveal` onwards the target is public and travels in `room:state`.
    if (game.phase === "reveal" || game.phase === "gameover") return;
    io.to(chooser.socketId).emit("round:target", {
      roundNumber: game.round.number,
      target: game.round.target,
    });
  }
```

Update `broadcast` to call `sendPrivateToChooser(room)` and to send each socket its own redacted view:

```ts
  function broadcast(room: Room): void {
    for (const player of room.players) {
      if (player.socketId) {
        io.to(player.socketId).emit("room:state", publicRoom(room, player.id));
      }
    }
    sendPrivateToChooser(room);
  }
```

Replace `apply` so it deals a random card when the topic phase opens:

```ts
  function apply(room: Room, action: GameAction): void {
    if (!room.game) return;
    let game = gameReducer(room.game, action);
    if (game.phase === "pass") {
      game = gameReducer(game, { type: "CONFIRM_CHOOSER" });
    }
    const enteringGuess = room.game.phase !== "guess" && game.phase === "guess";
    const enteringTopic = room.game.phase !== "topic" && game.phase === "topic";
    room.game = game;
    touch(room);

    if (enteringTopic) room.randomCard = drawCard(game.usedCardIds);
    if (enteringGuess) armGuessDeadline(room);
    if (game.phase !== "guess") disarmGuessDeadline(room);

    broadcast(room);
    if (game.phase === "guess") maybeReveal(room);
  }
```

Add below `apply`:

```ts
  /** Everyone with a dial who is still connected. */
  function activeGuessers(room: Room): ServerPlayer[] {
    const round = room.game?.round;
    if (!round) return [];
    return room.players.filter(
      (p) => p.connected && p.id !== round.chooserId,
    );
  }

  /** Move on as soon as every connected guesser has locked. */
  function maybeReveal(room: Room): void {
    const round = room.game?.round;
    if (!round || room.game?.phase !== "guess") return;
    const waiting = activeGuessers(room).filter((p) => !round.locked[p.id]);
    if (waiting.length === 0) apply(room, { type: "REVEAL" });
  }
```

Change the guess-deadline timer body to reveal rather than lock:

```ts
    timersFor(room.code).guessDeadline = setTimeout(() => {
      // Whatever each dial is on when the clock runs out is that player's answer.
      if (room.game?.phase === "guess") apply(room, { type: "REVEAL" });
    }, seconds * 1000);
```

`publicRoom` gains a viewer argument in Task 10, so update the two ack calls in
`room:create` and `room:join` (there are three sites in total) from
`publicRoom(room)` to `publicRoom(room, player.id)` — using `existing.id` in the
reconnect branch. Without this the file will not compile after Task 10.

Replace `game:start` with:

```ts
    socket.on("game:start", () => {
      const me = requireHost(socket);
      if (!me) return;
      const { room } = me;
      if (room.game) return fail(socket, "เกมเริ่มไปแล้ว");
      if (!rosterIsPlayable(room)) return fail(socket, "ต้องมีอย่างน้อย 2 คน");

      room.game = createGame(buildPlayers(room), room.config, randomTarget());
      apply(room, { type: "CONFIRM_CHOOSER" });
    });
```

Add the three new round handlers:

```ts
    socket.on("round:reroll", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (game.phase !== "topic") return;
      if (game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      me.room.randomCard = drawCard(game.usedCardIds);
      touch(me.room);
      sendPrivateToChooser(me.room);
    });

    socket.on("round:card", (payload) => {
      const data = parse(socket, cardSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me?.room.game?.round) return;
      if (me.room.game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      apply(me.room, { type: "SET_CARD", card: data });
    });

    socket.on("round:subject", (payload) => {
      const data = parse(socket, subjectSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me?.room.game?.round) return;
      if (me.room.game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      apply(me.room, { type: "SUBMIT_SUBJECT", subject: data.subject });
    });
```

Replace `round:guess` and `round:lockGuess` with:

```ts
    socket.on("round:guess", (payload) => {
      const data = parse(socket, guessSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round || game.phase !== "guess") return;
      // The chooser knows the answer, so they never get a dial.
      if (me.player.id === game.round.chooserId) return;

      me.room.game = gameReducer(game, {
        type: "SET_GUESS",
        key: me.player.id,
        value: data.value,
      });
      touch(me.room);
      // No broadcast: dials stay hidden from each other until reveal.
    });

    socket.on("round:lockGuess", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round || game.phase !== "guess") return;
      if (me.player.id === game.round.chooserId) return;
      apply(me.room, { type: "LOCK_GUESS", key: me.player.id });
    });
```

In the `disconnect` handler, after `watchPsychic(room)` add:

```ts
      // A player dropping can be the last one we were waiting on.
      maybeReveal(room);
```

Rename `watchPsychic` to `watchChooser` and update its `round.psychicId` references to `round.chooserId`, and its phase list to `["topic", "subject", "guess"]`.

Delete the `throttledGuessBroadcast` function, the `guessBroadcast`/`pendingGuess` timer fields and `GUESS_BROADCAST_MS`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/socket/events.ts src/types/online.ts src/server/rooms.ts src/server/handlers.ts
git commit -m "Move the socket contract to topic cards and per-player dials"
```

---

## Task 10: Redaction

**Files:**
- Modify: `src/server/redact.ts`
- Modify: `scripts/check-redaction.ts`
- Create: `tests/unit/redact.test.ts`

**Interfaces:**
- Produces: `publicRoom(room, viewerId): PublicRoom` — hides the target before reveal and every dial but the viewer's own.

- [ ] **Step 1: Write the failing redaction test**

Create `tests/unit/redact.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/redact.test.ts`
Expected: FAIL — `publicRoom` takes one argument.

- [ ] **Step 3: Rewrite redact**

Replace all of `src/server/redact.ts`:

```ts
import type { GameState } from "@/types/game";
import type { PublicGameState, PublicRoom, RoomPlayer } from "@/types/online";
import type { Room } from "./rooms";

/**
 * The one place that decides what leaves the server.
 *
 * Two secrets travel in room state, and both are held back until the reveal:
 * the target, which is dropped from the payload entirely, and every other
 * player's dial, which would let a late guesser copy an early one. The chooser
 * gets their target through a direct `round:target` emit instead.
 *
 * If you add a field to `Round` that could give either away, strip it here.
 */
export function publicGame(
  game: GameState | null,
  viewerId: string,
): PublicGameState | null {
  if (!game) return null;
  if (!game.round) return { ...game, round: null };

  const { target, ...rest } = game.round;
  const revealed = game.phase === "reveal" || game.phase === "gameover";

  if (revealed) {
    return { ...game, round: { ...rest, target } };
  }

  // Before reveal a viewer sees their own dial and nobody else's.
  const own = Object.hasOwn(rest.guesses, viewerId)
    ? { [viewerId]: rest.guesses[viewerId] }
    : {};

  return { ...game, round: { ...rest, guesses: own } };
}

export function publicRoom(room: Room, viewerId: string): PublicRoom {
  const players: RoomPlayer[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    config: room.config,
    game: publicGame(room.game, viewerId),
    guessDeadlineAt: room.guessDeadlineAt,
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/redact.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Update the standing check**

In `scripts/check-redaction.ts`, replace the round-walking section so it uses the new actions and asserts foreign dials too. Replace everything from `let game = createGame(` to the end of the file with:

```ts
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
```

Then update the helpers earlier in that file: `roomWith` must add `randomCard: null` and drop `teamId`; `wire(game)` becomes `JSON.stringify(publicRoom(roomWith(game), "p2"))`; the `players`/`teams`/`config` constants become the Task 4 shapes; and `card` is the `TopicCard` from Task 2.

- [ ] **Step 6: Run both checks**

Run: `npm run check:redaction && npm test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/redact.ts scripts/check-redaction.ts tests/unit/redact.test.ts
git commit -m "Hide other players' dials as well as the target"
```

---

## Task 11: Online mode end to end

**Files:**
- Modify: `src/lib/store/onlineGame.tsx`
- Modify: `src/app/online/[code]/page.tsx`
- Modify: `src/components/lobby/Lobby.tsx`
- Delete: `src/components/lobby/TeamPicker.tsx`

**Interfaces:**
- Consumes: Tasks 2–10.
- Produces: a playable online game. This is the task that restores a green `npm run build`.

- [ ] **Step 1: Rewrite the online store**

In `src/lib/store/onlineGame.tsx`:

Change the identity key to `"wavelength:online:v2"`.

Replace the context value interface's role block with:

```tsx
  isHost: boolean;
  isChooser: boolean;
  canGuess: boolean;
  canLock: boolean;
  /** Random card offered to the chooser, or null when not the chooser. */
  randomCard: TopicCard | null;
  /** Guessers who have not locked yet. */
  waitingCount: number;
```

and the action block with:

```tsx
  setConfig: (config: Partial<GameConfig>) => void;
  startGame: () => void;
  reroll: () => void;
  setCard: (card: TopicCard) => void;
  submitSubject: (subject: string) => void;
  setGuess: (value: number) => void;
  lockGuess: () => void;
  showScoreboard: () => void;
  nextRound: () => void;
  rematch: () => void;
```

Add `randomCard` state beside `privateTarget`:

```tsx
  const [randomCard, setRandomCard] = useState<TopicCard | null>(null);
```

Register its listener alongside `onTarget`:

```tsx
    const onRandomCard = (payload: { card: TopicCard }) =>
      setRandomCard(payload.card);
    socket.on("round:randomCard", onRandomCard);
```

and unregister it in the cleanup.

Replace the derived-role block with:

```tsx
  const round = room?.game?.round ?? null;
  const phase = room?.game?.phase;

  const isHost = Boolean(me && room && room.hostId === me.id);
  const isChooser = Boolean(me && round && round.chooserId === me.id);
  // The chooser knows the answer, so they never get a dial.
  const canGuess = Boolean(me) && !isChooser && phase === "guess";
  const canLock = canGuess && !round?.locked[me?.id ?? ""];

  const waitingCount = round
    ? (room?.players.filter(
        (p) => p.connected && p.id !== round.chooserId && !round.locked[p.id],
      ).length ?? 0)
    : 0;
```

Replace the `target` derivation's `isPsychic` reference with `isChooser`.

Replace `setGuess` and add the new emitters in the memo:

```tsx
      reroll: () => emit().emit("round:reroll"),
      setCard: (card) => emit().emit("round:card", card),
      submitSubject: (subject) => emit().emit("round:subject", { subject }),
      setGuess: (value) => {
        setNeedle(value);
        emit().emit("round:guess", { value });
      },
      lockGuess: () => emit().emit("round:lockGuess"),
```

Delete `setTeam`, `setBet`, `lockBet` and the `round:guessMoved` listener.

Change `onState` so it only follows the server's needle for this client:

```tsx
    const onState = (next: PublicRoom) => {
      setRoom(next);
      const mine = next.game?.round?.guesses;
      const id = identity.current?.playerId;
      if (id && mine && typeof mine[id] === "number") setNeedle(mine[id]);
      if (next.game?.phase !== "topic") setRandomCard(null);
    };
```

- [ ] **Step 2: Rewrite the lobby**

In `src/components/lobby/Lobby.tsx`:

Delete the `TeamPicker` import and usage, the `coop`/`teamsFilled` logic and the left-right-bet toggle. Replace `TARGET_SCORES` with `const ROUND_COUNTS = [5, 10, 15];` and `MIN_PLAYERS_FOR_TEAMS` with `const MIN_PLAYERS = 2;`.

Replace the players section body with:

```tsx
        <ul className="flex flex-wrap gap-2">
          {room.players.map((p, i) => (
            <li key={p.id}>
              <span
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
                  p.connected
                    ? "bg-slate-700 text-slate-100"
                    : "bg-slate-800 text-slate-500 line-through"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                />
                <span className="truncate">{p.name}</span>
                {p.id === room.hostId && <span title="host">👑</span>}
                {p.id === me?.id && (
                  <span className="text-xs text-amber-300">(คุณ)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
```

with `import { PLAYER_COLORS } from "@/components/game/ScoreBoard";` and
`import { rotationIsEven } from "@/lib/game/setup";` added, and set
`canStart = isHost && room.players.length >= MIN_PLAYERS`.

Replace the score-target section with:

```tsx
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            เล่นกี่รอบ
          </h2>
          <div className="flex gap-2">
            {ROUND_COUNTS.map((r) => (
              <button
                key={r}
                disabled={!isHost}
                onClick={() => onConfig({ rounds: r })}
                className={pill(room.config.rounds === r)}
              >
                {r}
              </button>
            ))}
          </div>
          {!rotationIsEven(room.players.length, room.config.rounds) && (
            <p className="mt-2 text-xs text-amber-300/80">
              {room.config.rounds} รอบ หารกับ {room.players.length} คนไม่ลงตัว
              บางคนจะได้เลือกมากกว่าคนอื่น
            </p>
          )}
        </div>
```

Then delete the file:

```bash
git rm src/components/lobby/TeamPicker.tsx
```

- [ ] **Step 3: Rewrite the online phase router**

In `src/app/online/[code]/page.tsx`, replace the whole `RoomGame` switch with:

```tsx
  const chooser = state.players.find((p) => p.id === round.chooserId);
  const chooserName = chooser?.name ?? "?";

  switch (state.phase) {
    // `pass` is walked through server-side; it only shows up in a race.
    case "pass":
    case "topic":
      if (game.isChooser && game.randomCard) {
        return (
          <TopicPickerView
            card={game.randomCard}
            chooserName={chooserName}
            onReroll={game.reroll}
            onConfirm={game.setCard}
          />
        );
      }
      return (
        <WaitingView
          card={null}
          chooserName={chooserName}
          roundNumber={round.number}
          note="กำลังเลือกหัวข้อ"
        />
      );

    case "subject":
      if (game.isChooser && round.card && target !== undefined) {
        return (
          <SubjectView
            card={round.card}
            target={target}
            chooserName={chooserName}
            onSubmit={game.submitSubject}
          />
        );
      }
      return (
        <WaitingView
          card={round.card}
          chooserName={chooserName}
          roundNumber={round.number}
          note="กำลังคิดคำตอบ"
        />
      );

    case "guess":
      return round.card ? (
        <GuessView
          card={round.card}
          subject={round.subject}
          guess={needle}
          discussionSeconds={secondsLeft}
          onChange={game.setGuess}
          onLock={game.lockGuess}
          canGuess={game.canGuess}
          canLock={game.canLock}
          waitingCount={game.waitingCount}
          watchingLabel={
            game.isChooser
              ? "คุณเป็นคนเลือก — รอคนอื่นเดา"
              : "ล็อกแล้ว รอคนอื่น"
          }
        />
      ) : null;

    case "reveal":
      return (
        <RevealView
          round={{ ...round, target: target ?? 50 } as Round}
          players={state.players}
          sharedDial={state.config.sharedDial}
          onNext={game.showScoreboard}
          canAdvance={game.isHost}
        />
      );

    case "scoreboard":
    case "gameover":
      return (
        <ScoreboardScreen
          state={state}
          onNext={game.nextRound}
          onRematch={game.rematch}
          onExit={() => {
            game.leaveRoom();
            router.push("/");
          }}
          canAdvance={game.isHost}
          exitLabel="ออกจากห้อง"
        />
      );

    default:
      return <Loading />;
  }
```

Update the imports in that file: drop `BetView`, `PsychicView`, `getCard`, `teamColor`; add `TopicPickerView`, `SubjectView`, and `Round` from `@/types/game`. Change the `Lobby` props to drop `onMove`.

- [ ] **Step 4: Restore the build**

Run: `npm run typecheck && npm run build`
Expected: both PASS. Fix any remaining references to deleted symbols until they do.

- [ ] **Step 5: Play a full online game**

Run: `npm run dev`, open three browser tabs (clear `localStorage` before each so they take different seats), create a room, play a full 5-round game.
Expected: chooser sees the picker and can reroll; others see "กำลังเลือกหัวข้อ"; chooser sees the band, others never do; each guesser has their own dial and cannot see the others; reveal shows every needle labelled; leaderboard ranks players; the chooser scores the average.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store/onlineGame.tsx src/app/online/ src/components/lobby/
git commit -m "Wire online play to per-player hidden dials and a leaderboard"
```

---

## Task 12: Documentation

**Files:**
- Rewrite: `DESIGN.md`
- Modify: `PROJECT.md`, `README.md`

- [ ] **Step 1: Rewrite DESIGN.md**

Replace the whole file with the new rules: the three-layer topic structure, random vs custom, the chooser rotation, the shared-dial vs individual-dial split, the unchanged 2-3-4-3-2 bands, `scoreRound`'s chooser average, the round-count end condition, and the three layers of target hiding. Delete every mention of teams, the left/right bet and co-op mode.

- [ ] **Step 2: Update PROJECT.md**

In the file map, replace the deleted rows (`BetView`, `TeamPicker`, `PsychicView`, `th-core.json`, `rotation.ts` description) with the new ones (`TopicPickerView`, `SubjectView`, `topics.json`, `chooserForRound`), update the socket-event table to Task 9's list, add `tests/unit/` and `vitest.config.ts`, and add a Phase 5 section describing this change with its spec and plan links.

- [ ] **Step 3: Update README.md**

Update the deck section to point at `src/lib/cards/topics.json` and show the new card shape, and add `npm test` to the scripts table.

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md PROJECT.md README.md
git commit -m "Document the topic-mode rules"
```

---

## Task 13: Deploy

**Files:** none — deployment only.

- [ ] **Step 1: Verify locally one more time**

Run: `npm test && npm run check:redaction && npm run typecheck && npm run build`
Expected: all four PASS.

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Deploy**

```bash
ssh -i ~/.ssh/newportfolio_deploy tide@49.231.43.187 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; export NODE_OPTIONS=--dns-result-order=ipv4first; cd /var/www/wavelength && git pull origin main && npm ci && npm run build && pm2 restart wavelength'
```

> A restart drops every live room. Deploy when nobody is playing.

- [ ] **Step 4: Verify from outside**

```bash
curl -s https://wavelength.madebytide.xyz/healthz
```

Expected: `{"ok":true,"uptime":N}`.

Then open the site in two devices and play one round end to end.

- [ ] **Step 5: Commit any doc fixes the deploy turned up**

```bash
git add -A && git commit -m "Note what the topic-mode deploy turned up" && git push origin main
```

---

## Self-review notes

**Spec coverage:** §2 topic structure → Tasks 2, 6. §3 mode split → Tasks 7, 8, 11. §4 flow → Task 4. §5 data model → Task 2. §6 scoring → Task 3. §7 rotation → Tasks 3, 9. §8 hiding → Task 10. §9 deck → Task 2. §10 screens → Tasks 5, 6, 7. §11 events → Task 9. §12 cautions → Tasks 8, 11, 13. §13 testing → Tasks 1, 10, 11.

**Known gap carried forward:** the spec's `sharedDial` config is set by the client that starts the game (local always `true`, online always `false`). The lobby does not expose it as a toggle, because a room where some players share a screen is not a case the design covers.
