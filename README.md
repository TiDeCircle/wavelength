# Wavelength

เกมทายใจแบบ spectrum guessing — โหมดเล่นเครื่องเดียว (pass-and-play) เล่นได้แล้ว

- กติกาเกม: [DESIGN.md](DESIGN.md)
- โครงสร้าง + แผนเฟสถัดไป: [PROJECT.md](PROJECT.md)

## รัน

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วเลือก "เล่นเครื่องเดียว"

## Scripts

| Command | ทำอะไร |
|---|---|
| `npm run dev` | dev server (Next + Socket.io ใน process เดียว ผ่าน `server.ts`) |
| `npm run build` | production build |
| `npm start` | รัน production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:redaction` | ยืนยันว่า target ไม่หลุดออก payload ก่อน reveal |

`npm run dev` รัน `server.ts` ไม่ใช่ `next dev` เพราะ Socket.io ต้องมี process ที่อยู่ยาว
ถ้าอยากรัน Next เปล่า ๆ (local mode อย่างเดียว) ใช้ `npm run dev:next`

## แก้ deck

การ์ดอยู่ใน [src/lib/cards/th-core.json](src/lib/cards/th-core.json) — เพิ่มคู่คำได้เลย
`id` ต้องไม่ซ้ำ `left` คือค่า 0 บน dial `right` คือ 100

```json
{ "id": "th-031", "left": "ของถูก", "right": "ของแพง" }
```

จะเพิ่ม deck ใหม่ให้สร้างไฟล์ JSON ข้าง ๆ แล้ว merge ใน
[src/lib/cards/index.ts](src/lib/cards/index.ts)

## สถานะ

| โหมด | สถานะ |
|---|---|
| Local (pass-and-play) | เล่นได้ |
| Online (room code, หลายเครื่อง) | เล่นได้ |
| Deploy | ไฟล์พร้อม ยังไม่ได้ขึ้น server — [DEPLOY.md](DEPLOY.md) |

Online ต้องรันบน platform ที่รัน Node ยาว ๆ (VPS / Railway / Fly.io / Render)
**Vercel ใช้ไม่ได้** เพราะ serverless ไม่มี process ที่อยู่ยาวให้ Socket.io เกาะ
