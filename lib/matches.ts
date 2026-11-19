import type { Card, SwipeReason } from "./types";

/**
 * Skill matches et métiers proposés (fichier partagé client / serveur, pur).
 *
 * Un skill match naît d'un « Oui, déjà fait » : le jeune a vécu la situation
 * de la carte. La compétence ROME qu'elle prouve est connue tout de suite pour
 * une carte générée (`card.target`), ou résolue en arrière-plan pour une carte
 * de la banque (`/api/skill`). Les matchs sont gardés en mémoire ; la vue
 * « Mes matchs » propose ensuite de vrais métiers ROME qui s'appuient dessus.
 */

export type SkillRef = { code: number; label: string };

export type SkillMatch = {
  /** Carte où le jeune a dit « déjà fait ». */
  cardId: string;
  text: string;
  emoji?: string;
  reason: Extract<SwipeReason, "deja-souvent" | "deja-une-fois">;
  centers: Card["centers"];
  /** Compétence ROME prouvée (absente tant qu'elle n'est pas résolue, ou si aucune ne colle). */
  skill?: SkillRef;
  skillStatus: "pending" | "found" | "none";
  at: number;
  /** Vu dans « Mes matchs » (sinon compté dans la pastille). */
  seen: boolean;
};

export type JobSuggestion = {
  /** Code ROME du métier. */
  code: string;
  label: string;
  /** 0 = sans diplôme … 3 = Bac+2 ; null = à vérifier. */
  level: number | null;
  definition: string;
  /** Phrase d'accroche qui relie le vécu du jeune au métier. */
  pitch: string;
  /** Matchs (cartes « déjà fait ») sur lesquels il s'appuie. */
  cardIds: string[];
  /** Compétences ROME prouvées qui comptent pour ce métier. */
  skills: string[];
  source: "generated" | "template";
};

/** Ce que le serveur reçoit d'un match (jamais de texte libre du jeune). */
export type MatchInput = {
  cardId: string;
  text: string;
  skill?: number;
  centers: Card["centers"];
};

export function toMatchInput(match: SkillMatch): MatchInput {
  return { cardId: match.cardId, text: match.text, skill: match.skill?.code, centers: match.centers };
}

/** Clé de cache des métiers : change quand un match ou sa compétence change. */
export function matchesKey(matches: SkillMatch[]): string {
  return matches
    .map((m) => `${m.cardId}:${m.skill?.code ?? m.skillStatus}`)
    .sort()
    .join("|");
}

/** Libellé ROME « Mécanicien / Mécanicienne cycles » : gardé tel quel (inclusif). */
export function levelLabel(level: number | null): string {
  if (level === null) return "Niveau d'accès à vérifier";
  return ["Accessible sans diplôme", "Niveau CAP / BEP", "Niveau Bac", "Niveau Bac+2"][level] ?? "Niveau Bac+2";
}
