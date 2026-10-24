import fs from 'node:fs';
import { items } from './dataset.ts';

/** How often the teacher agrees with the hand-made gold labels, overall and when it says it is confident. */
const teacher: Record<string, { category: string; confident: boolean }> = JSON.parse(
  fs.readFileSync(new URL('./data/teacher.json', import.meta.url), 'utf8')
);
const labelled = items.filter((i) => teacher[i.text]);
const ok = labelled.filter((i) => i.gold.includes(teacher[i.text].category));
const confident = labelled.filter((i) => teacher[i.text].confident);
const confidentOk = confident.filter((i) => i.gold.includes(teacher[i.text].category));
console.log(`teacher vs gold: ${ok.length}/${labelled.length} of ${items.length} gold items`);
console.log(`confident: ${confidentOk.length}/${confident.length}`);
for (const i of labelled.filter((i) => !ok.includes(i)))
  console.log(`  ${i.text} → ${teacher[i.text].category}${teacher[i.text].confident ? ' (confident)' : ''} (want ${i.gold.join(' | ')})`);
