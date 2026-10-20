import { useOutletContext, useParams } from 'react-router-dom';
import type { Card, Mortgage } from './types/v2';

export interface CardsOutletContext {
  cards: Card[];
  mortgages: Mortgage[];
  reloadMortgages: () => void;
}

/** Card from the current `/cards/:cardId` route, provided by MainLayout. */
export function useCurrentCard(): Card | null {
  const { cardId } = useParams<{ cardId: string }>();
  const context = useOutletContext<CardsOutletContext | undefined>();
  return context?.cards.find((card) => card.id === cardId) ?? null;
}
