"""Fine-tunes rubert-mini-frida contrastively (SetFit) on data/train.jsonl and saves the encoder.

Only the sentence encoder is kept: the app classifies by nearest confirmed examples, so the
classification head SetFit also trains is not needed.
"""

import json
import sys
from pathlib import Path

from datasets import Dataset
from setfit import SetFitModel, Trainer, TrainingArguments

HERE = Path(__file__).parent
PREFIX = "categorize: "
out = HERE / "models" / "local" / (sys.argv[1] if len(sys.argv) > 1 else "frida-ft")

rows = [json.loads(line) for line in (HERE / "data" / "train.jsonl").read_text().splitlines()]
dataset = Dataset.from_list([{"text": PREFIX + r["text"], "label": r["label"]} for r in rows])

model = SetFitModel.from_pretrained("sergeyzh/rubert-mini-frida")
args = TrainingArguments(batch_size=64, num_epochs=1, num_iterations=10, body_learning_rate=2e-5, seed=42)
trainer = Trainer(model=model, args=args, train_dataset=dataset, column_mapping={"text": "text", "label": "label"})
trainer.train()
model.model_body.save(str(out / "st"))
print(f"saved {out / 'st'}")
