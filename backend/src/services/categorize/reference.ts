import fs from 'fs';
import path from 'path';
import { embeddingText } from '../../domain/categorize';
import { MODEL_DIR, modelVersion } from './encoder';

/**
 * The shipped reference set: well-known merchants per category, how banks print them and how people
 * type them. Its vectors are precomputed by scripts/build-reference-vectors.ts, because embedding
 * a few thousand strings on a small VPS would take tens of seconds.
 */
type ReferenceFile = Record<string, { merchant: string; bank: string[]; typed: string[] }[]>;

export interface ReferenceEntry {
  text: string;
  category: string;
}

export const VECTORS_FILE = path.join(MODEL_DIR, 'reference.vectors.bin');
export const META_FILE = path.join(MODEL_DIR, 'reference.vectors.json');

function readReference(): ReferenceFile {
  return JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'reference.json'), 'utf8'));
}

/** Category names of the reference set, in file order. */
export function referenceCategories(): string[] {
  return Object.keys(readReference());
}

/** Distinct prepared texts per category, in the order their vectors are stored. */
export function referenceEntries(): ReferenceEntry[] {
  const entries: ReferenceEntry[] = [];
  for (const [category, merchants] of Object.entries(readReference())) {
    const seen = new Set<string>();
    for (const merchant of merchants)
      for (const raw of [...merchant.bank, ...merchant.typed]) {
        const text = embeddingText(raw);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        entries.push({ text, category });
      }
  }
  return entries;
}

export interface ReferenceVectors {
  entries: ReferenceEntry[];
  vectors: Float32Array[];
}

let cached: ReferenceVectors | null = null;

/** Throws when the vectors were built by another model or from another reference.json. */
export function loadReferenceVectors(): ReferenceVectors {
  if (cached) return cached;
  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as { model: string; count: number; dim: number };
  const entries = referenceEntries();
  if (meta.model !== modelVersion() || meta.count !== entries.length) {
    throw new Error('reference.vectors.bin is stale: run scripts/build-reference-vectors.ts');
  }
  const buffer = fs.readFileSync(VECTORS_FILE);
  const all = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  const vectors = entries.map((_, i) => all.subarray(i * meta.dim, (i + 1) * meta.dim));
  cached = { entries, vectors };
  return cached;
}
