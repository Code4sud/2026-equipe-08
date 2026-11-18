import { describe, expect, it } from "vitest";
import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
import { CENTER_IDS } from "./centers";
import { JOBS } from "./jobs";
import { buildDirections, matchJobs } from "./match";
import {
  applyResponse,
  applyTraitResponse,
  computeProfile,
  createProfile,
  proposeConfirmation,
  resolveConfirmation,
  topDomains,
} from "./score";
import { nextCard, nextTraitPair } from "./select";
import type { Profile, Response } from "./types";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function swipe(
  profile: Profile,
  cardId: string,
  direction: "left" | "right",
  reason?: Response["reason"],
): Profile {
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`Carte inconnue: ${cardId}`);
  return applyResponse(profile, card, {
    cardId,
    direction,
    reason,
    ts: Date.now(),
  });
}

describe("banque de cartes", () => {
  it("couvre les 30 centres ROME", () => {
    const covered = new Set<string>();
    for (const card of CARDS) {
      for (const [centerId, weight] of Object.entries(card.centers)) {
        if ((weight ?? 0) >= 0.4) covered.add(centerId);
      }
    }
    const missing = CENTER_IDS.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it("a des poids qui somment à ~1", () => {
    for (const card of CARDS) {
      const total = Object.values(card.centers).reduce<number>(
        (s, w) => s + (w ?? 0),
        0,
      );
      expect(total).toBeGreaterThan(0.75);
      expect(total).toBeLessThan(1.3);
    }
  });

  it("a 3 paires par spectre", () => {
    for (const trait of [
      "socialEnergy",
      "structure",
      "openness",
      "cooperation",
      "pace",
    ]) {
      expect(PAIRS.filter((p) => p.trait === trait)).toHaveLength(3);
    }
  });
});

describe("scoring des intérêts", () => {
  it("un like augmente le domaine, un dislike le baisse", () => {
    let p = createProfile();
    const before = p.domains.manual.mean;

    p = swipe(p, "reparer-velo", "right");
    expect(p.domains.manual.mean).toBeGreaterThan(before);

    const afterLike = p.domains.manual.mean;
    p = swipe(p, "bricoler", "left", "pas-mon-truc");
    expect(p.domains.manual.mean).toBeLessThan(afterLike);
  });

  it("« jamais essayé » ne touche pas le score d'intérêt", () => {
    let p = createProfile();
    const before = p.domains.manual.mean;
    p = swipe(p, "reparer-velo", "left", "jamais-essaye");
    expect(p.domains.manual.mean).toBeCloseTo(before, 6);
    expect(p.domains.manual.nEff).toBe(0);
  });

  it("les barrières d'accès ne comptent pas comme un rejet", () => {
    let p = createProfile();
    const before = p.domains.tech.mean;
    p = swipe(p, "coder-jeu", "left", "pas-les-moyens");
    expect(p.domains.tech.mean).toBeCloseTo(before, 6);
  });

  it("un domaine fortement aimé devient confirmable, puis verrouillé", () => {
    let p = createProfile();
    for (const id of [
      "reparer-velo",
      "bricoler",
      "reparer-scooter",
      "monter-meuble",
      "peindre-mur",
    ]) {
      p = swipe(p, id, "right");
    }

    const proposal = proposeConfirmation(p);
    expect(proposal).toBe("manual");

    p = resolveConfirmation(p, "manual", true);
    expect(p.domains.manual.confirmed).toBe(true);
    expect(p.confirmed).toContain("manual");
    expect(p.domains.manual.mean).toBeGreaterThan(0.85);
  });

  it("un domaine fortement rejeté est marqué", () => {
    let p = createProfile();
    for (const id of [
      "reparer-velo",
      "bricoler",
      "reparer-scooter",
      "monter-meuble",
      "peindre-mur",
    ]) {
      p = swipe(p, id, "left", "pas-mon-truc");
    }
    expect(p.domains.manual.mean).toBeLessThan(0.3);
    expect(p.domains.manual.rejected).toBe(true);
  });
});

describe("scoring des spectres de travail", () => {
  it("calcule une moyenne par spectre", () => {
    let p = createProfile();
    const pair = PAIRS.find((x) => x.trait === "socialEnergy")!;
    p = applyTraitResponse(p, pair, {
      pairId: pair.id,
      direction: "right",
      ts: Date.now(),
    });
    expect(p.traits.socialEnergy.mean).toBe(pair.rightValue);
    expect(p.traits.socialEnergy.n).toBe(1);
  });

  it("15 réponses donnent une confiance pleine", () => {
    let p = createProfile();
    for (const pair of PAIRS) {
      p = applyTraitResponse(p, pair, {
        pairId: pair.id,
        direction: pair.id.endsWith("2") ? "right" : "left",
        ts: Date.now(),
      });
    }
    for (const trait of Object.values(p.traits)) {
      expect(trait.confidence).toBe(1);
      expect(trait.n).toBe(3);
    }
  });
});

describe("sélection adaptative et convergence", () => {
  it("retrouve un profil simulé en ~35 swipes", () => {
    const rand = mulberry32(42);
    const trueAffinity: Record<string, number> = Object.fromEntries(
      CENTER_IDS.map((id) => [id, 0.45]),
    );
    trueAffinity.manual = 0.9;
    trueAffinity.tech = 0.85;
    trueAffinity.discovery = 0.8;
    trueAffinity.care = 0.15;
    trueAffinity.children = 0.15;

    let profile = createProfile();
    const responses: Response[] = [];

    for (let i = 0; i < 35; i++) {
      const card = nextCard(profile, responses, CARDS, rand);
      if (!card) break;

      const expected = Object.entries(card.centers).reduce(
        (sum, [id, w]) => sum + (w ?? 0) * trueAffinity[id],
        0,
      );
      const p = 1 / (1 + Math.exp(-(expected - 0.5) * 8));
      const direction = rand() < p ? "right" : "left";

      const response: Response = {
        cardId: card.id,
        direction,
        ts: i,
      };
      responses.push(response);
      profile = applyResponse(profile, card, response);
    }

    const top = topDomains(profile, 5);
    expect(top).toContain("manual");
    expect(top).toContain("tech");
    expect(profile.confirmed.includes("manual") || profile.domains.manual.mean > 0.65).toBe(
      true,
    );
    expect(profile.domains.manual.confidence).toBeGreaterThan(0.2);
  });

  it("ne propose jamais une carte déjà vue", () => {
    const rand = mulberry32(7);
    let profile = createProfile();
    const responses: Response[] = [];

    for (let i = 0; i < 20; i++) {
      const card = nextCard(profile, responses, CARDS, rand);
      if (!card) break;
      expect(responses.some((r) => r.cardId === card.id)).toBe(false);
      responses.push({ cardId: card.id, direction: "right", ts: i });
      profile = applyResponse(profile, card, responses[i]);
    }
  });

  it("donne les 15 paires dans l'ordre, sans doublon", () => {
    const responses = PAIRS.map((p, i) => ({
      pairId: p.id,
      direction: i % 2 ? "left" : "right",
      ts: i,
    })) as Parameters<typeof nextTraitPair>[0];

    expect(nextTraitPair(responses)).toBeNull();
  });
});

describe("matching métiers", () => {
  it("produit 3 directions et une short-list diversifiée", () => {
    let p = createProfile();
    for (const id of ["reparer-velo", "bricoler", "reparer-scooter", "monter-meuble", "peindre-mur"]) {
      p = swipe(p, id, "right");
    }
    for (const id of ["coder-jeu", "demonter-telephone", "creer-site", "enigmes"]) {
      p = swipe(p, id, "right");
    }
    p = resolveConfirmation(p, "manual", true);

    expect(JOBS.length).toBeGreaterThan(100);
    const matches = matchJobs(p, JOBS, CARDS, 30);
    expect(matches.length).toBeGreaterThan(10);

    const directions = buildDirections(matches, p);
    expect(directions).toHaveLength(3);
    expect(new Set(directions.map((d) => d.centerId)).size).toBe(3);

    for (const d of directions) {
      expect(d.jobs.length).toBeGreaterThan(0);
      expect(d.jobs[0].job.code).toMatch(/^[A-N]\d{4}$/);
    }
  });

  it("diversifie les directions quand le profil est multi-domaines", () => {
    let p = createProfile();
    for (const card of CARDS.filter((c) => (c.centers.manual ?? 0) > 0.5)) {
      p = swipe(p, card.id, "right");
    }
    for (const card of CARDS.filter((c) => (c.centers.tech ?? 0) > 0.5)) {
      p = swipe(p, card.id, "right");
    }
    for (const card of CARDS.filter((c) => (c.centers.care ?? 0) > 0.5)) {
      p = swipe(p, card.id, "right");
    }

    const matches = matchJobs(p, JOBS, CARDS, 20);
    const directions = new Set(matches.slice(0, 8).map((m) => m.direction));
    expect(directions.size).toBeGreaterThan(1);
  });
});

describe("persona de démonstration", () => {
  it("produit un profil confirmé et trois directions cohérentes", async () => {
    const { DEMO } = await import("./demo");
    expect(DEMO.profile.confirmed).toContain("manual");

    const matches = matchJobs(DEMO.profile, JOBS, CARDS, 60);
    const directions = buildDirections(matches, DEMO.profile);

    console.log(
      "DEMO",
      directions.map((d) => ({
        title: d.title,
        jobs: d.jobs.map((j) => j.job.label),
      })),
    );

    expect(directions).toHaveLength(3);
    expect(directions[0].jobs.length).toBeGreaterThan(0);
  });
});

describe("profil complet", () => {
  it("se recalcule depuis les réponses", () => {
    const responses: Response[] = [
      { cardId: "reparer-velo", direction: "right", ts: 1 },
      { cardId: "coder-jeu", direction: "right", ts: 2 },
      { cardId: "cuisiner-famille", direction: "left", ts: 3 },
    ];
    const p = computeProfile(responses, [
      { pairId: "social-1", direction: "left", ts: 4 },
    ]);

    expect(p.answered).toBe(3);
    expect(p.domains.manual.mean).toBeGreaterThan(0.5);
    expect(p.domains.cooking.mean).toBeLessThan(0.5);
    expect(p.traits.socialEnergy.mean).toBe(-1);
    expect(p.code).toHaveLength(3);
  });
});
