"use client";

import { DEMO_USER, saveDemoUser } from "./dossier/demo";
import { useSession } from "./store";

export const AUTODEMO_KEY = "orientis-autodemo";
export const AUTODEMO_EVENT = "orientis-autodemo-change";

export function isAutoDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(AUTODEMO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Démarre une démo propre : persona Sam, session vide, puis le deck. */
export function startAutoDemo(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTODEMO_KEY, "1");
  } catch {
    // mode privé strict : la démo marche quand même dans l'onglet.
  }
  saveDemoUser(DEMO_USER);
  useSession.getState().reset();
  window.dispatchEvent(new Event(AUTODEMO_EVENT));
}

export function stopAutoDemo(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTODEMO_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(AUTODEMO_EVENT));
}
