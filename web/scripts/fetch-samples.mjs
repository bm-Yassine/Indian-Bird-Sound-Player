// Pulls the sample photos for the "or try one of these" row from Wikimedia
// Commons, and writes down where each one came from.
//
// The images themselves are committed, so a build never depends on this - run
// it only when you want to add or replace a sample:
//
//   node scripts/fetch-samples.mjs
//
// Only openly licensed photos are kept (public domain, CC0, CC BY, CC BY-SA).
// Anything with a non-commercial or no-derivatives clause is skipped, and the
// licence and photographer end up in public/samples/samples.json, which the
// page shows under the row.
import { mkdir, writeFile } from "node:fs/promises";

// Wikimedia throttles anonymous scripts, so say who we are and don't rush.
const HEADERS = {
  "User-Agent":
    "bird-spotter-samples/1.0 (https://github.com/bm-Yassine/Indian-Bird-Sound-Player)",
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJSON(url) {
  const response = await fetch(url, { headers: HEADERS });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${response.status} from the API: ${text.slice(0, 120)}`);
  }
}

// species name as the classifier spells it -> the Wikipedia article to take
// the lead photo from
const WANTED = [
  { species: "Indian Peacock", article: "Indian peafowl" },
  { species: "Common Kingfisher", article: "Common kingfisher" },
  { species: "Hoopoe", article: "Hoopoe" },
  { species: "Indian Roller", article: "Indian roller" },
  { species: "Common Myna", article: "Common myna" },
  { species: "Sarus Crane", article: "Sarus crane" },
];

const OPEN_LICENCES = [/^cc0/i, /^cc by(-sa)?( |$)/i, /public domain/i, /^pd/i];
const WIDTH = 900; // the detector works at 640, no need to ship more

const api = "https://en.wikipedia.org/w/api.php";
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** the file name of the article's lead image */
async function leadImage(article) {
  const url = `${api}?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(article)}`;
  const pages = (await getJSON(url)).query.pages;
  return Object.values(pages)[0]?.pageimage;
}

/** a scaled-down copy of the file, plus who took it and under what licence */
async function fileDetails(fileName) {
  const url =
    `${api}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}` +
    `&titles=${encodeURIComponent("File:" + fileName)}`;
  const pages = (await getJSON(url)).query.pages;
  const info = Object.values(pages)[0]?.imageinfo?.[0];
  if (!info) return null;

  const meta = info.extmetadata ?? {};
  const plain = (value) =>
    value ? String(value.value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";

  return {
    url: info.thumburl ?? info.url,
    licence: plain(meta.LicenseShortName) || "unknown",
    licenceUrl: plain(meta.LicenseUrl),
    author: plain(meta.Artist) || "unknown",
    source: info.descriptionurl,
  };
}

const out = new URL("../public/samples/", import.meta.url);
await mkdir(out, { recursive: true });

const samples = [];
for (const { species, article } of WANTED) {
  const fileName = await leadImage(article);
  if (!fileName) {
    console.warn(`! ${species}: no lead image on "${article}"`);
    continue;
  }

  const details = await fileDetails(fileName);
  if (!details) {
    console.warn(`! ${species}: could not read the file details`);
    continue;
  }
  if (!OPEN_LICENCES.some((pattern) => pattern.test(details.licence))) {
    console.warn(`! ${species}: skipping, licence is "${details.licence}"`);
    continue;
  }

  const response = await fetch(details.url, { headers: HEADERS });
  const image = Buffer.from(await response.arrayBuffer());

  // a throttled request answers with a page of text, which would happily be
  // written out as a .jpg - check it really is an image before saving
  const jpeg = image[0] === 0xff && image[1] === 0xd8;
  const png = image.toString("latin1", 1, 4) === "PNG";
  if (!jpeg && !png) {
    console.warn(`! ${species}: that download wasn't an image (${image.length} bytes)`);
    continue;
  }

  const name = `${slug(species)}.${jpeg ? "jpg" : "png"}`;
  await writeFile(new URL(name, out), image);

  samples.push({
    file: `samples/${name}`,
    species,
    author: details.author,
    licence: details.licence,
    licenceUrl: details.licenceUrl,
    source: details.source,
  });
  console.log(`${species}: ${(image.length / 1024).toFixed(0)} kB, ${details.licence}`);
  await pause(1000);
}

await writeFile(new URL("samples.json", out), JSON.stringify(samples, null, 2) + "\n");
console.log(`\nwrote ${samples.length} samples into public/samples/`);
