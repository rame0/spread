/** @jest-environment ./jest.native-arrays-env.js */
import { dot, embeddingText } from '../../domain/categorize';
import { embed } from '../categorize/encoder';
import { loadReferenceVectors } from '../categorize/reference';

describe('categorize encoder', () => {
  it('ships reference vectors built by the shipped model', () => {
    expect(() => loadReferenceVectors()).not.toThrow();
  });

  it('reproduces the stored reference vectors', async () => {
    const { entries, vectors } = loadReferenceVectors();
    // int8 kernels differ between CPUs (VNNI or not), so vectors built elsewhere match only closely.
    expect(dot(await embed(entries[0].text), vectors[0])).toBeGreaterThan(0.98);
  });

  it('puts a bank string closer to how people type it than to an unrelated merchant', async () => {
    const bank = await embed(embeddingText('Оплата в PYATEROCHKA 1234 Moscow RUS'));
    const typed = await embed(embeddingText('пятерочка'));
    const other = await embed(embeddingText('хостинг'));
    expect(dot(bank, typed)).toBeGreaterThan(dot(bank, other) + 0.2);
  });
});
