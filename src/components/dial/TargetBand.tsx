import { bandSegments } from "@/lib/game/scoring";
import { annularSector, R_INNER, R_OUTER } from "./geometry";

const FILL: Record<number, string> = {
  4: "var(--band-4)",
  3: "var(--band-3)",
  2: "var(--band-2)",
};

/**
 * The 2-3-4-3-2 scoring wedges around the target.
 *
 * Rendered only when the target is meant to be visible. Callers must not mount
 * this and hide it with CSS — during the guess phase the target must be absent
 * from the DOM entirely.
 */
export function TargetBand({
  target,
  className,
}: {
  target: number;
  className?: string;
}) {
  return (
    <g data-testid="target-band" className={className}>
      {bandSegments(target).map((seg, i) => (
        <path
          key={i}
          d={annularSector(seg.from, seg.to, R_INNER, R_OUTER)}
          fill={FILL[seg.points]}
        />
      ))}
      {bandSegments(target).map((seg, i) => {
        const mid = (seg.from + seg.to) / 2;
        const r = (R_INNER + R_OUTER) / 2;
        const rad = ((180 - mid * 1.8) * Math.PI) / 180;
        return (
          <text
            key={`l${i}`}
            x={200 + r * Math.cos(rad)}
            y={210 - r * Math.sin(rad)}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-900/70 text-[22px] font-bold"
          >
            {seg.points}
          </text>
        );
      })}
    </g>
  );
}
