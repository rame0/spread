/**
 * Precomputes the embeddings of models/frida-categorize/reference.json for the running app.
 * Rerun after changing the model or the reference set: pnpm run categorize:reference
 */

import * as fs from 'fs';
import { embed, modelVersion } from '../src/services/categorize/encoder';
import { META_FILE, VECTORS_FILE, referenceEntries } from '../src/services/categorize/reference';

async function main() {
  const entries = referenceEntries();
  const vectors: Float32Array[] = [];
  for (const [i, entry] of entries.entries()) {
    vectors.push(await embed(entry.text));
    if ((i + 1) % 500 === 0) console.log(`${i + 1}/${entries.length}`);
  }
  const dim = vectors[0].length;
  const all = new Float32Array(entries.length * dim);
  vectors.forEach((vector, i) => all.set(vector, i * dim));
  fs.writeFileSync(VECTORS_FILE, Buffer.from(all.buffer));
  fs.writeFileSync(META_FILE, JSON.stringify({ model: modelVersion(), count: entries.length, dim }) + '\n');
  console.log(`${entries.length} vectors of ${dim} written`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
