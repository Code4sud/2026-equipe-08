"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
import {
  interviewId,
  pickCvFields,
  type CvAnswers,
  type CvField,
  type Interview,
  type QuestionSource,
} from "./interview";
import {
  matchesKey,
  toMatchInput,
  type JobSuggestion,
  type SkillMatch,
  type SkillRef,
} from "./matches";
import { createProfile, computeProfile, proposeConfirmation, resolveConfirmation } from "./score";
import { nextCard, nextTraitPair } from "./select";
import type {
  Card,
  CenterId,
  Confirmation,
  Profile,
  Response,
  SwipeDirection,
  SwipeReason,
  TraitResponse,
} from "./types";

export type LastResponse = { kind: "card" | "pair"; index: number } | null;

export type SessionSnapshot = {
  responses: Response[];
  generated: Card[];
  traitResponses: TraitResponse[];
  confirmations: Confirmation[];
  interviews?: Interview[];
  cv?: CvAnswers;
  cvSkipped?: CvField[];
  skillMatches?: SkillMatch[];
};

type JobsCache = { key: string; list: JobSuggestion[] };

type SessionState = {
  responses: Response[];
  traitResponses: TraitResponse[];
  confirmations: Confirmation[];
  currentCardId: string | null;
  currentPairId: string | null;
  pendingConfirmation: CenterId | null;
  dismissed: CenterId[];
  lastResponse: LastResponse;
  startedAt: number | null;

  /** Cartes écrites par le swipe adaptatif (jouées ou en file). */
  generated: Card[];
  /** Ids des cartes générées pas encore montrées. */
  queue: string[];
  /** Transitoire : une requête /api/card est en cours. */
  fetching: boolean;
  /** Transitoire : échecs consécutifs de /api/card (coupe l'adaptatif à 3). */
  failures: number;
  /**
   * Après un oui sur une carte d'intérêt, on attend la réponse à
   * « Tu l'as déjà fait ? » avant de passer à la suite.
   */
  awaitingExperience: boolean;

  /** Mémoire des skill matches : un par carte où le jeune a dit « déjà fait ». */
  skillMatches: SkillMatch[];
  /** Transitoire : carte du dernier match, pour la notification. */
  toast: string | null;
  /** Métiers proposés dans « Mes matchs » (recalculés quand les matchs changent). */
  jobs: JobsCache | null;
  /** Transitoire : /api/jobs en cours. */
  jobsLoading: boolean;
  /** Étape 2 : un entretien par métier creusé. */
  interviews: Interview[];
  /** Entretien en cours (id `job:<code>`). */
  activeInterview: string | null;
  /** Réponses aux questions CV (quelques-unes à la fin de chaque entretien). */
  cv: CvAnswers;
  /** Questions CV que le jeune a passées : on ne les repose pas. */
  cvSkipped: CvField[];

  ensureCard: () => void;
  ensurePair: () => void;
  swipeCard: (
    direction: SwipeDirection,
    reason?: SwipeReason,
    latencyMs?: number,
  ) => void;
  setReason: (reason: SwipeReason) => void;
  /** Réponse à « Tu l'as déjà fait ? » (après un oui). */
  answerExperience: (lived: boolean) => void;
  resolvePending: (accepted: boolean) => void;
  swipePair: (direction: SwipeDirection, latencyMs?: number) => void;
  startStyle: () => void;
  reset: () => void;
  /** Charge une session existante (ex. le persona de démonstration). */
  loadSession: (session: SessionSnapshot) => void;
  getProfile: () => Profile;
  /** Toutes les cartes connues : banque fixe + générées. */
  allCards: () => Card[];
  /** Demande la prochaine carte adaptative si la file est vide. */
  pump: () => Promise<void>;

  /** Résout en arrière-plan la compétence ROME des matchs en attente. */
  resolvePendingSkills: () => void;
  dismissToast: () => void;
  /** « Mes matchs » ouvert : la pastille repart de zéro. */
  markMatchesSeen: () => void;
  /** Charge les métiers proposés (cache tant que les matchs ne changent pas). */
  loadJobs: () => Promise<void>;
  /** Clic sur un métier : ouvre (ou reprend) l'entretien « On creuse ». */
  startJobInterview: (job: JobSuggestion) => void;
  setInterviewQuestions: (id: string, questions: string[], source: QuestionSource) => void;
  answerInterview: (id: string, index: number, answer: string) => void;
  /** Écran courant de l'entretien (pour reprendre au même endroit). */
  setInterviewStep: (id: string, step: number) => void;
  finishInterview: (id: string) => void;
  /** Quitter l'étape 2 sans finir : tout est gardé, on pourra reprendre. */
  leaveInterview: () => void;
  setCvAnswer: (field: CvField, answer: string) => void;
  skipCv: (field: CvField) => void;
};

