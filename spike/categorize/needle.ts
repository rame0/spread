import { Needle, tool } from 'cactus-needle';
import { categories, items, report, type Item, type Prediction } from './dataset.ts';

const needle = new Needle({
  stateless: true,
  system: 'Descriptions of personal expenses are mostly in Russian, written by hand or taken from bank statements.',
  tools: {
    set_category: tool({
      description: 'Assign the expense description to one of the user expense categories.',
      inputSchema: {
        type: 'object',
        properties: { category: { type: 'string', enum: categories, description: 'Expense category' } },
        required: ['category'],
      },
    }),
  },
});

const results: { item: Item; prediction: Prediction }[] = [];
try {
  for (const item of items) {
    const start = performance.now();
    const out = await needle.generate({ prompt: `Expense: ${item.text}` });
    const call = out.toolCalls[0] ?? out.suppressedToolCalls?.[0];
    results.push({
      item,
      prediction: {
        category: (call?.input as { category?: string } | undefined)?.category ?? null,
        confidence: out.confidence,
        ms: performance.now() - start,
      },
    });
  }
  report('needle-tool', results);
} finally {
  await needle.close();
}
