import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-10 px-5 py-10">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight">Wavelength</h1>
        <p className="mt-3 text-slate-400">เกมทายใจแบบ spectrum guessing</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/local"
          className="rounded-2xl bg-amber-400 px-5 py-5 text-center font-bold text-slate-900 transition-colors hover:bg-amber-300"
        >
          เล่นเครื่องเดียว (ส่งต่อมือถือ)
        </Link>
        <Link
          href="/online"
          className="rounded-2xl bg-[var(--surface-raised)] px-5 py-5 text-center font-bold text-slate-100 transition-colors hover:bg-slate-700"
        >
          เล่นออนไลน์
          <span className="mt-1 block text-xs font-normal text-slate-400">
            สร้างห้อง แจก code เล่นคนละเครื่อง
          </span>
        </Link>
      </div>

      <p className="text-center text-xs leading-relaxed text-slate-600">
        2-3 คน = โหมดร่วมมือ · 4 คนขึ้นไป = แบ่ง 2 ทีม
      </p>
    </main>
  );
}
