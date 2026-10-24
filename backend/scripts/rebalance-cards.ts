/**
 * Allocates the payments of every credit card again in date order (see rebalanceCard).
 * Run once after statements were imported back-dated: pnpm run cards:rebalance
 */

import { ne } from 'drizzle-orm';
import { db, cards } from '../src/db';
import { findBucketsByCardId } from '../src/repositories/graceBucketRepository';
import { rebalanceCard } from '../src/services/depositService';

async function main() {
  const rows = await db.select({ id: cards.id, name: cards.name }).from(cards).where(ne(cards.kind, 'installment'));
  for (const card of rows) {
    const before = await findBucketsByCardId(card.id);
    await rebalanceCard(card.id);
    const after = await findBucketsByCardId(card.id);
    const changed = after.filter((row) => before.find((old) => old.id === row.id)?.principalRemaining !== row.principalRemaining);
    console.log(`${card.name}: ${changed.length} periods changed`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
