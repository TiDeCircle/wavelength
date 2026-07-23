# Wavelength

## 🔗 เล่นเลย: https://wavelength.madebytide.xyz

เกมทายใจแบบ spectrum guessing — เล่นได้ทั้งเครื่องเดียว (pass-and-play) และออนไลน์หลายเครื่อง

- กติกาเกม: [DESIGN.md](DESIGN.md)
- โครงสร้าง + แผนเฟสถัดไป: [PROJECT.md](PROJECT.md)

## รัน

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วเลือกโหมด. แต่ละรอบผลัดกันเป็น **คนเลือก** ตั้งหัวข้อ + ชื่อของ คนอื่นเดาว่าอยู่ตรงไหนบนสเกล — กติกาเต็มใน [DESIGN.md](DESIGN.md)

## Scripts

| Command | ทำอะไร |
|---|---|
| `npm run dev` | dev server (Next + Socket.io ใน process เดียว ผ่าน `server.ts`) |
| `npm run build` | production build |
| `npm start` | รัน production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit tests (Vitest) — scoring, reducer, rotation, cards, redaction |
| `npm run check:redaction` | ยืนยันว่า target + เข็มคนอื่นไม่หลุดออก payload ก่อน reveal |

`npm run dev` รัน `server.ts` ไม่ใช่ `next dev` เพราะ Socket.io ต้องมี process ที่อยู่ยาว
ถ้าอยากรัน Next เปล่า ๆ (local mode อย่างเดียว) ใช้ `npm run dev:next`

## แก้ deck

การ์ดอยู่ใน [src/lib/cards/topics.json](src/lib/cards/topics.json) — เพิ่มได้เลย
`id` ต้องไม่ซ้ำ · `category` คือหมวด · `left` คือค่า 0 บน dial · `right` คือ 100

```json
{ "id": "t-033", "category": "อาหาร", "left": "ถูก", "right": "แพง" }
```

จะเพิ่ม deck ใหม่ให้สร้างไฟล์ JSON ข้าง ๆ แล้ว merge ใน
[src/lib/cards/index.ts](src/lib/cards/index.ts)

## สถานะ

| โหมด | สถานะ |
|---|---|
| Local (เครื่องเดียว, เข็มเดียว, คะแนนกลุ่ม) | เล่นได้ |
| Online (room code, เข็มคนละอัน, leaderboard) | เล่นได้ |
| Deploy | [wavelength.madebytide.xyz](https://wavelength.madebytide.xyz) — [DEPLOY.md](DEPLOY.md) (topic mode รอ deploy) |

Online ต้องรันบน platform ที่รัน Node ยาว ๆ (VPS / Railway / Fly.io / Render)
**Vercel ใช้ไม่ได้** เพราะ serverless ไม่มี process ที่อยู่ยาวให้ Socket.io เกาะ
