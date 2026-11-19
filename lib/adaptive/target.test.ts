import { describe, expect, it } from "vitest";
import { CARDS } from "../../content/cards";
import { applyResponse, computeProfile, createProfile } from "../score";
import type { Card, Response } from "../types";
import { getMacro, isSwipeTarget, poolFor } from "./skills";
import { buildCard, cardCenters, coverage, pickTarget, statusOf } from "./target";
import { pregenCard, pregenCount } from "./pregen";
import { buildCardPrompt, matchesMode, templateDraft } from "./writer";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = (cardId: string, direction: "left" | "right", reason?: Response["reason"]): Response => ({
  cardId,
  direction,
  reason,
  ts: 0,
});

/** Joue n tours : à chaque tour, génère la carte visée (texte template) et y répond. */
function play(n: number, answer: (card: Card) => Response, seed = 1) {
  const rand = mulberry32(seed);
  const generated: Card[] = [];
  const responses: Response[] = [];
  for (let i = 0; i < n; i++) {
    const cards = [...CARDS, ...generated];
    const profile = computeProfile(responses, [], cards);
    const plan = pickTarget({ profile, responses, cards, rand });
    if (!plan) break;
    const macro = plan.candidates[0];
    const card = buildCard(plan, macro, templateDraft(plan, macro), "template");
    generated.push(card);
    responses.push(answer(card));
  }
  return { generated, responses };
}

describe("référentiel ROME compacté", () => {
  it("chaque centre a un vivier de cibles", () => {
    for (const center of new Set(CARDS.flatMap((c) => Object.keys(c.centers)))) {
      expect(poolFor(center).length, center).toBeGreaterThan(0);
    }
  });

  it("aucune cible de swipe n'est un savoir-être, une compétence expert ou un acte clinique", () => {
    for (const center of ["care", "children", "manual", "contact"]) {
      for (const m of poolFor(center)) {
        expect(m.kind).toBe("sf");
        expect(m.sub).not.toMatch(/expert/i);
        expect(m.label).not.toMatch(/psycholog|th[ée]rap|m[ée]dic|patient/i);
      }
    }
  });
});

describe("couverture", () => {
  it("distingue vécu, attirance, inconnu et rejet", () => {
    expect(statusOf(r("x", "right", "deja-souvent"))).toBe("vecu");
    expect(statusOf(r("x", "right"))).toBe("attire");
    expect(statusOf(r("x", "left", "jamais-essaye"))).toBe("inconnu");
    expect(statusOf(r("x", "left", "pas-les-moyens"))).toBe("inconnu");
    expect(statusOf(r("x", "left", "pas-mon-truc"))).toBe("rejete");
    expect(statusOf(r("x", "left"))).toBe("rejete");
  });

  it("une carte 'déjà fait' de la banque part dans la file à creuser", () => {
    const cov = coverage([r("caisse-asso", "right", "deja-souvent")], CARDS);
    expect(cov.aCreuser.map((c) => c.id)).toEqual(["caisse-asso"]);
  });
});