/** Le swipe adaptatif démarre après quelques cartes de la banque (zéro latence). */
const ADAPTIVE_WARMUP = 2;
/** Plafond de cartes générées par session. */
const MAX_GENERATED = 18;
const MAX_FAILURES = 3;
/** Expériences au plus dans un entretien (les questions restent ciblées). */
const MAX_INTERVIEW_EXPERIENCES = 3;

const LIVED = new Set<SwipeReason>(["deja-souvent", "deja-une-fois"]);
const isLived = (reason?: SwipeReason): reason is SkillMatch["reason"] =>
  Boolean(reason && LIVED.has(reason));

function deriveProfile(state: {
  responses: Response[];
  traitResponses: TraitResponse[];
  confirmations: Confirmation[];
  generated: Card[];
}): Profile {
  let profile = computeProfile(state.responses, state.traitResponses, [
    ...CARDS,
    ...state.generated,
  ]);
  for (const confirmation of state.confirmations) {
    profile = resolveConfirmation(
      profile,
      confirmation.centerId,
      confirmation.accepted,
    );
  }
  return profile;
}

/**
 * « Déjà fait » sur une carte = skill match. Une carte générée porte déjà sa
 * compétence ROME ; celle d'une carte de la banque est résolue en arrière-plan.
 */
function makeMatch(card: Card, reason: SkillMatch["reason"]): SkillMatch {
  const skill: SkillRef | undefined = card.target
    ? { code: card.target.macro, label: card.target.label }
    : undefined;
  return {
    cardId: card.id,
    text: card.text,
    emoji: card.emoji,
    reason,
    centers: card.centers,
    skill,
    skillStatus: skill ? "found" : "pending",
    at: Date.now(),
    seen: false,
  };
}

/** Requêtes /api/skill en cours (hors état : rien à persister). */
const resolving = new Set<string>();

const MAX_RESPONSES = 48;

const initialState = {
  responses: [] as Response[],
  traitResponses: [] as TraitResponse[],
  confirmations: [] as Confirmation[],
  currentCardId: null as string | null,
  currentPairId: null as string | null,
  pendingConfirmation: null as CenterId | null,
  dismissed: [] as CenterId[],
  lastResponse: null as LastResponse,
  startedAt: null as number | null,
  generated: [] as Card[],
  queue: [] as string[],
  fetching: false,
  failures: 0,
  awaitingExperience: false,
  skillMatches: [] as SkillMatch[],
  toast: null as string | null,
  jobs: null as JobsCache | null,
  jobsLoading: false,
  interviews: [] as Interview[],
  activeInterview: null as string | null,
  cv: {} as CvAnswers,
  cvSkipped: [] as CvField[],
};

function updateInterview(
  interviews: Interview[],
  id: string,
  patch: (interview: Interview) => Interview,
): Interview[] {
  return interviews.map((i) => (i.id === id ? patch(i) : i));
}

const isGenerated = (id: string) => id.startsWith("gen-");

/**
 * Carte suivante. La file n'attend jamais le LLM : on alterne banque fixe et
 * carte adaptative, pour garder les situations écrites à la main et limiter
 * les appels LLM ; à défaut, la banque fixe (sélection UCB existante).
 */
