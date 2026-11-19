import { CARDS } from "../../content/cards";
import type { DossierSession, DemoExperience } from "./types";

const LIVED = new Set(["deja-souvent", "deja-une-fois"]);

/**
 * Le vécu n'est pas dans le dossier exporté : il faut le lire dans la session.
 *
 * - carte fixe + « déjà fait souvent / une fois » → activité vécue ;
 * - carte `gen-creuser-*` + oui → compétence ROME confirmée par le jeune ;
 * - carte `gen-explorer-*` → intérêt, jamais du vécu.
 */
export function extractExperience(session: DossierSession): DemoExperience[] {
  const all = [...CARDS, ...session.generated];
  const byId = new Map(all.map((card) => [card.id, card]));
  const out: DemoExperience[] = [];
  const seen = new Set<string>();

  for (const response of session.responses) {
    if (response.direction !== "right") continue;
    const card = byId.get(response.cardId);
    if (!card) continue;

    if (response.cardId.startsWith("gen-creuser-")) {
      const macro = card.target?.label;
      if (!macro) continue;
      const key = `creuser:${card.target?.macro ?? macro}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const parent = card.target?.parentId
        ? byId.get(card.target.parentId)
        : undefined;
      out.push({
        id: key,
        title: macro,
        detail: "Vécu confirmé",
        source: "creuser",
        evidence: [parent?.text, card.text].filter(
          (text): text is string => Boolean(text),
        ),
      });
      continue;
    }

    if (response.cardId.startsWith("gen-")) continue;
    if (!response.reason || !LIVED.has(response.reason)) continue;

    const key = `fixed:${response.cardId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: key,
      title: card.text,
      detail:
        response.reason === "deja-souvent"
          ? "Déjà fait souvent"
          : "Déjà fait au moins une fois",
      source: "swipe",
      evidence: [card.text],
    });
  }

  // Étape 2 : les récits d'entretien sont la matière la plus riche du CV.
  for (const interview of session.interviews ?? []) {
    if (!interview.answers.some((answer) => answer.trim())) continue;
    const key = `interview:${interview.cardId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const answers = interview.answers.filter((answer) => answer.trim());
    out.push({
      id: key,
      title: interview.parentText,
      detail: answers.join(" "),
      source: "creuser",
      evidence: [interview.proofText, ...answers],
      competences: [interview.skill],
    });
  }

  return out;
}

export function mergeExperience(
  fromSwipe: DemoExperience[],
  manual: DemoExperience[],
): DemoExperience[] {
  const seen = new Set<string>();
  const out: DemoExperience[] = [];
  for (const item of [...fromSwipe, ...manual]) {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
