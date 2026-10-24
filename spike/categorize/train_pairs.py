"""Fine-tunes rubert-mini-frida on (anchor, positive) text pairs with in-batch negatives.

Usage: train_pairs.py <output name> [pairs file in data/]. Older pair files with bank/typed keys work too.

Unlike SetFit it never sees categories: it only learns that a merchant and the ways people type it
are the same thing, which is what the nearest-example lookup needs.
"""

import json
import sys
from pathlib import Path

from datasets import Dataset
from sentence_transformers import SentenceTransformer, SentenceTransformerTrainer, SentenceTransformerTrainingArguments
from sentence_transformers.training_args import BatchSamplers
from sentence_transformers.losses import MultipleNegativesRankingLoss

HERE = Path(__file__).parent
PREFIX = "categorize: "
out = HERE / "models" / "local" / (sys.argv[1] if len(sys.argv) > 1 else "frida-pairs")

source = sys.argv[2] if len(sys.argv) > 2 else "pairs.jsonl"
pairs = [json.loads(line) for line in (HERE / "data" / source).read_text().splitlines()]
dataset = Dataset.from_list(
    [{"anchor": PREFIX + p.get("anchor", p.get("typed")), "positive": PREFIX + p.get("positive", p.get("bank"))} for p in pairs]
)

model = SentenceTransformer("sergeyzh/rubert-mini-frida")
args = SentenceTransformerTrainingArguments(
    output_dir=str(out / "checkpoints"), num_train_epochs=2, per_device_train_batch_size=64,
    learning_rate=2e-5, warmup_ratio=0.1, save_strategy="no", report_to=[], seed=42,
    # The same bank string or category name twice in a batch would be its own false negative.
    batch_sampler=BatchSamplers.NO_DUPLICATES,
)
SentenceTransformerTrainer(model=model, args=args, train_dataset=dataset, loss=MultipleNegativesRankingLoss(model)).train()
model.save(str(out / "st"))
print(f"saved {out / 'st'}")
