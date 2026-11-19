import sessionRaw from "../../content/demo/session.json";
import offersRaw from "../../content/demo/offers.nice.json";
import trainingsRaw from "../../content/demo/trainings.nice.json";
import type {
  DemoUser,
  DossierSession,
  OfferFixture,
  TrainingFixture,
} from "./types";

/**
 * Session réelle fournie par l'équipe swipe : 24 réponses, 7 cartes
 * adaptatives, 15 paires de style, 2 confirmations. Sert de persona de démo.
 */
export const DEMO_SESSION = sessionRaw as unknown as DossierSession;

export const OFFERS = offersRaw as unknown as OfferFixture[];
export const TRAININGS = trainingsRaw as unknown as TrainingFixture[];

export const DEMO_USER: DemoUser = {
  firstName: "Ilaf",
  lastName: "Laamari",
  email: "ilaf.laamari@example.com",
  phone: "06 12 34 56 78",
  age: 19,
  postalCode: "06000",
  city: "Nice",
  studiesLevel: "bac",
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
