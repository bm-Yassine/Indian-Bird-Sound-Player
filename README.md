# 🪶 Bird Spotter

Drop in a photo, and it finds every bird, names the species, and plays that bird's call.

Two models do the work: a **YOLOv11** detector that finds where the birds are, and a
classifier that names them among **25 Indian species**. There is a desktop app (PySide6)
and a **web version that runs entirely in your browser** — the photo never leaves your
device, and there is no server.

> This is a fork of a university group project for *Artificial Intelligence in Practice*
> at Politechnika Śląska, originally built by **Sara Sobstyl** (team lead, annotation,
> training), **Alicja Banaszewska** (annotation, report), **Filip Bucher** (database and
> sound research), **Bartłomiej Szkodny** (backend/frontend integration),
> **Szymon Poterejko** (frontend design) and me (frontend implementation).
> Original repo: [ss19190/Indian-Bird-Sound-Player](https://github.com/ss19190/Indian-Bird-Sound-Player).
> The trained models and the bird call recordings are the team's work.

## What's different in this fork

**The sound worked for 2 of 25 birds.** The classifier emits names with spaces
(`"Cattle Egret"`) while the sound map was keyed with underscores (`"Cattle_Egret"`), so
only *Hoopoe* and *Indian Peacock* ever matched — every other bird reported "No Audio
Available" while its mp3 sat unused in `assets/sounds`. File names are now derived from
the species name, and all 25 resolve.

**Only the first bird in a photo was used.** The detector can find several, but the app
read `boxes[0]` and dropped the rest. Now every bird above the threshold is detected,
boxed and classified separately.

Also: runs on Apple Silicon (MPS) instead of falling back to CPU, model paths resolve from
the repo so the app works from any directory, weights load with `weights_only=True`, and
the classifier returns its top three guesses — which matters, because it is often unsure.

**New: a browser version** (`web/`) with the models exported to ONNX, per-bird result
cards, a short field-guide note for each species, and the call playable inline.

## Running it

**Web** — no Python needed:

```bash
cd web
npm install
npm run dev
```

**Desktop:**

```bash
pip install -r requirements.txt
python main.py
```

## Honest state of the models

The detector is decent: mAP@0.5 of 0.742 from 1250 hand-annotated photos. Its recall drops
off at higher confidence, so quiet detections are often still correct — that is why the web
app keeps the threshold low and shows the detection confidence per bird.

The **classifier is the weak part**. It was trained on 64×64 crops, which throws away most
of the detail, and it shows: the project report has it calling an Indian Peacock at 47% and
a Cattle Egret at 23%. The app says so out loud when a guess is under 50%, rather than
presenting a coin flip as an identification.

`training/retrain_classifier.ipynb` is a Colab notebook that fine-tunes a pretrained
EfficientNet-B0 at 224×224 on the same 25 species, reports per-species accuracy and the
most common mix-ups, and exports a drop-in ONNX replacement. The dataset is ~16 GB, which
is why it trains in Colab rather than on a laptop.

## Layout

```
main.py, src/            the desktop app (PySide6)
  detection.py           both models: detect every bird, classify each
  audio_manager.py       finds the call for a species
trained_models/          the team's trained weights
assets/sounds/           25 bird calls
scripts/export_onnx.py   exports both models for the browser, int8-quantising
                         the detector only if the boxes still agree with fp32
training/                the Colab retraining notebook
web/                     the browser app (TypeScript + onnxruntime-web)
  src/lib/birds.ts       preprocessing, the detector, NMS, the classifier
  src/lib/species.ts     a short note and a Wikipedia link per species
data_for_the_report/     training curves and confusion matrices
```

## Credits and licence

Code is MIT, as in the original repo. The models were trained on the
[birds25-cleaned](https://www.kaggle.com/datasets/pavangawande/birds25-cleaned) dataset
(CC BY-NC 4.0 — non-commercial), so treat anything derived from them the same way.
Species notes are deliberately brief and link to Wikipedia rather than restating it.
