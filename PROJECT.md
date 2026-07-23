# Wavelength — Project Plan

Implementation plan. กติกาเกมอยู่ใน [DESIGN.md](DESIGN.md)

---

## 1. Tech Stack

| Layer | Choice | สถานะ | เหตุผล |
|---|---|---|---|
| Framework | **Next.js 16 (App Router)** | ติดตั้งแล้ว | RSC + route handlers, deploy ง่าย |
| Language | **TypeScript** (strict) | ติดตั้งแล้ว | shared types ระหว่าง client/server สำคัญมากกับ socket payload |
| Styling | **Tailwind CSS v4** | ติดตั้งแล้ว | prototype เร็ว, dial ใช้ CSS transform ล้วน |
| State (client) | **React Context + useReducer** | ติดตั้งแล้ว | reducer เป็น pure function → server รันตัวเดียวกันได้ตอนทำ online |
| Animation | **CSS transition / keyframes** | ติดตั้งแล้ว | dial reveal ใช้แค่ transform ไม่ต้องพึ่ง library |
| Realtime | **Socket.io** (server + client) | ติดตั้งแล้ว | rooms API มาให้แล้ว, มี reconnect + fallback |
| Validation | **Zod** | ติดตั้งแล้ว | validate socket payload ทั้งสองฝั่ง, infer type จาก schema เดียว |
| Server runtime | **tsx** | ติดตั้งแล้ว | รัน `server.ts` (TypeScript) ตรง ๆ ทั้ง dev/prod ไม่ต้อง compile แยก |
| Testing | **Vitest** + **Playwright** | ยังไม่ติดตั้ง | unit สำหรับ scoring/state machine, e2e สำหรับ multi-client |
| Package manager | **npm** | | เครื่อง dev ยังไม่มี pnpm |

> **State**: PROJECT.md เดิมวาง Zustand ไว้ แต่ใช้ Context + `useReducer` แทนทั้ง 2 โหมด
> เพราะ pure reducer (`lib/game/reducer.ts`) ย้ายไปรันบน server ได้ตรง ๆ
> ถ้าเจอปัญหา re-render ค่อยเปลี่ยน context layer เป็น Zustand — reducer ไม่ต้องแตะ

### เรื่อง Socket.io กับ Next.js

Socket.io ต้องมี long-lived server. Next.js API routes บน Vercel เป็น serverless → **ใช้ไม่ได้**

ทำแล้ว: **custom server** (`server.ts`) ยัด Next handler + Socket.io ไว้ process เดียว
รันด้วย `tsx server.ts` ทั้ง dev และ prod. Deploy ต้องเป็น platform ที่รัน Node ยาว ๆ
(Railway / Fly.io / Render) ไม่ใช่ Vercel

Local mode ไม่แตะ socket เลย — รันเป็น static client เพียว ๆ ได้

---

## 2. Folder Structure

ไฟล์ไหนทำอะไร — อ่านตารางนี้ก่อนแก้อะไรก็ตาม

### Entry points

| ไฟล์ | หน้าที่ |
|---|---|
| `server.ts` | Node entrypoint. Next + Socket.io ใน process เดียว. `npm run dev` / `npm start` รันไฟล์นี้ผ่าน tsx |
| `src/app/page.tsx` | หน้าแรก เลือก Local / Online |
| `src/app/local/play/page.tsx` | phase router โหมด local — อ่าน `useLocalGame()` |
| `src/app/online/[code]/page.tsx` | lobby + phase router โหมด online — อ่าน `useOnlineGame()` |

สองไฟล์ router ทำงานเหมือนกัน: map phase → view component. ต่างกันแค่ที่มาของ state
กับ prop `can*` ที่บอกว่าใครกดได้ ถ้าจะเพิ่ม phase ต้องแก้ทั้งสองไฟล์

