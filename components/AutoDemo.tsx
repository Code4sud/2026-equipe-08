"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { PAIRS } from "../content/pairs";
import { lexicalMatches } from "../lib/adaptive/target";
import { DEMO } from "../lib/demo";
import { DEMO_SESSION } from "../lib/dossier/demo";
import {
  CV_QUESTIONS,
  type CvField,
  type CvQuestion,
} from "../lib/interview";
import {
  AUTODEMO_EVENT,
  isAutoDemo,
  startAutoDemo,
  stopAutoDemo,
} from "../lib/autodemo";
import { dominantCenter } from "../lib/select";
import { useSession } from "../lib/store";
import type { Card, SwipeDirection, TraitPair } from "../lib/types";

/** Assez lent pour qu'on voie les cartes et les transitions. */
const TICK_MS = 900;
const RESULT_PAUSE_MS = 2_600;
const MAX_CARDS = 20;
const LIKED = new Set(["manual", "tech", "creation", "organize"]);
const DISLIKED = new Set([
  "care",
  "contact",
  "business",
  "children",
  "public",
  "leadership",
]);

/** Le persona officiel : ses choix sur les cartes fixes servent de guide. */
const DEMO_PICK = new Map(
  DEMO.responses.map((response) => [response.cardId, response.direction]),
);

type Store = ReturnType<typeof useSession.getState>;

/** Un seul bouton : réinitialise la session, charge Sam, puis lance le deck. */
export function StartAutoDemoButton({
  className = "",
  children = "Lancer la démo automatique",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        startAutoDemo();
        router.push("/deck");
      }}
      className={className}
    >
      {children}
    </button>
  );
}

/**
 * Conducteur de démo. Il lit le store et le chemin courant, puis avance d'une
 * étape toutes les 520 ms : swipe, confirmation, style, entretien, résultat.
 * L'utilisateur peut arrêter à tout moment ; rien n'est caché.
 */
