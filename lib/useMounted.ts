"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false au rendu serveur, true après hydratation.
 * Évite les mismatches localStorage sans setState dans un effet.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