function pickNext(
  queue: string[],
  profile: Profile,
  responses: Response[],
): { id: string | null; queue: string[] } {
  if (responses.length >= MAX_RESPONSES) return { id: null, queue };
  const seen = new Set(responses.map((r) => r.cardId));
  const pending = queue.filter((id) => !seen.has(id));
  const take = (id: string) => ({ id, queue: pending.filter((x) => x !== id) });

  const last = responses.at(-1);
  const bank = nextCard(profile, responses);
  if (pending[0] && (!last || !isGenerated(last.cardId) || !bank)) return take(pending[0]);

  return { id: bank?.id ?? pending[0] ?? null, queue: bank ? pending : pending.slice(1) };
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => {
      /** Ajoute le match d'un « déjà fait » (une fois par carte) et notifie. */
      const addMatch = (cardId: string, reason: SkillMatch["reason"]) => {
        const state = get();
        if (state.skillMatches.some((m) => m.cardId === cardId)) return;
        const card = get().allCards().find((c) => c.id === cardId);
        if (!card) return;
        set({ skillMatches: [...state.skillMatches, makeMatch(card, reason)], toast: card.id });
        get().resolvePendingSkills();
      };

      return {
        ...initialState,

        getProfile: () => deriveProfile(get()),

        loadSession: (session) => {
          set({
            ...initialState,
            ...session,
            currentCardId: null,
            startedAt: Date.now(),
          });
        },

        allCards: () => [...CARDS, ...get().generated],

        ensureCard: () => {
          if (get().currentCardId) {
            void get().pump();
            return;
          }
          const state = get();
          const next = pickNext(state.queue, deriveProfile(state), state.responses);
          set({ currentCardId: next.id, queue: next.queue });
          void get().pump();
        },

        pump: async () => {
          const state = get();
          if (
            state.fetching ||
            state.awaitingExperience ||
            state.failures >= MAX_FAILURES ||
            state.queue.length > 0 ||
            state.generated.length >= MAX_GENERATED ||
            state.responses.length < ADAPTIVE_WARMUP ||
            state.responses.length >= MAX_RESPONSES
          ) {
            return;
          }

          set({ fetching: true });
          try {
            const res = await fetch("/api/card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                responses: state.responses.map(({ cardId, direction, reason }) => ({
                  cardId,
                  direction,
                  reason,
                })),
                generated: state.generated,
              }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { card } = (await res.json()) as { card: Card | null };

            const now = get();
            if (card && !now.generated.some((c) => c.id === card.id)) {
              set({
                generated: [...now.generated, card],
                queue: [...now.queue, card.id],
                failures: 0,
              });
            } else {
              set({ failures: 0 });
            }
          } catch (error) {
            console.warn("[deck] carte adaptative indisponible", error);
            set({ failures: get().failures + 1 });
          } finally {
            set({ fetching: false });
          }

          // Le jeune a pu répondre pendant la requête : on relance si la file s'est vidée.
          const after = get();
          if (after.queue.length === 0 && after.responses.length > state.responses.length) {
            void get().pump();
          }
        },

        ensurePair: () => {
          if (get().currentPairId) return;
          const next = nextTraitPair(get().traitResponses);
          set({ currentPairId: next?.id ?? null });
        },

        swipeCard: (direction, reason, latencyMs) => {
          const state = get();
          const card = get()
            .allCards()
            .find((c) => c.id === state.currentCardId);
          if (!card) return;

          const response: Response = {
            cardId: card.id,
            direction,
            reason,
            latencyMs,
            ts: Date.now(),
          };
          const responses = [...state.responses, response];

          const profile = deriveProfile({ ...state, responses });
          let pending = state.pendingConfirmation;
          if (!pending) {
            const proposal = proposeConfirmation(profile);
            if (proposal && !state.dismissed.includes(proposal)) {
              pending = proposal;
            }
          }

          const next = pickNext(state.queue, profile, responses);

          // Oui sur une carte d'intérêt : on demande « déjà fait ? » avant la suite.
          const awaitingExperience = direction === "right" && !reason;

          set({
            responses,
            currentCardId: next.id,
            queue: next.queue,
            pendingConfirmation: pending,
            lastResponse: { kind: "card", index: responses.length - 1 },
            startedAt: state.startedAt ?? Date.now(),
            awaitingExperience,
          });
          if (direction === "right" && isLived(reason)) addMatch(card.id, reason);
          if (!awaitingExperience) void get().pump();
        },

        answerExperience: (lived) => {
          if (!get().awaitingExperience) return;
          set({ awaitingExperience: false });
          get().setReason(lived ? "deja-une-fois" : "jamais-fait-mais-tente");
          void get().pump();
        },

        setReason: (reason) => {
          const state = get();
          const last = state.lastResponse;
          if (!last || last.kind !== "card") return;
          const response = state.responses[last.index];
          const responses = state.responses.map((r, i) =>
            i === last.index ? { ...r, reason } : r,
          );
          set({ responses });
          // « Déjà fait » = skill match.
          if (response?.direction === "right" && isLived(reason)) addMatch(response.cardId, reason);
        },

        resolvePending: (accepted) => {
          const state = get();
          const centerId = state.pendingConfirmation;
          if (!centerId) return;

          const confirmation: Confirmation = {
            centerId,
            accepted,
            ts: Date.now(),
          };
          const confirmations = [...state.confirmations, confirmation];
          const dismissed = accepted
            ? state.dismissed
            : [...state.dismissed, centerId];

          const profile = deriveProfile({ ...state, confirmations });
          // La carte courante est déjà affichée derrière l'overlay : on ne la
          // remplace que si elle porte sur un domaine qui vient de se fermer.
          const current = get()
            .allCards()
            .find((c) => c.id === state.currentCardId);
          const stillOpen =
            current &&
            Object.keys(current.centers).some((id) => {
              const d = profile.domains[id];
              return d && !d.confirmed && !d.rejected;
            });
          const next = stillOpen
            ? { id: state.currentCardId, queue: state.queue }
            : pickNext(state.queue, profile, state.responses);

          set({
            confirmations,
            dismissed,
            pendingConfirmation: null,
            currentCardId: next.id ?? state.currentCardId,
            queue: next.queue,
          });
        },

        swipePair: (direction, latencyMs) => {
          const state = get();
          const pair = PAIRS.find((p) => p.id === state.currentPairId);
          if (!pair) return;

          const traitResponses: TraitResponse[] = [
            ...state.traitResponses,
            { pairId: pair.id, direction, latencyMs, ts: Date.now() },
          ];
          const next = nextTraitPair(traitResponses);

          set({
            traitResponses,
            currentPairId: next?.id ?? null,
            lastResponse: { kind: "pair", index: traitResponses.length - 1 },
            startedAt: state.startedAt ?? Date.now(),
          });
        },

        startStyle: () => {
          const next = nextTraitPair(get().traitResponses);
          set({ currentPairId: next?.id ?? null });
        },

        resolvePendingSkills: () => {
          for (const match of get().skillMatches) {
            if (match.skillStatus !== "pending" || resolving.has(match.cardId)) continue;
            resolving.add(match.cardId);
            void (async () => {
              let skill: SkillRef | null = null;
              let ok = false;
              try {
                const res = await fetch("/api/skill", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ cardId: match.cardId }),
                });
                if (res.ok) {
                  skill = ((await res.json()) as { skill: SkillRef | null }).skill;
                  ok = true;
                }
              } catch (error) {
                console.warn("[matchs] compétence indisponible", error);
              } finally {
                resolving.delete(match.cardId);
              }
              // Échec réseau : on retentera plus tard (le match reste « pending »).
              if (!ok) return;
              set({
                skillMatches: get().skillMatches.map((m) =>
                  m.cardId === match.cardId
                    ? { ...m, skill: skill ?? undefined, skillStatus: skill ? "found" : "none" }
                    : m,
                ),
              });
            })();
          }
        },

        dismissToast: () => set({ toast: null }),

        markMatchesSeen: () =>
          set({ skillMatches: get().skillMatches.map((m) => (m.seen ? m : { ...m, seen: true })) }),

        loadJobs: async () => {
          const state = get();
          if (state.skillMatches.length === 0 || state.jobsLoading) return;
          const key = matchesKey(state.skillMatches);
          if (state.jobs?.key === key) return;

          set({ jobsLoading: true });
          try {
            const res = await fetch("/api/jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ matches: state.skillMatches.map(toMatchInput) }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { jobs } = (await res.json()) as { jobs: JobSuggestion[] };
            set({ jobs: { key, list: jobs } });
          } catch (error) {
            console.warn("[matchs] métiers indisponibles", error);
          } finally {
            set({ jobsLoading: false });
          }
          // Un match (ou sa compétence) a changé pendant la requête : on recalcule.
          if (matchesKey(get().skillMatches) !== key) void get().loadJobs();
        },

        startJobInterview: (job) => {
          const state = get();
          const id = interviewId(job.code);
          if (!state.interviews.some((i) => i.id === id)) {
            const supporting = state.skillMatches.filter((m) => job.cardIds.includes(m.cardId));
            const experiences = (supporting.length > 0 ? supporting : state.skillMatches.slice(-1))
              .slice(0, MAX_INTERVIEW_EXPERIENCES)
              .map((m) => ({ cardId: m.cardId, text: m.text, skill: m.skill }));
            const interview: Interview = {
              id,
              job: { code: job.code, label: job.label },
              experiences,
              questions: [],
              answers: [],
              // Les questions CV encore ouvertes et pas réservées par un autre récit en cours.
              cvFields: pickCvFields(state.cv, [
                ...state.cvSkipped,
                ...state.interviews.filter((i) => !i.finishedAt).flatMap((i) => i.cvFields),
              ]),
              step: 0,
              startedAt: Date.now(),
            };
            set({ interviews: [...state.interviews, interview] });
          }
          set({ activeInterview: id });
        },

        setInterviewQuestions: (id, questions, source) =>
          set({
            interviews: updateInterview(get().interviews, id, (i) =>
              i.questions.length > 0
                ? i
                : { ...i, questions, questionSource: source, answers: questions.map(() => "") },
            ),
          }),

        answerInterview: (id, index, answer) =>
          set({
            interviews: updateInterview(get().interviews, id, (i) => {
              const answers = [...i.answers];
              answers[index] = answer;
              return { ...i, answers };
            }),
          }),

        setInterviewStep: (id, step) =>
          set({ interviews: updateInterview(get().interviews, id, (i) => ({ ...i, step })) }),

        finishInterview: (id) =>
          set({
            interviews: updateInterview(get().interviews, id, (i) => ({
              ...i,
              finishedAt: i.finishedAt ?? Date.now(),
            })),
            activeInterview: null,
          }),

        leaveInterview: () => set({ activeInterview: null }),

        setCvAnswer: (field, answer) => set({ cv: { ...get().cv, [field]: answer } }),

        skipCv: (field) => {
          const state = get();
          if (state.cv[field]?.trim() || state.cvSkipped.includes(field)) return;
          set({ cvSkipped: [...state.cvSkipped, field] });
        },

        reset: () => {
          set({ ...initialState });
        },
      };
    },
    {
      name: "declic-session-v1",
      version: 6,
      // v1 -> v2 : swipe adaptatif. v3 -> v4 : match de compétence + étape 2.
      // v4 -> v5 : questions CV réparties entre les entretiens, reprise possible.
      // v5 -> v6 : skill matches en mémoire (« déjà fait »), entretiens par métier.
      migrate: (persisted, version) => {
        const state = {
          generated: [],
          queue: [],
          interviews: [],
          activeInterview: null,
          cv: {},
          cvSkipped: [],
          skillMatches: [],
          jobs: null,
          ...(persisted as object),
        } as unknown as SessionState & Record<string, unknown>;
        for (const old of ["cvDone", "skillMatch", "matchedSkills", "creuserAsked"]) delete state[old];

        if (version < 6) {
          // Les entretiens d'avant portaient sur une carte « creuser », pas sur un métier.
          state.interviews = [];
          state.activeInterview = null;
          // Les « déjà fait » déjà donnés deviennent des skill matches.
          const cards = new Map([...CARDS, ...state.generated].map((c) => [c.id, c]));
          const matches: SkillMatch[] = [];
          for (const r of state.responses ?? []) {
            const card = cards.get(r.cardId);
            if (!card || r.direction !== "right" || !isLived(r.reason)) continue;
            if (card.target?.mode === "creuser" || matches.some((m) => m.cardId === card.id)) continue;
            matches.push({ ...makeMatch(card, r.reason), at: r.ts, seen: true });
          }
          state.skillMatches = matches;
        }
        return state;
      },
      // Les champs transitoires ne sont jamais persistés.
      partialize: (state) => {
        const rest: Partial<SessionState> = { ...state };
        delete rest.fetching;
        delete rest.failures;
        delete rest.awaitingExperience;
        delete rest.toast;
        delete rest.jobsLoading;
        return rest;
      },
    },
  ),
);

export function freshProfile(): Profile {
  return createProfile();
}
