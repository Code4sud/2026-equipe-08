import { z } from "zod";
import rawIndex from "../data/rome/jobs-index.json";
import { getMacro } from "./adaptive/skills";
import { completeJson } from "./llm";
import type { JobSuggestion, MatchInput } from "./matches";

/**
 * Métiers proposés à partir des skill matches (serveur uniquement).
 *
 * 1. Le CODE choisit des candidats parmi les ~850 métiers ROME accessibles
 *    (data/rome/jobs-index.json, `npm run build:jobs`) : compétences ROME
 *    prouvées présentes dans la fiche, mots communs entre les cartes et le
 *    métier, proximité des centres d'intérêt.
 * 2. Le LLM en retient 3 à 5 et écrit une accroche qui relie le vécu au
 *    métier. Il ne peut choisir que dans la liste : pas de métier inventé.
 * Sans LLM : les mieux classés, avec une accroche construite.
 */

export type IndexedJob = {
  code: string;
  label: string;
  level: number | null;
  definition: string;
  centers: Record<string, number>;
  /** Macro-compétence ROME -> 1 (principale) ou 0,5. */
  macros: Record<string, number>;
};

const JOBS = (rawIndex as unknown as { jobs: IndexedJob[] }).jobs;
const BY_CODE = new Map(JOBS.map((j) => [j.code, j]));

export function getIndexedJob(code: string): IndexedJob | undefined {
  return BY_CODE.get(code);
}

// ---------------------------------------------------------------------------
// 1. Candidats
// ---------------------------------------------------------------------------

const CANDIDATES = 25;
const WEIGHTS = { skill: 0.6, lex: 0.8, center: 0.7 };
/** Au-delà, les mots communs n'ajoutent plus rien. */
const LEX_CAP = 12;

// Racines (5 lettres, sans accents) trop générales dans les fiches métier.
const STOP = new Set([
  "avec", "pour", "dans", "sans", "chez", "tout", "toute", "comme", "entre", "plusi",
  "petit", "autre", "quelq", "truc", "plus", "faire", "avoir", "etre", "leurs", "cette",
  "ainsi", "selon", "peut", "assur", "reali", "effec", "activ", "metie", "profe", "clien",
  "perso", "struc", "march", "trava", "gener", "dossi", "produ", "servi", "manie", "respe",
  "regle", "organ", "condu", "contr", "suivi", "verif", "prepa", "proce", "equip", "techn",
  "norme",
]);

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Racine grossière : 5 lettres, sans le pluriel (« vélos » ~ « vélo »). */
export function jobStems(s: string): string[] {
  return normalize(s)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.replace(/[sx]$/, "").slice(0, 5))
    .filter((w) => !STOP.has(w));
}

let idfCache: Map<string, number> | null = null;
function idf(word: string): number {
  if (!idfCache) {
    const df = new Map<string, number>();
    for (const job of JOBS) {
      for (const w of new Set(jobStems(`${job.label} ${job.definition}`))) df.set(w, (df.get(w) ?? 0) + 1);
    }
    idfCache = new Map([...df].map(([w, n]) => [w, Math.log(JOBS.length / n)]));
  }
  return idfCache.get(word) ?? 0;
}

function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key] ?? 0;
    const y = b[key] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export type RankedJob = {
  job: IndexedJob;
  score: number;
  /** Matchs qui soutiennent ce métier (compétence ROME ou mots communs). */
  cardIds: string[];
  /** Compétences ROME prouvées présentes dans la fiche. */
  skills: string[];
};

