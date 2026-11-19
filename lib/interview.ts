import type { SkillRef } from "./matches";

/**
 * Étape 2 — « On creuse » : entretien court autour d'UN MÉTIER choisi dans
 * « Mes matchs », sur les expériences vécues (skill matches) qui y mènent.
 *
 * L'entretien = 3 questions ouvertes sur ces expériences, orientées vers le
 * métier, puis au plus 3 questions utiles au CV (champs `user` du contrat
 * d'entrée de docs/DOSSIER.md) parmi celles encore sans réponse : le CV se
 * complète au fil des métiers creusés. Le jeune peut quitter à tout moment et
 * reprendre plus tard.
 *
 * Fichier partagé client / serveur : pur, sans dépendance au référentiel ROME.
 */

export type QuestionSource = "generated" | "template";

export type InterviewExperience = {
  /** Carte où le jeune a dit « déjà fait ». */
  cardId: string;
  text: string;
  skill?: SkillRef;
};

export type Interview = {
  /** `job:<code ROME>`. */
  id: string;
  /** Métier visé (code et intitulé ROME). */
  job: { code: string; label: string };
  /** Expériences vécues sur lesquelles s'appuie ce métier. */
  experiences: InterviewExperience[];
  /** Questions ouvertes (vide tant qu'elles ne sont pas chargées). */
  questions: string[];
  questionSource?: QuestionSource;
  /** Réponses, même index que `questions` ("" = passée). */
  answers: string[];
  /** Questions CV posées à la fin de CET entretien (choisies à l'ouverture). */
  cvFields: CvField[];
  /** Écran en cours (questions du projet puis questions CV) : reprise au même endroit. */
  step: number;
  startedAt: number;
  finishedAt?: number;
};

/** Nombre de questions ouvertes sur le projet. */
export const PROJECT_QUESTION_COUNT = 3;
/** Questions CV au plus par entretien. */
export const CV_PER_INTERVIEW = 3;

export const interviewId = (jobCode: string) => `job:${jobCode}`;

/** « Mécanicien / Mécanicienne cycles » → pas d'accord à faire dans la phrase. */
const trimEnd = (s: string) => s.replace(/[.!?…\s]+$/u, "");

/**
 * Questions de repli (sans LLM) : contexte, action, lien avec le métier.
 * Elles restent sur l'expérience principale et le métier visé.
 */
export function fallbackQuestions(jobLabel: string, experiences: Pick<InterviewExperience, "text">[]): string[] {
  const activity = trimEnd(experiences[0]?.text ?? "ce que tu as déjà fait");
  return [
    `Raconte la dernière fois que tu as fait ça : « ${activity} ». C'était quand, et dans quel cadre ?`,
    "Qu'est-ce que tu as fait toi, concrètement, du début à la fin ?",
    `Dans ce que tu as fait, qu'est-ce qui te rapproche du métier « ${trimEnd(jobLabel)} » ?`,
  ];
}

// ---------------------------------------------------------------------------
// Questions CV (fin d'étape 2)
// ---------------------------------------------------------------------------

export type CvField =
  | "firstName"
  | "age"
  | "place"
  | "studiesLevel"
  | "currentStatus"
  | "experience"
  | "driverLicense"
  | "mobilityKm";

export type CvChip = { label: string; value: string };

export type CvQuestion = {
  field: CvField;
  text: string;
  hint?: string;
  /** Réponses rapides : un tap remplit la réponse. */
  chips?: CvChip[];
  numeric?: boolean;
};

/** Par ordre de priorité pour le CV : les premières sans réponse sont posées d'abord. */
export const CV_QUESTIONS: CvQuestion[] = [
  {
    field: "firstName",
    text: "C'est quoi ton prénom ?",
    hint: "Seulement pour l'écrire sur ton CV. Tu peux passer.",
  },
  {
    field: "place",
    text: "Tu habites dans quelle ville ?",
    hint: "Ajoute ton code postal si tu le connais. Pas besoin de l'adresse.",
  },
  {
    field: "studiesLevel",
    text: "Tu as quel niveau d'études ?",
    hint: "Le dernier diplôme obtenu, ou ta dernière année d'études.",
    chips: [
      { label: "Sans diplôme", value: "sans-diplome" },
      { label: "CAP / BEP", value: "cap-bep" },
      { label: "Bac", value: "bac" },
      { label: "Bac+2", value: "bac+2" },
      { label: "Bac+3", value: "bac+3" },
      { label: "Bac+5", value: "bac+5" },
      { label: "Autre", value: "autre" },
    ],
  },
  {
    field: "currentStatus",
    text: "Tu fais quoi en ce moment ?",
    chips: [
      { label: "Je cherche", value: "recherche" },
      { label: "En formation / études", value: "etudes" },
      { label: "En alternance", value: "alternance" },
      { label: "Au lycée", value: "lycee" },
      { label: "Je travaille", value: "emploi" },
      { label: "Rien pour l'instant", value: "inactif" },
    ],
  },
  {
    field: "experience",
    text: "Tu as déjà eu des petits boulots, des stages ou fait du bénévolat ?",
    hint: "Dis ce que c'était, où, et combien de temps. Même court, ça compte.",
  },
  { field: "age", text: "Tu as quel âge ?", numeric: true },
  {
    field: "driverLicense",
    text: "Tu as le permis ?",
    chips: [
      { label: "Oui", value: "oui" },
      { label: "Non", value: "non" },
      { label: "En cours", value: "en-cours" },
    ],
  },
  {
    field: "mobilityKm",
    text: "Tu peux aller jusqu'à combien de kilomètres pour un travail ou une formation ?",
    chips: [
      { label: "5 km", value: "5" },
      { label: "10 km", value: "10" },
      { label: "20 km", value: "20" },
      { label: "30 km et plus", value: "30" },
    ],
  },
];

