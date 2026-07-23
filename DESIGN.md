# Wavelength — Game Design

เกมทายใจแบบ spectrum guessing. ทีมช่วยกันอ่านใจ psychic ว่าเขาคิดถึงจุดไหนบนแถบค่าต่อเนื่อง

---

## 1. องค์ประกอบ

### Spectrum Card

การ์ดใบนึง = คู่คำตรงข้าม 1 คู่ วางไว้สองปลายของ dial

| Left (0) | Right (100) |
|---|---|
| อาหารแย่ | อาหารอร่อย |
| หนัง flop | หนังดัง |
| ร้อน | เย็น |
| ของถูก | ของแพง |
| งานอดิเรก | อาชีพ |
| ไม่จำเป็น | จำเป็น |

กติกา: คู่คำต้องเป็น spectrum ต่อเนื่อง ไม่ใช่ binary. "จริง/เท็จ" ใช้ไม่ได้ เพราะไม่มีตรงกลาง

### Dial

แถบครึ่งวงกลม ค่า `0.0 – 100.0`
- `0` = ปลายซ้าย, `100` = ปลายขวา
- Target = เลขทศนิยม 1 ตำแหน่ง สุ่มในช่วง `[12.5, 87.5]` (กันไม่ให้ scoring band ล้นขอบ)
- Guess = ค่าที่ทีมหมุนมาหยุด

### Roles ต่อ 1 รอบ

| Role | เห็นอะไร | ทำอะไร |
|---|---|---|
| **Psychic** | spectrum + **target** | ให้ clue 1 คำ/วลี |
| **Team ของ psychic** | spectrum + dial โล่ง | ถกกัน แล้วหมุน dial |
| **ทีมตรงข้าม** | spectrum + ตำแหน่งที่ทีมแรกหมุน | เดา **ซ้าย/ขวา** ของ target |

---

## 2. ลำดับการเล่น 1 รอบ

1. **จั่ว spectrum card** — สุ่มจาก deck ที่ยังไม่ใช้ในเกมนี้
2. **สุ่ม target** — เห็นเฉพาะ psychic
3. **Psychic ให้ clue** — คำหรือวลีสั้น
4. **ทีมถกกัน** — จับเวลาได้ (default 90 วิ, ปิดได้)
5. **ทีมหมุน dial แล้วล็อก**
6. **ทีมตรงข้าม bet ซ้าย/ขวา** — ว่า target อยู่ฝั่งไหนของเข็มที่ทีมแรกหมุน
7. **เปิด target** — animation กางแถบคะแนน
8. **ให้คะแนนทั้งสองทีม**
9. **หมุน psychic ไปคนถัดไป, สลับทีม**

### กติกา Clue

- ห้ามใช้ตัวเลข, %, ทิศทาง ("ค่อนไปทางขวา", "เกือบสุด")
- ห้ามใช้คำที่ปรากฏบน spectrum card
- ห้ามใช้ท่าทาง / น้ำเสียงชี้นำ
- ยาว 1 คำหรือวลีสั้น ไม่ใช่ประโยคยาว
- ตอบคำถามทีมได้แค่ "ใช่ / ไม่ใช่ / ไม่ตอบ" (optional rule, toggle ได้)

---

## 3. ระบบคะแนน

### Scoring band

target เป็นศูนย์กลางของแถบกว้างรวม 25 หน่วย แบ่งเป็น 5 ช่อง ช่องละ 5 หน่วย

```
   2  |  3  |  4  |  3  |  2
-12.5 -7.5  -2.5  +2.5  +7.5 +12.5
              ^
            target
```

| ระยะห่าง `d = |guess − target|` | คะแนน |
|---|---|
| `d ≤ 2.5` | **4** |
| `2.5 < d ≤ 7.5` | **3** |
| `7.5 < d ≤ 12.5` | **2** |
| `d > 12.5` | **0** |

คะแนนนี้ได้ทั้ง psychic และทีมของ psychic (คะแนนทีม)

### Left/Right bet ของทีมตรงข้าม

