import { describe, expect, it } from "vitest";
import {
  CV_PER_INTERVIEW,
  CV_QUESTIONS,
  PROJECT_QUESTION_COUNT,
  fallbackQuestions,
  pickCvFields,
  toDossierUser,
  type Interview,
} from "./interview";
import { buildQuestionsPrompt, isUsableQuestion, writeQuestions } from "./interviewQuestions";

const SKILL = { code: 300182, label: "Réparer un équipement, une machine, une installation" };

const interview: Interview = {
  id: "job:I1619",
  job: { code: "I1619", label: "Mécanicien / Mécanicienne cycles" },
  experiences: [{ cardId: "reparer-velo", text: "Réparer un vélo crevé", skill: SKILL }],
  questions: ["C'était quand ?", "Tu as fait quoi ?"],
  answers: ["L'été dernier, au quartier.", ""],
  cvFields: [],
  step: 0,
  startedAt: 0,
};

const questionInput = {
  jobCode: interview.job.code,
  jobLabel: interview.job.label,
  experiences: [{ text: "Réparer un vélo crevé", skill: SKILL.code }],
};

describe("étape 2 — questions sur le métier", () => {
  it("les questions de repli restent sur l'expérience et le métier", () => {
    const questions = fallbackQuestions(interview.job.label, [{ text: "Réparer un vélo crevé." }]);
    expect(questions).toHaveLength(PROJECT_QUESTION_COUNT);
    expect(questions[0]).toContain("« Réparer un vélo crevé »");
    expect(questions[2]).toContain("Mécanicien / Mécanicienne cycles");
    expect(questions.every(isUsableQuestion)).toBe(true);
  });

  it("sans LLM (mode mock), on retombe sur les questions de repli", async () => {
    const out = await writeQuestions(questionInput);
    expect(out.source).toBe("template");
    expect(out.questions).toEqual(fallbackQuestions(interview.job.label, questionInput.experiences));
  });

  it("le prompt ne contient que le métier ROME, les cartes et leurs compétences", () => {
    const prompt = buildQuestionsPrompt(questionInput);
    expect(prompt).toContain("Mécanicien / Mécanicienne cycles");
    expect(prompt).toContain("vélos"); // définition ROME du métier
    expect(prompt).toContain("Réparer un vélo crevé");
    expect(prompt).toContain(SKILL.label);
  });

  it("accepte questions et consignes ouvertes, rejette ce qui sort du gabarit", () => {
    expect(isUsableQuestion("Comment tu as trouvé la panne ?")).toBe(true);
    expect(isUsableQuestion("Raconte étape par étape ce que t'as fait.")).toBe(true);
    expect(isUsableQuestion("Quand ?")).toBe(false);
    expect(isUsableQuestion("x".repeat(200))).toBe(false);
  });
});

describe("étape 2 — export vers le dossier (docs/DOSSIER.md)", () => {
  it("range les réponses CV dans les champs `user`", () => {
    const user = toDossierUser(
      {
        firstName: " Sam ",
        age: "19 ans",
        place: "Nice 06300",
        studiesLevel: "CAP / BEP",
        currentStatus: "Je cherche",
        driverLicense: "Non",
        mobilityKm: "20 km",
        experience: "Vendeur au marché deux étés",
      },
      [interview],
    );
    expect(user).toMatchObject({
      firstName: "Sam",
      age: 19,
      postalCode: "06300",
      city: "Nice",
      studiesLevel: "cap-bep",
      currentStatus: "recherche",
      constraints: { mobilityKm: 20, driverLicense: false },
    });
    expect(user.experience[0]).toMatchObject({
      title: "Réparer un vélo crevé",
      competences: [SKILL.label],
    });
    expect(user.experience[0].description).toContain("L'été dernier");
    expect(user.experience[1].description).toBe("Vendeur au marché deux étés");
    expect(user.targetJobs).toEqual([interview.job]);
  });

  it("une réponse libre qui ne correspond à aucun choix reste brute", () => {
    const user = toDossierUser({ studiesLevel: "j'ai arrêté en seconde", age: "8" }, []);
    expect(user.studiesLevel).toBeUndefined();
    expect(user.age).toBeUndefined();
    expect(user.raw.studiesLevel).toBe("j'ai arrêté en seconde");
    expect(user.postalCode).toBe("");
    expect(user.experience).toEqual([]);
  });

  it("au plus 3 questions CV par entretien, les plus utiles d'abord, sans reposer les passées", () => {
    expect(pickCvFields({}, [])).toEqual(["firstName", "place", "studiesLevel"]);
    expect(pickCvFields({ firstName: "Sam" }, ["place"])).toEqual(["studiesLevel", "currentStatus", "experience"]);
    const all = CV_QUESTIONS.map((q) => q.field);
    expect(pickCvFields({}, all)).toEqual([]);
    expect(pickCvFields({}, []).length).toBe(CV_PER_INTERVIEW);
  });

  it("les questions CV couvrent les champs du contrat", () => {
    const fields = CV_QUESTIONS.map((q) => q.field);
    for (const field of ["firstName", "age", "place", "studiesLevel", "currentStatus", "experience"]) {
      expect(fields).toContain(field);
    }
  });
});