### Pure logic — ไม่มี React ไม่มี socket, ใช้ร่วมกันทั้ง 2 โหมด

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/game.ts` | SpectrumCard, Player, Team, Round, Phase, GameState, GameConfig |
| `src/lib/game/reducer.ts` | **state machine ทั้งเกม** — local รันบน client, online รันบน server ตัวเดียวกัน. randomness ไม่อยู่ในนี้ ส่งเข้ามาเป็น `RoundSeed` |
| `src/lib/game/scoring.ts` | `scoreGuess` 4/3/2/0, `scoreBet` 1/0, `bandSegments` สำหรับวาดแถบ |
| `src/lib/game/rotation.ts` | ใครเป็น psychic รอบไหน + `advancePsychic` |
| `src/lib/game/target.ts` | สุ่ม target ในช่วง `[12.5, 87.5]` กัน band ล้นขอบ |
| `src/lib/game/setup.ts` | local เท่านั้น: รายชื่อ → players + teams |
| `src/lib/cards/th-core.json` | deck 30 ใบ — แก้ไฟล์นี้ไฟล์เดียวถ้าจะเพิ่มการ์ด |
| `src/lib/cards/index.ts` | loader + `drawCardId` แบบไม่ซ้ำในเกมเดียว |

### Server (online เท่านั้น)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/server/redact.ts` | **จุดเดียวที่ตัดสินว่า target ออกจาก server หรือไม่** — เพิ่ม field ที่อาจใบ้ target ต้องมาตัดที่นี่ |
| `src/server/rooms.ts` | in-memory `Map<code, Room>`, auto-balance ทีม, host transfer, sweeper. เปลี่ยนเป็น Redis = แก้ไฟล์นี้ไฟล์เดียว |
| `src/server/handlers.ts` | socket handler ทุกตัว + role guard + timer (guess deadline, psychic grace, throttle เข็ม) |
| `src/server/codes.ts` | สุ่ม room code |
| `src/types/online.ts` | RoomPlayer, PublicRound, PublicGameState, PublicRoom |
| `src/lib/socket/events.ts` | ชื่อ event + Zod schema + typed event map — **ใช้ร่วมทั้ง client และ server** |
| `scripts/check-redaction.ts` | `npm run check:redaction` — fail ถ้า target โผล่ใน payload ก่อน reveal |

