/**
 * Banc « métiers proposés » : le bon métier sort-il dans les 25 candidats
 * soumis à l'IA ? Compare le classement actuel (lib/careers.ts) à une
 * recherche par embeddings et au mélange des deux.
 *
 *   npm run bench:jobs
 *   npm run bench:jobs -- --model Xenova/paraphrase-multilingual-MiniLM-L12-v2
 *
 * Embeddings : modèle local (transformers.js, comme Whisper), rien ne sort de
 * la machine. Les vecteurs des 849 métiers sont mis en cache dans
 * node_modules/.cache/bench-jobs (premier lancement : téléchargement du
 * modèle + ~1 min de calcul).
 *
 * Compétence de chaque carte : repli lexical de resolveSkill (mode mock), donc
 * un peu moins bonne que celle choisie par le LLM en vrai.
 */

process.env.LLM_BACKEND = "mock";

import fs from "node:fs";
import path from "node:path";
import { pipeline } from "@huggingface/transformers";
import { CARDS } from "../../content/cards";
import rawIndex from "../../data/rome/jobs-index.json";
import { rankJobs, type IndexedJob } from "../../lib/careers";
import type { MatchInput } from "../../lib/matches";
import { resolveSkill } from "../../lib/skillOf";
import type { Card } from "../../lib/types";
import { CASES, type BenchCase } from "./cases";

const JOBS = (rawIndex as unknown as { jobs: IndexedJob[] }).jobs;
const CANDIDATES = 25;

const argModel = process.argv.indexOf("--model");
const MODEL = argModel > 0 ? process.argv[argModel + 1] : "Xenova/multilingual-e5-small";
const E5 = /e5/i.test(MODEL);

// ---------------------------------------------------------------------------
// Entrées : cartes du cas -> MatchInput (avec compétence résolue)
// ---------------------------------------------------------------------------

async function inputsOf(c: BenchCase): Promise<MatchInput[]> {
  const cards: Card[] = [
    ...(c.cards ?? []).map((id) => {
      const card = CARDS.find((x) => x.id === id);
      if (!card) throw new Error(`carte inconnue : ${id}`);
      return card;
    }),
    ...(c.texts ?? []).map((t, i) => ({ id: `gen-${c.name}-${i}`, text: t.text, centers: t.centers }) as Card),
  ];
  return Promise.all(
    cards.map(async (card) => ({
      cardId: card.id,
      text: card.text,
      centers: card.centers,
      skill: (await resolveSkill(card))?.code,
    })),
  );
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

type Embed = (texts: string[]) => Promise<Float32Array[]>;

async function loadEmbedder(): Promise<Embed> {
  const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  return async (texts) => {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const t = await extractor(texts.slice(i, i + 32), { pooling: "mean", normalize: true });
      const dim = t.dims[1];
      const data = t.data as Float32Array;
      for (let k = 0; k < t.dims[0]; k++) out.push(data.slice(k * dim, (k + 1) * dim));
    }
    return out;
  };
}

async function jobVectors(embed: Embed): Promise<Float32Array[]> {
  const dir = path.join("node_modules", ".cache", "bench-jobs");
  const file = path.join(dir, `${MODEL.replace(/\W+/g, "_")}-${JOBS.length}.json`);
  if (fs.existsSync(file)) return (JSON.parse(fs.readFileSync(file, "utf8")) as number[][]).map((v) => Float32Array.from(v));
  console.log(`Calcul des vecteurs des ${JOBS.length} métiers (${MODEL})…`);
  const vectors = await embed(JOBS.map((j) => `${E5 ? "passage: " : ""}${j.label}. ${j.definition}`));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(vectors.map((v) => Array.from(v, (x) => Math.round(x * 1e5) / 1e5))));
  return vectors;
}

const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

// ---------------------------------------------------------------------------
// Classements (liste complète de codes, du meilleur au moins bon)
// ---------------------------------------------------------------------------

function rankCurrent(inputs: MatchInput[]): string[] {
  return rankJobs(inputs, JOBS.length).map((r) => r.job.code);
}

/** Proximité de sens : meilleure similarité entre une carte et la fiche. */
function rankEmbedding(queries: Float32Array[], jobs: Float32Array[]): string[] {
  return JOBS.map((j, i) => ({ code: j.code, s: Math.max(...queries.map((q) => dot(q, jobs[i]))) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.code);
}

/** Fusion par les rangs (RRF) : ni l'un ni l'autre ne domine par son échelle. */
function rankFusion(a: string[], b: string[], k = 60): string[] {
  const score = new Map<string, number>();
  a.forEach((c, i) => score.set(c, (score.get(c) ?? 0) + 1 / (k + i + 1)));
  b.forEach((c, i) => score.set(c, (score.get(c) ?? 0) + 1 / (k + i + 1)));
  return [...score].sort((x, y) => y[1] - x[1]).map(([c]) => c);
}

// ---------------------------------------------------------------------------

const LABEL = new Map(JOBS.map((j) => [j.code, j.label]));

function firstHit(ranking: string[], expect: RegExp): number {
  const i = ranking.findIndex((c) => expect.test(LABEL.get(c) ?? ""));
  return i < 0 ? Infinity : i + 1;
}

async function main() {
  for (const c of CASES) {
    if (!JOBS.some((j) => c.expect.test(j.label))) throw new Error(`« ${c.name} » : aucun métier attendu dans l'index`);
  }

  const embed = await loadEmbedder();
  const jobs = await jobVectors(embed);

  const methods = ["actuel", "embeddings", "mélange"] as const;
  const ranks: Record<(typeof methods)[number], number[]> = { actuel: [], embeddings: [], mélange: [] };
  const rows: string[] = [];

  for (const c of CASES) {
    const inputs = await inputsOf(c);
    const queries = await embed(inputs.map((m) => `${E5 ? "query: " : ""}${m.text}`));
    const current = rankCurrent(inputs);
    const semantic = rankEmbedding(queries, jobs);
    const fused = rankFusion(current, semantic);
    const r = { actuel: firstHit(current, c.expect), embeddings: firstHit(semantic, c.expect), mélange: firstHit(fused, c.expect) };
    for (const m of methods) ranks[m].push(r[m]);
    const fmt = (n: number) => (n === Infinity ? "—" : String(n)).padStart(4) + (n > CANDIDATES ? " ✗" : "  ");
    rows.push(`${c.name.padEnd(26)}${fmt(r.actuel)}${fmt(r.embeddings)}${fmt(r.mélange)}   ${LABEL.get(current[0])?.slice(0, 40)}`);
  }

  console.log(`\nRang du premier bon métier (✗ = hors des ${CANDIDATES} candidats envoyés à l'IA)\n`);
  console.log(`${"cas".padEnd(26)}actuel  emb.  mél.   (n°1 du classement actuel)`);
  console.log(rows.join("\n"));

  const at = (xs: number[], k: number) => `${Math.round((100 * xs.filter((x) => x <= k).length) / xs.length)} %`;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(`\n${CASES.length} cas · modèle d'embeddings : ${MODEL}\n`);
  console.log(`${"".padEnd(12)}${"top 5".padStart(8)}${"top 25".padStart(8)}${"médiane".padStart(9)}`);
  for (const m of methods) {
    console.log(`${m.padEnd(12)}${at(ranks[m], 5).padStart(8)}${at(ranks[m], CANDIDATES).padStart(8)}${String(median(ranks[m])).padStart(9)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
