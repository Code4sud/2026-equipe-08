import { z } from "zod";
import { completeJson } from "../llm";
import type { CardSource } from "../types";
import type { Macro } from "./skills";
import type { CardDraft, TargetPlan } from "./target";

/**
 * Écriture du texte d'une carte. Le LLM reçoit UNIQUEMENT la cible ROME et
 * les textes des cartes déjà montrées : aucune donnée personnelle du jeune.
 * Si le LLM échoue ou sort du cadre, on retombe sur un texte construit
 * depuis le libellé ROME (source "template").
 */

// ---------------------------------------------------------------------------
// Garde-fous
// ---------------------------------------------------------------------------

/**
 * Le brief interdit toute DÉDUCTION sur la santé, l'origine, la famille ou
 * la religion du jeune. On bloque donc :
 *  1. les thèmes qui n'ont rien à faire dans une carte (religion, origine,
 *     papiers, sexualité), quel que soit le contexte ;
 *  2. la santé et la famille seulement quand elles visent LE JEUNE
 *     ("ton traitement", "t'es malade", "ton petit frère").
 * Parler d'aider un pote à l'hôpital ou d'animer un atelier pour enfants
 * reste permis : ce sont des situations, pas des déductions.
 * Le prompt fait le gros du travail ; ce filtre rattrape les dérapages nets.
 */
const ALWAYS_BLOCKED = [
  "religi",
  "pri[èe]re",
  "mosqu[ée]e",
  "[ée]glise",
  "synagogue",
  "ramadan",
  "car[êe]me",
  "\\bdieu\\b",
  "pays d'origine",
  "\\b(tes|tas|ton|ta) origines?\\b",
  "nationalit",
  "titre de s[ée]jour",
  "sans[- ]papiers",
  "\\bethni",
  "sexualit",
  "orientation sexuelle",
];

/** "toi" : ton, ta, tes, t'es, tu es, t'as, tu as (+ formes 1re personne). */
const SELF = "(?:ton|ta|tes|mon|ma|mes|t'es|tu es|t'as|tu as|j'ai|je suis)";
/** 0 ou 1 mot entre le possessif et le nom, sauf préposition ("ton atelier POUR enfants" passe). */
const GAP = "(?:(?!pour\\b|avec\\b|de\\b|des\\b|du\\b|aux?\\b)[\\p{L}'-]+\\s+)?";

const HEALTH = "(?:sant[ée]|malade|maladie|handicap\\w*|traitement|m[ée]dicaments?|h[ôo]pital|psy\\w*|d[ée]pression|enceinte)";
const FAMILY =
  "(?:m[èe]res?|maman|p[èe]res?|papa|parents?|fr[èe]res?|s(?:œ|oe)urs?|famille|cousins?|cousines?|oncles?|tantes?|grands?-parents?|grand-m[èe]re|grand-p[èe]re|enfants?|fils|filles?|daronn?e?s?)";

const SENSITIVE = new RegExp(
  [...ALWAYS_BLOCKED, `\\b${SELF}\\s+${GAP}${HEALTH}\\b`, `\\b${SELF}\\s+${GAP}${FAMILY}\\b`].join("|"),
  "iu",
);

const MAX_TEXT = 90;
const MAX_HINT = 80;

