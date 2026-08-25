"""Export both models to ONNX so they can run in a browser.

    python scripts/export_onnx.py

Writes into web/public/models/:
  bird_detector.onnx    - YOLOv11, finds where the birds are
  bird_classifier.onnx  - names the species
  classifier_meta.json  - class order + preprocessing, so the web app
                          never has to hardcode them

If training/retrain_classifier.ipynb has produced a better classifier, drop
bird_classifier.onnx and classifier_meta.json in from Colab instead - this
script only re-exports the original team model.
"""

import json
import shutil
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.detection import (  # noqa: E402
    CLASS_NAMES,
    CLASSIFIER_INPUT_SIZE,
    CLASSIFIER_WEIGHTS,
    DETECTOR_WEIGHTS,
    MyCnn_model,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "web" / "public" / "models"

# what the classifier expects on its input
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

# YOLO runs on a fixed square; 640 is what it was trained at
DETECTOR_INPUT_SIZE = 640


def export_detector() -> Path:
    from ultralytics import YOLO

    print("exporting the detector...")
    model = YOLO(str(DETECTOR_WEIGHTS))
    produced = model.export(format="onnx", imgsz=DETECTOR_INPUT_SIZE, opset=17, dynamic=False)

    target = OUT_DIR / "bird_detector.onnx"
    shutil.move(str(produced), target)
    return target


def export_classifier() -> Path:
    print("exporting the classifier...")
    model = MyCnn_model(num_classes=len(CLASS_NAMES))
    model.load_state_dict(torch.load(CLASSIFIER_WEIGHTS, map_location="cpu", weights_only=True))
    model.eval()

    target = OUT_DIR / "bird_classifier.onnx"
    dummy = torch.randn(1, 3, CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE)
    # dynamo=False keeps the weights inside the .onnx file. The newer exporter
    # writes them to a sidecar .onnx.data, which the browser runtime would have
    # to be told about separately - one file is one less thing to get wrong.
    torch.onnx.export(
        model,
        dummy,
        str(target),
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    stale = target.with_suffix(".onnx.data")
    if stale.exists():
        stale.unlink()
    return target


def shrink_detector(onnx_path: Path) -> Path:
    """int8-quantise the detector, keeping it only if the boxes still agree.

    fp32 YOLO is ~38 MB, which is a lot to push at a phone. Quantising gets it
    to roughly a quarter of that, but a smaller model that detects worse is a
    bad trade - so we compare both on a real photo before keeping it.
    """
    import numpy as np
    import onnxruntime as ort
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantised = onnx_path.with_name("bird_detector.int8.onnx")
    print("quantising the detector...")
    quantize_dynamic(str(onnx_path), str(quantised), weight_type=QuantType.QUInt8)

    sample = REPO_ROOT / "data_for_the_report" / "object_detection" / "val_batch0_labels.jpg"
    if not sample.exists():
        print("  no sample image to check against, keeping fp32")
        quantised.unlink(missing_ok=True)
        return onnx_path

    from PIL import Image

    image = Image.open(sample).convert("RGB").resize((DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE))
    tensor = np.asarray(image, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0

    def best_boxes(model_path):
        session = ort.InferenceSession(str(model_path))
        raw = session.run(None, {session.get_inputs()[0].name: tensor})[0]
        # ultralytics single-class output: (1, 5, N) -> x, y, w, h, confidence
        predictions = raw[0].T
        keep = predictions[predictions[:, 4] > 0.25]
        return keep[keep[:, 4].argsort()[::-1]]

    original, small = best_boxes(onnx_path), best_boxes(quantised)
    print(f"  fp32 found {len(original)} boxes, int8 found {len(small)}")

    if len(original) and len(small):
        drift = float(abs(original[0][4] - small[0][4]))
        centre_shift = float(np.abs(original[0][:2] - small[0][:2]).max())
        print(f"  top box: confidence differs by {drift:.3f}, centre moves {centre_shift:.1f}px")
        acceptable = drift < 0.10 and centre_shift < 15
    else:
        acceptable = len(original) == len(small)

    if acceptable:
        onnx_path.unlink()
        quantised.rename(onnx_path)
        print("  keeping the quantised model")
    else:
        quantised.unlink()
        print("  quantised model drifted too far - keeping fp32")
    return onnx_path


def check_matches_pytorch(onnx_path: Path) -> None:
    """An exported model that disagrees with the original is worse than none."""
    import numpy as np
    import onnxruntime as ort

    model = MyCnn_model(num_classes=len(CLASS_NAMES))
    model.load_state_dict(torch.load(CLASSIFIER_WEIGHTS, map_location="cpu", weights_only=True))
    model.eval()

    dummy = torch.randn(1, 3, CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE)
    with torch.no_grad():
        expected = model(dummy).numpy()

    session = ort.InferenceSession(str(onnx_path))
    actual = session.run(None, {"input": dummy.numpy()})[0]

    difference = float(np.abs(expected - actual).max())
    print(f"  ONNX vs PyTorch, largest difference: {difference:.2e}")
    if difference > 1e-4:
        raise SystemExit("ONNX export does not match PyTorch - not shipping this")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    detector = export_detector()
    detector = shrink_detector(detector)
    classifier = export_classifier()
    check_matches_pytorch(classifier)

    meta = {
        "classes": CLASS_NAMES,
        "input_size": CLASSIFIER_INPUT_SIZE,
        "mean": MEAN,
        "std": STD,
        "architecture": "team CNN (5 conv layers)",
        "detector_input_size": DETECTOR_INPUT_SIZE,
        "note": "original course model - replace with the retrained one when ready",
    }
    (OUT_DIR / "classifier_meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    print("\nwritten:")
    for path in (detector, classifier, OUT_DIR / "classifier_meta.json"):
        print(f"  {path.relative_to(REPO_ROOT)}  {path.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