describe("choix de la cible", () => {
  it("mode explorer : ne vise jamais deux fois la même compétence", () => {
    const { generated } = play(25, (card) => r(card.id, "left", "pas-mon-truc"));
    const macros = generated.map((c) => c.target!.macro);
    expect(new Set(macros).size).toBe(macros.length);
    expect(generated.every((c) => c.target!.mode === "explorer")).toBe(true);
  });

  it("mode explorer : varie les centres sondés", () => {
    const { generated } = play(12, (card) => r(card.id, "right"));
    const centers = new Set(generated.map((c) => c.target!.center));
    expect(centers.size).toBeGreaterThanOrEqual(6);
  });

  it("'déjà fait' sur une carte de la banque déclenche un creuser avec une short-list", () => {
    const responses = [r("caisse-asso", "right", "deja-souvent")];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(2) })!;
    expect(plan.mode).toBe("creuser");
    expect(plan.parent?.id).toBe("caisse-asso");
    expect(plan.candidates.length).toBeGreaterThan(1);
    expect(plan.candidates.length).toBeLessThanOrEqual(8);
  });

  it("relie une carte de la banque à la compétence ROME par les mots", () => {
    const responses = [r("caisse-asso", "right", "deja-souvent")];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(2) })!;
    expect(plan.candidates[0].label).toBe("Gérer une caisse");
    expect(plan.loose).toBe(false);
  });

  it("sans LLM, ne creuse pas une carte qu'aucun mot ne relie à ROME", () => {
    const responses = [r("enigmes", "right", "deja-souvent")];
    const profile = computeProfile(responses, [], CARDS);
    const withLlm = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(2) })!;
    expect(withLlm.mode).toBe("creuser");
    expect(withLlm.loose).toBe(true);
    const without = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(2), allowLoose: false })!;
    expect(without.mode).toBe("explorer");
  });

  it("'déjà fait' sur une carte générée creuse la même compétence, une seule fois", () => {
    const { generated } = play(4, (card) => r(card.id, "right", "deja-souvent"));
    const [first, second] = generated;
    expect(first.target!.mode).toBe("explorer");
    expect(second.target!.mode).toBe("creuser");
    expect(second.target!.parentId).toBe(first.id);
    expect(second.target!.macro).toBe(first.target!.macro);
    // On ne creuse pas une carte "creuser" : la suivante repart en exploration
    // ou creuse une autre carte, jamais la même parente deux fois.
    const parents = generated.map((c) => c.target!.parentId).filter(Boolean);
    expect(new Set(parents).size).toBe(parents.length);
  });

  it("plafonne le nombre de cartes creuser", () => {
    const { generated } = play(30, (card) => r(card.id, "right", "deja-souvent"));
    expect(generated.filter((c) => c.target!.mode === "creuser").length).toBeLessThanOrEqual(6);
  });
});

describe("construction de la carte", () => {
  it("les poids de centres viennent de ROME, pas du LLM, et somment à ~1", () => {
    const responses: Response[] = [];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(3) })!;
    const macro = plan.candidates[0];
    const centers = cardCenters(plan, macro);
    const sum = Object.values(centers).reduce<number>((a, b) => a + (b ?? 0), 0);
    expect(sum).toBeGreaterThan(0.97);
    expect(sum).toBeLessThan(1.03);
    expect(centers[plan.center]).toBeGreaterThanOrEqual(0.5);
    expect(isSwipeTarget(macro.code)).toBe(true);
  });

  it("garde la trace de la compétence visée", () => {
    const macro = getMacro(118069)!; // Gérer une caisse
    const parent = CARDS.find((c) => c.id === "caisse-asso")!;
    const card = buildCard(
      { mode: "creuser", center: "numbers", candidates: [macro], parent },
      macro,
      { text: "C'est toi qui comptais la caisse à la fin ?" },
      "generated",
    );
    expect(card.target).toMatchObject({ mode: "creuser", macro: 118069, label: "Gérer une caisse", parentId: "caisse-asso" });
  });
});

