/**
 * ROME 4.0 (v62, octobre 2026) -> données compactes pour Déclic.
 *
 * Source : dump public France Travail, encodé ISO-8859-1.
 *   https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json
 *
 * Usage :
 *   node scripts/import-rome.mjs
 *
 * Produit :
 *   data/rome/centers.json        30 centres d'intérêt + métiers liés
 *   data/rome/jobs.json           1 923 métiers compacts (matching complet)
 *   data/rome/jobs-featured.json  ~150 métiers accessibles, couvrant les 30 centres
 *   data/rome/meta.json           version + compteurs
 */

import fs from "node:fs";
import path from "node:path";

const RAW_DIR = "data/rome/unzipped";
const OUT_DIR = "data/rome";

const readLatin1 = (name) =>
  JSON.parse(fs.readFileSync(path.join(RAW_DIR, name)).toString("latin1"));

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[’]/g, "'")
    .trim()
    .toLowerCase();

const centersMeta = JSON.parse(fs.readFileSync("content/centers.json", "utf8"));
const metaByLabel = new Map(centersMeta.map((c) => [norm(c.label), c]));

// ---------------------------------------------------------------------------
// 1. Les 30 centres d'intérêt ROME -> métiers
// ---------------------------------------------------------------------------

const arbo = readLatin1("unix_arborescence_centre_interet_v462.json")
  .arbo_centre_interet;

/** @type {Map<string, {id: string, weight: number}[]>} */
const jobCenters = new Map();
const centersOut = [];

for (const c of arbo) {
  const meta = metaByLabel.get(norm(c.libelle_centre_interet));
  if (!meta) {
    throw new Error(`Centre ROME inconnu dans content/centers.json : ${c.libelle_centre_interet}`);
  }

  const linked = [];
  for (const m of c.liste_metier ?? []) {
    const weight = m.principal ? 1 : 0.5;
    linked.push({ code: m.code_rome, weight });

    const list = jobCenters.get(m.code_rome) ?? [];
    if (!list.some((x) => x.id === meta.id)) {
      list.push({ id: meta.id, weight });
    }
    jobCenters.set(m.code_rome, list);
  }

  centersOut.push({
    id: meta.id,
    label: meta.label,
    short: meta.short,
    riasec: meta.riasec,
    definition: c.definition_centre_interet,
    jobCount: linked.length,
  });
}

// ---------------------------------------------------------------------------
// 2. Les fiches métier -> jobs compacts
// ---------------------------------------------------------------------------

const fiches = readLatin1("unix_fiche_emploi_metier_v462.json");

const ACCESS_LEVELS = [
  [/sans diplome|aucun diplome|non diplome|sans qualification|accessible sans|pas de diplome/i, 0],
  [/bac ?\+ ?5|niveau bac ?\+ ?5|master|ingenieur|doctorat/i, 5],
  [/bac ?\+ ?4|niveau bac ?\+ ?4/i, 5],
  [/bac ?\+ ?3|niveau bac ?\+ ?3|licence|bachelor/i, 4],
  [/bac ?\+ ?2|niveau bac ?\+ ?2|bts|dut|deust/i, 3],
  [/niveau bac(?! ?\+)/i, 2],
  [/bac pro|baccalaureat professionnel|bac general|bac techno/i, 2],
  [/niveau cap|niveau bep/i, 1],
  [/\bcap\b|\bbep\b|titre professionnel|mention complementaire/i, 1],
];

const stripAccents = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function inferLevel(accessText) {
  if (!accessText) return null;
  const text = stripAccents(accessText);
  for (const [re, level] of ACCESS_LEVELS) {
    if (re.test(text)) return level;
  }
  return null;
}

// Parcours trop longs, réglementés ou hors cible pour la démo 17–25.
const EXCLUDED = /militaire|chasse|yacht|skipper|scaphandrier|demineur|capitaine|administrateur de l'etat|architecte du patrimoine|medecin|pharmacien|avocat|notaire|expert-comptable|commissaire|lieutenant|officier|forces armees|armee|paneliste/i;

function flattenCompetences(group, kind) {
  if (!group) return [];
  if (kind === "savoir_faire" && Array.isArray(group.enjeux)) {
    return group.enjeux.flatMap((e) =>
      (e.items ?? []).map((i) => ({
        code: String(i.code_ogr),
        label: i.libelle,
        principal: i.coeur_metier === "Principale",
        group: e.libelle,
      })),
    );
  }
  if (Array.isArray(group.enjeux)) {
    return group.enjeux.flatMap((e) =>
      (e.items ?? []).map((i) => ({
        code: String(i.code_ogr),
        label: i.libelle,
        principal: i.coeur_metier === "Principale",
        group: e.libelle,
      })),
    );
  }
  return [];
}

function flattenContexts(contexts) {
  const out = [];
  for (const group of contexts ?? []) {
    for (const item of group.items ?? []) {
      if (!out.includes(item.libelle)) out.push(item.libelle);
    }
  }
  return out;
}

