/**
 * ROME 4.0 (v62) -> data/rome/jobs-index.json
 *
 * Index compact des métiers accessibles, pour la vue « Mes matchs » : proposer
 * de VRAIS métiers ROME à partir des compétences prouvées en swipe.
 *
 * Pourquoi pas jobs-featured.json : ses ~213 métiers sont choisis pour couvrir
 * les 30 centres d'intérêt, pas pour être complets (pas de « Mécanicien
 * cycles », par exemple). jobs.json (1 923 métiers) n'est pas versionné (5 Mo).
 *
 * Usage :
 *   node scripts/build-jobs-index.mjs
 *
 * Entrées : data/rome/jobs.json (npm run import:rome), data/rome/skills.json
 * Sortie  : data/rome/jobs-index.json
 *
 * Retenus : niveau d'accès 0–3 (sans diplôme → Bac+2), ou inconnu (le texte
 * d'accès n'a pas pu être lu : « à vérifier »), hors métiers exclus de la démo.
 * Pour chaque métier : code, intitulé, niveau, définition courte, centres
 * d'intérêt, et macro-compétences ROME de sa fiche (savoir-faire rattachés).
 */

import fs from "node:fs";

const JOBS = "data/rome/jobs.json";
const SKILLS = "data/rome/skills.json";
const OUT = "data/rome/jobs-index.json";

// Même liste que scripts/import-rome.mjs.
const EXCLUDED = /militaire|chasse|yacht|skipper|scaphandrier|demineur|capitaine|administrateur de l'etat|architecte du patrimoine|medecin|pharmacien|avocat|notaire|expert-comptable|commissaire|lieutenant|officier|forces armees|armee|paneliste/i;
const MAX_LEVEL = 3;
const DEF_MAX = 220;

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const jobs = JSON.parse(fs.readFileSync(JOBS, "utf8"));
const skills = JSON.parse(fs.readFileSync(SKILLS, "utf8"));

// Compétence fine (ou macro) -> macro.
const macroOf = new Map();
for (const macro of Object.values(skills.macros)) {
  macroOf.set(String(macro.code), macro.code);
  for (const child of macro.children) macroOf.set(String(child.code), macro.code);
}

function shortDefinition(text) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  const first = clean.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? clean;
  return first.length <= DEF_MAX ? first : `${first.slice(0, DEF_MAX - 1).trimEnd()}…`;
}

const index = [];
for (const job of jobs) {
  if (job.level !== null && job.level > MAX_LEVEL) continue;
  if (EXCLUDED.test(stripAccents(`${job.label} ${job.access ?? ""}`))) continue;

  // Macro -> 1 si une compétence principale de la fiche la contient, sinon 0,5.
  const macros = {};
  for (const sf of job.competences?.savoirFaire ?? []) {
    const macro = macroOf.get(String(sf.code));
    if (!macro) continue;
    const weight = sf.principal ? 1 : 0.5;
    macros[macro] = Math.max(macros[macro] ?? 0, weight);
  }

  index.push({
    code: job.code,
    label: job.label,
    level: job.level,
    definition: shortDefinition(job.definition),
    centers: job.centers,
    macros,
  });
}

index.sort((a, b) => a.code.localeCompare(b.code));
fs.writeFileSync(OUT, JSON.stringify({ version: skills.version, count: index.length, jobs: index }) + "\n");

const withMacros = index.filter((j) => Object.keys(j.macros).length > 0).length;
console.log(`métiers retenus  : ${index.length} / ${jobs.length}`);
console.log(`avec compétences : ${withMacros}`);
console.log(`niveau inconnu   : ${index.filter((j) => j.level === null).length}`);
console.log(`taille           : ${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko -> ${OUT}`);
