import { createHash } from 'crypto';
import path from 'path';
import { and, desc, eq } from 'drizzle-orm';
import {
  cards,
  db,
  statementImports,
  statementOperations,
} from '../db';
import { findCardById } from '../repositories/cardRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { addDeposit } from './depositService';
import { addPurchase } from './purchaseService';
import { latestEventDate, reconcileBalanceInTransaction } from './reconciliationService';
import { parseStatementPdf, StatementParseError, type ParsedStatementOperation } from './statementParser';

const INSTALLMENT_STATEMENTS_ERROR = 'Импорт выписок недоступен для карт рассрочки';

export interface StatementPreviewOperation extends ParsedStatementOperation {
  duplicate: boolean;
  duplicateReason?: 'already_imported' | 'matching_event';
}

const today = () => new Date().toISOString().slice(0, 10);
const eventKey = (kind: string, date: string, amount: number) =>
  `${kind}|${date}|${Math.round(amount * 100)}`;

function safeFileName(value: string): string {
  return path
    .basename(value)
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .slice(0, 255) || 'statement.pdf';
}

function fileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function previewStatement(
  cardId: string,
  userId: string,
  file: { buffer: Buffer; originalname: string }
) {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  if (card.kind === 'installment') throw new StatementParseError(INSTALLMENT_STATEMENTS_ERROR);
  const parsed = await parseStatementPdf(file.buffer);
  const hash = fileHash(file.buffer);
  const [knownRows, existingImportRows, purchases, deposits, lastEvent] = await Promise.all([
    db
      .select({ fingerprint: statementOperations.fingerprint })
      .from(statementOperations)
      .where(eq(statementOperations.cardId, cardId)),
    db
      .select({ reconciliationId: statementImports.reconciliationId })
      .from(statementImports)
      .where(and(eq(statementImports.cardId, cardId), eq(statementImports.fileHash, hash)))
      .limit(1),
    findPurchasesByCardId(cardId, parsed.periodStart, parsed.periodEnd),
    findDepositsByCardId(cardId, parsed.periodStart, parsed.periodEnd),
    latestEventDate(cardId),
  ]);
  const known = new Set(knownRows.map((row) => row.fingerprint));
  const existingEvents = new Map<string, number>();
  for (const purchase of purchases) {
    const key = eventKey('purchase', purchase.purchaseDate, purchase.amount);
    existingEvents.set(key, (existingEvents.get(key) ?? 0) + 1);
  }
  for (const deposit of deposits) {
    const key = eventKey('deposit', deposit.depositDate, deposit.amount);
    existingEvents.set(key, (existingEvents.get(key) ?? 0) + 1);
  }

  const operations: StatementPreviewOperation[] = parsed.operations.map((operation) => {
    if (known.has(operation.fingerprint)) {
      const key = eventKey(operation.kind, operation.operationDate, operation.amount);
      const matches = existingEvents.get(key) ?? 0;
      if (matches > 0) existingEvents.set(key, matches - 1);
      return { ...operation, duplicate: true, duplicateReason: 'already_imported' };
    }
    const key = eventKey(operation.kind, operation.operationDate, operation.amount);
    const matches = existingEvents.get(key) ?? 0;
    if (matches > 0) {
      existingEvents.set(key, matches - 1);
      return { ...operation, duplicate: true, duplicateReason: 'matching_event' };
    }
    return { ...operation, duplicate: false };
  });
  const reconciliationAlreadyImported = Boolean(existingImportRows[0]?.reconciliationId);
  const reconciliationAllowed =
    !reconciliationAlreadyImported &&
    parsed.periodEnd <= today() &&
    (!lastEvent || parsed.periodEnd >= lastEvent);

  return {
    fileName: safeFileName(file.originalname),
    fileHash: hash,
    ...parsed,
    reconciliationAllowed,
    reconciliationAlreadyImported,
    lastEventDate: lastEvent,
    operations,
  };
}