function projectRiasec(centers) {
  const sum = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  let total = 0;
  for (const c of centers) {
    const meta = centersMeta.find((x) => x.id === c.id);
    if (!meta) continue;
    for (const [k, v] of Object.entries(meta.riasec)) {
      sum[k] += v * c.weight;
    }
    total += c.weight;
  }
  if (total === 0) return sum;
  for (const k of Object.keys(sum)) sum[k] = +(sum[k] / total).toFixed(3);
  return sum;
}

const jobs = [];

for (const f of fiches) {
  const code = f.rome.code_rome;
  const centers = jobCenters.get(code) ?? [];

  const savoirFaire = flattenCompetences(f.competences?.savoir_faire, "savoir_faire")
    // coeur de métier d'abord, puis ordre ROME
    .sort((a, b) => Number(b.principal) - Number(a.principal));

  const savoirEtre = flattenCompetences(
    f.competences?.savoir_etre_professionnel,
    "savoir_etre",
  );

  const savoirs = [];
  for (const cat of f.competences?.savoirs?.categories ?? []) {
    for (const item of cat.items ?? []) {
      savoirs.push({
        code: String(item.code_ogr),
        label: item.libelle,
        principal: item.coeur_metier === "Principale",
        group: cat.libelle,
      });
    }
  }

  const access = (f.acces_metier ?? "").trim();
  const contexts = flattenContexts(f.contextes_travail);

  jobs.push({
    code,
    label: f.rome.intitule,
    definition: (f.definition ?? "").trim(),
    access,
    level: inferLevel(access),
    centers: Object.fromEntries(centers.map((c) => [c.id, c.weight])),
    riasec: projectRiasec(centers),
    contexts,
    competences: {
      savoirFaire: savoirFaire.slice(0, 6).map(({ code, label, principal }) => ({
        code,
        label,
        principal,
      })),
      savoirEtre: savoirEtre.slice(0, 4).map(({ code, label }) => ({ code, label })),
      savoirs: savoirs
        .sort((a, b) => Number(b.principal) - Number(a.principal))
        .slice(0, 3)
        .map(({ code, label }) => ({ code, label })),
    },
    mobilities: (f.mobilites ?? [])
      .slice(0, 3)
      .map((m) => m.rome_cible)
      .filter(Boolean),
  });
}

// ---------------------------------------------------------------------------
// 3. Sous-ensemble "accessible" pour la démo
//    Couvre les 30 centres, exclus les métiers qui exigent Bac+3 et plus.
// ---------------------------------------------------------------------------

const eligible = jobs.filter((j) => {
  if (Object.keys(j.centers).length === 0) return false;
  if (j.definition.length === 0) return false;
  if (j.level === null || j.level > 3) return false;
  if (EXCLUDED.test(stripAccents(`${j.label} ${j.access}`))) return false;
  if (/ingenieur|ingenierie/i.test(stripAccents(j.label))) return false;
  return true;
});

const byCenter = new Map();
for (const j of eligible) {
  for (const [centerId, weight] of Object.entries(j.centers)) {
    // On préfère les métiers dont c'est le centre principal, et les métiers
    // spécifiques (peu de centres) plutôt que les couteaux-suisses.
    const specificity = 2 - Math.min(2, Object.keys(j.centers).length) * 0.15;
    const centrality = weight * specificity;
    const list = byCenter.get(centerId) ?? [];
    list.push({ job: j, centrality });
    byCenter.set(centerId, list);
  }
}

const featuredMap = new Map();
for (const list of byCenter.values()) {
  list.sort(
    (a, b) =>
      b.centrality - a.centrality ||
      a.job.label.localeCompare(b.job.label, "fr"),
  );
  for (const { job } of list.slice(0, 8)) featuredMap.set(job.code, job);
}

const featured = [...featuredMap.values()].sort((a, b) =>
  a.label.localeCompare(b.label, "fr"),
);

// ---------------------------------------------------------------------------
// 4. Écriture
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name, data) =>
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data), "utf8");

write("centers.json", centersOut);
write("jobs.json", jobs);
write("jobs-featured.json", featured);
write("meta.json", {
  romeVersion: "62",
  romeLabel: "ROME 4.0 v62 — 26M10",
  source: "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json",
  license: "Licence Ouverte / Open Licence 2.0",
  generatedAt: new Date().toISOString(),
  counts: {
    centers: centersOut.length,
    jobs: jobs.length,
    jobsWithCenters: jobs.filter((j) => Object.keys(j.centers).length > 0).length,
    featured: featured.length,
  },
});

console.log("ROME importé.");
console.log(`  centres           : ${centersOut.length}`);
console.log(`  métiers           : ${jobs.length}`);
console.log(`  avec centres      : ${jobs.filter((j) => Object.keys(j.centers).length > 0).length}`);
console.log(`  accessibles démo  : ${featured.length}`);
console.log(`  fichiers          : ${OUT_DIR}/centers.json, jobs.json, jobs-featured.json, meta.json`);