### Client state

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/store/localGame.tsx` | Context + `useReducer` + persist localStorage |
| `src/lib/store/onlineGame.tsx` | Context + socket. ไม่มีกติกาเกมอยู่ในนี้เลย — ส่ง intent ขึ้น server แล้วรับ state กลับ. เก็บ `privateTarget` แยกจาก room state เพราะมาคนละ channel |
| `src/lib/socket/client.ts` | socket singleton ต่อ tab |
| `src/lib/hooks/useCountdown.ts` | นับถอยหลัง |

### View components — โหมดไหนก็ใช้ตัวเดียวกัน

รับ prop เป็น plain data ทั้งหมด ไม่มีตัวไหนดึง store เอง

| ไฟล์ | ใช้ที่ไหน | prop ที่คุมสิทธิ์ |
|---|---|---|
| `components/dial/Dial.tsx` | ทุกที่ | `onChange` (ไม่ส่ง = read-only), `target` (ไม่ส่ง = **ไม่ mount band เลย**) |
| `components/dial/TargetBand.tsx` | Dial | — |
| `components/dial/geometry.ts` | Dial | value ↔ angle, arc path, pointer → value |
| `components/game/PsychicView.tsx` | ทั้ง 2 โหมด | — |
| `components/game/GuessView.tsx` | ทั้ง 2 โหมด | `canGuess`, `canLock`, `watchingLabel` |
| `components/game/BetView.tsx` | ทั้ง 2 โหมด | `canBet` |
| `components/game/RevealView.tsx` | ทั้ง 2 โหมด | `canAdvance` |
| `components/game/ScoreboardScreen.tsx` | ทั้ง 2 โหมด | `canAdvance`, `exitLabel` |
| `components/game/ScoreBoard.tsx` | ทั้ง 2 โหมด | — |
| `components/game/PassDeviceScreen.tsx` | local เท่านั้น | — |
| `components/game/WaitingView.tsx` | online เท่านั้น | — |
| `components/lobby/*` | online เท่านั้น | Lobby, TeamPicker, RoomCode |
| `components/ui/*` | ทุกที่ | Button, Screen, SpectrumHeading |

prop `can*` ทุกตัว default เป็น `true` เพื่อให้ local mode ใช้ได้โดยไม่ต้องส่งอะไรเพิ่ม

### หลักการแบ่ง

- `lib/game/*` = **pure functions ล้วน** ไม่มี React ไม่มี socket → local กับ online ใช้ร่วมกัน ทดสอบง่าย
  randomness ไม่อยู่ในนี้ — การ์ดกับ target ส่งเข้ามาเป็น `RoundSeed` ใน action payload
  (local: store สุ่ม / online: server สุ่ม)
- `server/*` = แตะได้แค่ฝั่ง server ห้าม import จาก client
- `redact.ts` แยกไฟล์ตั้งใจ — จุดเดียวที่ตัดสินว่า target หลุดหรือไม่ ทำให้ audit ง่ายและเขียน test คลุมได้ครบ
- Local mode คือ state machine ตัวเดียวกับ online แค่รันบน client แทน server

### การซ่อน target — 3 ชั้น

1. **Server ไม่ส่งออกไป** — `redact.ts` ตัด field `target` ออกจากทุก payload ที่
   broadcast จนกว่าจะถึง phase `reveal` psychic รับ target ผ่าน event
   `round:target` ที่ยิงไปที่ socket ตัวเดียว ไม่ใช่ broadcast
2. **Client ไม่ mount** — `<Dial>` ที่ไม่ได้รับ prop `target` จะไม่ render
   `<TargetBand>` เลย ไม่ใช่ซ่อนด้วย CSS
3. **Psychic ห้ามลากเข็ม** — `canGuess = isGuessTeam && !isPsychic` เพราะ psychic
   รู้คำตอบอยู่แล้ว

ชั้น 1 คือชั้นที่สำคัญที่สุด ชั้น 2 อย่างเดียวไม่พอเมื่อ state วิ่งผ่าน network
`npm run check:redaction` เฝ้าชั้น 1 ไว้

### การ validate action ฝั่ง server

ทุก action จาก client ผ่าน 3 ด่าน:

1. Zod schema ใน `lib/socket/events.ts` — payload หน้าตาถูกไหม
2. role guard ใน `handlers.ts` — คนนี้เป็น psychic / อยู่ทีมที่เดา / เป็น host ไหม
3. phase guard ใน `reducer.ts` — action นี้ทำได้ใน phase นี้ไหม

client ไม่ถูกเชื่ออะไรเลยนอกจาก "socket นี้คือ player คนไหน"

---

## 3. Milestones

### Phase 1 — Scaffold ✅

- [x] Next.js 16 + TS strict + Tailwind v4
- [x] `types/game.ts` ครบทุก entity
- [x] `lib/game/scoring.ts` — band 2-3-4-3-2 + left/right bet
- [x] `lib/game/reducer.ts` — phase machine + guard ทุก action
- [x] `lib/game/rotation.ts`, `target.ts`, `setup.ts`
- [x] Deck `th-core.json` 30 ใบ + draw ไม่ซ้ำในเกมเดียว
- [x] `components/dial/Dial.tsx` — pointer drag + keyboard (`role="slider"`)
- [x] หน้าแรกเลือกโหมด (ปุ่ม Online disabled)
- [ ] ตั้ง Vitest + Playwright, เขียน unit test ให้ `lib/game/*`
- [ ] ขยาย deck เป็น 60+ ใบ

---

### Phase 2 — Local Mode ✅ (เล่นจบเกมได้แล้ว)

- [x] `store/localGame.tsx` — Context + useReducer + persist `localStorage`
- [x] Setup screen: ชื่อผู้เล่น (auto สลับทีม), ชื่อทีม, เป้าคะแนน, timer, toggle bet
- [x] `PassDeviceScreen` — บังคับกดยืนยันตัวก่อนเห็น target
- [x] `PsychicView` — target + TargetBand + ช่อง clue
- [x] `GuessView` — ลาก dial, target ไม่อยู่ใน DOM, timer auto-lock เมื่อหมดเวลา
- [x] `BetView` ←/→
- [x] `RevealView` — band กางออก + เข็ม ease + คะแนนแยกทีม
- [x] `ScoreboardScreen` + จบเกม + rematch
- [x] Co-op mode อัตโนมัติเมื่อผู้เล่น < 4 คน
- [x] Responsive มือถือเป็นหลัก
- [ ] e2e: เล่นจบ 1 เกมเต็ม + assert ว่า target ไม่อยู่ใน DOM ตอน guess/bet
- [ ] Sudden death ตอนคะแนนถึงเป้าพร้อมกัน (ตอนนี้ทีมแรกใน array ชนะ)

**ยืนยันด้วยมือแล้ว:** 4 ผู้เล่น → pass → clue → ลากเข็ม 50→25 → lock → bet ซ้าย →
reveal (เข็ม 25.1 / target 22.0 / ห่าง 3.1 → +3, bet ถูก → +1) → scoreboard →
รอบ 2 สลับไป Bee ทีมเขียว. refresh กลางเกม state ไม่หาย. `data-testid="target-band"`
ไม่โผล่ใน DOM ตอน pass/guess/bet

---

### Phase 3 — Online Mode ✅ (เล่นหลายเครื่องได้แล้ว)

- [x] `server.ts` custom server (Next + Socket.io) process เดียว
- [x] `server/rooms.ts` in-memory store + auto-balance ทีม + sweeper
- [x] `server/codes.ts` gen code 4 ตัว (ตัด `0/O`, `1/I/L`, `5/S`, `8/B`)
- [x] `lib/socket/events.ts` — event + Zod schema ใช้ร่วม 2 ฝั่ง
- [x] `server/handlers.ts` — validate 3 ชั้น: Zod → role guard → phase guard ใน reducer
- [x] `server/redact.ts` + `scripts/check-redaction.ts` ที่ fail ถ้า target หลุด
- [x] `/online` create/join + `/online/[code]` lobby + play
- [x] Lobby: room code, copy ลิงก์, ย้ายทีม, host ปรับ config
- [x] Dial sync throttle 50ms, ตัด echo กลับหาคนลากเอง
- [x] Reconnect ด้วย `playerId` ใน `localStorage`
- [x] Psychic หลุด 30 วิ → `ABORT_ROUND` จั่วใหม่ให้เพื่อนร่วมทีม / Host หลุด → โอน host
- [x] Timer เป็น server deadline → ทุกเครื่องนับตรงกัน + auto-lock ฝั่ง server
- [ ] e2e Playwright แทน manual check
- [ ] Spectator mode (ตอนนี้เข้าห้องหลังเกมเริ่มไม่ได้เลย)

**ยืนยันด้วยมือแล้ว** (4 tab, 4 ผู้เล่น, ห้อง `8M47`):
lobby auto-balance → host เริ่มเกม → psychic เห็น band, อีก 3 คนไม่เห็น →
Cat ลากเข็ม 50→59 แล้ว Ake กับ Dao เห็นเข็มขยับตาม → timer หมดเวลา server auto-lock →
ทีมเขียว bet ซ้าย → reveal (เข็ม 59.0 / target 24.2 / ห่าง 34.8 → +0, bet ถูก → +1) →
non-host เห็น "รอ host ไปต่อ" → รอบ 2 psychic ย้ายไป Bee ทีมเขียว, Ake ไม่เห็น target แล้ว →
reload กลางรอบ กลับเข้า seat เดิมได้ → ปิด tab ของ psychic (Bee) ทิ้ง 30 วิ →
รอบ 2 ถูกจั่วใหม่ psychic ย้ายไป Dao ทีมเดิม ไม่มีใครได้คะแนน

`npm run check:redaction` ผ่านทุก phase

**ข้อจำกัดที่รู้อยู่:** ใครถือ `playerId` ก็เข้า seat นั้นได้ ไม่มี token กันแย่ง seat
พอสำหรับเกมปาร์ตี้ แต่ 2 tab ในเบราว์เซอร์เดียวกันเป็นคนละผู้เล่นไม่ได้ (แชร์ localStorage)

---

### Phase 4 — Deploy

**เป้า:** ออนไลน์จริง เพื่อนเข้าเล่นจาก URL ได้

- [ ] Dockerfile (Node 24 alpine, multi-stage)
- [ ] Deploy Railway หรือ Fly.io (ต้องรองรับ WebSocket + sticky session)
- [ ] Env config: `PORT`, `HOST`, `NODE_ENV` (socket ต่อ same-origin อยู่แล้ว ไม่ต้องมี URL แยก)
- [ ] Health check endpoint
- [ ] Structured logging (room created/joined/ended, error)
- [ ] Rate limit ต่อ socket
- [ ] PWA manifest + icon (เพิ่มลง home screen)
- [ ] Lighthouse mobile ≥ 90
- [ ] Test บนเน็ตจริง: 4G, wifi กระตุก, สลับแอปแล้วกลับมา
- [ ] README: วิธีรัน + วิธี deploy

**Done when:** ส่ง URL ให้เพื่อน 6 คน เล่นจบเกมได้ ไม่มีใครหลุด

---

## 4. Backlog (หลัง Phase 4)

- Custom deck — ผู้เล่นสร้าง spectrum เอง
- Deck ภาษาอังกฤษ + toggle ภาษา
- Redis-backed rooms (รองรับหลาย instance)
- Emoji reaction ตอน reveal
- ประวัติผลเกม + สถิติรายคน
- Sound effects
- Spectator link แยก

---

## 5. Risks

| Risk | ผลกระทบ | ทางแก้ |
|---|---|---|
| Target รั่วผ่าน socket payload | เกมพัง หมดสนุก | `redact.ts` จุดเดียว + e2e เช็ก network payload |
| Vercel รัน Socket.io ไม่ได้ | deploy ไม่ผ่าน | ตัดสินตั้งแต่แรกแล้ว: custom server + Railway/Fly |
| Dial ลากไม่ลื่นบนมือถือ | UX แย่มาก | ทำ dial ก่อนใครใน Phase 1, ทดสอบเครื่องจริง |
| Reconnect หลุดกลางรอบ | เกมค้าง | Phase machine ต้องมีทางออกทุก state + timeout |
| Deck เล็กเกิน เจอการ์ดซ้ำ | น่าเบื่อ | ≥60 ใบตั้งแต่ Phase 1, no-repeat ต่อเกม |
