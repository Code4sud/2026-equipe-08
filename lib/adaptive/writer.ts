import { z } from "zod";
import { completeJson } from "../llm";
import type { CardSource } from "../types";
import { pregenCard } from "./pregen";
import type { Macro } from "./skills";
import type { CardDraft, TargetPlan } from "./target";

/**
 * Écriture du texte d'une carte. Le LLM reçoit la cible ROME et les textes
 * des cartes déjà montrées (aimées / pas aimées) : jamais de texte libre du
 * jeune. Si le LLM échoue ou sort du cadre, on retombe sur la carte
 * pré-écrite de la compétence, ou à défaut sur son libellé ROME
 * (source "template").
 */

// ---------------------------------------------------------------------------
// Garde-fous
// ---------------------------------------------------------------------------

// Filtre de thèmes sensibles retiré pour l'instant (décision d'équipe) :
// le prompt cadre seul. Version précédente : commit 5ceeea1.
// On garde uniquement des contrôles de forme pour ne pas casser l'affichage.

const MAX_TEXT = 120;
const MAX_HINT = 100;

/**
 * Explorer = activité ("ça te tente ?"), jamais une question d'expérience :
 * sinon un swipe gauche voudrait dire "jamais fait" et serait compté comme
 * un désintérêt. Creuser = question de vécu, forme libre.
 */
export function matchesMode(plan: Pick<TargetPlan, "mode">, draft: CardDraft): boolean {
  if (plan.mode === "creuser") return true;
  const text = draft.text.replace(/[’]/g, "'").trim();
  if (text.endsWith("?")) return false;
  // (pas de \b après "à" : en JS, "à" n'est pas un caractère de mot)
  if (/(^|[^\p{L}])d[ée]j[àa](?!\p{L})/iu.test(text)) return false;
  if (/^(t'as|tu as|as-tu|t'es|tu es|est-ce|et c'est|c'est toi)\b/i.test(text)) return false;
  return true;
}