describe("intérêt et vécu ne se mélangent pas", () => {
  const macro = getMacro(118069)!; // Gérer une caisse
  const parent = CARDS.find((c) => c.id === "caisse-asso")!;
  const creuser = buildCard(
    { mode: "creuser", center: "numbers", candidates: [macro], parent },
    macro,
    { text: "Et c'est toi qui comptais la caisse à la fin ?" },
    "generated",
  );

  it("un 'non' sur une carte creuser ne fait pas baisser l'intérêt", () => {
    const before = createProfile();
    const after = applyResponse(before, creuser, r(creuser.id, "left"));
    for (const id of Object.keys(creuser.centers)) {
      expect(after.domains[id].mean).toBe(before.domains[id].mean);
      expect(after.domains[id].nEff).toBe(0);
    }
  });

  it("carte creuser : oui = vécu, non = pas vécu (et ne dégrade pas la carte parente)", () => {
    expect(statusOf(r(creuser.id, "right"), creuser)).toBe("vecu");
    expect(statusOf(r(creuser.id, "left"), creuser)).toBe("inconnu");

    const { generated, responses } = play(2, (card) =>
      card.target!.mode === "creuser" ? r(card.id, "left") : r(card.id, "right", "deja-une-fois"),
    );
    const cov = coverage(responses, [...CARDS, ...generated]);
    expect(cov.macros.get(generated[0].target!.macro)).toBe("vecu");
  });

  it("une carte explorer est une activité, pas une question de vécu", () => {
    const explorer = { mode: "explorer" as const };
    expect(matchesMode(explorer, { text: "Fixer les prix pour une vente de gâteaux" })).toBe(true);
    expect(matchesMode(explorer, { text: "T'as déjà compté la caisse ?" })).toBe(false);
    expect(matchesMode(explorer, { text: "Avoir déjà géré un stock" })).toBe(false);
    expect(matchesMode(explorer, { text: "Et c'est toi qui comptais" })).toBe(false);
    expect(matchesMode({ mode: "creuser" }, { text: "Et c'est toi qui comptais la caisse ?" })).toBe(true);
  });
});

describe("explorer personnalisé", () => {
  it("propose jusqu'à 3 compétences du même vivier, d'enjeux variés", () => {
    const responses = [r("reparer-velo", "right")];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(4) })!;
    expect(plan.mode).toBe("explorer");
    expect(plan.candidates.length).toBe(3);
    expect(new Set(plan.candidates.map((m) => m.code)).size).toBe(3);
    const pool = new Set(poolFor(plan.center).map((m) => m.code));
    for (const m of plan.candidates) expect(pool.has(m.code)).toBe(true);
  });

  it("le prompt explorer contient ce que le jeune a aimé, jamais de texte libre", () => {
    const responses = [r("reparer-velo", "right")];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(4) })!;
    const prompt = buildCardPrompt(plan, {
      recent: ["Réparer un vélo crevé"],
      liked: ["Réparer un vélo crevé"],
      disliked: ["Jouer dans une pièce de théâtre"],
    });
    expect(prompt).toContain("Il a dit oui à");
    expect(prompt).toContain("Réparer un vélo crevé");
    expect(prompt).toContain("Ça ne lui parle pas");
    expect(prompt).toContain("prolonge le mieux ce que le jeune aime");
  });
});

describe("cartes pré-écrites (repli sans LLM)", () => {
  it("chaque cible du swipe a sa carte explorer pré-écrite", () => {
    const missing = new Set<number>();
    for (const center of new Set(CARDS.flatMap((c) => Object.keys(c.centers)))) {
      for (const m of poolFor(center)) if (!pregenCard(m.code)) missing.add(m.code);
    }
    expect(missing.size).toBe(0);
    expect(pregenCount()).toBeGreaterThan(200);
  });

  it("sans LLM, une carte explorer n'affiche jamais le libellé ROME brut", () => {
    const responses: Response[] = [];
    const profile = computeProfile(responses, [], CARDS);
    const plan = pickTarget({ profile, responses, cards: CARDS, rand: mulberry32(5), allowLoose: false })!;
    const draft = templateDraft(plan, plan.candidates[0]);
    expect(draft.text).not.toBe(plan.candidates[0].label);
    expect(matchesMode(plan, draft)).toBe(true);
  });

  it("sans LLM, pas de suite 'creuser' sur une carte générée (elle serait en jargon ROME)", () => {
    const { generated, responses } = play(1, (card) => r(card.id, "right", "deja-souvent"));
    const cards = [...CARDS, ...generated];
    const profile = computeProfile(responses, [], cards);
    const plan = pickTarget({ profile, responses, cards, rand: mulberry32(6), allowLoose: false })!;
    expect(plan.mode).toBe("explorer");
  });
});

