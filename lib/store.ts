"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
import { createProfile, computeProfile, proposeConfirmation, resolveConfirmation } from "./score";
import { nextCard, nextTraitPair } from "./select";
import type {
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
};

function deriveProfile(state: {
  responses: Response[];
  traitResponses: TraitResponse[];
  confirmations: Confirmation[];
}): Profile {
  let profile = computeProfile(state.responses, state.traitResponses);
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
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      getProfile: () => deriveProfile(get()),

      ensureCard: () => {
        if (get().currentCardId) return;
        const next = nextCard(deriveProfile(get()), get().responses);
        set({ currentCardId: next?.id ?? null });
      },

      ensurePair: () => {
        if (get().currentPairId) return;
        const next = nextTraitPair(get().traitResponses);
        set({ currentPairId: next?.id ?? null });
      },

      swipeCard: (direction, reason, latencyMs) => {
        const state = get();
        const card = CARDS.find((c) => c.id === state.currentCardId);
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

        const next =
          responses.length >= MAX_RESPONSES
            ? null
            : nextCard(profile, responses);

        set({
          responses,
          currentCardId: next?.id ?? null,
          pendingConfirmation: pending,
          lastResponse: { kind: "card", index: responses.length - 1 },
          startedAt: state.startedAt ?? Date.now(),
        });
      },

      setReason: (reason) => {
        const state = get();
        const last = state.lastResponse;
        if (!last || last.kind !== "card") return;
        const responses = state.responses.map((r, i) =>
          i === last.index ? { ...r, reason } : r,
        );
        set({ responses });
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
        const next =
          state.responses.length >= MAX_RESPONSES
            ? null
            : nextCard(profile, state.responses);

        set({
          confirmations,
          dismissed,
          pendingConfirmation: null,
          currentCardId: next?.id ?? state.currentCardId,
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
      version: 1,
    },
  ),
);

export function freshProfile(): Profile {
  return createProfile();
}
