import type {
  Card,
  CenterId,
  Confirmation,
  Job,
  JobCompetence,
  JobMatch,
  Profile,
  Response,
  Riasec,
  TraitResponse,
} from "../types";
import type { CvAnswers, CvField, Interview } from "../interview";
import type { SkillMatch } from "../matches";

export type StudiesLevel =
  | "sans-diplome"
  | "cap-bep"
  | "bac"
  | "bac+2"
  | "bac+3"
  | "bac+5"
  | "autre";

export type CurrentStatus =
  | "college"
  | "lycee"
  | "etudes"
  | "alternance"
  | "recherche"
  | "emploi"
  | "inactif";

export type DemoExperience = {
  id: string;
  title: string;
  detail?: string;
  source: "swipe" | "creuser" | "manuel";
  evidence: string[];
  competences?: string[];
};

export type DemoUser = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age: number;
  postalCode: string;
  city: string;
  studiesLevel: StudiesLevel;
  currentStatus: CurrentStatus;
  driverLicense: boolean;
  mobilityKm: number;
  availableFrom: string;
  maxTrainingMonths: number;
  minSalary: number;
  contractTypes: string[];
  alternance: boolean;
  experience: DemoExperience[];
  aiEnabled: boolean;
  locationSimulated: boolean;
};

export type DossierSession = {
  responses: Response[];
  generated: Card[];
  traitResponses: TraitResponse[];
  confirmations: Confirmation[];
  interviews?: Interview[];
  cv?: CvAnswers;
  cvSkipped?: CvField[];
  skillMatches?: SkillMatch[];
};

export type TrainingEstablishment = {
  name: string;
  city: string;
  url?: string;
  source: string;
};

export type TrainingFixture = {
  id: string;
  title: string;
  diplomaLevel: string;
  durationMonths: number;
  alternance: boolean;
  prerequisites: string[];
  cost?: string;
  jobCodes: string[];
  centers: CenterId[];
  establishments: TrainingEstablishment[];
  debouches: { code: string; label: string }[];
  nextStep: string;
  source: string;
};

export type OfferFixture = {
  id: string;
  title: string;
  company: string;
  city: string;
  contract?: string;
  salary?: string;
  url: string;
  contact?: string;
  publishedAt?: string;
  jobCodes: string[];
  centers: CenterId[];
  source: string;
};

export type DossierTraining = TrainingFixture & { why: string };

export type DossierOffer = OfferFixture & { distanceKm?: number };

export type DossierJob = {
  code: string;
  label: string;
  definition: string;
  level: string;
  access: string;
  competences: Job["competences"];
  match: { score: number; interest: number; context: number };
  evidence: string[];
  friction: string[];
  trainings: DossierTraining[];
  offers: DossierOffer[];
};

export type DossierDirection = {
  centerId: CenterId;
  title: string;
  subtitle: string;
  score: number;
  why: string;
  watchout?: string;
  evidence: string[];
  jobs: DossierJob[];
};

export type DossierEmail = {
  id: string;
  offerId: string;
  to?: string;
  subject: string;
  body: string;
  applicationUrl?: string;
};

export type DossierCvSection = {
  heading: string;
  items: { title: string; detail?: string; dates?: string }[];
};

export type DossierCv = {
  title: string;
  summary: string;
  contact: { name: string; city: string; email?: string; phone?: string };
  sections: DossierCvSection[];
};

export type DossierActionStep = {
  id: string;
  title: string;
  detail: string;
  contact?: { name?: string; email?: string; url?: string; phone?: string };
};

export type DossierSource = {
  id: string;
  label: string;
  url?: string;
  fetchedAt?: string;
};

export type Dossier = {
  version: string;
  generatedAt: string;
  user: DemoUser;
  experience: DemoExperience[];
  profile: {
    code: string;
    theta: Record<Riasec, number>;
    domains: Record<CenterId, { mean: number; confidence: number; confirmed: boolean; rejected: boolean }>;
    traits: Profile["traits"];
    confirmed: CenterId[];
    rejected: CenterId[];
  };
  actionPlan: { headline: string; steps: DossierActionStep[] };
  synthesis: {
    headline: string;
    summary: string;
    strengths: { label: string; evidenceIds: string[] }[];
    watchouts: string[];
    unknowns: string[];
  };
  directions: DossierDirection[];
  trainings: DossierTraining[];
  cv: DossierCv;
  emails: DossierEmail[];
  charts: {
    radar: Record<Riasec, number>;
    domains: { id: CenterId; label: string; score: number; confidence: number }[];
    matchBars: { label: string; value: number }[];
  };
  sources: DossierSource[];
  disclaimers: string[];
};

export type Narrative = {
  headline: string;
  summary: string;
  strengths: { label: string; evidenceIds: string[] }[];
  directions: { id: string; why: string; watchout: string }[];
  trainings: { id: string; why: string }[];
  cv: { title: string; summary: string; bullets: string[] };
  emails: { offerId: string; subject: string; body: string }[];
  nextSteps: { title: string; detail: string; evidenceIds: string[] }[];
};

export type DossierFacts = {
  profile: {
    code: string;
    domains: { id: string; label: string; score: number; confirmed: boolean }[];
    traits: { label: string; value: string; confidence: number }[];
    strengths: string[];
    unknowns: string[];
  };
  directions: {
    id: string;
    title: string;
    jobs: { code: string; label: string; level: string; competences: string[] }[];
    evidence: { id: string; text: string }[];
  }[];
  trainings: { id: string; title: string; level: string; duration: string; establishments: string[] }[];
  offers: { id: string; title: string; company: string; city: string }[];
  user: {
    age: number;
    studiesLevel: string;
    status: string;
    experience: { title: string; detail?: string }[];
    mobilityKm: number;
    city: string;
  };
};

export type JobCardInput = {
  job: Job;
  match: JobMatch;
  competences: JobCompetence[];
};

export type BuildInput = {
  session: DossierSession;
  profile: Profile;
  user: DemoUser;
  narrative?: Narrative | null;
};