export function rankJobs(matches: MatchInput[], limit = CANDIDATES): RankedJob[] {
  if (matches.length === 0) return [];

  const centers: Record<string, number> = {};
  for (const m of matches) {
    for (const [k, v] of Object.entries(m.centers)) centers[k] = (centers[k] ?? 0) + (v ?? 0);
  }
  const matchStems = matches.map((m) => ({ m, stems: new Set(jobStems(m.text)) }));

  return JOBS.map((job) => {
    const label = new Set(jobStems(job.label));
    const definition = new Set(jobStems(job.definition));
    const cardIds = new Set<string>();
    const skills = new Set<string>();

    let skill = 0;
    let lex = 0;
    for (const { m, stems } of matchStems) {
      const weight = m.skill ? job.macros[String(m.skill)] ?? 0 : 0;
      if (weight > 0) {
        skill += weight;
        cardIds.add(m.cardId);
        const skillLabel = getMacro(m.skill!)?.label;
        if (skillLabel) skills.add(skillLabel);
      }
      let own = 0;
      for (const w of stems) own += label.has(w) ? 2 * idf(w) : definition.has(w) ? idf(w) : 0;
      if (own >= 2) cardIds.add(m.cardId);
      lex += own;
    }

    const score =
      WEIGHTS.skill * skill +
      (WEIGHTS.lex * Math.min(lex, LEX_CAP)) / LEX_CAP +
      WEIGHTS.center * cosine(centers, job.centers) -
      (job.level === null ? 0.05 : 0);

    return { job, score, cardIds: [...cardIds], skills: [...skills] };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 2. Choix et accroches (LLM, ou repli)
// ---------------------------------------------------------------------------

export const JOBS_SYSTEM_PROMPT = `Tu aides Orientis, une app pour des jeunes de 17 à 25 ans en décrochage, suivis en mission locale, à découvrir des métiers. Beaucoup pensent qu'ils ne savent "rien faire".

On te donne ce que le jeune a DÉJÀ fait (ses expériences, en cartes numérotées) et une liste de métiers du répertoire ROME (France Travail), chacun avec son code et sa définition. Choisis entre 3 et 5 métiers de cette liste, ceux qui prolongent le plus naturellement ses expériences, et variés entre eux (pas cinq fois le même métier).

Pour chaque métier :
- "code" : le code ROME, exactement comme dans la liste. Jamais de métier hors liste.
- "pitch" : une phrase de 10 à 24 mots, tutoiement, registre parlé, qui relie une de SES expériences au quotidien du métier ("Tu répares déjà les vélos du quartier : c'est le cœur du métier de mécanicien cycles."). Concret, pas de jargon, pas de promesse ("tu vas adorer", "garanti"), pas de jugement.
- "experiences" : les numéros des cartes sur lesquelles le métier s'appuie.

Interdit : la santé, le handicap, l'origine, la religion, la famille du jeune, son argent, sa situation administrative, la politique, la sexualité.

Réponds uniquement avec l'objet JSON demandé.`;

const outSchema = z.object({
  jobs: z
    .array(
      z.object({
        code: z.string(),
        pitch: z.string(),
        experiences: z.array(z.number().int()).optional(),
      }),
    )
    .min(1)
    .max(8),
});

const outJsonSchema = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          pitch: { type: "string" },
          experiences: { type: "array", items: { type: "integer" } },
        },
        required: ["code", "pitch"],
        additionalProperties: false,
      },
    },
  },
  required: ["jobs"],
  additionalProperties: false,
};

export function buildJobsPrompt(matches: MatchInput[], ranked: RankedJob[]): string {
  return [
    "Ce que le jeune a déjà fait :",
    ...matches.map((m, i) => {
      const skill = m.skill ? getMacro(m.skill)?.label : undefined;
      return `${i + 1}. « ${m.text} »${skill ? ` (compétence ROME : ${skill})` : ""}`;
    }),
    "",
    "Métiers possibles (choisis uniquement dans cette liste) :",
    ...ranked.map(({ job }) => `- ${job.code} : ${job.label} — ${job.definition}`),
  ].join("\n");
}

const MIN_PITCH = 20;
const MAX_PITCH = 220;
const FALLBACK_COUNT = 4;

function toSuggestion(
  ranked: RankedJob,
  pitch: string,
  cardIds: string[],
  source: JobSuggestion["source"],
): JobSuggestion {
  const { job } = ranked;
  return {
    code: job.code,
    label: job.label,
    level: job.level,
    definition: job.definition,
    pitch,
    cardIds,
    skills: ranked.skills,
    source,
  };
}

function templatePitch(ranked: RankedJob, matches: MatchInput[]): string {
  const support = matches.find((m) => ranked.cardIds.includes(m.cardId)) ?? matches[0];
  return `Tu as déjà fait « ${support.text.replace(/[.!?…\s]+$/u, "")} » : c'est une vraie base pour ce métier.`;
}

export async function suggestJobs(matches: MatchInput[]): Promise<JobSuggestion[]> {
  const ranked = rankJobs(matches);
  if (ranked.length === 0) return [];

  const fallback = () =>
    ranked
      .slice(0, FALLBACK_COUNT)
      .map((r) =>
        toSuggestion(
          r,
          templatePitch(r, matches),
          r.cardIds.length > 0 ? r.cardIds : [matches[0].cardId],
          "template",
        ),
      );

  const out = await completeJson({
    system: JOBS_SYSTEM_PROMPT,
    prompt: buildJobsPrompt(matches, ranked),
    schema: outSchema,
    jsonSchema: outJsonSchema,
    effort: "low",
    timeoutMs: 45_000,
  });
  if (!out) return fallback();

  const byCode = new Map(ranked.map((r) => [r.job.code, r]));
  const seen = new Set<string>();
  const chosen: JobSuggestion[] = [];
  for (const item of out.jobs) {
    const r = byCode.get(item.code.trim());
    const pitch = item.pitch.trim();
    if (!r || seen.has(r.job.code) || pitch.length < MIN_PITCH || pitch.length > MAX_PITCH) continue;
    seen.add(r.job.code);
    const cardIds = (item.experiences ?? [])
      .map((n) => matches[n - 1]?.cardId)
      .filter((id): id is string => Boolean(id));
    const support = cardIds.length > 0 ? cardIds : r.cardIds.length > 0 ? r.cardIds : [matches[0].cardId];
    chosen.push(toSuggestion(r, pitch, [...new Set(support)], "generated"));
  }

  return chosen.length >= 2 ? chosen.slice(0, 5) : fallback();
}