export function AutoDemoController() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Préparation");
  const [finished, setFinished] = useState(false);
  const resultAt = useRef<number | null>(null);
  const finishedTimer = useRef<number | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    const sync = () => setActive(isAutoDemo());
    sync();
    window.addEventListener(AUTODEMO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTODEMO_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/result") resultAt.current = null;
    navigating.current = false;
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (finishedTimer.current) window.clearTimeout(finishedTimer.current);
    };
  }, []);

  const finish = useCallback(() => {
    stopAutoDemo();
    setActive(false);
    setLabel("");
    setFinished(true);
    if (finishedTimer.current) window.clearTimeout(finishedTimer.current);
    finishedTimer.current = window.setTimeout(() => setFinished(false), 7_000);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      if (navigating.current) return;
      navigating.current = true;
      router.push(path);
    },
    [router],
  );

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (!isAutoDemo()) {
        setActive(false);
        return;
      }
      const state = useSession.getState();
      if (pathname === "/deck") {
        tickDeck(state, navigate, setLabel);
      } else if (pathname === "/style") {
        tickStyle(state, navigate, setLabel);
      } else if (pathname === "/creuser") {
        tickCreuser(state, navigate, setLabel);
      } else if (pathname === "/result") {
        setLabel("Résultat");
        if (!resultAt.current) resultAt.current = Date.now();
        if (Date.now() - resultAt.current >= RESULT_PAUSE_MS) {
          navigate("/dossier");
        }
      } else if (pathname === "/dossier") {
        finish();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, pathname, navigate, finish]);

  return (
    <>
      {active && (
        <div className="fixed inset-x-3 bottom-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-full border-2 border-ink bg-ink px-4 py-2.5 text-paper shadow-2xl">
          <span className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mint" />
            Démo auto
          </span>
          <span className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold text-paper/60">
            {label}
          </span>
          <button
            type="button"
            onClick={finish}
            className="shrink-0 rounded-full bg-paper/15 px-3 py-1.5 text-[10px] font-bold text-paper"
          >
            Arrêter
          </button>
        </div>
      )}

      {finished && !active && (
        <div className="fixed inset-x-3 bottom-4 z-[80] mx-auto flex max-w-md items-center gap-2 rounded-full border-2 border-ink bg-mint px-4 py-2.5 text-ink shadow-2xl">
          <span className="min-w-0 flex-1 truncate text-xs font-black">
            Démo terminée — tu peux explorer le dossier.
          </span>
          <button
            type="button"
            onClick={() => {
              setFinished(false);
              startAutoDemo();
              router.push("/deck");
            }}
            className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-paper"
          >
            Rejouer
          </button>
          <button
            type="button"
            onClick={() => setFinished(false)}
            aria-label="Fermer"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-ink/50"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

function tickDeck(
  state: Store,
  navigate: (path: string) => void,
  setLabel: (label: string) => void,
) {
  if (state.pendingConfirmation) {
    setLabel("Confirmation du domaine");
    state.resolvePending(LIKED.has(state.pendingConfirmation));
    return;
  }

  if (state.skillMatch) {
    setLabel("Compétence repérée");
    state.startInterview(state.skillMatch);
    navigate("/creuser");
    return;
  }

  if (state.awaitingExperience) {
    const last = state.responses.at(-1);
    const lastCard = state.allCards().find((item) => item.id === last?.cardId);
    const generated = Boolean(lastCard?.target);
    const creusableFixed =
      Boolean(lastCard) &&
      !lastCard?.target &&
      lexicalMatches(lastCard?.text ?? "", 3, lastCard?.centers ?? {}).length >
        0;
    const canInterview =
      state.experienceAsks <= 2 &&
      state.interviews.length < 2 &&
      (generated || creusableFixed);

    setLabel(canInterview ? "Vécu confirmé" : "Pas de récit");
    state.answerExperience(canInterview);
    if (canInterview && generated && lastCard) {
      // Carte générée : en mode mock, elle ne peut pas produire de carte
      // creuser. Pour la démo, on ouvre directement l'entretien.
      state.startInterview(
        lastCard.id,
        `C'est bien toi qui as fait : « ${lastCard.text} » ?`,
      );
      navigate("/creuser");
    }
    return;
  }

  const card = state.allCards().find((item) => item.id === state.currentCardId);
  if (!card) {
    setLabel("Cartes");
    if (state.responses.length >= 18) {
      state.startStyle();
      navigate("/style");
    } else {
      state.ensureCard();
    }
    return;
  }

  if (state.responses.length >= MAX_CARDS) {
    setLabel("Fin des cartes");
    state.startStyle();
    navigate("/style");
    return;
  }

  if (card.target?.mode === "creuser") {
    setLabel("On creuse un peu");
    state.swipeCard("right");
    return;
  }

  setLabel(`Cartes ${Math.min(state.responses.length + 1, MAX_CARDS)}/${MAX_CARDS}`);
  // Une carte fixe sans lien lexical ROME ne peut pas produire de carte
  // creuser en mode mock : on la laisse de côté pour garder la démo fluide.
  if (!card.target && lexicalMatches(card.text, 3, card.centers).length === 0) {
    state.swipeCard("left", "jamais-essaye");
    return;
  }
  const direction = decideDirection(card, state.responses.length);
  state.swipeCard(
    direction,
    direction === "left" ? leftReason(card) : undefined,
  );
}

function tickStyle(
  state: Store,
  navigate: (path: string) => void,
  setLabel: (label: string) => void,
) {
  const pair = PAIRS.find((item) => item.id === state.currentPairId);
  if (!pair) {
    if (state.traitResponses.length >= PAIRS.length) {
      setLabel("Résultat");
      // Scénario final garanti : on charge la session officielle de Sam
      // (2 entretiens riches, CV rempli) avant la restitution.
      state.loadSession(DEMO_SESSION);
      navigate("/result");
    } else {
      setLabel("Style de travail");
      state.startStyle();
    }
    return;
  }

  setLabel(
    `Style ${Math.min(state.traitResponses.length + 1, PAIRS.length)}/${
      PAIRS.length
    }`,
  );
  state.swipePair(choosePairDirection(pair));
}

function tickCreuser(
  state: Store,
  navigate: (path: string) => void,
  setLabel: (label: string) => void,
) {
  const interview = state.interviews.find(
    (item) => item.cardId === state.activeInterview,
  );
  if (!interview) {
    navigate("/deck");
    return;
  }
  if (interview.questions.length === 0) {
    setLabel("Préparation des questions");
    return;
  }

  const cvQuestions = interview.cvFields
    .map((field) => CV_QUESTIONS.find((question) => question.field === field))
    .filter((question): question is CvQuestion => Boolean(question));
  const total = interview.questions.length + cvQuestions.length;
  const step = interview.step;
  setLabel(`Entretien ${Math.min(step + 1, total)}/${total}`);

  if (step < interview.questions.length) {
    state.answerInterview(
      interview.cardId,
      step,
      projectAnswer(interview.parentText, interview.skill, step),
    );
  } else {
    const question = cvQuestions[step - interview.questions.length];
    if (question) state.setCvAnswer(question.field, cvAnswer(question.field));
  }

  if (step >= total - 1) {
    state.finishInterview(interview.cardId);
    navigate("/deck");
  } else {
    state.setInterviewStep(interview.cardId, step + 1);
  }
}

/**
 * Direction prédéterminée à partir du persona officiel :
 * - si la carte fixe est dans la séquence de `DEMO`, on suit son choix ;
 * - sinon on pondère les centres de la carte par le profil cible ;
 * - les cartes mitoyennes alternent, pour éviter un mur de « oui » ou de « non ».
 */
function decideDirection(card: Card, answered: number): SwipeDirection {
  const fixed = DEMO_PICK.get(card.id);
  if (fixed) return fixed;

  const score = Object.entries(card.centers).reduce(
    (sum, [center, weight]) =>
      sum + (weight ?? 0) * (DEMO.profile.domains[center]?.mean ?? 0.3),
    0,
  );

  if (score >= 0.58) return "right";
  if (score <= 0.4) return "left";
  return answered % 2 === 0 ? "right" : "left";
}

function leftReason(card: Card): "pas-mon-truc" | "jamais-essaye" {
  return DISLIKED.has(dominantCenter(card)) ? "pas-mon-truc" : "jamais-essaye";
}

function choosePairDirection(pair: TraitPair): "left" | "right" {
  // Profil de démo : plutôt seul, cadre clair, nouveauté, compétition,
  // rythme régulier. On choisit le pôle le plus proche à chaque paire.
  const target: Record<TraitPair["trait"], number> = {
    socialEnergy: -0.5,
    structure: 0.6,
    openness: 0.5,
    cooperation: -0.3,
    pace: -0.4,
  };
  const leftDistance = Math.abs(target[pair.trait] - pair.leftValue);
  const rightDistance = Math.abs(target[pair.trait] - pair.rightValue);
  return leftDistance <= rightDistance ? "left" : "right";
}

function projectAnswer(
  parentText: string,
  skill: string,
  index: number,
): string {
  const text = `${parentText} ${skill}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/planning|organis|planifi|gerer|equipe|benevole|buvette/.test(text)) {
    return [
      "Pour la buvette du club de foot, les week-ends de match, pendant une saison.",
      "Je faisais le planning, je gérais les désistements et je prévenais tout le monde quand quelqu'un changeait d'horaire.",
      "Il y a toujours eu quelqu'un à la buvette. Le président m'a demandé de le refaire la saison d'après.",
    ][Math.min(index, 2)];
  }
  if (
    /repar|install|diagnost|maintien|mont|demont|machine|reseau|console|velo|robot|ordinateur|pc/.test(
      text,
    )
  ) {
    return [
      "L'été dernier, en bas de chez moi, pour des potes du quartier. Je répare leurs vélos et leurs consoles régulièrement.",
      "J'ai démonté la pièce, cherché la panne, testé ce qui ne marchait pas, réparé puis remonté. J'ai vérifié que tout fonctionnait.",
      "Ça a remarché tout de suite. Depuis, les gens du quartier viennent me voir quand ils ont un problème.",
    ][Math.min(index, 2)];
  }
  if (/cre|concev|pein|dessin|photo|site|jeu|art|fabric|assembl/.test(text)) {
    return [
      "Chez moi, le week-end, pour un projet perso et pour des potes. J'aime partir d'une idée et la rendre réelle.",
      "J'ai fait des essais, préparé les éléments, assemblé le tout et corrigé ce qui ne rendait pas bien.",
      "Le résultat a plu aux personnes qui l'ont vu. On m'a demandé d'en refaire un autre.",
    ][Math.min(index, 2)];
  }
  return [
    "Ça s'est passé chez moi, dans mon quartier, pour rendre service à des proches.",
    "J'ai regardé ce qui n'allait pas, fait les étapes une par une, puis vérifié que ça marchait.",
    "Ça a servi à quelqu'un et on m'a dit que c'était bien fait. J'ai envie de refaire ce genre de choses.",
  ][Math.min(index, 2)];
}

function cvAnswer(field: CvField): string {
  const answers: Record<CvField, string> = {
    firstName: "Sam",
    age: "19",
    place: "Nice 06300",
    studiesLevel: "CAP / BEP",
    currentStatus: "Je cherche",
    experience: "Deux étés sur un stand de fruits et légumes au marché.",
    driverLicense: "Non",
    mobilityKm: "20",
  };
  return answers[field];
}
