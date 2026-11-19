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
  /**
   * Question de vécu à laquelle le jeune a répondu oui. Ce n'est pas une
   * réponse libre : elle peut partir à l'IA, contrairement au récit complet.
   */
  proof?: string;
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
  matchedSkills?: string[];
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
  company?: string;
  jobLabel?: string;
};

export type CvTarget = {
  offerId?: string;
  jobCode?: string;
  /** Intitulé de l'offre, utilisé dans l'en-tête du CV. */
  jobLabel: string;
  /** Libellé ROME du métier, pour relier la formation. */
  romeLabel?: string;
  company?: string;
  city?: string;
  contract?: string;
  salary?: string;
  contact?: string;
  url?: string;
  competences: string[];
  /** Savoir-être attendus par l'offre, pour cibler les soft skills. */
  savoirEtre?: string[];
};

export type DossierCvExperience = {
  id: string;
  title: string;
  organization?: string;
  dates?: string;
  bullets: string[];
  softSkills: string[];
};

export type DossierCv = {
  target: CvTarget;
  header: {
    name: string;
    title: string;
    city: string;
    email?: string;
    phone?: string;
    availability: string;
    mobility: string;
  };
  summary: string;
  experiences: DossierCvExperience[];
  skills: { technical: string[]; soft: string[] };
  education: { title: string; detail?: string; dates?: string }[];
  languages: string[];
  interests: string[];
  /** Champs de la trame encore vides, à remplir par le jeune. */
  placeholders: string[];
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

export type SynthesisNarrative = {
  headline: string;
  summary: string;
  strengths: { label: string; evidenceIds: string[] }[];
  directions: { id: string; why: string; watchout: string }[];
  trainings: { id: string; why: string }[];
  nextSteps: { title: string; detail: string; evidenceIds: string[] }[];
};

export type CvNarrative = {
  /** Le CV est ciblé sur UNE offre : l'IA doit renvoyer la même. */
  targetOfferId?: string;
  title: string;
  summary: string;
  experiences: {
    experienceId: string;
    bullets: string[];
    softSkills: string[];
  }[];
  softSkills: string[];
  languages: string[];
  interests: string[];
};

export type EmailsNarrative = {
  emails: { offerId: string; subject: string; body: string }[];
};

export type Narrative = {
  synthesis: SynthesisNarrative;
  cv: CvNarrative;
  emails: EmailsNarrative;
};

/** Réponse partielle : chaque section a son propre appel et son propre repli. */
export type NarrativeSections = {
  synthesis?: SynthesisNarrative | null;
  cv?: CvNarrative | null;
  emails?: EmailsNarrative | null;
};

export type DossierFacts = {
  consents: { ai: boolean };
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
    jobs: {
      code: string;
      label: string;
      level: string;
      competences: string[];
      savoirEtre: string[];
      friction: string[];
    }[];
    evidence: { id: string; text: string }[];
    watchout?: string;
  }[];
  trainings: {
    id: string;
    title: string;
    level: string;
    duration: string;
    establishments: string[];
    jobs: string[];
    debouches: string[];
    prerequisites: string[];
    alternance: boolean;
    cost?: string;
    why: string;
  }[];
  offers: {
    id: string;
    title: string;
    company: string;
    city: string;
    jobCode?: string;
    jobLabel?: string;
    contract?: string;
    salary?: string;
    contact?: string;
    url?: string;
    competences?: string[];
  }[];
  cvTarget: CvTarget;
  softSkills: string[];
  user: {
    age: number;
    studiesLevel: string;
    status: string;
    /** Jamais le récit brut : titre + preuve + compétences ROME validées. */
    experience: {
      id: string;
      title: string;
      proof?: string;
      competences?: string[];
      source: string;
    }[];
    mobilityKm: number;
    city: string;
    contracts: string[];
    availability: string;
    alternance: boolean;
    driverLicense: boolean;
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
  /** Offre visée par le CV. Par défaut : la meilleure offre disponible. */
  targetOfferId?: string;
  narrative?: NarrativeSections | null;
};