export async function importStatement(
  cardId: string,
  userId: string,
  file: { buffer: Buffer; originalname: string },
  selectedFingerprints: string[],
  reconcile: boolean
) {
  const existingCard = await findCardById(cardId);
  if (!existingCard || existingCard.userId !== userId) return null;
  if (existingCard.kind === 'installment') throw new StatementParseError(INSTALLMENT_STATEMENTS_ERROR);
  const parsed = await parseStatementPdf(file.buffer);
  const requested = new Set(selectedFingerprints);
  if (requested.size !== selectedFingerprints.length) throw new Error('Список выбранных операций содержит повторы');
  const available = new Map(parsed.operations.map((operation) => [operation.fingerprint, operation]));
  if ([...requested].some((fingerprint) => !available.has(fingerprint))) {
    throw new Error('Выбранная операция не найдена в PDF');
  }
  const hash = fileHash(file.buffer);

  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(cards).where(eq(cards.id, cardId)).for('update').limit(1);
    if (!card || card.userId !== userId) return null;
    const [createdImport] = await tx
      .insert(statementImports)
      .values({
        cardId,
        bank: parsed.bank,
        fileName: safeFileName(file.originalname),
        fileHash: hash,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        actualDebt: parsed.actualDebt,
      })
      .onConflictDoNothing({ target: [statementImports.cardId, statementImports.fileHash] })
      .returning();
    const [statementImport] = createdImport
      ? [createdImport]
      : await tx
          .select()
          .from(statementImports)
          .where(and(eq(statementImports.cardId, cardId), eq(statementImports.fileHash, hash)))
          .limit(1);
    if (!statementImport) throw new Error('Не удалось создать запись импорта выписки');

    let importedPurchases = 0;
    let importedDeposits = 0;
    let skippedDuplicates = 0;
    const selected = parsed.operations
      .filter((operation) => requested.has(operation.fingerprint))
      .sort((a, b) =>
        `${a.operationDate}T${a.operationTime ?? ''}`.localeCompare(
          `${b.operationDate}T${b.operationTime ?? ''}`
        )
      );
    for (const operation of selected) {
      const [sourceRow] = await tx
        .insert(statementOperations)
        .values({
          statementImportId: statementImport.id,
          cardId,
          fingerprint: operation.fingerprint,
          sourceId: operation.sourceId ?? null,
          operationDate: operation.operationDate,
          operationTime: operation.operationTime ?? null,
          kind: operation.kind,
          amount: operation.amount,
          description: operation.description || null,
        })
        .onConflictDoNothing({
          target: [statementOperations.cardId, statementOperations.fingerprint],
        })
        .returning();
      if (!sourceRow) {
        skippedDuplicates += 1;
        continue;
      }
      if (operation.kind === 'purchase') {
        const purchase = await addPurchase(cardId, {
          purchaseDate: operation.operationDate,
          amount: operation.amount,
          description: operation.description,
        }, userId, tx);
        await tx
          .update(statementOperations)
          .set({ purchaseId: purchase.id })
          .where(eq(statementOperations.id, sourceRow.id));
        importedPurchases += 1;
      } else {
        const deposit = await addDeposit(cardId, {
          depositDate: operation.operationDate,
          amount: operation.amount,
        }, userId, tx);
        await tx
          .update(statementOperations)
          .set({ depositId: deposit.id })
          .where(eq(statementOperations.id, sourceRow.id));
        importedDeposits += 1;
      }
    }

    let reconciliationCreated = false;
    if (reconcile && !statementImport.reconciliationId) {
      const reconciliation = await reconcileBalanceInTransaction(cardId, {
        reconciliationDate: parsed.periodEnd,
        actualDebt: parsed.actualDebt,
      }, userId, tx, card);
      await tx
        .update(statementImports)
        .set({ reconciliationId: reconciliation.id })
        .where(eq(statementImports.id, statementImport.id));
      reconciliationCreated = true;
    }
    return {
      importedPurchases,
      importedDeposits,
      skippedDuplicates,
      reconciliationCreated,
    };
  });
}

export async function getStatementImports(cardId: string, userId: string) {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  return db
    .select({
      id: statementImports.id,
      bank: statementImports.bank,
      fileName: statementImports.fileName,
      periodStart: statementImports.periodStart,
      periodEnd: statementImports.periodEnd,
      actualDebt: statementImports.actualDebt,
      reconciliationId: statementImports.reconciliationId,
      createdAt: statementImports.createdAt,
    })
    .from(statementImports)
    .where(eq(statementImports.cardId, cardId))
    .orderBy(desc(statementImports.createdAt));
}
