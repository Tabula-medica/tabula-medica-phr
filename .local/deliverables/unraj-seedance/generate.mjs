#!/usr/bin/env node
/**
 * Seedance 2.0 batch generator for the unraj.org video kit (fal.ai).
 *
 *   npm i @fal-ai/client
 *   FAL_KEY=xxx node generate.mjs                 # generate every clip
 *   FAL_KEY=xxx node generate.mjs --only 01,03    # subset by id prefix
 *   node generate.mjs --estimate                  # cost only, no API calls
 *   FAL_KEY=xxx node generate.mjs --fast          # 720p fast tier for drafts
 *   node generate.mjs --keep 04:1000              # copy out/04-...-s1000.mp4 to out/keepers/04-....mp4
 *
 * Outputs land in ./out/<id>-s<seed>.mp4 with a sidecar .json of the request.
 * Chosen seeds are promoted with --keep to ./out/keepers/<id>.mp4, the stable path that
 * clip 06's video reference, optimize.sh, and the Higgsfield jobs file point at.
 * Exits non-zero if any seed fails so automation cannot report a partial batch as complete.
 * Reference files listed in prompts.json (refs/*.jpg, *.mp3) are uploaded to fal storage.
 */
import { readFile, writeFile, mkdir, stat, copyFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const ESTIMATE_ONLY = flag("estimate");
const FAST = flag("fast");
const ONLY = (opt("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const KEEP = opt("keep"); // "<id-prefix>:<seed>"

// fal.ai list prices, USD per output second (checked Sep 2026; re-verify on fal.ai/seedance-2.0).
const PRICE_PER_SEC = {
  standard: { "480p": 0.14, "720p": 0.3034, "1080p": 0.682 },
  fast: { "480p": 0.11, "720p": 0.2419 },
};

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await readFile(path.join(here, "prompts/prompts.json"), "utf8"));
const outDir = path.join(here, "out");
const keepDir = path.join(outDir, "keepers");
await mkdir(keepDir, { recursive: true });

// ---- keeper promotion (no API calls) --------------------------------------
if (KEEP) {
  const [prefix, seed] = KEEP.split(":");
  const clip = cfg.clips.find((c) => c.id.startsWith(prefix ?? ""));
  if (!clip || !seed) {
    console.error("Usage: --keep <clip-id-prefix>:<seed>   e.g. --keep 04:1000");
    process.exit(1);
  }
  const src = path.join(outDir, `${clip.id}-s${seed}.mp4`);
  await stat(src); // throws if that seed was never generated
  await copyFile(src, path.join(keepDir, `${clip.id}.mp4`));
  await copyFile(src.replace(/\.mp4$/, ".json"), path.join(keepDir, `${clip.id}.json`)).catch(() => {});
  console.log(`✔ keeper: out/keepers/${clip.id}.mp4  (from ${path.basename(src)})`);
  process.exit(0);
}

const clips = cfg.clips.filter((c) => ONLY.length === 0 || ONLY.some((p) => c.id.startsWith(p)));
if (clips.length === 0) {
  console.error("No clips matched --only", ONLY);
  process.exit(1);
}

const tierFor = () => (FAST ? "fast" : "standard");
// fast tier tops out at 720p; downgrade 1080p requests for drafts
const resolutionFor = (clip, tier) => (tier === "fast" && clip.resolution === "1080p" ? "720p" : clip.resolution);

// ---- cost estimate ---------------------------------------------------------
let total = 0;
console.log("\nClip                       tier      res    sec  seeds   est. USD");
for (const c of clips) {
  const tier = tierFor();
  const res = resolutionFor(c, tier);
  const seeds = c.seeds ?? cfg.defaults.seeds;
  const perSec = PRICE_PER_SEC[tier][res];
  if (perSec == null) {
    console.error(`No price for ${tier}/${res} (clip ${c.id})`);
    process.exit(1);
  }
  const cost = perSec * Number(c.duration) * seeds;
  total += cost;
  console.log(
    `${c.id.padEnd(26)} ${tier.padEnd(9)} ${res.padEnd(6)} ${String(c.duration).padStart(3)}  ${String(seeds).padStart(5)}   ${cost.toFixed(2).padStart(8)}`
  );
}
console.log(`${"".padEnd(58)}TOTAL ${total.toFixed(2)}\n`);
if (ESTIMATE_ONLY) process.exit(0);

// ---- generation ------------------------------------------------------------
if (!process.env.FAL_KEY) {
  console.error("FAL_KEY is not set. Get one at https://fal.ai/dashboard/keys");
  process.exit(1);
}
const { fal } = await import("@fal-ai/client");
fal.config({ credentials: process.env.FAL_KEY });

const uploadCache = new Map();
async function exists(relPath) {
  return stat(path.join(here, relPath)).then(() => true, () => false);
}
async function upload(relPath) {
  if (uploadCache.has(relPath)) return uploadCache.get(relPath);
  const abs = path.join(here, relPath);
  await stat(abs); // throws if the reference file is missing
  const bytes = await readFile(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime =
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4" }[ext] ??
    "application/octet-stream";
  const url = await fal.storage.upload(new Blob([bytes], { type: mime }));
  uploadCache.set(relPath, url);
  console.log(`  uploaded ${relPath}`);
  return url;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

const failures = [];
for (const c of clips) {
  const tier = tierFor();
  const res = resolutionFor(c, tier);
  const seeds = c.seeds ?? cfg.defaults.seeds;
  // Optional image references (the diamond render) are used when present; without them the
  // clip falls back to plain text-to-video so the batch still runs.
  let clipEndpoint = c.endpoint;
  let imageRefs = c.image_refs ?? [];
  if (c.optional_image_refs) {
    const present = [];
    for (const r of imageRefs) (await exists(r)) ? present.push(r) : console.log(`  (optional ref ${r} not found, continuing without it)`);
    imageRefs = present;
    if (imageRefs.length === 0 && !(c.video_refs?.length || c.audio_refs?.length)) clipEndpoint = "text-to-video";
    else clipEndpoint = "reference-to-video";
  }
  // fal endpoint IDs for this model carry no "fal-ai/" prefix. Source: fal's API reference
  // (fal.ai/docs/model-api-reference/video-generation-api/bytedance-seedance-2.0-text-to-video,
  // "Endpoint ID: bytedance/seedance-2.0/text-to-video") and github.com/fal-ai/seedance-2.0-api.
  const endpoint = `bytedance/seedance-2.0/${tier === "fast" ? "fast/" : ""}${clipEndpoint}`;

  const input = {
    prompt: c.prompt,
    resolution: res,
    duration: String(c.duration),
    aspect_ratio: c.aspect_ratio,
    generate_audio: Boolean(c.generate_audio),
  };
  if (clipEndpoint === "image-to-video") input.image_url = await upload(imageRefs[0]);
  if (clipEndpoint === "reference-to-video") {
    if (imageRefs.length) input.image_urls = await Promise.all(imageRefs.map(upload));
    if (c.video_refs?.length) input.video_urls = await Promise.all(c.video_refs.map(upload));
    if (c.audio_refs?.length) input.audio_urls = await Promise.all(c.audio_refs.map(upload));
  }

  for (let i = 0; i < seeds; i++) {
    const seed = 1000 + i * 7919; // deterministic, re-runnable
    const req = { ...input, seed };
    const label = `${c.id}-s${seed}`;
    console.log(`\n▶ ${label}  (${endpoint}, ${res}, ${c.duration}s)`);
    const t0 = Date.now();
    try {
      const result = await fal.subscribe(endpoint, {
        input: req,
        logs: true,
        onQueueUpdate: (u) => {
          if (u.status === "IN_PROGRESS") (u.logs ?? []).slice(-1).forEach((l) => console.log("   ", l.message));
        },
      });
      const videoUrl = result.data?.video?.url;
      if (!videoUrl) throw new Error("no video url in response");
      const dest = path.join(outDir, `${label}.mp4`);
      await download(videoUrl, dest);
      await writeFile(path.join(outDir, `${label}.json`), JSON.stringify({ endpoint, request: req, response: result.data }, null, 2));
      console.log(`  ✔ saved ${path.relative(process.cwd(), dest)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (err) {
      failures.push(label);
      console.error(`  ✖ ${label} failed:`, err?.message ?? err);
    }
  }
}
if (failures.length) {
  console.error(`\n${failures.length} generation(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("\nDone. Next: promote keepers with `node generate.mjs --keep 01:1000`, then `bash optimize.sh out/keepers/01-hero-loop.mp4`.");
}
