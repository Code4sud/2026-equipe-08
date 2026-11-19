/**
 * ROME 4.0 (v62) -> data/rome/skills.json
 *
 * Le référentiel des macro-compétences, compacté pour le swipe adaptatif
 * (et plus tard pour l'extraction du quiz).
 *
 * Usage :
 *   node scripts/build-skills.mjs
 *
 * Entrées :
 *   data/rome/unzipped/*.json       dump brut ROME (ISO-8859-1)
 *   data/rome/jobs-featured.json    ~213 métiers accessibles (centres déjà calculés)
 *
 * Sortie : data/rome/skills.json
 *   - macros     : 506 macro-compétences, avec domaine / enjeu / objectif,
 *                  sous-catégorie, compétences fines, et un vecteur de centres
 *                  d'intérêt dérivé des fiches métier officielles.
 *   - byCenter   : pour chaque centre, les macros les plus caractéristiques,
 *                  triées. C'est le vivier de cibles du mode "explorer".
 *
 * Le vecteur de centres d'une macro n'est PAS deviné par un LLM : c'est la
 * moyenne pondérée des centres des métiers accessibles dont la fiche ROME
 * contient cette macro (principale = 1, sinon 0,5).
 */

import fs from "node:fs";
import path from "node:path";

const RAW_DIR = "data/rome/unzipped";
const OUT = "data/rome/skills.json";

const readLatin1 = (name) =>
  JSON.parse(fs.readFileSync(path.join(RAW_DIR, name)).toString("latin1"));

const clean = (s) => (s ?? "").replace(/\s+/g, " ").replace(/[’]/g, "'").trim();

// ---------------------------------------------------------------------------
// 1. Référentiel : compétences fines + macros
// ---------------------------------------------------------------------------

const referentiel = readLatin1("unix_referentiel_competence_v462.json")
  .item_referentiel_competence;

/** code_ogr -> item brut */
const byCode = new Map(referentiel.map((i) => [i.code_ogr, i]));

// Attention : `libelle_nature` est doublement encodé dans le dump
// ("CompÃ©tence"). On compare sur "Macro", jamais sur le libellé exact.
const isMacro = (item) => /macro/i.test(item.libelle_nature ?? "");

const macros = new Map();
for (const item of referentiel) {
  if (!isMacro(item)) continue;
  macros.set(item.code_ogr, {
    code: item.code_ogr,
    label: clean(item.libelle),
    kind: /savoir-faire/i.test(item.libelle_categorie) ? "sf" : "se",
    sub: clean(item.libelle_sous_categorie),
    domain: "",
    enjeu: "",
    objectif: "",
    children: [],
    jobCount: 0,
    centers: {},
  });
}

const macroOf = (code) => {
  const item = byCode.get(code);
  if (!item) return null;
  if (isMacro(item)) return item.code_ogr;
  return item.code_ogr_macro_comp ?? null;
};

for (const item of referentiel) {
  if (isMacro(item) || !item.code_ogr_macro_comp) continue;
  const macro = macros.get(item.code_ogr_macro_comp);
  if (!macro) continue;
  macro.children.push({
    code: item.code_ogr,
    label: clean(item.libelle),
    expert: /expert/i.test(item.libelle_sous_categorie ?? ""),
  });
}

// ---------------------------------------------------------------------------
// 2. Arborescence : domaine -> enjeu -> objectif -> macro
// ---------------------------------------------------------------------------

const arbo = readLatin1("unix_arborescence_competence_v462.json")
  .arborescence_competence;

function walk(node, ctx) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, ctx);
    return;
  }
  if (!node || typeof node !== "object") return;

  const next = { ...ctx };
  if (node.libelle_domaine_competence) next.domain = clean(node.libelle_domaine_competence);
  if (node.libelle_enjeu) next.enjeu = clean(node.libelle_enjeu);
  if (node.libelle_objectif) next.objectif = clean(node.libelle_objectif);

  if (node.code_ogr_macro_competence) {
    const macro = macros.get(node.code_ogr_macro_competence);
    if (macro) {
      macro.domain = next.domain ?? "";
      macro.enjeu = next.enjeu ?? "";
      macro.objectif = next.objectif ?? "";
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") walk(value, next);
  }
}
walk(arbo, {});

// ---------------------------------------------------------------------------
// 3. Fiches métier accessibles -> vecteur de centres par macro
// ---------------------------------------------------------------------------

const featured = JSON.parse(fs.readFileSync("data/rome/jobs-featured.json", "utf8"));
const featuredByCode = new Map(featured.map((j) => [j.code, j]));

const fiches = readLatin1("unix_fiche_emploi_metier_v462.json");

/** macro -> codes des compétences fines effectivement citées dans une fiche accessible */
const usedChildren = new Map();

