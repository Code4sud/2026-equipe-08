import rawPregen from "../../data/rome/explorer-cards.json";
import type { CardDraft } from "./target";

/**
 * Cartes explorer pré-écrites par le LLM (scripts/pregen-cards.ts), une par
 * compétence ciblable. Servent quand aucun LLM n'est disponible (mode mock,
 * Vercel sans clé, LLM en échec) : le jeune ne voit jamais un libellé ROME brut.
 * Côté serveur uniquement.
 */
type PregenFile = { version: string; cards: Record<string, CardDraft> };

const PREGEN = rawPregen as unknown as PregenFile;

export function pregenCard(macro: number): CardDraft | undefined {
  return PREGEN.cards[String(macro)];
}

export function pregenCount(): number {
  return Object.keys(PREGEN.cards).length;
}
