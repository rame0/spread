"""Exports a BERT-style encoder to the layout transformers.js loads: models/<name>/{tokenizer, onnx/model_int8.onnx}."""

import sys
from pathlib import Path

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModel, AutoTokenizer

src, name = sys.argv[1], sys.argv[2]
dst = Path(__file__).parent / "models" / name
(dst / "onnx").mkdir(parents=True, exist_ok=True)

tokenizer = AutoTokenizer.from_pretrained(src)
model = AutoModel.from_pretrained(src).eval()
tokenizer.save_pretrained(dst)
model.config.save_pretrained(dst)



class Encoder(torch.nn.Module):
    """Positional inputs and a single output, which is what the ONNX tracer handles."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.model(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids).last_hidden_state


sample = tokenizer(["categorize: пример"], return_tensors="pt")
inputs = {k: sample[k] for k in ("input_ids", "attention_mask", "token_type_ids") if k in sample}
axes = {k: {0: "batch", 1: "sequence"} for k in inputs}
torch.onnx.export(
    Encoder(model),
    tuple(inputs.values()),
    dst / "onnx" / "model.onnx",
    input_names=list(inputs),
    output_names=["last_hidden_state"],
    dynamic_axes={**axes, "last_hidden_state": {0: "batch", 1: "sequence"}},
    opset_version=17,
    dynamo=False,
)
quantize_dynamic(dst / "onnx" / "model.onnx", dst / "onnx" / "model_int8.onnx", weight_type=QuantType.QInt8)
print(f"exported {dst}")
