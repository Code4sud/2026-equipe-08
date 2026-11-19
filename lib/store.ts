"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
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

  ensureCard: () => void;
  ensurePair: () => void;
  swipeCard: (
    direction: SwipeDirection,
    reason?: SwipeReason,
    latencyMs?: number,
  ) => void;
  setReason: (reason: SwipeReason) => void;
  resolvePending: (accepted: boolean) => void;
  swipePair: (direction: SwipeDirection, latencyMs?: number) => void;
  startStyle: () => void;
  reset: () => void;
  getProfile: () => Profile;
  /** Toutes les cartes connues : banque fixe + générées. */
  allCards: () => Card[];
  /** Demande la prochaine carte adaptative si la file est vide. */
  pump: () => Promise<void>;
};

/** Le swipe adaptatif démarre après quelques cartes de la banque (zéro latence). */
const ADAPTIVE_WARMUP = 2;
/** Plafond de cartes générées par session. */
const MAX_GENERATED = 18;
const MAX_FAILURES = 3;

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
};

/**
 * Carte suivante : d'abord une carte adaptative prête dans la file, sinon la
 * banque fixe (sélection UCB existante). La file n'attend jamais le LLM.
 */
function pickNext(
  queue: string[],
  profile: Profile,
  responses: Response[],
): { id: string | null; queue: string[] } {
  if (responses.length >= MAX_RESPONSES) return { id: null, queue };
  const seen = new Set(responses.map((r) => r.cardId));
  const queued = queue.find((id) => !seen.has(id));
  if (queued) {
    return { id: queued, queue: queue.filter((id) => id !== queued && !seen.has(id)) };
  }
  return { id: nextCard(profile, responses)?.id ?? null, queue };
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      getProfile: () => deriveProfile(get()),

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

        // Le jeune a pu répondre pendant la requête (ex. "déjà fait") :
        // on relance si la file s'est vidée entre-temps.
        if (get().queue.length === 0 && get().responses.length > state.responses.length) {
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

        set({
          responses,
          currentCardId: next.id,
          queue: next.queue,
          pendingConfirmation: pending,
          lastResponse: { kind: "card", index: responses.length - 1 },
          startedAt: state.startedAt ?? Date.now(),
        });
        void get().pump();
      },

      setReason: (reason) => {
        const state = get();
        const last = state.lastResponse;
        if (!last || last.kind !== "card") return;
        const responses = state.responses.map((r, i) =>
          i === last.index ? { ...r, reason } : r,
        );
        set({ responses });
        // "Déjà fait" ouvre une carte "creuser" : on la prépare tout de suite.
        if (reason === "deja-souvent" || reason === "deja-une-fois") {
          void get().pump();
        }
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

      reset: () => {
        set({ ...initialState });
      },
    }),
    {
      name: "declic-session-v1",
      version: 2,
      // v1 -> v2 : ajout du swipe adaptatif.
      migrate: (persisted) =>
        ({
          ...(persisted as object),
          generated: [],
          queue: [],
        }) as unknown as SessionState,
      // Les champs transitoires ne sont jamais persistés.
      partialize: (state) => {
        const rest: Partial<SessionState> = { ...state };
        delete rest.fetching;
        delete rest.failures;
        return rest;
      },
    },
  ),
);

export function freshProfile(): Profile {
  return createProfile();
}
