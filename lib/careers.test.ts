import { describe, expect, it } from "vitest";
import { CARDS } from "../content/cards";
import { getIndexedJob, jobStems, rankJobs, suggestJobs } from "./careers";
import { matchesKey, type MatchInput, type SkillMatch } from "./matches";
import { resolveSkill, skillCandidates } from "./skillOf";

const card = (id: string) => CARDS.find((c) => c.id === id)!;
const input = (id: string, skill?: number): MatchInput => ({
  cardId: id,
  text: card(id).text,
  skill,
  centers: card(id).centers,
});

describe("métiers proposés à partir des skill matches", () => {
  it("l'index contient des métiers ROME absents de la sélection de démo", () => {
    expect(getIndexedJob("I1619")?.label).toBe("Mécanicien / Mécanicienne cycles");
  });

  it("le pluriel ne casse pas le lien par les mots (« vélo » ~ « vélos »)", () => {
    expect(jobStems("vélos")).toEqual(jobStems("vélo"));
  });

  it("« réparer un vélo » met Mécanicien cycles parmi les candidats soumis à l'IA", () => {
    const ranked = rankJobs([input("reparer-velo", 300182)]);
    expect(ranked).toHaveLength(25);
    const velo = ranked.find((r) => r.job.code === "I1619");
    expect(velo).toBeDefined();
    expect(velo!.cardIds).toContain("reparer-velo");
  });

  it("sans LLM, propose de vrais métiers ROME avec une accroche reliée au vécu", async () => {
    const jobs = await suggestJobs([input("reparer-velo", 300182), input("vendre-vinted")]);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(getIndexedJob(job.code)).toBeDefined();
      expect(job.source).toBe("template");
      expect(job.pitch).toMatch(/« .+ »/);
      expect(job.cardIds.length).toBeGreaterThan(0);
    }
  });

  it("aucun match, aucun métier", async () => {
    expect(await suggestJobs([])).toEqual([]);
  });
});

describe("compétence ROME d'un « déjà fait » sur une carte de la banque", () => {
  it("short-list fermée : lien par les mots d'abord, au plus 8", () => {
    const { candidates, lexical } = skillCandidates(card("caisse-asso"));
    expect(lexical[0]?.label).toBe("Gérer une caisse");
    expect(candidates[0]?.label).toBe("Gérer une caisse");
    expect(candidates.length).toBeLessThanOrEqual(8);
  });

  it("sans LLM : le lien par les mots s'il existe, sinon aucune compétence", async () => {
    expect((await resolveSkill(card("caisse-asso")))?.label).toBe("Gérer une caisse");
    // « réviser » ≠ « révision » d'un véhicule : pas de lien solide, pas de compétence inventée.
    expect(await resolveSkill(card("aider-reviser"))).toBeNull();
  });
});

describe("mémoire des matchs", () => {
  const match = (cardId: string, skill?: number): SkillMatch => ({
    cardId,
    text: cardId,
    reason: "deja-une-fois",
    centers: {},
    skill: skill ? { code: skill, label: "x" } : undefined,
    skillStatus: skill ? "found" : "pending",
    at: 0,
    seen: false,
  });

  it("la clé des métiers change quand un match ou sa compétence change, pas avec l'ordre", () => {
    const a = matchesKey([match("a"), match("b", 1)]);
    expect(matchesKey([match("b", 1), match("a")])).toBe(a);
    expect(matchesKey([match("a", 2), match("b", 1)])).not.toBe(a);
    expect(matchesKey([match("a"), match("b", 1), match("c")])).not.toBe(a);
  });
});
