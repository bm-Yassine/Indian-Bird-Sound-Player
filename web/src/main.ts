import "./style.css";
import { DETECTION_THRESHOLD, findBirds, loadModels, type Bird } from "./lib/birds";
import { speciesInfo, soundUrl } from "./lib/species";

const app = document.getElementById("app")!;

app.innerHTML = `
  <header class="border-b" style="border-color: var(--line)">
    <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
      <span class="text-2xl">🪶</span>
      <div class="flex-1">
        <h1 class="text-xl font-bold leading-tight">Bird Spotter</h1>
        <p class="text-xs muted">finds every bird in a photo, names it, and plays its call</p>
      </div>
      <button id="theme" class="btn-ghost !px-3" aria-label="Toggle dark mode">☾</button>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-4 py-8">
    <div id="status" class="card mb-6 flex items-center gap-3 p-4 text-sm">
      <div class="spinner"></div>
      <span id="status-text" class="muted">waking up the models…</span>
    </div>

    <label id="dropzone" class="dropzone flex cursor-pointer flex-col items-center justify-center gap-2 p-12 text-center">
      <span class="text-3xl">🐦</span>
      <span class="font-medium">Drop a photo here, or click to choose one</span>
      <span class="text-xs muted">everything runs on your device — the photo never leaves it</span>
      <input id="file" type="file" accept="image/*" class="hidden" />
    </label>

    <section id="samples" class="mt-4"></section>

    <section id="results" class="mt-8"></section>

    <p class="mt-10 text-xs muted">
      25 Indian species · detector and classifier trained for a university project ·
      <a class="underline" href="https://github.com/bm-Yassine/Indian-Bird-Sound-Player">source</a>
    </p>
  </main>
`;

const statusBox = document.getElementById("status") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const dropzone = document.getElementById("dropzone") as HTMLLabelElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const results = document.getElementById("results") as HTMLElement;
const samplesBox = document.getElementById("samples") as HTMLElement;

// ------------------------------------------------------------------ theme

const themeButton = document.getElementById("theme") as HTMLButtonElement;
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  themeButton.textContent = dark ? "☀" : "☾";
  localStorage.setItem("bird-theme", dark ? "dark" : "light");
}
applyTheme(
  localStorage.getItem("bird-theme") === "dark" ||
    (!localStorage.getItem("bird-theme") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches),
);
themeButton.onclick = () => applyTheme(!document.documentElement.classList.contains("dark"));

// ------------------------------------------------------------------ models

let ready = false;
loadModels((message) => (statusText.textContent = message))
  .then(() => {
    ready = true;
    statusBox.innerHTML = `<span class="chip">ready</span><span class="muted">models loaded — they stay cached for next time</span>`;
  })
  .catch((error) => {
    statusBox.innerHTML = `<span class="chip" style="background:#fde8e8;color:#b42318">problem</span>
      <span class="muted">could not load the models: ${String(error)}</span>`;
  });

// ------------------------------------------------------------------ samples

// Photos to try without hunting for one. They are committed under
// public/samples together with who took them - see scripts/fetch-samples.mjs.
type Sample = {
  file: string;
  species: string;
  author: string;
  licence: string;
  licenceUrl: string;
  source: string;
};

fetch("/samples/samples.json")
  .then((response) => (response.ok ? response.json() : []))
  .then((samples: Sample[]) => samples.length && showSamples(samples))
  .catch(() => {
    /* no samples shipped - the dropzone is enough */
  });

function showSamples(samples: Sample[]) {
  samplesBox.innerHTML = `
    <p class="mb-2 text-sm muted">No bird photo to hand? Try one of these:</p>
    <div class="flex flex-wrap gap-2">
      ${samples
        .map(
          (sample, index) => `
        <button class="sample" data-sample="${index}" title="${sample.species}">
          <img src="/${sample.file}" alt="${sample.species}" loading="lazy" />
          <span>${sample.species}</span>
        </button>`,
        )
        .join("")}
    </div>
    <p class="mt-2 text-xs muted">
      Sample photos from Wikimedia Commons —
      ${samples
        .map(
          (sample) =>
            `<a class="underline" target="_blank" rel="noreferrer" href="${sample.source}">${sample.species}</a>
             by ${sample.author} (${sample.licence})`,
        )
        .join(" · ")}
    </p>`;

  samplesBox.querySelectorAll<HTMLButtonElement>("[data-sample]").forEach((button) => {
    button.onclick = () => {
      const sample = samples[Number(button.dataset.sample)];
      if (sample) void analyse(`/${sample.file}`);
    };
  });
}

// ------------------------------------------------------------------ input

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragging");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragging");
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

async function handleFile(file: File) {
  if (!file.type.startsWith("image/")) {
    results.innerHTML = `<p class="muted">That doesn't look like an image.</p>`;
    return;
  }
  await analyse(URL.createObjectURL(file));
}