export function isSafeDraft(draft: CardDraft): boolean {
  const all = `${draft.text} ${draft.hint ?? ""}`.replace(/[’]/g, "'");
  if (SENSITIVE.test(all)) return false;
  if (draft.text.length < 8 || draft.text.length > MAX_TEXT) return false;
  if ((draft.hint?.length ?? 0) > MAX_HINT) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Repli sans LLM
// ---------------------------------------------------------------------------

const DOMAIN_EMOJI: Record<string, string> = {
  "Pilotage, Gestion, Cadre réglementaire": "🗂️",
  "Management, Social, Soin": "🤝",
  "Coopération, Organisation et Développement de ses compétences": "🧩",
  "Communication, Création, Innovation, Nouvelles technologies": "💡",
  "Production, Construction, Qualité, Logistique": "🛠️",
  "Développement économique": "📈",
};

export function templateDraft(plan: TargetPlan, macro: Macro): CardDraft {
  const emoji = DOMAIN_EMOJI[macro.domain] ?? "✨";
  if (plan.mode === "creuser") {
    const text = plan.focus ?? macro.label;
    return {
      text: text.length > MAX_TEXT ? macro.label : text,
      hint: plan.parent ? clip(`Comme pour « ${plan.parent.text} »`, MAX_HINT) : undefined,
      emoji,
    };
  }
  return { text: macro.label, hint: "Même juste une fois, pour toi ou pour un pote", emoji };
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** Stable d'un appel à l'autre (cacheable côté API). */
export const CARD_SYSTEM_PROMPT = `Tu écris les cartes de Déclic, un jeu de swipe pour des jeunes de 17 à 25 ans en décrochage, suivis en mission locale. Beaucoup pensent qu'ils ne savent "rien faire". Chaque carte décrit une situation de la vie de tous les jours ; le jeune swipe à droite si ça lui parle, à gauche sinon.

On te donne une compétence du répertoire ROME (France Travail). Tu écris UNE carte qui fait reconnaître cette compétence dans une situation vécue hors travail : entre potes, au quartier, en ligne, dans une asso, au sport, dans un petit job.

Règles :
- "text" : 4 à 12 mots, verbe à l'infinitif ou question en "T'as déjà…", registre parlé, tutoiement. Pas de jargon ROME, pas d'intitulé de métier.
- Jamais d'étiquette ("tu es manuel", "tu es organisé") : une situation concrète.
- "hint" : facultatif, 3 à 10 mots, rassurant ("même une fois", "même sans t'en rendre compte").
- "emoji" : un seul emoji, sans visage ni personne.
- Interdit : la santé, le handicap, l'origine, le pays, la religion, la famille du jeune (parents, frères, sœurs), son argent, sa situation administrative, la politique, la sexualité. Pour parler d'enfants, dis "des plus petits" ou "des enfants", jamais "ton petit frère".
- Ne répète pas une situation déjà montrée.
- Mode "creuser" : le jeune vient de dire qu'il a DÉJÀ fait la carte parente. Pose une suite plus précise sur ce même vécu ("Et c'est toi qui…", "T'as déjà dû…").

Réponds uniquement avec l'objet JSON demandé.`;

const draftSchema = z.object({
  text: z.string().min(1).max(200),
  hint: z.string().max(200).optional(),
  emoji: z.string().max(16).optional(),
  macro: z.number().int().optional(),
});

const draftJsonSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
    hint: { type: "string" },
    emoji: { type: "string" },
    macro: { type: "integer", description: "Code de la compétence choisie (mode creuser avec plusieurs candidates)" },
  },
  required: ["text"],
  additionalProperties: false,
};

export function buildCardPrompt(plan: TargetPlan, recentTexts: string[]): string {
  const lines: string[] = [`Mode : ${plan.mode}`];

  if (plan.parent) lines.push(`Carte parente (le jeune a dit "déjà fait") : « ${plan.parent.text} »`);

  if (plan.candidates.length === 1) {
    const m = plan.candidates[0];
    lines.push(`Compétence ROME visée : « ${m.label} » (enjeu : ${m.enjeu})`);
    if (plan.focus) lines.push(`Précise sur ce point : « ${plan.focus} »`);
  } else {
    lines.push(
      "Choisis dans cette liste LA compétence la plus naturellement liée à la carte parente, et renvoie son code dans \"macro\" :",
      ...plan.candidates.map((m) => `- ${m.code} : ${m.label}`),
    );
  }

  if (recentTexts.length > 0) {
    lines.push("Déjà montré (à ne pas répéter) :", ...recentTexts.map((t) => `- ${t}`));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export type WrittenCard = { macro: Macro; draft: CardDraft; source: CardSource };

export async function writeCard(
  plan: TargetPlan,
  recentTexts: string[],
): Promise<WrittenCard> {
  const fallback: WrittenCard = {
    macro: plan.candidates[0],
    draft: templateDraft(plan, plan.candidates[0]),
    source: "template",
  };

  const out = await completeJson({
    system: CARD_SYSTEM_PROMPT,
    prompt: buildCardPrompt(plan, recentTexts),
    schema: draftSchema,
    jsonSchema: draftJsonSchema,
    effort: "low",
  });
  if (!out) return fallback;

  // Le LLM ne peut choisir qu'une compétence de la short-list.
  const macro =
    plan.candidates.length > 1
      ? plan.candidates.find((m) => m.code === out.macro) ?? plan.candidates[0]
      : plan.candidates[0];

  const draft: CardDraft = {
    text: out.text.trim(),
    hint: out.hint?.trim() || undefined,
    emoji: firstEmoji(out.emoji),
  };
  if (!isSafeDraft(draft)) return fallback;

  return { macro, draft, source: "generated" };
}

function firstEmoji(s?: string): string | undefined {
  if (!s) return undefined;
  const match = s.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/u);
  return match?.[0];
}