for (const fiche of fiches) {
  const romeCode = typeof fiche.rome === "object" ? fiche.rome.code_rome : fiche.rome;
  const job = featuredByCode.get(romeCode);
  if (!job) continue;

  /** macro -> poids max dans cette fiche */
  const inJob = new Map();
  for (const block of Object.values(fiche.competences ?? {})) {
    for (const enjeu of block?.enjeux ?? []) {
      for (const it of enjeu.items ?? []) {
        const m = macroOf(it.code_ogr);
        if (!m || !macros.has(m)) continue;
        const w = it.coeur_metier ? 1 : 0.5;
        inJob.set(m, Math.max(inJob.get(m) ?? 0, w));
        if (it.code_ogr !== m) {
          const set = usedChildren.get(m) ?? new Set();
          set.add(it.code_ogr);
          usedChildren.set(m, set);
        }
      }
    }
  }

  for (const [m, w] of inJob) {
    const macro = macros.get(m);
    macro.jobCount += 1;
    for (const [centerId, cw] of Object.entries(job.centers ?? {})) {
      macro.centers[centerId] = (macro.centers[centerId] ?? 0) + w * cw;
    }
  }
}

// Masse totale de chaque centre sur les métiers accessibles (référence).
const centerMass = {};
for (const job of featured) {
  for (const [id, w] of Object.entries(job.centers ?? {})) {
    centerMass[id] = (centerMass[id] ?? 0) + w;
  }
}
const jobTotal = featured.length;

for (const macro of macros.values()) {
  // P(macro | centre), lissé : part des métiers du centre qui contiennent la
  // macro. Sert à classer le vivier de chaque centre. Le lissage (+3) évite
  // que les petits centres (2-3 métiers) écrasent tout.
  const pGivenCenter = {};
  for (const [id, v] of Object.entries(macro.centers)) {
    if (centerMass[id]) pGivenCenter[id] = v / (centerMass[id] + 3);
  }
  macro.pGivenCenter = pGivenCenter;
  macro.prevalence = macro.jobCount / jobTotal;

  // `centers` : part brute de chaque centre dans les métiers qui contiennent
  // la macro (top 3, part >= 15 %, somme = 1). Même format que les cartes.
  const total = Object.values(macro.centers).reduce((x, y) => x + y, 0);
  if (total === 0) {
    macro.centers = {};
  } else {
    const top = Object.entries(macro.centers)
      .map(([id, v]) => [id, v / total])
      .sort((x, y) => y[1] - x[1])
      .filter(([, share], i) => i === 0 || share >= 0.15)
      .slice(0, 3);
    const sum = top.reduce((x, [, v]) => x + v, 0);
    macro.centers = Object.fromEntries(
      top.map(([id, v]) => [id, Math.round((v / sum) * 100) / 100]),
    );
  }

  // Compétences fines : on garde celles citées dans une fiche accessible, hors "expert".
  const used = usedChildren.get(macro.code) ?? new Set();
  macro.children = macro.children
    .filter((c) => !c.expert)
    .sort((a, b) => Number(used.has(b.code)) - Number(used.has(a.code)))
    .slice(0, 8)
    .map(({ code, label }) => ({ code, label }));
}

// ---------------------------------------------------------------------------
// 4. Vivier de cibles par centre (mode "explorer")
// ---------------------------------------------------------------------------

// Une cible de swipe doit être : un savoir-faire (les savoir-être sont gardés
// pour le quiz), pas "Technique expert", présente dans au moins 2 métiers
// accessibles, et pas omniprésente (> 30 % des métiers = ne discrimine rien :
// "Respecter des règles", "Utiliser les outils numériques"...).
const MAX_PREVALENCE = 0.3;
// Cibles exclues du swipe : actes cliniques et thèmes qui pousseraient le
// générateur vers la santé ou la vie privée du jeune.
const SENSITIVE_TARGET = /psycholog|chirurg|sanitaire|th[ée]rap|m[ée]dic|patient|soins? infirm|prescri|fun[ée]raire|d[ée]funt|religi|culte|sinistre/i;
const swipeable = (m) =>
  m.kind === "sf" &&
  !SENSITIVE_TARGET.test(m.label) &&
  !/expert/i.test(m.sub) &&
  m.jobCount >= 2 &&
  m.prevalence <= MAX_PREVALENCE &&
  Object.keys(m.centers).length > 0;

const centers = JSON.parse(fs.readFileSync("data/rome/centers.json", "utf8"));
const byCenter = {};
for (const center of centers) {
  byCenter[center.id] = [...macros.values()]
    .filter(swipeable)
    .filter((m) => (m.pGivenCenter[center.id] ?? 0) > 0)
    .map((m) => {
      const p = m.pGivenCenter[center.id];
      // P(m|c) × lift : fréquente dans le centre ET caractéristique du centre.
      return { code: m.code, score: (p * p) / Math.max(m.prevalence, 1e-3) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map((x) => x.code);
}

for (const macro of macros.values()) {
  delete macro.pGivenCenter;
  macro.prevalence = Math.round(macro.prevalence * 1000) / 1000;
}

const out = {
  version: "ROME 4.0 v62",
  generatedAt: new Date().toISOString().slice(0, 10),
  counts: {
    macros: macros.size,
    swipeable: [...macros.values()].filter(swipeable).length,
  },
  macros: Object.fromEntries([...macros.values()].map((m) => [m.code, m])),
  byCenter,
};

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  `skills.json : ${out.counts.macros} macros, ${out.counts.swipeable} ciblables en swipe, ` +
    `${Object.values(byCenter).filter((l) => l.length === 0).length} centres sans cible.`,
);
