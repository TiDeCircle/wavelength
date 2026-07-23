# Deploy — Wavelength

Deploy ลง VPS Ubuntu ที่มี Node + PM2 + Nginx + Certbot อยู่แล้ว

> ไฟล์นี้ไม่มี credential ใด ๆ host / user / รหัสผ่าน / token อยู่ในโน้ตส่วนตัวนอก repo
> **ห้ามเอา credential มาใส่ไฟล์นี้** — repo นี้อยู่บน GitHub

---

## ทำไม Vercel ใช้ไม่ได้

Socket.io ต้องมี process ที่อยู่ยาว serverless ไม่มีให้ ต้องเป็น VPS / Railway / Fly.io / Render

---

## 4 อย่างที่ต่างจาก deploy Next ปกติ

| เรื่อง | ปกติ | Wavelength |
|---|---|---|
| Install | `npm install --production` | **`npm ci`** เต็ม — `next build` ต้องใช้ typescript + tailwind ที่อยู่ใน devDependencies |
| Start | `next start` | `tsx server.ts` (custom server) |
| PM2 | cluster ได้ | **fork 1 instance เท่านั้น** — ห้องอยู่ใน memory ของ process |
| Nginx | proxy ธรรมดา | ต้องมี WebSocket upgrade + read timeout ยาว |

`tsx` อยู่ใน `dependencies` (ไม่ใช่ dev) เพราะ production รันจริงผ่านมัน

---

## สภาพเครื่องปลายทาง (เช็กเมื่อ 2026-07-23)

| อะไร | ค่า |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| Node | v20.20.2 ผ่าน **nvm** (ไม่มี node ใน `/usr/bin`) |
| npm / PM2 / certbot | 10.8.2 / 7.0.3 / 2.9.0 |
| Nginx | 1.24.0 |
| PM2 apps ที่รันอยู่ | `newportfolio` (:3000), `nptsx-backend` (:3001) |
| **Wavelength ใช้** | **:3002** |
| `/var/www` | เจ้าของคือ user `tide` — clone ได้โดยไม่ต้อง sudo |
| sudo | **ต้องใส่รหัสผ่าน** (ไม่ใช่ NOPASSWD) |

> **Node มาจาก nvm** → shell แบบ non-interactive จะไม่เจอ `node`/`npm`/`pm2`
> ทุกคำสั่งต้อง `source ~/.nvm/nvm.sh` ก่อน หรือ ssh เข้าไปแบบ interactive

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

### ⚠️ IPv6 บนเครื่องนี้เสีย — ต้องบังคับ IPv4 ทุกครั้งที่ npm

`npm ci` จะพังด้วย `ETIMEDOUT` แล้วจบด้วย `Exit handler never called!`
ซึ่งอ่านเหมือน npm bug แต่จริง ๆ คือ npm ไปทาง IPv6 แล้วไม่มีอะไรตอบ
(`curl -6 registry.npmjs.org` timeout, `curl -4` ตอบ 200 ใน 1 วิ)

ตั้ง env นี้ก่อน npm ทุกครั้ง:

```bash
export NODE_OPTIONS=--dns-result-order=ipv4first
```

ตั้งแล้ว `npm ci` เสร็จใน 4 วินาที จากที่ก่อนหน้าค้างเป็นนาทีแล้ว fail

แก้ถาวรได้ถ้าอยาก: ใส่บรรทัดข้างบนใน `~/.bashrc` หรือไปแก้ที่ระบบให้ IPv6 ใช้ได้จริง

## ต้องมีก่อน

- **Node ≥ 20.9.0** — Next 16 บังคับ (v20.20.2 บนเครื่องผ่านแล้ว)
- port `3002` ว่าง — 3000 กับ 3001 มีคนใช้อยู่
- DNS A record `wavelength.madebytide.xyz` ชี้มาที่ IP ของ VPS

เช็ก DNS ก่อนเริ่ม:

```bash
dig +short wavelength.madebytide.xyz A
```