- เดาถูกฝั่ง → **+1** ให้ทีมตรงข้าม
- เดาผิด → **0**
- ถ้าทีมแรกได้ 4 (ตรงกลางเป๊ะ) → ทีมตรงข้ามได้ 0 อัตโนมัติ (ไม่มีฝั่งให้เดา)

### จบเกม

- ทีมแรกที่ถึง **10 คะแนน** ชนะ (config ได้: 7 / 10 / 15)
- ถ้าถึงพร้อมกันในรอบเดียวกัน → เล่น sudden-death 1 รอบ ทีมไหนใกล้ target กว่าชนะ
- Solo/co-op mode (ผู้เล่นน้อย): ไม่มีทีมตรงข้าม เล่นสะสมคะแนนรวมให้ถึงเป้าใน N รอบ

---

## 4. โหมด Local (จอเดียว / ส่งมือถือต่อกัน)

จอเดียว หมุนเวียนคนถือ

### Flow

```
[Setup] ตั้งชื่อทีม + รายชื่อผู้เล่น + เป้าคะแนน
   ↓
[Pass Screen] "ส่งเครื่องให้ <ชื่อ psychic>" → ปุ่ม "ฉันคือ <ชื่อ> ✓"
   ↓
[Psychic Screen] เห็น spectrum + target ชัด → พิมพ์/พูด clue → กด "พร้อม"
   ↓
[Guess Screen] target ถูกซ่อน (blur/ปิดฝา) → ทีมหมุน dial → กด "ล็อก"
   ↓
[Bet Screen] ทีมตรงข้ามกด ← หรือ →
   ↓
[Reveal] เปิด target + แจกคะแนน
   ↓
[Scoreboard] → รอบถัดไป (psychic คนถัดไป, สลับทีม)
```

### จุดสำคัญ

- **Pass screen บังคับ** ทุกครั้งก่อนโชว์ target กันคนอื่นเหลือบเห็น
- Target ต้อง**ไม่ถูก render**ใน DOM ระหว่างหน้า guess (ไม่ใช่แค่ `opacity: 0` — คนกด devtools/screenshot ได้)
- ลำดับ psychic = round-robin ในทีม สลับทีมทุกรอบ: `A1 → B1 → A2 → B2 → …`
- State เก็บใน memory + `localStorage` กัน refresh หลุด
- ไม่ต้องต่อเน็ต

---

## 5. โหมด Online (หลายเครื่อง, real-time)

Host สร้างห้อง → แจก room code → ทุกคน join ด้วยมือถือตัวเอง

### Room lifecycle

```
Host: สร้างห้อง → ได้ room code 4 ตัว (เช่น "K7QM")
   ↓
Players: เข้า /join → กรอก code + ชื่อ → เข้า lobby
   ↓
Lobby: เห็นรายชื่อทุกคน, host จัดทีม (auto-balance หรือลากเอง), host กด Start
   ↓
รอบเล่น (ดูด้านล่าง)
   ↓
จบเกม → Rematch (เก็บทีมเดิม) หรือ กลับ lobby
```

### สิ่งที่แต่ละคนเห็นในรอบเดียวกัน

| ใคร | หน้าจอ |
|---|---|
| **Psychic** | spectrum + **target ชัดเจน** + ช่องพิมพ์ clue |
| **เพื่อนร่วมทีม** | spectrum + dial โล่ง + clue + หมุน dial ได้ |
| **ทีมตรงข้าม** | spectrum + dial โล่ง (ล็อกหมุนไม่ได้) → พอทีมแรกล็อก ค่อยโผล่ปุ่ม ←/→ |
| **Spectator** | เหมือนทีมตรงข้าม แต่กดอะไรไม่ได้ |

### ความลับของ target — ข้อบังคับ

**Target ห้ามถูกส่งออกจาก server ไปหาใครนอกจาก psychic**

