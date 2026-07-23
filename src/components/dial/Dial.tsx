"use client";

import { useCallback, useRef } from "react";
import { TargetBand } from "./TargetBand";
import {
  annularSector,
  CX,
  CY,
  R_INNER,
  R_OUTER,
  VIEW_H,
  VIEW_W,
  valueFromPointer,
} from "./geometry";

export interface DialNeedle {
  value: number;
  /** Short caption drawn at the needle tip. Omit for an unlabelled needle. */
  label?: string;
  /** CSS colour. Defaults to the standard needle colour. */
  color?: string;
}

export interface DialProps {
  /** Needle position, 0-100. */
  value: number;
  /** Omit to make the dial read-only. */
  onChange?: (value: number) => void;
  /**
   * Target position, 0-100. When omitted the scoring band is never mounted —
   * this is what keeps the target out of the DOM during the guess phase.
   */
  target?: number;
  leftLabel: string;
  rightLabel: string;
  disabled?: boolean;
  /** Ease the needle into place instead of snapping — used on reveal. */
  animateNeedle?: boolean;
  /** Hide the needle entirely — the psychic has no guess to show yet. */
  showNeedle?: boolean;
  /**
   * Draw several needles at once instead of the single `value` one. Used on
   * reveal, where every player's dial appears together.
   */
  needles?: DialNeedle[];
  /** Extra class for the scoring band, used for the reveal animation. */
  bandClassName?: string;
}

export function Dial({
  value,
  onChange,
  target,
  leftLabel,
  rightLabel,
  disabled = false,
  animateNeedle = false,
  showNeedle = true,
  needles,
  bandClassName,
}: DialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const interactive = Boolean(onChange) && !disabled;

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !onChange) return;
      onChange(valueFromPointer(clientX, clientY, svg.getBoundingClientRect()));
    },
    [onChange],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    applyPointer(e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onChange) return;
    const step =
      e.key === "PageUp" || e.key === "PageDown"
        ? 10
        : e.shiftKey
          ? 5
          : 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown") {
      next = value - step;
    } else if (
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "PageUp"
    ) {
      next = value + step;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = 100;
    }
    if (next === null) return;
    e.preventDefault();
    onChange(Math.round(Math.min(100, Math.max(0, next)) * 10) / 10);
  };

  return (
    <div
      className="w-full max-w-lg select-none"
      role="slider"
      tabIndex={interactive ? 0 : -1}
      aria-label={`${leftLabel} ถึง ${rightLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-disabled={!interactive}
      onKeyDown={handleKeyDown}
    >
      <svg
        ref={svgRef}
        viewBox={`-12 -14 ${VIEW_W + 24} ${VIEW_H + 14}`}
        className={`w-full touch-none ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Track */}
        <path
          d={annularSector(0, 100, R_INNER, R_OUTER)}
          fill="var(--dial-track)"
        />

        {target !== undefined && (
          <TargetBand target={target} className={bandClassName} />
        )}

        {/* Tick marks every 10 units, drawn over the band. */}
        {Array.from({ length: 11 }, (_, i) => i * 10).map((v) => {
          const rad = ((180 - v * 1.8) * Math.PI) / 180;
          const r1 = R_OUTER - 10;
          return (
            <line
              key={v}
              x1={CX + r1 * Math.cos(rad)}
              y1={CY - r1 * Math.sin(rad)}
              x2={CX + R_OUTER * Math.cos(rad)}
              y2={CY - R_OUTER * Math.sin(rad)}
              stroke="var(--dial-tick)"
              strokeWidth={v % 50 === 0 ? 3 : 1.5}
            />
          );
        })}

        {/* Needle */}
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
      </svg>

      <div className="-mt-2 flex items-start justify-between gap-4 px-1">
        <span className="max-w-[45%] text-left text-sm font-semibold text-slate-300">
          ◀ {leftLabel}
        </span>
        <span className="max-w-[45%] text-right text-sm font-semibold text-slate-300">
          {rightLabel} ▶
        </span>
      </div>
    </div>
  );
}
