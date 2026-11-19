import sessionRaw from "../../docs/samples/declic-session.sample.json";
import dossierRaw from "../../docs/samples/declic-dossier.sample.json";
import offersRaw from "../../content/demo/offers.nice.json";
import trainingsRaw from "../../content/demo/trainings.nice.json";
import type { DossierUser } from "../interview";
import type {
  CurrentStatus,
  DemoUser,
  DossierSession,
  OfferFixture,
  StudiesLevel,
  TrainingFixture,
} from "./types";

/**
 * Session officielle fournie par l'équipe swipe (étape 2 incluse) :
 * 24 swipes, 7 cartes adaptatives, 15 paires de style, 2 entretiens.
 */
export const DEMO_SESSION = sessionRaw as unknown as DossierSession;

export const OFFERS = offersRaw as unknown as OfferFixture[];
export const TRAININGS = trainingsRaw as unknown as TrainingFixture[];

const SAMPLE_USER = (dossierRaw as unknown as { user: DossierUser }).user;

const STUDIES: Record<string, StudiesLevel> = {
  "sans-diplome": "sans-diplome",
  "cap-bep": "cap-bep",
  "bac": "bac",
  "bac+2": "bac+2",
  "bac+3": "bac+3",
  "bac+5": "bac+5",
  "autre": "autre",
};

const STATUS: Record<string, CurrentStatus> = {
  college: "college",
  lycee: "lycee",
  etudes: "etudes",
  alternance: "alternance",
  recherche: "recherche",
  emploi: "emploi",
  inactif: "inactif",
};

const BASE: DemoUser = {
  firstName: "Sam",
  lastName: "",
  email: "sam@example.com",
  phone: "06 12 34 56 78",
  age: 19,
  postalCode: "06300",
  city: "Nice",
  studiesLevel: "cap-bep",
  currentStatus: "recherche",
  driverLicense: false,
  mobilityKm: 20,
  availableFrom: "immédiatement",
  maxTrainingMonths: 24,
  minSalary: 0,
  contractTypes: ["CDI", "CDD", "Alternance"],
  alternance: true,
  experience: [],
  aiEnabled: true,
  locationSimulated: true,
};

/**
 * Fusionne le `user` du contrat dossier (étape 2) avec les valeurs de démo
 * qui ne sont pas encore demandées par le swipe (email, contrats, IA).
 */
export function demoUserFromDossier(
  user: DossierUser,
  base: DemoUser = BASE,
): DemoUser {
  const experience = user.experience.map((item, index) => ({
    id: `cv-${index + 1}`,
    title: item.title,
    detail: item.description,
    proof: item.proof,
    source: "creuser" as const,
    evidence: [item.proof, item.description ?? item.title].filter(
      (text): text is string => Boolean(text),
    ),
    competences: item.competences,
  }));

  return {
    ...base,
    firstName: user.firstName?.trim() || base.firstName,
    age: user.age ?? base.age,
    postalCode: user.postalCode || base.postalCode,
    city: user.city?.trim() || base.city,
    studiesLevel: STUDIES[user.studiesLevel ?? ""] ?? base.studiesLevel,
    currentStatus: STATUS[user.currentStatus ?? ""] ?? base.currentStatus,
    driverLicense: user.constraints?.driverLicense ?? base.driverLicense,
    mobilityKm: user.constraints?.mobilityKm ?? base.mobilityKm,
    experience,
  };
}

export const DEMO_USER = demoUserFromDossier(SAMPLE_USER, BASE);

const KEY = "declic-demo-user-v1";

export function loadDemoUser(): DemoUser {
  if (typeof window === "undefined") return DEMO_USER;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEMO_USER;
    const parsed = JSON.parse(raw) as Partial<DemoUser>;
    return { ...DEMO_USER, ...parsed };
  } catch {
    return DEMO_USER;
  }
}

export function saveDemoUser(user: DemoUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // mode privé strict : on garde la valeur en mémoire.
  }
}

export function clearDemoUser(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
