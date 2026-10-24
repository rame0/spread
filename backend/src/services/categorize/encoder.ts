import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { InferenceSession } from 'onnxruntime-node';
import type { Tokenizer } from '@huggingface/tokenizers';
import { config } from '../../config/env';

/** backend/models/frida-categorize, both from src/ under ts-node and from dist/. */
export const MODEL_DIR = path.resolve(__dirname, '..', '..', '..', 'models', 'frida-categorize');
const MODEL_FILE = path.join(MODEL_DIR, 'onnx', 'model_int8.onnx');
/** The model was fine-tuned with this prefix; without it the vectors drift. */
const PREFIX = 'categorize: ';
const MAX_TOKENS = 128;

interface Model {
  session: InferenceSession;
  tokenizer: Tokenizer;
  ort: typeof import('onnxruntime-node');
}

let loading: Promise<Model> | null = null;
let active = 0;
let idleTimer: NodeJS.Timeout | null = null;
let version: string | null = null;

/** Short hash of the weights; stored next to every cached embedding so a new model invalidates them. */
export function modelVersion(): string {
  version ??= createHash('sha256').update(fs.readFileSync(MODEL_FILE)).digest('hex').slice(0, 12);
  return version;
}

async function load(): Promise<Model> {
  // onnxruntime 1.30 uploads usage telemetry unless told not to; this app stays local.
  process.env.ORT_DISABLE_TELEMETRY ??= '1';
  const ort = await import('onnxruntime-node');
  const { Tokenizer } = await import('@huggingface/tokenizers');
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(MODEL_DIR, file), 'utf8'));
  const tokenizer = new Tokenizer(read('tokenizer.json'), read('tokenizer_config.json'));
  // One thread: the VPS is shared, and a single short description is fast enough on one core.
  const session = await ort.InferenceSession.create(MODEL_FILE, { intraOpNumThreads: 1, interOpNumThreads: 1 });
  return { session, tokenizer, ort };
}

/** The model takes ~200 MB of RAM, so it is released after a quiet period and loaded again on demand. */
function scheduleUnload() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (active > 0 || !loading) return;
    const pending = loading;
    loading = null;
    await (await pending).session.release();
  }, config.categorizeIdleMs);
  idleTimer.unref();
}

/** Unit-length sentence embedding: mean of the last hidden states. */
export async function embed(text: string): Promise<Float32Array> {
  active++;
  try {
    loading ??= load().catch((error) => {
      loading = null;
      throw error;
    });
    const { session, tokenizer, ort } = await loading;
    const encoded = tokenizer.encode(PREFIX + text, { return_token_type_ids: true });
    let ids = encoded.ids;
    let types = encoded.token_type_ids;
    // Keep the closing [SEP] when cutting a very long description.
    if (ids.length > MAX_TOKENS) {
      ids = [...ids.slice(0, MAX_TOKENS - 1), ids[ids.length - 1]];
      types = types.slice(0, MAX_TOKENS);
    }
    const tensor = (values: number[]) => new ort.Tensor('int64', BigInt64Array.from(values, BigInt), [1, values.length]);
    const output = await session.run({
      input_ids: tensor(ids),
      attention_mask: tensor(ids.map(() => 1)),
      token_type_ids: tensor(types),
    });
    const hidden = output.last_hidden_state.data as Float32Array;
    const [, length, dim] = output.last_hidden_state.dims as number[];
    const vector = new Float32Array(dim);
    for (let t = 0; t < length; t++) for (let i = 0; i < dim; i++) vector[i] += hidden[t * dim + i];
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) vector[i] /= norm;
    return vector;
  } finally {
    active--;
    scheduleUnload();
  }
}
