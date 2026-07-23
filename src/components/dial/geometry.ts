/**
 * Dial geometry, in SVG viewBox units.
 *
 * The dial is a half-circle: value 0 sits at the far left (180°), value 100 at
 * the far right (0°). Screen y grows downwards, so arcs from low to high value
 * sweep clockwise.
 */

export const VIEW_W = 400;
export const VIEW_H = 232;
export const CX = 200;
export const CY = 210;
export const R_OUTER = 186;
export const R_INNER = 96;

export function valueToDeg(value: number): number {
  return 180 - value * 1.8;
}

export function pointAt(value: number, radius: number): [number, number] {
  const rad = (valueToDeg(value) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)];
}

/** Path for a wedge between two dial values, between two radii. */
export function annularSector(
  from: number,
  to: number,
  rInner: number,
  rOuter: number,
): string {
  const [x1, y1] = pointAt(from, rOuter);
  const [x2, y2] = pointAt(to, rOuter);
  const [x3, y3] = pointAt(to, rInner);
  const [x4, y4] = pointAt(from, rInner);
  const large = (to - from) * 1.8 > 180 ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/**
 * Turn a pointer position into a dial value.
 *
 * @param rect Bounding box of the rendered svg, from `getBoundingClientRect()`.
 */
export function valueFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const scale = VIEW_W / rect.width;
  const vx = (clientX - rect.left) * scale;
  const vy = (clientY - rect.top) * scale;
  const deg = (Math.atan2(CY - vy, vx - CX) * 180) / Math.PI;
  const clamped = Math.min(180, Math.max(0, deg));
  return Math.round(((180 - clamped) / 1.8) * 10) / 10;
}
