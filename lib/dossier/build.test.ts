import { describe, expect, it } from "vitest";
import { buildDossier, profileFromSession } from "./build";
import { DEMO_SESSION, DEMO_USER } from "./demo";
import {
  NarrativeJsonSchema,
  buildFacts,
  validateNarrative,
} from "./narrative";
import type { Narrative } from "./types";

const profile = profileFromSession(DEMO_SESSION);
const dossier = buildDossier({
  session: DEMO_SESSION,
  profile,
  user: DEMO_USER,
});

describe("dossier de démonstration", () => {
  it("retrouve le code et les directions du sample", () => {
    expect(profile.code).toBe("RIC");
    expect(dossier.profile.code).toBe("RIC");
    expect(dossier.directions).toHaveLength(3);
    expect(dossier.directions[0].jobs.length).toBeGreaterThan(0);
  });

  it("extrait le vécu de la session, pas du dossier exporté", () => {
    const titles = dossier.experience.map((item) => item.title);
    const competences = dossier.experience.flatMap(
      (item) => item.competences ?? [],
    );
    expect(titles).toContain("Réparer un vélo crevé");
    expect(competences).toContain(
      "Réparer un équipement, une machine, une installation",
    );
    expect(titles.length).toBeGreaterThanOrEqual(3);
  });

  it("associe des formations et des offres réelles du jeu de démo", () => {
    expect(dossier.trainings.length).toBeGreaterThan(4);
    expect(dossier.emails.length).toBeGreaterThan(3);
    expect(dossier.actionPlan.steps).toHaveLength(3);

    const offerIds = new Set(
      dossier.directions
        .flatMap((direction) => direction.jobs)
        .flatMap((job) => job.offers)
        .map((offer) => offer.id),
    );
    for (const email of dossier.emails) {
      expect(offerIds.has(email.offerId)).toBe(true);
    }

    const trainingIds = new Set(dossier.trainings.map((training) => training.id));
    for (const job of dossier.directions.flatMap((direction) => direction.jobs)) {
      for (const training of job.trainings) {
        expect(trainingIds.has(training.id)).toBe(true);
      }
    }
  });

  it("produit un CV et des emails à partir des données", () => {
    expect(dossier.cv.contact.name).toContain("Sam");
    expect(dossier.cv.sections.length).toBeGreaterThan(2);
    expect(dossier.cv.summary.length).toBeGreaterThan(40);
    expect(dossier.emails[0].subject).toMatch(/Candidature/);
    expect(dossier.emails[0].body).toContain("Bonjour");
  });

  it("conserve la trace des sources et les garde-fous", () => {
    expect(dossier.sources.some((source) => source.id === "rome")).toBe(true);
    expect(
      dossier.disclaimers.some((line) => line.includes("démonstration")),
    ).toBe(true);
    expect(
      dossier.disclaimers.some((line) => line.includes("santé")),
    ).toBe(true);
  });
});

describe("narrative IA", () => {
  it("expose un JSON Schema exploitable par claude -p", () => {
    expect(NarrativeJsonSchema).toMatchObject({
      type: "object",
    });
    expect(NarrativeJsonSchema).toHaveProperty("properties");
  });

  it("rejette les emails et directions inventés", () => {
    const facts = buildFacts(dossier);
    const validOffer = dossier.emails[0].offerId;
    const validDirection = dossier.directions[0].centerId;

    const narrative: Narrative = {
      headline: "Test",
      summary: "Résumé",
      strengths: [{ label: "Manuel", evidenceIds: ["inconnu"] }],
      directions: [
        { id: validDirection, why: "ok", watchout: "à vérifier" },
        { id: "inventée", why: "non", watchout: "" },
      ],
      trainings: [{ id: "inventée", why: "non" }],
      cv: { title: "Test", summary: "Résumé", bullets: ["Un"] },
      emails: [
        { offerId: validOffer, subject: "S", body: "B" },
        { offerId: "offre-inventée", subject: "S", body: "B" },
      ],
      nextSteps: [
        { title: "Étape", detail: "Détail", evidenceIds: ["inconnu"] },
      ],
    };

    const clean = validateNarrative(narrative, facts);
    expect(clean.directions).toHaveLength(1);
    expect(clean.emails).toHaveLength(1);
    expect(clean.emails[0].offerId).toBe(validOffer);
    expect(clean.trainings).toHaveLength(0);
    expect(clean.strengths[0].evidenceIds).toHaveLength(0);
  });
});
