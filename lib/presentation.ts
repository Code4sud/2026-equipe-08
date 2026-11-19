import { CENTER_BY_ID } from "./centers";
import type { Card, Riasec } from "./types";
import { RIASEC } from "./types";

export const RIASEC_LABEL: Record<Riasec, string> = {
  R: "Concret",
  I: "Analyser",
  A: "Créer",
  S: "Aider",
  E: "Convaincre",
  C: "Organiser",
};

export const RIASEC_COLOR: Record<Riasec, string> = {
  R: "#DFF3A9",
  I: "#CFE0FF",
  A: "#FFD6E8",
  S: "#FFE2C7",
  E: "#FFC9B8",
  C: "#E9E1CE",
};

export const RIASEC_INK: Record<Riasec, string> = {
  R: "#3E4A16",
  I: "#173A82",
  A: "#7A1E49",
  S: "#7A3D12",
  E: "#7A2416",
  C: "#4A4030",
};

export function cardRiasec(card: Card): Riasec {
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  for (const [centerId, weight] of Object.entries(card.centers)) {
    const meta = CENTER_BY_ID[centerId];
    if (!meta) continue;
    for (const [key, value] of Object.entries(meta.riasec) as [
      Riasec,
      number,
    ][]) {
      scores[key] += value * (weight ?? 0);
    }
  }

  return [...RIASEC].sort((a, b) => scores[b] - scores[a])[0] ?? "R";
}

export function cardTone(card: Card): { bg: string; ink: string } {
  const type = cardRiasec(card);
  return { bg: RIASEC_COLOR[type], ink: RIASEC_INK[type] };
}

export function jobLevel(level: number | null): string {
  if (level === 0) return "Sans diplôme";
  if (level === 1) return "CAP / BEP";
  if (level === 2) return "Bac pro / Bac";
  if (level === 3) return "Bac +2";
  if (level === 4) return "Bac +3";
  if (level === 5) return "Bac +5";
  return "Accès variable";
}

export function matchLevel(score: number): {
  label: string;
  className: string;
} {
  if (score >= 0.62) {
    return { label: "Fort", className: "bg-ink text-paper" };
  }
  if (score >= 0.46) {
    return { label: "À explorer", className: "bg-sand text-ink" };
  }
  return { label: "Piste", className: "bg-paper text-ink/60 border border-ink/20" };
}

export function shortCenter(id: string): string {
  return CENTER_BY_ID[id]?.short ?? id;
}

export function domainLabel(id: string): string {
  return CENTER_BY_ID[id]?.label ?? id;
}

export function studiesLabel(level: string): string {
  const labels: Record<string, string> = {
    "sans-diplome": "Sans diplôme",
    "cap-bep": "CAP / BEP",
    "bac": "Bac",
    "bac+2": "Bac +2",
    "bac+3": "Bac +3",
    "bac+5": "Bac +5",
    "autre": "Autre",
  };
  return labels[level] ?? level;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    college: "Collège",
    lycee: "Lycée",
    etudes: "Études",
    alternance: "Alternance",
    recherche: "Recherche d'emploi / formation",
    emploi: "En emploi",
    inactif: "Ni en emploi ni en études",
  };
  return labels[status] ?? status;
}
