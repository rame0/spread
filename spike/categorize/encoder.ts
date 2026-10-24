import { env, pipeline } from '@huggingface/transformers';
import { stripCity, transliterate } from './normalize.ts';

// Models without a transformers.js build are assembled under ./models/<repo> by hand.
env.localModelPath = new URL('./models/', import.meta.url).pathname;

const MODELS: Record<string, { repo: string; prefix: string; pooling?: 'mean' | 'cls' }> = {
  user2: { repo: 'onnx-community/USER2-small-ONNX', prefix: 'classification: ' },
  e5: { repo: 'Xenova/multilingual-e5-small', prefix: 'query: ' },
  frida: { repo: 'sergeyzh/rubert-mini-frida', prefix: 'categorize: ' },
  'frida-base': { repo: 'local/frida-onnx', prefix: 'categorize: ' },
  'frida-ft': { repo: 'local/frida-ft-onnx', prefix: 'categorize: ' },
  'frida-ft2': { repo: 'local/frida-ft2-onnx', prefix: 'categorize: ' },
  'frida-pairs': { repo: 'local/frida-pairs-onnx', prefix: 'categorize: ' },
  'frida-general': { repo: 'local/frida-general-onnx', prefix: 'categorize: ' },
  'frida-general-cat': { repo: 'local/frida-general-cat-onnx', prefix: 'categorize: ' },
  granite: { repo: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX', prefix: '', pooling: 'cls' },
};

/** No model at all: hashed character 3-grams of the transliterated, lower-cased text. */
function ngrams(text: string) {
  const v = new Float32Array(4096);
  const s = ` ${transliterate(text).toLowerCase().replace(/[^а-яё0-9]+/g, ' ')} `;
  for (let i = 0; i + 3 <= s.length; i++) {
    let h = 2166136261;
    for (const c of s.slice(i, i + 3)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    v[(h >>> 0) % v.length] += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export async function loadEncoder(name: string) {
  if (name === 'ngram') return async (text: string) => ngrams(text);
  if (name.startsWith('combo')) {
    // Concatenated unit vectors: the dot product is the sum of both similarities, n-grams weighted by `w`.
    const w = Math.sqrt(Number(name.split(':')[1] ?? 1));
    const model = await loadEncoder(name.split(':')[2] ?? 'user2');
    return async (text: string) => {
      const v = Float32Array.from([...(await model(text)), ...ngrams(text).map((x) => x * w)]);
      return v.map((x) => x / Math.sqrt(1 + w * w));
    };
  }
  const { repo, prefix, pooling = 'mean' } = MODELS[name];
  const extractor = await pipeline('feature-extraction', repo, { dtype: 'int8' });
  const translit = process.env.TRANSLIT === '1';
  const city = process.env.CITY === '1';
  const prepare = (text: string) => (translit ? transliterate(city ? stripCity(text) : text) : text);
  return async (text: string) =>
    (await extractor(prefix + prepare(text), { pooling, normalize: true })).data as Float32Array;
}

export const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);
