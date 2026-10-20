import { useOutletContext, useParams } from 'react-router-dom';
import type { Card } from './types/v2';

export interface CardsOutletContext {
  cards: Card[];
}

/** Card from the current `/cards/:cardId` route, provided by MainLayout. */
export function useCurrentCard(): Card | null {
  const { cardId } = useParams<{ cardId: string }>();
  const context = useOutletContext<CardsOutletContext | undefined>();
  return context?.cards.find((card) => card.id === cardId) ?? null;
}
