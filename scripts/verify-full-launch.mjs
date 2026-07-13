/**
 * Static Full Launch readiness checks (no browser).
 * Run after `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const src = path.join(root, "src");

let failed = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  failed += 1;
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function walkFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

// —— dist presence & size ——
if (!fs.existsSync(dist)) {
  fail("dist/ missing — run npm run build first");
  process.exit(1);
}

const files = walkFiles(dist);
const totalBytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
const totalMb = totalBytes / (1024 * 1024);

if (files.length <= 1500) ok(`file count ${files.length} ≤ 1500`);
else fail(`file count ${files.length} > 1500`);

if (totalMb <= 50) ok(`total size ${totalMb.toFixed(2)} MB ≤ 50 MB (initial)`);
else fail(`total size ${totalMb.toFixed(2)} MB > 50 MB`);

if (fs.existsSync(path.join(dist, "index.html"))) ok("dist/index.html present");
else fail("dist/index.html missing");

const distHtml = read(path.join(dist, "index.html"));
if (distHtml.includes("sdk.crazygames.com/crazygames-sdk-v3.js")) {
  ok("SDK v3 script tag in dist");
} else {
  fail("SDK v3 script tag missing in dist");
}

if (distHtml.includes('id="ad-block"')) ok("ad-block overlay in dist HTML");
else fail("ad-block overlay missing in dist HTML");

// Bundle assets must be relative (CrazyGames hosts games under non-root paths).
// External https:// CDN (SDK, fonts) is allowed.
if (/(?:src|href)=["']\/assets\//.test(distHtml)) {
  fail("root-absolute bundle paths (/assets/…) — set Vite base: './'");
} else {
  ok("bundle assets use relative paths (not /assets/…)");
}
if (/(?:src|href)=["']\.\/assets\//.test(distHtml)) {
  ok("dist references assets as ./assets/…");
} else if (/(?:src|href)=["']assets\//.test(distHtml)) {
  ok("dist references assets relatively");
} else {
  fail("no relative assets/* references in dist HTML");
}

// —— source Full Launch contracts ——
const platform = read(path.join(src, "platform", "crazygames.ts"));
const audio = read(path.join(src, "audio.ts"));
const main = read(path.join(src, "main.ts"));
const game = read(path.join(src, "game", "Game.ts"));
const css = read(path.join(src, "style.css"));

const checks = [
  [platform, "muteAudio", "settings.muteAudio handling"],
  [platform, "addSettingsChangeListener", "settings change listener"],
  [platform, "adStarted", "adStarted mute hook"],
  [platform, "setAdMuted", "ad mute API used"],
  [platform, "setAdUiLocked", "ad UI lock"],
  [platform, "reportGameCompletedPercentage", "progress percentage"],
  [platform, "setGameContext", "game context"],
  [platform, "loadingStart", "loadingStart"],
  [platform, "loadingStop", "loadingStop"],
  [audio, "setPlatformMuted", "platform mute layer"],
  [audio, "setAdMuted", "ad mute layer"],
  [audio, "isEffectivelyMuted", "effective mute"],
  [main, "continueGame()", "instant gameplay boot"],
  [main, "onAdUiLock", "ad UI handler wired"],
  [main, "isPlatformMuted", "platform mute UI respect"],
  [game, "isAdUiLocked", "ad lock in game flow"],
  [game, "maybeShowMidgameAd", "midgame ads"],
  [css, "user-select: none", "mobile user-select"],
  [css, "ad-locked", "ad-locked CSS"],
];

for (const [srcText, needle, label] of checks) {
  if (srcText.includes(needle)) ok(label);
  else fail(`${label} (missing "${needle}")`);
}

// happytime only on campaign clear (not every 3★)
if (
  game.includes("if (id === LEVELS.length) happytime()") ||
  game.includes("id === LEVELS.length) happytime()")
) {
  ok("happytime sparingly (campaign clear)");
} else if (game.includes("stars >= 3")) {
  fail("happytime still fires on every 3★ (too frequent)");
} else {
  ok("happytime usage reviewed");
}

console.log("");
if (failed) {
  console.error(`Full Launch verify failed: ${failed} issue(s)`);
  process.exit(1);
}
console.log("Full Launch static checks passed");
