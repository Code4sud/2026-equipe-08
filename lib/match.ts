import { CARDS } from "../content/cards";
import { CENTER_BY_ID, CENTER_IDS } from "./centers";
import { JOBS } from "./jobs";
import { contextFit, frictionFor } from "./traits";
import type {
  Card,
  CenterId,
  Direction,
  Job,
  JobMatch,
  Profile,
} from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function cosine(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, va] of Object.entries(a)) {
    const vb = b[k] ?? 0;
    dot += va * vb;
    na += va * va;
  }
  for (const vb of Object.values(b)) nb += vb * vb;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Vecteur utilisateur pour le matching :
 * - confirmé = 1
 * - rejeté = 0
 * - sinon, seulement la partie au-dessus du neutre
 */
function userVector(profile: Profile): Record<CenterId, number> {
  const out: Record<CenterId, number> = {};
  for (const id of CENTER_IDS) {
    const d = profile.domains[id];
    out[id] = d.rejected ? 0 : d.confirmed ? 1 : Math.max(0, d.mean - 0.45);
  }
  return out;
}

function interestFit(profile: Profile, job: Job): number {
  const u = userVector(profile);
  const cos = cosine(u, job.centers);

  let penaltyNum = 0;
  let penaltyDen = 0;
  for (const [id, weight] of Object.entries(job.centers) as [
    CenterId,
    number,
  ][]) {
    const d = profile.domains[id];
    if (d && !d.confirmed && d.mean < 0.38) {
      penaltyNum += (0.38 - d.mean) * weight;
    }
    penaltyDen += weight;
  }
  const penalty = penaltyDen > 0 ? penaltyNum / penaltyDen : 0;

  return clamp01(cos - 0.45 * penalty);
}

/**
 * Direction = domaine principal DU MÉTIER, pas le domaine préféré du jeune.
 * Sinon un métier tech qui a aussi une petite composante manuelle serait
 * classé "manuel" dès que le jeune a confirmé le manuel.
 */
export function dominantJobCenter(job: Job): CenterId {
  const entries = Object.entries(job.centers) as [CenterId, number][];
  entries.sort(
    (a, b) =>
      b[1] - a[1] ||
      CENTER_IDS.indexOf(a[0]) - CENTER_IDS.indexOf(b[0]),
  );
  return entries[0]?.[0] ?? "manual";
}

function evidenceFor(
  profile: Profile,
  centerId: CenterId,
  cards: Card[],
): string[] {
  const liked = profile.domains[centerId]?.likedCards ?? [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fromCenter = liked
    .map((id) => byId.get(id)?.text)
    .filter((x): x is string => Boolean(x));

  if (fromCenter.length > 0) return fromCenter.slice(0, 3);

  // Repli : les cartes likées qui chargent le plus sur ce centre.
  return cards
    .filter((c) => (c.centers[centerId] ?? 0) >= 0.5)
    .filter((c) => liked.includes(c.id))
    .map((c) => c.text)
    .slice(0, 3);
}

export function matchJobs(
  profile: Profile,
  jobs: Job[] = JOBS,
  cards: Card[] = CARDS,
  limit = 48,
): JobMatch[] {
  const candidates: JobMatch[] = [];

  for (const job of jobs) {
    if (Object.keys(job.centers).length === 0) continue;

    const interest = interestFit(profile, job);
    const context = contextFit(profile, job);
    const score = clamp01(0.68 * interest + 0.32 * context);
    const direction = dominantJobCenter(job);

    candidates.push({
      job,
      score,
      interest,
      context,
      direction,
      evidence: evidenceFor(profile, direction, cards),
      friction: frictionFor(profile, job),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // MMR : on garde de la diversité dans la short-list.
  const selected: JobMatch[] = [];
  while (selected.length < limit && candidates.length > 0) {
    let bestIndex = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(
              ...selected.map((s) =>
                cosine(candidate.job.centers, s.job.centers),
              ),
            );
      const mmr = 0.78 * candidate.score - 0.22 * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIndex = i;
      }
    }

    selected.push(candidates.splice(bestIndex, 1)[0]);
  }

  return selected;
}

/**
 * Les directions suivent les domaines les plus forts de la personne,
 * pas les métiers qui ont le meilleur score isolé. Sinon un domaine
 * secondaire avec deux métiers peut voler la place d'un domaine confirmé.
 *
 * Pour chaque domaine (confirmé d'abord, puis moyenne décroissante),
 * on prend les meilleurs métiers qui ont un lien fort avec ce domaine.
 * Un métier n'apparaît que dans une seule direction.
 */
export function buildDirections(
  matches: JobMatch[],
  profile: Profile,
): Direction[] {
  const ranked = CENTER_IDS.filter(
    (id) => !profile.domains[id].rejected,
  ).sort((a, b) => {
    const da = profile.domains[a];
    const db = profile.domains[b];
    if (da.confirmed !== db.confirmed) return da.confirmed ? -1 : 1;
    return db.mean - da.mean;
  });

  const used = new Set<string>();
  const directions: Direction[] = [];

  for (const centerId of ranked) {
    if (directions.length >= 3) break;

    const domain = profile.domains[centerId];
    const jobs = matches
      .filter(
        (m) =>
          !used.has(m.job.code) &&
          (m.job.centers[centerId] ?? 0) >= 0.5,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (jobs.length === 0) continue;

    for (const job of jobs) used.add(job.job.code);

    const avg = jobs.reduce((sum, j) => sum + j.score, 0) / jobs.length;
    const strength = domain.confirmed ? 1 : domain.mean;
    const meta = CENTER_BY_ID[centerId];

    directions.push({
      centerId,
      title: meta?.short ?? centerId,
      subtitle: meta?.label ?? "",
      score: 0.6 * strength + 0.4 * avg,
      jobs,
    });
  }

  // Filet de sécurité : si un domaine n'a aucun métier dans le pool,
  // on complète avec les meilleurs métiers restants.
  if (directions.length < 3) {
    for (const match of matches) {
      if (directions.length >= 3) break;
      if (used.has(match.job.code)) continue;
      if (directions.some((d) => d.centerId === match.direction)) continue;

      const meta = CENTER_BY_ID[match.direction];
      directions.push({
        centerId: match.direction,
        title: meta?.short ?? match.direction,
        subtitle: meta?.label ?? "",
        score: match.score,
        jobs: [match],
      });
    }
  }

  return directions;
}

export function topConfirmed(profile: Profile, n = 3): CenterId[] {
  return CENTER_IDS.filter((id) => profile.domains[id].confirmed).slice(0, n);
}

export function profileHeadline(profile: Profile): string {
  const strong = CENTER_IDS.filter((id) => {
    const d = profile.domains[id];
    return d.confirmed || d.mean >= 0.62;
  })
    .sort((a, b) => {
      const da = profile.domains[a];
      const db = profile.domains[b];
      if (da.confirmed !== db.confirmed) return da.confirmed ? -1 : 1;
      return db.mean - da.mean;
    })
    .slice(0, 3)
    .map((id) => CENTER_BY_ID[id]?.short ?? id);

  return strong.join(" · ");
}