ต้องได้ IP ของ VPS ถ้าว่างเปล่า = ยังไม่ได้ตั้ง record

---

## เรื่อง Cloudflare

`madebytide.xyz` อยู่หลัง Cloudflare (root domain resolve เป็น IP ของ Cloudflare)
มีผลกับ deploy 2 จุด

**1. certbot ตอนออก cert**

ถ้าเปิด proxy (เมฆส้ม) ตั้งแต่แรก certbot อาจออก cert ไม่ได้ เพราะ HTTP-01 challenge
ต้องวิ่งถึง origin จริง

ทางที่ตรงที่สุด: ตั้ง record เป็น **DNS only (เมฆเทา)** ก่อน → รัน certbot → ค่อยเปิด proxy
ทีหลังถ้าอยากได้ พอเปิด proxy แล้ว SSL mode ใน Cloudflare ต้องเป็น **Full (strict)**
ไม่ใช่ Flexible — Flexible จะทำให้เกิด redirect loop กับ config ที่ certbot เขียนให้

**2. WebSocket ผ่าน proxy ได้ แต่ไม่ควรปล่อยให้ idle**

Cloudflare รองรับ WebSocket ทุกแพลน แต่ตัดการเชื่อมต่อที่เงียบนาน ๆ
ตรงนี้ไม่กระทบเพราะ Socket.io ตั้ง `pingInterval` 10 วิ ไว้ใน [server.ts](server.ts)
มี traffic ตลอด ไม่มีช่วงเงียบยาว

ถ้าไม่อยากยุ่ง: ปล่อย DNS only ไปเลย ใช้ cert จาก Let's Encrypt ตรง ๆ ทำงานได้เหมือนกัน

---

## Deploy ครั้งแรก

### 1. Clone

`/var/www` เป็นของ user `tide` อยู่แล้ว ไม่ต้อง sudo

```bash
git clone https://github.com/TiDeCircle/wavelength.git /var/www/wavelength
```

### 2. Install + build

```bash
cd /var/www/wavelength && export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && export NODE_OPTIONS=--dns-result-order=ipv4first && npm ci && npm run build
```

อย่าใช้ `--production` / `--omit=dev` — build จะพังเพราะไม่มี typescript

### 3. ทดสอบก่อนต่อ PM2

```bash
cd /var/www/wavelength && PORT=3002 npm start
```

อีก terminal นึง:

```bash
curl -s localhost:3002/healthz
```

ควรได้ `{"ok":true,"uptime":N}` แล้วค่อย `Ctrl+C`

### 4. PM2

```bash
cd /var/www/wavelength && pm2 start ecosystem.config.cjs && pm2 save
```

```bash
pm2 status wavelength
```

ถ้ายังไม่เคยตั้ง auto-start ตอน reboot: `pm2 startup` แล้วรันคำสั่งที่มันพิมพ์ออกมา

### 5. Nginx

`server_name` ตั้งเป็น `wavelength.madebytide.xyz` ไว้แล้วใน
[deploy/nginx/wavelength.conf](deploy/nginx/wavelength.conf) — ถ้าเปลี่ยนโดเมนต้องแก้ไฟล์นั้นก่อน

```bash
sudo cp /var/www/wavelength/deploy/nginx/wavelength.conf /etc/nginx/sites-available/wavelength
```

```bash
sudo ln -s /etc/nginx/sites-available/wavelength /etc/nginx/sites-enabled/ && sudo nginx -t
```

`nginx -t` ต้องผ่านก่อนถึง reload — ถ้าไม่ผ่านแล้ว reload เว็บ portfolio จะดับไปด้วย

```bash
sudo systemctl reload nginx
```

### 6. SSL

```bash
sudo certbot --nginx -d wavelength.madebytide.xyz
```

certbot จะแก้ไฟล์ config ให้เอง (เพิ่ม block 443 + redirect 80)

---

## เช็กว่าขึ้นจริง

```bash
curl -s https://wavelength.madebytide.xyz/healthz
```

