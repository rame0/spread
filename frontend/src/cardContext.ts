import type { Card, Mortgage } from './types/v2';

export interface CardsOutletContext {
  cards: Card[];
  mortgages: Mortgage[];
  reloadMortgages: () => void;
  openAddCard: () => void;
  openAddMortgage: () => void;
  openQuickAdd: () => void;
}
