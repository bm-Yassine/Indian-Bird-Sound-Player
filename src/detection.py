"""Finding birds in a photo and naming them.

Two models, as in the original project:
  * a YOLOv11 detector that finds where the birds are (one class: "bird")
  * a CNN that names the species of a cropped bird

Changes from the first version:
  * every detected bird is returned, not just the first box
  * runs on Apple Silicon (MPS) as well as CUDA
  * model paths resolve from the repo, so the app runs from any directory
  * weights are loaded with weights_only=True
"""

from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from ultralytics import YOLO

REPO_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = REPO_ROOT / "trained_models"

DETECTOR_WEIGHTS = MODELS_DIR / "Bird_Detector.pt"
CLASSIFIER_WEIGHTS = MODELS_DIR / "Indian_Bird_Identifier_model.pth"

# the classifier was trained on 64x64 crops; kept here so the old weights still
# load. The retrained model uses a larger size and sets this from its metadata.
CLASSIFIER_INPUT_SIZE = 64

# how sure YOLO has to be before we call something a bird
DETECTION_THRESHOLD = 0.25


class MyCnn_model(nn.Module):
    """The team's classifier. Kept as-is so the original weights still load."""

    def __init__(self, num_classes):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(32),
            nn.MaxPool2d(2, padding=1),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64),
            nn.MaxPool2d(2, padding=1),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(128),
            nn.MaxPool2d(2, padding=1),

            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(256),
            nn.MaxPool2d(2, padding=1),

            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(512),
            nn.MaxPool2d(2, padding=1),
        )
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Dropout(0.5),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


CLASS_NAMES = [
    "Asian Green Bee Eater", "Brown Headed Barbet", "Cattle Egret",
    "Common Kingfisher", "Common Myna", "Common Rosefinch",
    "Common Tailorbird", "Coppersmith Barbet", "Forest Wagtail",
    "Gray Wagtail", "Hoopoe", "House Crow",
    "Indian Grey Hornbill", "Indian Peacock", "Indian Pitta",
    "Indian Roller", "Jungle Babbler", "Northern Lapwing",
    "Red Wattled Lapwing", "Ruddy Shelduck", "Rufous Treepie",
    "Sarus Crane", "White Breasted Kingfisher",
    "White Breasted Waterhen", "White Wagtail",
]


def pick_device() -> str:
    """CUDA if there is one, Apple's GPU on a Mac, otherwise the CPU."""
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


@dataclass
class Detection:
    """One bird found in the photo."""
    box: tuple[int, int, int, int]      # x1, y1, x2, y2
    detection_confidence: float
    species: str | None = None
    species_confidence: float = 0.0


class BirdDetector:
    def __init__(self, device: str | None = None):
        self.device = device or pick_device()
        self.yolo_model = None
        self.classifier_model = None
        self.load_models()

    def load_models(self):
        try:
            self.yolo_model = YOLO(str(DETECTOR_WEIGHTS))
        except Exception as e:
            print(f"Error loading YOLO: {e}")

        try:
            model = MyCnn_model(num_classes=len(CLASS_NAMES)).to(self.device)
            state = torch.load(CLASSIFIER_WEIGHTS, map_location=self.device, weights_only=True)
            model.load_state_dict(state)
            model.eval()
            self.classifier_model = model
        except Exception as e:
            print(f"Error loading Classifier: {e}")

    # ---------------------------------------------------------------- detect

    def detect(self, image_path, threshold: float = DETECTION_THRESHOLD) -> list[Detection]:
        """Every bird in the photo, biggest confidence first.

        The original returned only boxes[0], so a photo with three birds
        reported one and silently dropped the rest.
        """
        if not self.yolo_model:
            return []

        # the threshold has to go into the call: ultralytics applies its own
        # default (0.25) first, so filtering afterwards can only ever remove
        # more boxes, never surface the quieter ones
        results = self.yolo_model(image_path, verbose=False, conf=threshold)
        found: list[Detection] = []

        for result in results:
            for box in result.boxes:
                confidence = float(box.conf.cpu().numpy()[0])
                x1, y1, x2, y2 = (int(v) for v in box.xyxy.cpu().numpy()[0])
                found.append(Detection((x1, y1, x2, y2), confidence))

        found.sort(key=lambda d: d.detection_confidence, reverse=True)
        return found

    def detect_bbox(self, image_path):
        """Backwards-compatible single-box helper: (box, confidence)."""
        found = self.detect(image_path)
        if not found:
            return None, 0.0
        return found[0].box, found[0].detection_confidence

    # -------------------------------------------------------------- classify

    def _preprocess(self, img: Image.Image) -> torch.Tensor:
        transform = transforms.Compose([
            transforms.Resize((CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        return transform(img).unsqueeze(0).to(self.device)

    def classify_image(self, img: Image.Image, top_k: int = 3):
        """Name the bird in an already-cropped image.

        Returns [(species, confidence), ...] best first - showing the runners-up
        is useful when the model is unsure, which it often is.
        """
        if not self.classifier_model:
            return [("Model Error", 0.0)]

        tensor = self._preprocess(img.convert("RGB"))
        with torch.no_grad():
            probabilities = torch.softmax(self.classifier_model(tensor), dim=1)[0]

        k = min(top_k, len(CLASS_NAMES))
        confidences, indices = torch.topk(probabilities, k)
        return [
            (CLASS_NAMES[i], float(c))
            for c, i in zip(confidences.cpu(), indices.cpu())
        ]

    def classify_species(self, image_path, bbox=None):
        """Backwards-compatible helper: (species, confidence)."""
        try:
            img = Image.open(image_path).convert("RGB")
            if bbox is not None:
                img = crop_to_box(img, bbox)
            return self.classify_image(img, top_k=1)[0]
        except Exception as e:
            print(f"Prediction Error: {e}")
            return "Error", 0.0

    # ----------------------------------------------------------------- both

    def analyse(self, image_path, threshold: float = DETECTION_THRESHOLD) -> list[Detection]:
        """Detect every bird and name each one."""
        img = Image.open(image_path).convert("RGB")
        birds = self.detect(image_path, threshold)

        for bird in birds:
            crop = crop_to_box(img, bird.box)
            (species, confidence), *_ = self.classify_image(crop, top_k=1)
            bird.species = species
            bird.species_confidence = confidence
        return birds


def crop_to_box(img: Image.Image, box, padding: float = 0.05) -> Image.Image:
    """Crop to a detection, with a little margin so we keep the bird's edges."""
    width, height = img.size
    x1, y1, x2, y2 = box

    pad_x = int((x2 - x1) * padding)
    pad_y = int((y2 - y1) * padding)

    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(width, x2 + pad_x)
    y2 = min(height, y2 + pad_y)

    if x2 <= x1 or y2 <= y1:
        return img
    return img.crop((x1, y1, x2, y2))