**เช็ก WebSocket ด้วย** — HTTP 200 ไม่ได้แปลว่า socket ทำงาน:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://wavelength.madebytide.xyz/socket.io/?EIO=4&transport=polling"
```

ได้ `200` = Socket.io ตอบแล้ว ถ้าได้ `404` แปลว่า Nginx proxy ไปผิดที่

ทดสอบจริง: เปิด 2 เครื่อง สร้างห้อง แล้ว join ด้วย code ถ้าเข้าห้องได้แต่เข็มไม่ขยับตามกัน = WebSocket ไม่ผ่าน กลับไปดู `proxy_set_header Upgrade` ใน Nginx

---

## Update โค้ดใหม่

> ⚠️ **restart = ห้องที่กำลังเล่นอยู่หายหมด** ผู้เล่นทุกคนเด้งกลับหน้า join
> ห้องเก็บใน memory ของ process ไม่มี persistence — deploy ตอนไม่มีคนเล่น

```bash
cd /var/www/wavelength && export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && export NODE_OPTIONS=--dns-result-order=ipv4first && git pull origin main && npm ci && npm run build && pm2 restart wavelength
```

ถ้าแก้แค่ `ecosystem.config.cjs` ต้อง `pm2 delete wavelength` แล้ว start ใหม่ — `restart` ไม่อ่าน config ใหม่

---

## ปัญหาที่น่าจะเจอ

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `npm ci` ค้างแล้วจบด้วย `Exit handler never called!` | IPv6 เสีย ไม่ใช่ npm bug — ดู log จะเห็น `ETIMEDOUT` เต็มไปหมด | `export NODE_OPTIONS=--dns-result-order=ipv4first` |
| `node: command not found` ตอน ssh สั่งคำสั่งเดียว | node อยู่ใน nvm ไม่อยู่ใน PATH ของ non-interactive shell | `. ~/.nvm/nvm.sh` ก่อน |
| `next: not found` / `tsc: not found` ตอน build | ลงด้วย `--production` | `rm -rf node_modules && npm ci` |
| `tsx: not found` ตอน pm2 start | เหมือนกัน | เหมือนกัน |
| 502 Bad Gateway | process ตาย | `pm2 logs wavelength --lines 50` |
| หน้าเว็บขึ้นแต่ค้าง "กำลังต่อ server…" | WebSocket ไม่ผ่าน Nginx | เช็ก `Upgrade` / `Connection` header ใน config |
| เข้าห้องแล้วเด้งออกเรื่อย ๆ | รันหลาย instance ห้องอยู่คนละ process | `pm2 status` ต้องเห็น instance เดียว, `exec_mode: fork` |
| ผู้เล่นหลุดทุก 1 นาที | `proxy_read_timeout` สั้นไป | ต้องเป็น `3600s` |
| `nginx -t` ฟ้อง duplicate map | มี site อื่นประกาศ map ชื่อซ้ำ | เปลี่ยนชื่อ `$wavelength_connection_upgrade` |
| build ผ่านบนเครื่อง แต่พังบน VPS | Node คนละเวอร์ชัน | `node -v` ต้อง ≥ 20.9.0 |
| certbot fail: challenge ไม่ถึง origin | Cloudflare proxy เปิดอยู่ | ปิด proxy เป็น DNS only → ออก cert → ค่อยเปิดใหม่ |
| redirect loop หลังเปิด Cloudflare proxy | SSL mode เป็น Flexible | เปลี่ยนเป็น Full (strict) |

---

## Rollback

```bash
cd /var/www/wavelength && git log --oneline -5
```

```bash
cd /var/www/wavelength && git checkout <commit> && npm ci && npm run build && pm2 restart wavelength
```

---

## ยังไม่ได้ทำ

- Dockerfile — ตอนนี้ deploy ตรงบน VPS
- Redis-backed rooms — ต้องมีก่อนถึงจะรันหลาย instance หรือ restart แบบไม่ตัดผู้เล่นได้
- Structured logging / monitoring — มีแค่ `pm2 logs`
- Rate limit ต่อ socket