- Target เก็บใน server-side room state เท่านั้น
- Event ที่ broadcast ให้ทั้งห้องมี spectrum + clue + สถานะ แต่ **ไม่มี target**
- Target ส่งผ่าน event ส่วนตัวไปที่ socket ของ psychic คนเดียว
- Reveal ค่อย broadcast target ให้ทั้งห้อง — ตอนนั้น phase ต้องเป็น `reveal` แล้วเท่านั้น
- อย่าใช้วิธี "ส่งไปหมดแล้วให้ client ซ่อน" — เปิด devtools ก็โกงได้ทันที

### Dial sync

- คนในทีมของ psychic หมุน dial ได้พร้อมกัน → broadcast ค่าล่าสุดแบบ throttle (~50ms)
- คนสุดท้ายที่หมุนคือค่าที่ใช้ (last-write-wins) เห็นเข็มขยับตามกันแบบ real-time
- ล็อกได้เมื่อทีมกดยืนยัน (host หรือ majority — เลือกได้จาก config)

### Phase machine

`lobby → card → clue → guess → bet → reveal → scoreboard → (card | gameover)`

Server เป็นเจ้าของ phase. Client ส่ง action เข้ามา server ตรวจว่า action นั้นถูก phase + ถูก role ไหม แล้วค่อยเปลี่ยน state

### Disconnect / Reconnect

- ผู้เล่นหลุด → mark `disconnected` ยังอยู่ในทีม รอ 60 วิ
- Reconnect ด้วย `playerId` ใน `localStorage` → กลับเข้าห้องตำแหน่งเดิม
- **Psychic หลุด** → เกมค้าง 30 วิ, ถ้าไม่กลับ → ยกเลิกรอบ, จั่วการ์ดใหม่, psychic คนถัดไป
- Host หลุด → โอน host ให้คนที่อยู่ในห้องนานที่สุด
- ห้องว่าง 10 นาที → ลบทิ้ง

### Anti-cheat ขั้นต่ำ

- Validate ทุก action ที่ server: ใครส่ง, phase ไหน, role อะไร
- Clue กรองคำ: ตัวเลข, %, คำที่อยู่บน spectrum card → เตือน (ไม่บล็อกแข็ง เพราะภาษาไทยเคสเยอะ)
- Rate limit การส่ง event ต่อ socket

---

## 6. Config ที่ปรับได้

| Option | Default | หมายเหตุ |
|---|---|---|
| `targetScore` | 10 | 7 / 10 / 15 |
| `discussionTimer` | 90s | ปิดได้ |
| `clueTimer` | 60s | ปิดได้ |
| `leftRightBet` | on | ปิดเพื่อเล่นแบบง่าย |
| `yesNoQuestions` | off | ทีมถาม psychic ได้ ตอบได้แค่ ใช่/ไม่ใช่ |
| `deck` | `th-core` | ชุดการ์ดภาษาไทย / อังกฤษ / mixed |
| `teamCount` | 2 | 1 (co-op) หรือ 2 |

---

## 7. Data Model (conceptual)

```
SpectrumCard  { id, left, right, deck, lang }
Player        { id, name, teamId, isHost, connected }
Team          { id, name, score, playerIds }
Round         { cardId, psychicId, target, clue, guess, bet, scores }
Room          { code, phase, players, teams, rounds, config, currentRound }
```

`Round.target` = server-only field. ห้าม serialize ลง payload ที่ broadcast ทั้งห้อง ยกเว้น phase `reveal`

---

## 8. Edge Cases

- **ผู้เล่นน้อยกว่า 4 คน** → บังคับ co-op mode (ไม่มีทีมตรงข้าม, ไม่มี bet)
- **การ์ดหมด deck** → reshuffle แล้วเตือนว่าเริ่มซ้ำ
- **Psychic ไม่ส่ง clue จนหมดเวลา** → auto-skip รอบ ไม่มีใครได้คะแนน
- **ทีมไม่หมุน dial จนหมดเวลา** → ใช้ค่าที่เข็มค้างอยู่ตอนนั้น
- **คะแนนถึงเป้าพร้อมกัน** → sudden death 1 รอบ
