/**
 * Pré-écrit une carte "explorer" pour chaque compétence ciblable du swipe,
 * avec le LLM, et la versionne dans data/rome/explorer-cards.json.
 *
 * Usage (abonnement Claude, CLI `claude` connectée) :
 *   npm run pregen:cards
 *   npm run pregen:cards -- --force     # tout réécrire
 *
 * Incrémental : les compétences déjà écrites sont gardées, le fichier est
 * sauvegardé après chaque lot. Relancer le script complète les manquantes.
 *
 * Ces cartes servent quand aucun LLM n'est disponible (mode mock, Vercel
 * sans clé, LLM en échec) : le jeune ne voit jamais un libellé ROME brut.
 */

import fs from "node:fs";
import { z } from "zod";
import { CARDS } from "../content/cards";
import { swipeTargets, ROME_VERSION, type Macro } from "../lib/adaptive/skills";
import type { CardDraft } from "../lib/adaptive/target";
import { CARD_SYSTEM_PROMPT, isUsableDraft, matchesMode } from "../lib/adaptive/writer";
import { completeJson } from "../lib/llm";

process.env.LLM_BACKEND ??= "cli";

const OUT = "data/rome/explorer-cards.json";
const BATCH = 8;
const PARALLEL = 4;
const FORCE = process.argv.includes("--force");

type PregenFile = { version: string; generatedAt: string; cards: Record<string, CardDraft> };

const batchSchema = z.object({
  cards: z.array(
    z.object({
      macro: z.number().int(),
      text: z.string(),
      hint: z.string().optional(),
      emoji: z.string().optional(),
    }),
  ),
});

const batchJsonSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          macro: { type: "integer" },
          text: { type: "string" },
          hint: { type: "string" },
          emoji: { type: "string" },
        },
        required: ["macro", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

function batchPrompt(macros: Macro[], avoid: string[]): string {
  return [
    "Mode : explorer.",
    "On ne connaît pas encore le jeune : écris des cartes qui parlent au plus grand nombre.",
    "Écris UNE carte par compétence ci-dessous (renvoie son code dans \"macro\"), sans jamais répéter deux fois la même situation :",
    ...macros.map((m) => `- ${m.code} : ${m.label} (enjeu : ${m.enjeu})`),
    ...(avoid.length
      ? ["", "Situations déjà prises par d'autres cartes : n'en reprends AUCUNE, trouve un autre univers.", ...avoid.map((t) => `- ${t}`)]
      : []),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Doublons : entre cartes pré-écrites, et avec la banque fixe
// ---------------------------------------------------------------------------

const words = (t: string) =>
  new Set(
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3),
  );

/** Deux situations se ressemblent trop si elles partagent >= 60 % de leurs mots. */
function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 && inter / union >= 0.6;
}

/** Retire les cartes trop proches d'une carte de la banque ou d'une carte gardée avant elle. */
function dedupe(file: PregenFile): string[] {
  const bank = CARDS.map((c) => c.text);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const [code, card] of Object.entries(file.cards)) {
    if (bank.some((b) => similar(b, card.text)) || kept.some((k) => similar(k, card.text))) {
      removed.push(card.text);
      delete file.cards[code];
    } else {
      kept.push(card.text);
    }
  }
  return removed;
}

function firstEmoji(s?: string): string | undefined {
  return s?.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/u)?.[0];
}

function load(): PregenFile {
  try {
    const file = JSON.parse(fs.readFileSync(OUT, "utf8")) as PregenFile;
    return FORCE ? { ...file, cards: {} } : file;
  } catch {
    return { version: ROME_VERSION, generatedAt: "", cards: {} };
  }
}

function save(file: PregenFile) {
  const sorted = Object.fromEntries(Object.entries(file.cards).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      { version: ROME_VERSION, generatedAt: new Date().toISOString().slice(0, 10), cards: sorted },
      null,
      1,
    ) + "\n",
  );
}

async function writeBatch(macros: Macro[], avoid: string[]): Promise<Record<string, CardDraft>> {
  const out = await completeJson({
    system: CARD_SYSTEM_PROMPT,
    prompt: batchPrompt(macros, avoid),
    schema: batchSchema,
    jsonSchema: batchJsonSchema,
    effort: "low",
    timeoutMs: 120_000,
  });
  const result: Record<string, CardDraft> = {};
  for (const card of out?.cards ?? []) {
    if (!macros.some((m) => m.code === card.macro)) continue;
    const draft: CardDraft = {
      text: card.text.trim(),
      hint: card.hint?.trim() || undefined,
      emoji: firstEmoji(card.emoji),
    };
    if (isUsableDraft(draft) && matchesMode({ mode: "explorer" }, draft)) {
      result[String(card.macro)] = draft;
    }
  }
  return result;
}

async function main() {
  const file = load();
  const targets = swipeTargets();
  const t0 = Date.now();

  for (let round = 1; round <= 4; round++) {
    const removed = dedupe(file);
    if (removed.length) {
      console.log(`Doublons retirés (${removed.length}) : ${removed.join(" | ")}`);
      save(file);
    }
    const todo = targets.filter((m) => !file.cards[String(m.code)]);
    if (todo.length === 0) break;
    console.log(`Tour ${round} : ${todo.length} compétences à écrire (${targets.length} au total)`);

    const batches: Macro[][] = [];
    for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

    for (let i = 0; i < batches.length; i += PARALLEL) {
      const group = batches.slice(i, i + PARALLEL);
      // Au 1er tour on écrit à l'aveugle (rapide) ; ensuite on montre tout ce
      // qui existe déjà pour éviter les redites.
      const avoid =
        round === 1 && Object.keys(file.cards).length === 0
          ? []
          : [...CARDS.map((c) => c.text), ...Object.values(file.cards).map((c) => c.text)];
      const results = await Promise.all(group.map((batch) => writeBatch(batch, avoid)));
      for (const r of results) Object.assign(file.cards, r);
      save(file);
      const done = Object.keys(file.cards).length;
      console.log(`  ${done}/${targets.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
  }

  const missing = targets.filter((m) => !file.cards[String(m.code)]);
  console.log(
    `Terminé : ${targets.length - missing.length}/${targets.length} cartes dans ${OUT}` +
      (missing.length ? ` — manquantes : ${missing.map((m) => m.label).join(" | ")}` : ""),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