// Both ways in end up here: a photo the visitor picked, or one of the samples.
async function analyse(source: string) {
  if (!ready) {
    statusText.textContent = "still loading the models — one moment…";
    return;
  }

  const image = new Image();
  image.src = source;
  await image.decode();

  results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  results.innerHTML = `<div class="card flex items-center gap-3 p-4 text-sm"><div class="spinner"></div>
    <span class="muted">looking for birds…</span></div>`;

  const started = performance.now();
  const birds = await findBirds(image, DETECTION_THRESHOLD);
  const elapsed = ((performance.now() - started) / 1000).toFixed(1);

  render(image, birds, elapsed);
}

// ------------------------------------------------------------------ output

function drawBoxes(image: HTMLImageElement, birds: Bird[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.className = "w-full rounded-xl";

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  // keep labels readable on a phone photo without shouting on a big one
  const scale = Math.min(3, Math.max(1, Math.max(canvas.width, canvas.height) / 1100));
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.font = `${Math.max(14, 16 * scale)}px ui-sans-serif, system-ui, sans-serif`;

  birds.forEach((bird, index) => {
    const { x1, y1, x2, y2 } = bird.box;
    ctx.strokeStyle = "#3ddc84";
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    const label = `${index + 1}. ${bird.guesses[0]?.species ?? "bird"}`;
    const width = ctx.measureText(label).width + 12 * scale;
    const height = 22 * scale;

    ctx.fillStyle = "#3ddc84";
    ctx.fillRect(x1, Math.max(0, y1 - height), width, height);
    ctx.fillStyle = "#08210f";
    ctx.fillText(label, x1 + 6 * scale, Math.max(height - 6 * scale, y1 - 6 * scale));
  });

  return canvas;
}

function birdCard(bird: Bird, index: number): string {
  const best = bird.guesses[0];
  const info = best ? speciesInfo(best.species) : undefined;
  const runnersUp = bird.guesses.slice(1);

  return `
    <article class="card p-5">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="chip">bird ${index + 1}</span>
        <span class="chip">detected ${(bird.detectionConfidence * 100).toFixed(0)}%</span>
      </div>

      <h3 class="serif text-xl font-semibold">${best?.species ?? "Unknown"}</h3>
      ${info ? `<p class="text-sm italic muted">${info.scientificName}</p>` : ""}

      <div class="mt-2 flex items-center gap-2">
        <div class="h-2 flex-1 overflow-hidden rounded-full" style="background: var(--green-soft)">
          <div class="h-full rounded-full" style="width:${((best?.confidence ?? 0) * 100).toFixed(0)}%; background: var(--green)"></div>
        </div>
        <span class="text-sm font-medium">${((best?.confidence ?? 0) * 100).toFixed(1)}%</span>
      </div>

      ${
        (best?.confidence ?? 0) < 0.5
          ? `<p class="mt-2 text-xs" style="color: var(--amber)">
               ⚠ The classifier isn't confident here — treat this as a guess, not an identification.
             </p>`
          : ""
      }

      ${
        info
          ? `<p class="mt-3 text-sm">${info.description}</p>
             <p class="mt-2 text-sm muted"><b>Where:</b> ${info.habitat}</p>`
          : ""
      }

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button class="btn" data-play="${best?.species ?? ""}">▸ Play its call</button>
        ${info ? `<a class="btn-ghost" target="_blank" rel="noreferrer" href="${info.wikipedia}">Wikipedia ↗</a>` : ""}
      </div>

      ${
        runnersUp.length
          ? `<p class="mt-3 text-xs muted">also considered:
              ${runnersUp.map((g) => `${g.species} ${(g.confidence * 100).toFixed(1)}%`).join(" · ")}</p>`
          : ""
      }
    </article>`;
}

let audio: HTMLAudioElement | null = null;

function render(image: HTMLImageElement, birds: Bird[], elapsed: string) {
  if (!birds.length) {
    results.innerHTML = `
      <div class="card p-8 text-center">
        <p class="serif text-lg">No birds found in that one.</p>
        <p class="mt-1 text-sm muted">Try a photo where the bird is a bit larger in the frame.</p>
      </div>`;
    results.prepend(drawBoxes(image, []));
    return;
  }

  results.innerHTML = `
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="serif text-lg font-semibold">
        ${birds.length} bird${birds.length > 1 ? "s" : ""} found
      </h2>
      <span class="text-xs muted">in ${elapsed}s, on your device</span>
    </div>
    <div id="photo" class="card mb-6 overflow-hidden p-2"></div>
    <div class="grid gap-4 sm:grid-cols-2">
      ${birds.map(birdCard).join("")}
    </div>`;

  document.getElementById("photo")!.appendChild(drawBoxes(image, birds));

  results.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((button) => {
    button.onclick = () => {
      const species = button.dataset.play;
      if (!species) return;
      audio?.pause();
      audio = new Audio(soundUrl(species));
      audio.play().catch(() => {
        button.textContent = "no recording for this one";
        button.disabled = true;
      });
    };
  });
}
