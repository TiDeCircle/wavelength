import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-400 text-slate-900 hover:bg-amber-300 active:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500",
  secondary:
    "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800 disabled:bg-slate-800 disabled:text-slate-600",
  ghost:
    "bg-transparent text-slate-300 hover:bg-white/5 active:bg-white/10 disabled:text-slate-600",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`w-full rounded-2xl px-5 py-4 text-base font-bold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
