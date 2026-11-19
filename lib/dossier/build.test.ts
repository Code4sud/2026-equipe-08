import { describe, expect, it } from "vitest";
import { buildDossier, profileFromSession } from "./build";
import { DEMO_SESSION, DEMO_USER } from "./demo";
import {
  CvJsonSchema,
  EmailsJsonSchema,
  NarrativeJsonSchema,
  SynthesisJsonSchema,
  buildFacts,
  validateCv,
  validateEmails,
  validateNarrative,
} from "./narrative";
import { DossierRequestSchema } from "./schema";
import type { Narrative } from "./types";

const profile = profileFromSession(DEMO_SESSION);
const dossier = buildDossier({
  session: DEMO_SESSION,
  profile,
  user: DEMO_USER,
});
const facts = buildFacts(dossier);

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

  it("produit un vrai CV ciblé, avec des compétences traduites", () => {
    expect(dossier.cv.header.name).toContain("Sam");
    expect(dossier.cv.header.title).toBe(dossier.cv.target.jobLabel);
    expect(dossier.cv.target.company).toBeTruthy();
    expect(dossier.cv.experiences.length).toBeGreaterThan(0);
    expect(dossier.cv.experiences[0].title).toBe("Réparation d'un vélo crevé");
    expect(dossier.cv.target.romeLabel).toBeTruthy();
    expect(dossier.cv.experiences[0].bullets.length).toBeGreaterThan(0);
    expect(dossier.cv.experiences[0].bullets.join(" ")).not.toContain("?");
    expect(dossier.cv.skills.technical.length).toBeGreaterThan(0);
    expect(dossier.cv.target.savoirEtre?.length).toBeGreaterThan(0);
    expect(dossier.cv.skills.soft).toEqual(
      expect.arrayContaining(["Autonomie", "Rigueur"]),
    );
    expect(dossier.cv.summary.length).toBeGreaterThan(60);
    expect(dossier.emails[0].subject).toMatch(/Candidature/);
    expect(dossier.emails[0].body).toContain("Bonjour");
    expect(dossier.emails[0].body).toContain(dossier.emails[0].jobLabel ?? "");
  });

  it("recalcule le CV quand on change l'offre ciblée", () => {
    const azur = buildDossier({
      session: DEMO_SESSION,
      profile,
      user: DEMO_USER,
      targetOfferId: "off-composites-azur",
    });
    expect(azur.cv.target.offerId).toBe("off-composites-azur");
    expect(azur.cv.header.title).toBe("Opérateur / Opératrice composites");
    expect(azur.cv.summary).toContain("Azur Composites");
  });

  it("ne transmet jamais les réponses brutes d'entretien à l'IA", () => {
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toContain("L'été dernier");
    expect(serialized).not.toContain("bassine");
    expect(serialized).not.toContain("J'ai démonté");
    expect(serialized).not.toContain("sam@example.com");
    expect(serialized).not.toContain("06 12 34 56 78");
    expect(facts.consents.ai).toBe(true);
    expect(facts.user.experience[0].proof).toContain("vélo crevé");
  });

  it("enrichit les faits du CV et des emails", () => {
    expect(facts.cvTarget.offerId).toBeTruthy();
    expect(facts.cvTarget.competences.length).toBeGreaterThan(0);
    expect(facts.offers[0].contract).toBeTruthy();
    expect(facts.offers[0].contact).toMatch(/@/);
    expect(facts.offers[0].competences?.length).toBeGreaterThan(0);
    expect(facts.trainings[0].prerequisites.length).toBeGreaterThan(0);
    expect(facts.trainings[0].debouches.length).toBeGreaterThan(0);
    expect(facts.softSkills).toContain("Autonomie");
  });

  it("valide le corps { facts } envoyé à la route dossier", () => {
    expect(DossierRequestSchema.safeParse({ facts }).success).toBe(true);
    expect(
      DossierRequestSchema.safeParse({
        facts: { ...facts, consents: { ai: false } },
      }).success,
    ).toBe(true);
    expect(DossierRequestSchema.safeParse({ facts: {} }).success).toBe(false);
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
  it("expose des JSON Schemas exploitables par claude -p", () => {
    for (const schema of [
      NarrativeJsonSchema,
      SynthesisJsonSchema,
      CvJsonSchema,
      EmailsJsonSchema,
    ]) {
      expect(schema).toMatchObject({ type: "object" });
      expect(schema).toHaveProperty("properties");
    }
  });

  it("rejette les directions, offres et preuves inventées", () => {
    const validOffer = dossier.emails[0].offerId;
    const validDirection = dossier.directions[0].centerId;

    const narrative: Narrative = {
      synthesis: {
        headline: "Test",
        summary: "Résumé",
        strengths: [{ label: "Manuel", evidenceIds: ["inconnu"] }],
        directions: [
          { id: validDirection, why: "ok", watchout: "à vérifier" },
          { id: "inventée", why: "non", watchout: "" },
        ],
        trainings: [{ id: "inventée", why: "non" }],
        nextSteps: [
          { title: "Étape", detail: "Détail", evidenceIds: ["inconnu"] },
        ],
      },
      cv: {
        targetOfferId: facts.cvTarget.offerId,
        title: "Métallier",
        summary: "Profil manuel.",
        experiences: [],
        softSkills: ["Rigueur", "Team player"],
        languages: [],
        interests: [],
      },
      emails: {
        emails: [
          {
            offerId: validOffer,
            subject: `Candidature — ${facts.offers[0].title} (${facts.offers[0].company})`,
            body: `Bonjour,\n\nJe candidate au poste de ${facts.offers[0].title} chez ${facts.offers[0].company}.\n\n[Prénom]\n[email] · [téléphone]`,
          },
          { offerId: "offre-inventée", subject: "S", body: "B" },
        ],
      },
    };

    const clean = validateNarrative(narrative, facts);
    expect(clean.synthesis.directions).toHaveLength(1);
    expect(clean.synthesis.trainings).toHaveLength(0);
    expect(clean.synthesis.strengths[0].evidenceIds).toHaveLength(0);
    expect(clean.emails.emails).toHaveLength(1);
    expect(clean.emails.emails[0].offerId).toBe(validOffer);
    expect(clean.cv.softSkills).toEqual(["Rigueur"]);
  });

  it("rejette un CV qui recopie une question ou invente un contact", () => {
    const experience = facts.user.experience[0];
    const clean = validateCv(
      {
        targetOfferId: facts.cvTarget.offerId,
        title: "Métallier",
        summary: "Profil manuel.",
        experiences: [
          {
            experienceId: experience.id,
            bullets: [
              "Raconte-moi la fois où t'as réparé ce vélo crevé ?",
              "Réalisation de réparer un vélo",
              "Réparation d'un vélo pour des proches",
            ],
            softSkills: ["Team player", "Rigueur"],
          },
        ],
        softSkills: ["rigueur", "Autonomie"],
        languages: ["Français"],
        interests: [],
      },
      facts,
    );

    expect(clean.experiences[0].bullets).toEqual([
      "Réparation d'un vélo pour des proches",
    ]);
    expect(clean.experiences[0].softSkills).toEqual(["Rigueur"]);
    expect(clean.softSkills).toEqual(["Rigueur", "Autonomie"]);
  });

  it("rejette les emails avec un contact inventé", () => {
    const offer = facts.offers[0];
    const clean = validateEmails(
      {
        emails: [
          {
            offerId: offer.id,
            subject: `Candidature — ${offer.title} (${offer.company})`,
            body: `Bonjour,\n\nJe candidate chez ${offer.company}. Écrivez-moi à test@example.com.`,
          },
          {
            offerId: offer.id,
            subject: `Candidature — ${offer.title} (${offer.company})`,
            body: `Bonjour,\n\nJe candidate au poste de ${offer.title} chez ${offer.company}. Je suis disponible ${facts.user.availability}.\n\n[Prénom]\n[email] · [téléphone]`,
          },
        ],
      },
      facts,
    );

    expect(clean.emails).toHaveLength(1);
    expect(clean.emails[0].body).not.toContain("test@example.com");
  });
});
