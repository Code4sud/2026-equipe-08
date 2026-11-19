import { z } from "zod";
import { CARDS } from "../../../content/cards";
import { getMacro } from "../../../lib/adaptive/skills";
import { buildCard, pickTarget } from "../../../lib/adaptive/target";
import { templateDraft, writeCard, type WrittenCard } from "../../../lib/adaptive/writer";
import { CENTER_IDS } from "../../../lib/centers";
import { llmBackend } from "../../../lib/llm";
import { computeProfile } from "../../../lib/score";
import type { Card } from "../../../lib/types";

/**
 * POST /api/card — prochaine carte du swipe adaptatif.
 *
 * Entrée : l'historique du swipe (ids de cartes + gestes) et les cartes déjà
 * générées. Aucune donnée personnelle : le swipe ne contient pas de texte libre.
 * Sortie : { card } (ou { card: null } quand il n'y a plus de cible).
 */

const centerSet = new Set(CENTER_IDS);

const reasonSchema = z.enum([
  "pas-mon-truc",
  "jamais-essaye",
  "pas-capable",
  "pas-les-moyens",
  "pas-pres",
  "deja-souvent",
  "deja-une-fois",
  "jamais-fait-mais-tente",
]);

const bodySchema = z.object({
  responses: z
    .array(
      z.object({
        cardId: z.string().max(120),
        direction: z.enum(["left", "right"]),
        reason: reasonSchema.optional(),
      }),
    )
    .max(120),
  generated: z
    .array(
      z.object({
        id: z.string().max(160),
        text: z.string().max(200),
        centers: z.record(z.string(), z.number().min(0).max(1)),
        target: z.object({
          mode: z.enum(["explorer", "creuser"]),
          macro: z.number().int(),
          label: z.string().max(300),
          focus: z.string().max(300).optional(),
          center: z.string(),
          parentId: z.string().max(160).optional(),
        }),
      }),
    )
    .max(60),
});

/** Cache mémoire des textes écrits : les répétitions de démo sont instantanées. */
const cache = new Map<string, WrittenCard>();
const CACHE_MAX = 500;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  // Cartes générées renvoyées par le client : on ne garde que les centres
  // connus et les compétences qui existent dans le référentiel.
  const generated: Card[] = parsed.data.generated
    .filter((c) => getMacro(c.target.macro) && centerSet.has(c.target.center))
    .map((c) => ({
      id: c.id,
      text: c.text,
      centers: Object.fromEntries(
        Object.entries(c.centers).filter(([id]) => centerSet.has(id)),
      ),
      target: c.target,
    }));

  const cards = [...CARDS, ...generated];
  const responses = parsed.data.responses.map((r, i) => ({ ...r, ts: i }));
  const profile = computeProfile(responses, [], cards);

  const backend = llmBackend();
  // Pas de carte « creuser » : un « déjà fait » donne directement un skill match.
  let plan = pickTarget({ profile, responses, cards, allowLoose: backend !== "mock", allowCreuser: false });
  if (!plan) return Response.json({ card: null, backend });

  // Contexte pour le LLM : uniquement des textes de cartes (pas de texte libre).
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const textOf = (r: (typeof responses)[number]) => cardById.get(r.cardId)?.text;
  const isInterest = (r: (typeof responses)[number]) =>
    cardById.get(r.cardId)?.target?.mode !== "creuser";
  const ctx = {
    recent: responses.slice(-8).map(textOf).filter((t): t is string => Boolean(t)),
    liked: responses
      .filter((r) => r.direction === "right" && isInterest(r))
      .slice(-6)
      .reverse()
      .map(textOf)
      .filter((t): t is string => Boolean(t)),
    disliked: responses
      .filter((r) => r.direction === "left" && isInterest(r) && (!r.reason || r.reason === "pas-mon-truc"))
      .slice(-4)
      .map(textOf)
      .filter((t): t is string => Boolean(t)),
  };

  // Le cache tient compte des goûts : deux jeunes différents n'ont pas la même carte.
  const key = [
    plan.mode,
    plan.candidates.map((m) => m.code).join(","),
    plan.focus ?? "",
    plan.parent?.text ?? "",
    plan.mode === "explorer" ? ctx.liked.join("/") : "",
  ].join("|");

  let written = cache.get(key);
  if (!written) {
    written = await writeCard(plan, ctx);
    if (written.source === "generated") {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, written);
    }
  }

  // LLM en échec sur une short-list floue : on ne devine pas, on explore.
  if (written.source === "template" && plan.loose) {
    plan = pickTarget({ profile, responses, cards, allowLoose: false, allowCreuser: false });
    if (!plan) return Response.json({ card: null, backend });
    written = { macro: plan.candidates[0], draft: templateDraft(plan, plan.candidates[0]), source: "template" };
  }

  const card = buildCard(plan, written.macro, written.draft, written.source);
  return Response.json({ card, backend });
}
