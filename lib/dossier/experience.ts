import { CARDS } from "../../content/cards";
import type { DossierSession, DemoExperience } from "./types";

const LIVED = new Set(["deja-souvent", "deja-une-fois"]);

/**
 * Le vécu n'est pas dans le dossier exporté : il faut le lire dans la session.
 *
 * - carte (fixe ou générée) + « déjà fait souvent / une fois » → activité
 *   vécue = skill match, avec sa compétence ROME quand elle est connue ;
 * - carte `gen-creuser-*` + oui (anciennes sessions) → compétence ROME confirmée ;
 * - récits de l'étape 2 (un par métier creusé) → la matière la plus riche.
 */
export function extractExperience(session: DossierSession): DemoExperience[] {
  const all = [...CARDS, ...session.generated];
  const byId = new Map(all.map((card) => [card.id, card]));
  const skillOf = new Map(
    (session.skillMatches ?? []).flatMap((m) => (m.skill ? [[m.cardId, m.skill.label] as const] : [])),
  );
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

    if (!response.reason || !LIVED.has(response.reason)) continue;

    const key = `fixed:${response.cardId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const skill = skillOf.get(response.cardId) ?? card.target?.label;
    out.push({
      id: key,
      title: card.text,
      detail:
        response.reason === "deja-souvent"
          ? "Déjà fait souvent"
          : "Déjà fait au moins une fois",
      source: "swipe",
      evidence: [card.text],
      ...(skill ? { competences: [skill] } : {}),
    });
  }

  // Étape 2 : les récits (un par métier creusé) sont la matière la plus riche du CV.
  for (const interview of session.interviews ?? []) {
    // Ancien format (avant les récits par métier) : ignoré plutôt que planter.
    if (!interview.job || !Array.isArray(interview.experiences)) continue;
    if (!interview.answers.some((answer) => answer.trim())) continue;
    const key = `interview:${interview.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const answers = interview.answers.filter((answer) => answer.trim());
    const competences = [
      ...new Set(interview.experiences.flatMap((e) => (e.skill ? [e.skill.label] : []))),
    ];
    out.push({
      id: key,
      title: interview.experiences.map((e) => e.text).join(" · "),
      detail: answers.join(" "),
      source: "creuser",
      evidence: [`Pour le métier : ${interview.job.label}`, ...answers],
      ...(competences.length > 0 ? { competences } : {}),
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
