import rawCenters from "../data/rome/centers.json";
import type { CenterId, CenterMeta, Riasec } from "./types";
import { RIASEC } from "./types";

export const CENTERS = rawCenters as CenterMeta[];

export const CENTER_BY_ID: Record<CenterId, CenterMeta> = Object.fromEntries(
  CENTERS.map((c) => [c.id, c]),
) as Record<CenterId, CenterMeta>;

export const CENTER_IDS = CENTERS.map((c) => c.id);

/**
 * Projette un vecteur de 30 centres vers les 6 dimensions Holland.
 * On ne garde que la partie positive (au-dessus du neutre) : un rejet
 * ne doit pas tirer le type Holland vers le bas.
 */
export function projectRiasec(
  scores: Record<CenterId, number>,
): Record<Riasec, number> {
  const sum = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  let total = 0;

  for (const center of CENTERS) {
    const weight = Math.max(0, (scores[center.id] ?? 0) - 0.45);
    if (weight === 0) continue;
    for (const [key, value] of Object.entries(center.riasec) as [
      Riasec,
      number,
    ][]) {
      sum[key] += value * weight;
    }
    total += weight;
  }

  if (total === 0) {
    for (const key of RIASEC) sum[key] = 1 / 6;
    return sum;
  }

  for (const key of RIASEC) {
    sum[key] = Math.max(0, Math.min(1, sum[key] / total));
  }
  return sum;
}

export function hollandCode(theta: Record<Riasec, number>): string {
  return [...RIASEC]
    .sort((a, b) => theta[b] - theta[a])
    .slice(0, 3)
    .join("");
}

const HEX_ORDER: Riasec[] = ["R", "I", "A", "S", "E", "C"];

/** Distance circulaire sur l'hexagone Holland (0..3). */
export function hexDistance(a: Riasec, b: Riasec): number {
  const ia = HEX_ORDER.indexOf(a);
  const ib = HEX_ORDER.indexOf(b);
  const d = Math.abs(ia - ib);
  return Math.min(d, 6 - d);
}

/** Les deux premiers types sont-ils adjacents ? */
export function consistency(theta: Record<Riasec, number>): number {
  const sorted = [...RIASEC].sort((a, b) => theta[b] - theta[a]);
  const d = hexDistance(sorted[0], sorted[1]);
  if (d === 1) return 1;
  if (d === 2) return 0.5;
  return 0;
}

/** Écart entre le pic et la médiane, normalisé 0..1. */
export function differentiation(theta: Record<Riasec, number>): number {
  const values = [...RIASEC].map((k) => theta[k]).sort((a, b) => a - b);
  const median = (values[2] + values[3]) / 2;
  const max = values[5];
  if (max === 0) return 0;
  return Math.max(0, Math.min(1, ((max - median) / max) * 1.6));
}
