import { BAND_HALF_WIDTH } from "./scoring";

/**
 * Random target, kept far enough from either rim that the full 2-3-4-3-2 band
 * always fits on the dial.
 */
export function randomTarget(): number {
  const lo = BAND_HALF_WIDTH;
  const hi = 100 - BAND_HALF_WIDTH;
  return Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;
}
