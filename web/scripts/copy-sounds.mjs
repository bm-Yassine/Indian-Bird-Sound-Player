// The bird calls live in ../assets/sounds and belong to the desktop app too.
// Copying them in at build time keeps one copy in git instead of two.
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const from = new URL("../../assets/sounds/", import.meta.url);
const to = new URL("../public/sounds/", import.meta.url);

if (!existsSync(from)) {
  console.error("assets/sounds not found - are we inside the repo?");
  process.exit(1);
}

await mkdir(to, { recursive: true });
let copied = 0;
for (const name of await readdir(from)) {
  if (!name.endsWith(".mp3")) continue;
  await cp(new URL(name, from), new URL(name, to));
  copied++;
}
console.log(`copied ${copied} bird calls into public/sounds/`);
