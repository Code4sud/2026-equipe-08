"use client";

import { useRouter } from "next/navigation";
import { useSession } from "./store";

/**
 * Efface la session locale et repart sur un deck vierge.
 * Confirmation obligatoire : la session contient les réponses du jeune.
 */
export function useRestart() {
  const router = useRouter();

  return () => {
    const ok = window.confirm(
      "Recommencer depuis le début ?\n\nTa session actuelle sera effacée (réponses, confirmations, style).",
    );
    if (!ok) return;

    useSession.getState().reset();
    try {
      localStorage.removeItem("declic-session-v1");
    } catch {
      // localStorage peut être indisponible (mode privé strict).
    }

    // Si on reset depuis /deck, la route ne remonte pas : il faut
    // sélectionner une carte immédiatement.
    useSession.getState().ensureCard();
    router.push("/deck");
  };
}