/** Réponses brutes, telles que tapées ou dictées. */
export type CvAnswers = Partial<Record<CvField, string>>;

/**
 * Questions CV du prochain entretien : les plus prioritaires parmi celles
 * sans réponse, en sautant celles que le jeune a déjà passées.
 */
export function pickCvFields(cv: CvAnswers, skipped: CvField[], n = CV_PER_INTERVIEW): CvField[] {
  return CV_QUESTIONS.map((q) => q.field)
    .filter((field) => !cv[field]?.trim() && !skipped.includes(field))
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Export vers le contrat d'entrée du dossier (docs/DOSSIER.md, `user`)
// ---------------------------------------------------------------------------

export type DossierUser = {
  firstName?: string;
  age?: number;
  postalCode: string;
  city?: string;
  studiesLevel?: string;
  currentStatus?: string;
  experience: Array<{
    title: string;
    organization?: string;
    durationMonths?: number;
    description?: string;
    competences?: string[];
  }>;
  constraints?: { mobilityKm?: number; driverLicense?: boolean };
  /** Métiers que le jeune a choisi de creuser (code et intitulé ROME). */
  targetJobs?: Array<{ code: string; label: string }>;
  /** Réponses brutes, pour ce qui n'a pas pu être rangé dans un champ. */
  raw: CvAnswers;
};

function chipValue(field: CvField, answer?: string): string | undefined {
  const question = CV_QUESTIONS.find((q) => q.field === field);
  const text = answer?.trim().toLowerCase();
  if (!question?.chips || !text) return undefined;
  return question.chips.find((c) => c.label.toLowerCase() === text || c.value === text)?.value;
}

function firstNumber(answer?: string): number | undefined {
  const match = answer?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

export function toDossierUser(cv: CvAnswers, interviews: Interview[]): DossierUser {
  const place = cv.place?.trim() ?? "";
  const postalCode = place.match(/\b\d{5}\b/)?.[0] ?? "";
  const city = place.replace(postalCode, "").replace(/[,\s]+/g, " ").trim() || undefined;

  const age = firstNumber(cv.age);
  const mobility = chipValue("mobilityKm", cv.mobilityKm) ?? firstNumber(cv.mobilityKm);
  const license = chipValue("driverLicense", cv.driverLicense);

  const answered = interviews.filter((i) => i.answers.some((a) => a.trim()));
  const experience: DossierUser["experience"] = answered.map((i) => ({
    title: i.experiences.map((e) => e.text).join(" · "),
    description: i.questions
      .map((q, k) => (i.answers[k]?.trim() ? `${q} — ${i.answers[k].trim()}` : ""))
      .filter(Boolean)
      .join("\n"),
    competences: [...new Set(i.experiences.flatMap((e) => (e.skill ? [e.skill.label] : [])))],
  }));
  if (cv.experience?.trim()) {
    experience.push({
      title: "Petits boulots, stages, bénévolat (déclaré)",
      description: cv.experience.trim(),
    });
  }

  const constraints: DossierUser["constraints"] = {};
  if (mobility !== undefined) constraints.mobilityKm = Number(mobility);
  if (license !== undefined) constraints.driverLicense = license === "oui";

  return {
    firstName: cv.firstName?.trim() || undefined,
    age: age !== undefined && age >= 14 && age <= 99 ? age : undefined,
    postalCode,
    city,
    studiesLevel: chipValue("studiesLevel", cv.studiesLevel),
    currentStatus: chipValue("currentStatus", cv.currentStatus),
    experience,
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    targetJobs: interviews.map((i) => i.job),
    raw: cv,
  };
}
