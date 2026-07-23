/** Full-height column with a fixed action area at the bottom, thumb-friendly. */
export function Screen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6">
      <div className="flex flex-1 flex-col justify-center gap-6">{children}</div>
      {footer ? <div className="mt-6 flex flex-col gap-3">{footer}</div> : null}
    </div>
  );
}

export function SpectrumHeading({
  left,
  right,
}: {
  left: string;
  right: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--surface-raised)] px-4 py-3 text-center">
      <p className="text-lg font-bold">
        <span className="text-slate-400">{left}</span>
        <span className="mx-2 text-slate-600">↔</span>
        <span className="text-slate-100">{right}</span>
      </p>
    </div>
  );
}