export function isUsableDraft(draft: CardDraft): boolean {
  return draft.text.length >= 4 && draft.text.length <= MAX_TEXT && (draft.hint?.length ?? 0) <= MAX_HINT;
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
  const pregen = pregenCard(macro.code);
  if (plan.mode === "creuser") {
    // Carte de la banque reliée par les mots : l'activité pré-écrite, sous
    // « C'est toi ? », se lit comme une question de vécu.
    if (pregen && !plan.focus) {
      return {
        text: pregen.text,
        hint: plan.parent ? clip(`Quand tu as fait : « ${plan.parent.text} »`, MAX_HINT) : undefined,
        emoji: pregen.emoji ?? emoji,
      };
    }
    const text = plan.focus ?? macro.label;
    return {
      text: text.length > MAX_TEXT ? macro.label : text,
      hint: plan.parent ? clip(`Quand tu as fait : « ${plan.parent.text} »`, MAX_HINT) : undefined,
      emoji,
    };
  }
  if (pregen) return { ...pregen, emoji: pregen.emoji ?? emoji };
  return { text: macro.label, hint: "Même si t'as jamais essayé", emoji };
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** Stable d'un appel à l'autre (cacheable côté API). */
export const CARD_SYSTEM_PROMPT = `Tu écris les cartes de Déclic, un jeu de swipe pour des jeunes de 17 à 25 ans en décrochage, suivis en mission locale. Beaucoup pensent qu'ils ne savent "rien faire". Il y a deux sortes de cartes, avec deux questions différentes affichées au-dessus :

- Mode "explorer" : l'écran demande « Ça te tente ? ». La carte est UNE ACTIVITÉ à l'infinitif, qu'on peut avoir envie de faire même sans l'avoir jamais faite ("Fixer les prix pour une vente de gâteaux"). JAMAIS de question, JAMAIS "déjà" : on mesure l'envie, pas l'expérience (beaucoup n'ont jamais eu l'occasion d'essayer).
- Mode "creuser" : l'écran demande « C'est toi ? ». Le jeune vient de dire qu'il a DÉJÀ fait la carte parente. La carte est UNE QUESTION fermée sur ce même vécu, plus précise, à laquelle on répond oui ou non ("Et c'est toi qui fixais les prix ?", "T'as déjà dû gérer un client pas content ?").

On te donne une compétence du répertoire ROME (France Travail). Tu écris UNE carte qui fait reconnaître cette compétence dans une situation vécue hors travail : entre potes, au quartier, en ligne, dans une asso, au sport, dans un petit job.

Règles :
- "text" : 4 à 12 mots, registre parlé, tutoiement. Pas de jargon ROME, pas d'intitulé de métier.
- Jamais d'étiquette ("tu es manuel", "tu es organisé") : une situation concrète.
- "hint" : facultatif, 3 à 10 mots, rassurant ("même une fois", "même sans t'en rendre compte").
- "emoji" : un seul emoji, sans visage ni personne.
- Interdit : la santé, le handicap, l'origine, le pays, la religion, la famille du jeune (parents, frères, sœurs), son argent, sa situation administrative, la politique, la sexualité. Pour parler d'enfants, dis "des plus petits" ou "des enfants", jamais "ton petit frère".
- Ne répète pas une situation déjà montrée.

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

/** Ce que le LLM sait du jeune : uniquement des textes de cartes. */
export type CardContext = {
  /** Cartes montrées récemment (à ne pas répéter). */
  recent: string[];
  /** Cartes où il a dit oui (les plus récentes d'abord). */
  liked: string[];
  /** Cartes où il a dit "pas mon truc". */
  disliked: string[];
};

export function buildCardPrompt(plan: TargetPlan, ctx: CardContext): string {
  const lines: string[] = [`Mode : ${plan.mode}`];

  if (plan.parent) lines.push(`Carte parente (le jeune a dit "déjà fait") : « ${plan.parent.text} »`);

  if (plan.candidates.length === 1) {
    const m = plan.candidates[0];
    lines.push(`Compétence ROME visée : « ${m.label} » (enjeu : ${m.enjeu})`);
    if (plan.focus) lines.push(`Précise sur ce point : « ${plan.focus} »`);
  } else if (plan.mode === "creuser") {
    lines.push(
      "Choisis dans cette liste LA compétence la plus naturellement liée à la carte parente, et renvoie son code dans \"macro\" :",
      ...plan.candidates.map((m) => `- ${m.code} : ${m.label}`),
    );
  } else {
    lines.push(
      "Choisis dans cette liste LA compétence qui prolonge le mieux ce que le jeune aime, et renvoie son code dans \"macro\" :",
      ...plan.candidates.map((m) => `- ${m.code} : ${m.label} (enjeu : ${m.enjeu})`),
    );
  }

  if (plan.mode === "explorer" && ctx.liked.length > 0) {
    lines.push(
      "Il a dit oui à (ancre la situation dans cet univers quand c'est naturel, sans le recopier) :",
      ...ctx.liked.map((t) => `- ${t}`),
    );
  }
  if (plan.mode === "explorer" && ctx.disliked.length > 0) {
    lines.push("Ça ne lui parle pas (évite ces univers) :", ...ctx.disliked.map((t) => `- ${t}`));
  }

  if (ctx.recent.length > 0) {
    lines.push("Déjà montré (à ne pas répéter) :", ...ctx.recent.map((t) => `- ${t}`));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export type WrittenCard = { macro: Macro; draft: CardDraft; source: CardSource };

export async function writeCard(plan: TargetPlan, ctx: CardContext): Promise<WrittenCard> {
  const fallback: WrittenCard = {
    macro: plan.candidates[0],
    draft: templateDraft(plan, plan.candidates[0]),
    source: "template",
  };

  const prompt = buildCardPrompt(plan, ctx);
  const ask = (extra = "") =>
    completeJson({
      system: CARD_SYSTEM_PROMPT,
      prompt: prompt + extra,
      schema: draftSchema,
      jsonSchema: draftJsonSchema,
      effort: "low",
    });

  let out = await ask();
  if (!out) return fallback;

  // Une seule relance si une carte explorer est sortie en question de vécu.
  if (!matchesMode(plan, { text: out.text })) {
    out = await ask(
      `\n\nTa proposition « ${out.text} » est une question sur le vécu. Réécris-la en ACTIVITÉ à l'infinitif, sans "déjà" ni point d'interrogation.`,
    );
    if (!out) return fallback;
  }

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
  if (!isUsableDraft(draft) || !matchesMode(plan, draft)) return fallback;

  return { macro, draft, source: "generated" };
}

function firstEmoji(s?: string): string | undefined {
  if (!s) return undefined;
  const match = s.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/u);
  return match?.[0];
}
