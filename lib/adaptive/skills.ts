import rawSkills from "../../data/rome/skills.json";
import type { CenterId } from "../types";

/**
 * Référentiel ROME compacté (voir scripts/build-skills.mjs).
 * Côté serveur uniquement : ~430 Ko, ne doit pas partir dans le bundle client.
 */

export type SkillChild = { code: number; label: string };

export type Macro = {
  code: number;
  label: string;
  /** "sf" = savoir-faire, "se" = savoir-être professionnel */
  kind: "sf" | "se";
  /** Technique, Technique expert, Transverse */
  sub: string;
  domain: string;
  enjeu: string;
  objectif: string;
  children: SkillChild[];
  /** Nombre de métiers accessibles dont la fiche contient la macro. */
  jobCount: number;
  /** Part des métiers accessibles qui la contiennent (0..1). */
  prevalence: number;
  /** Centres d'intérêt, même format que les cartes (somme ≈ 1). */
  centers: Partial<Record<CenterId, number>>;
};

type SkillsFile = {
  version: string;
  macros: Record<string, Macro>;
  byCenter: Record<CenterId, number[]>;
};

const SKILLS = rawSkills as unknown as SkillsFile;

export const ROME_VERSION = SKILLS.version;

export function getMacro(code: number): Macro | undefined {
  return SKILLS.macros[String(code)];
}

/** Vivier de cibles "explorer" d'un centre, du plus au moins caractéristique. */
export function poolFor(center: CenterId): Macro[] {
  return (SKILLS.byCenter[center] ?? [])
    .map((code) => getMacro(code))
    .filter((m): m is Macro => Boolean(m));
}

const TARGET_CODES = new Set(Object.values(SKILLS.byCenter).flat());

export function isSwipeTarget(code: number): boolean {
  return TARGET_CODES.has(code);
}

/** Toutes les macros ciblables en swipe (union des viviers). */
export function swipeTargets(): Macro[] {
  return [...TARGET_CODES].map((code) => getMacro(code)).filter((m): m is Macro => Boolean(m));
}
