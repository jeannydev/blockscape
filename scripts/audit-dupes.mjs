/**
 * Find exact and near-duplicate levels.
 * Run: node scripts/audit-dupes.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../src/levels.ts"), "utf8");
const match = src.match(/export const LEVELS[^=]*=\s*(\[[\s\S]*\]);/);
const LEVELS = Function(`"use strict"; return (${match[1]});`)();

function wallSkeleton(map) {
  const w = Math.max(...map.map((r) => r.length));
  return map
    .map((r) =>
      [...r.padEnd(w, " ")].map((c) => (c === "#" || c === " " ? "#" : ".")).join("")
    )
    .join("\n");
}

function jaccardWalkable(a, b) {
  const A = wallSkeleton(a).split("\n");
  const B = wallSkeleton(b).split("\n");
  const h = Math.max(A.length, B.length);
  const w = Math.max(...A.map((r) => r.length), ...B.map((r) => r.length));
  let same = 0;
  let tot = 0;
  for (let y = 0; y < h; y++) {
    const ra = (A[y] || "").padEnd(w, "#");
    const rb = (B[y] || "").padEnd(w, "#");
    for (let x = 0; x < w; x++) {
      if (ra[x] === "." || rb[x] === ".") {
        tot++;
        if (ra[x] === rb[x]) same++;
      }
    }
  }
  return tot ? same / tot : 0;
}

function features(l) {
  const m = l.map.join("");
  return {
    ice: (m.match(/I/g) || []).length,
    portal: /[AB]/.test(m),
    doors: l.doors?.length || 0,
    plates: (m.match(/P/g) || []).length,
    crates: (m.match(/\$/g) || []).length,
    goals: (m.match(/G/g) || []).length,
    w: Math.max(...l.map.map((r) => r.length)),
    h: l.map.length,
  };
}

function mapKey(map) {
  return map.map((r) => r.replace(/\s+$/, "")).join("\n");
}

function rowPattern(map) {
  // Compress each row to wall/open only for shape compare ignoring entities
  return map
    .map((r) =>
      r
        .replace(/[@$GABPID*+.]/g, ".")
        .replace(/ /g, "#")
        .replace(/\.+/g, ".")
        .replace(/#+/g, "#")
    )
    .join("|");
}

// --- Exact duplicates ---
console.log("=== 1. EXACT MAP DUPLICATES ===");
const byExact = new Map();
for (const l of LEVELS) {
  const k = mapKey(l.map);
  if (!byExact.has(k)) byExact.set(k, []);
  byExact.get(k).push(`L${l.id} ${l.name}`);
}
let nExact = 0;
for (const ids of byExact.values()) {
  if (ids.length > 1) {
    console.log(" ", ids.join(" == "));
    nExact++;
  }
}
if (!nExact) console.log("  (none)");

// --- Identical wall skeleton ---
console.log("\n=== 2. IDENTICAL WALL LAYOUT (entities may differ) ===");
const byWall = new Map();
for (const l of LEVELS) {
  const k = wallSkeleton(l.map);
  if (!byWall.has(k)) byWall.set(k, []);
  byWall.get(k).push(`L${l.id} ${l.name}`);
}
let nWall = 0;
for (const ids of byWall.values()) {
  if (ids.length > 1) {
    console.log(" ", ids.join(" == "));
    nWall++;
  }
}
if (!nWall) console.log("  (none)");

// --- Pairwise high similarity ---
console.log("\n=== 3. HIGH WALL SIMILARITY (>= 85%) ===");
const pairs = [];
for (let i = 0; i < LEVELS.length; i++) {
  for (let j = i + 1; j < LEVELS.length; j++) {
    const sim = jaccardWalkable(LEVELS[i].map, LEVELS[j].map);
    if (sim >= 0.85) {
      pairs.push({
        sim,
        a: LEVELS[i],
        b: LEVELS[j],
      });
    }
  }
}
pairs.sort((x, y) => y.sim - x.sim);
if (!pairs.length) console.log("  (none)");
for (const p of pairs) {
  const fa = features(p.a);
  const fb = features(p.b);
  console.log(
    `  ${(p.sim * 100).toFixed(0)}%  L${p.a.id} ${p.a.name}  <->  L${p.b.id} ${p.b.name}`
  );
  console.log(
    `       A: ${fa.crates}c/${fa.goals}g ice=${fa.ice} portal=${fa.portal} doors=${fa.doors} P=${fa.plates} ${fa.w}x${fa.h}`
  );
  console.log(
    `       B: ${fb.crates}c/${fb.goals}g ice=${fb.ice} portal=${fb.portal} doors=${fb.doors} P=${fb.plates} ${fb.w}x${fb.h}`
  );
}

// --- Known repeated design templates ---
console.log("\n=== 4. DESIGN TEMPLATES (same puzzle idea) ===");

const plateIceDoor = LEVELS.filter((l) => {
  const m = l.map.join("");
  const f = features(l);
  return f.plates >= 1 && f.ice >= 4 && f.doors >= 1 && f.crates === 1 && f.goals === 1;
});
console.log("\n  [plate + ice runway + door + 1 crate]");
for (const l of plateIceDoor) {
  console.log(`    L${l.id} ${l.name}`);
  // show the critical row with $ and I
  for (const row of l.map) {
    if (row.includes("$") || row.includes("I") || row.includes("D") || row.includes("P")) {
      console.log("     ", JSON.stringify(row));
    }
  }
}

const portalVault = LEVELS.filter((l) => {
  const m = l.map.join("\n");
  return /A/.test(m) && /B/.test(m) && m.includes("###") && (m.match(/\$/g) || []).length >= 1;
});
console.log("\n  [portal A/B + sealed lower vault]");
for (const l of portalVault) {
  const f = features(l);
  // lower section after full-width wall
  const hasFullWall = l.map.some(
    (r) => (r.match(/#/g) || []).length >= r.trim().length * 0.9 && r.includes("#")
  );
  if (hasFullWall && f.portal) {
    console.log(
      `    L${l.id} ${l.name}  ${f.crates}c/${f.goals}g doors=${f.doors} P=${f.plates}`
    );
  }
}

const openField = LEVELS.filter((l) => {
  const f = features(l);
  if (f.ice || f.portal || f.doors) return false;
  // mostly open rectangle
  const sk = wallSkeleton(l.map).split("\n");
  const inner = sk.slice(1, -1).map((r) => r.slice(1, -1));
  const open = inner.join("").split(".").length - 1;
  const wall = inner.join("").split("#").length - 1;
  return open > wall * 3 && f.crates >= 1;
});
console.log("\n  [open empty field — no ice/portal/door]");
for (const l of openField) {
  const f = features(l);
  console.log(`    L${l.id} ${l.name}  ${f.crates}c/${f.goals}g  ${f.w}x${f.h}`);
}

const iceRunway = LEVELS.filter((l) => {
  const f = features(l);
  return f.ice >= 5 && !f.portal && f.doors === 0 && f.crates <= 2;
});
console.log("\n  [ice corridor / runway, no portal/door]");
for (const l of iceRunway) {
  const f = features(l);
  console.log(`    L${l.id} ${l.name}  ice=${f.ice} ${f.crates}c/${f.goals}g`);
  for (const row of l.map) {
    if (row.includes("I") || row.includes("$") || row.includes("G")) {
      console.log("     ", JSON.stringify(row));
    }
  }
}

// --- Near-identical critical rows (ice runways etc.) ---
console.log("\n=== 5. NEAR-IDENTICAL KEY ROWS (ice/door lines) ===");
function criticalRows(l) {
  return l.map
    .filter((r) => /[IPDG$]/.test(r))
    .map((r) => r.replace(/[@]/g, ".").replace(/\s+$/, ""));
}
for (let i = 0; i < LEVELS.length; i++) {
  for (let j = i + 1; j < LEVELS.length; j++) {
    const ra = criticalRows(LEVELS[i]);
    const rb = criticalRows(LEVELS[j]);
    if (!ra.length || !rb.length) continue;
    // if any critical row almost equal
    for (const a of ra) {
      for (const b of rb) {
        if (a.length < 8 || b.length < 8) continue;
        // normalize entities to type
        const na = a.replace(/[IPDG$]/g, (c) => c);
        const nb = b.replace(/[IPDG$]/g, (c) => c);
        if (na === nb) {
          console.log(
            `  same row L${LEVELS[i].id}/${LEVELS[j].id}: ${JSON.stringify(a)}`
          );
        } else {
          // pattern: only $ position differs or width
          const pa = a.replace(/\$/g, "X").replace(/[G]/g, "Y").replace(/[P]/g, "Z");
          const pb = b.replace(/\$/g, "X").replace(/[G]/g, "Y").replace(/[P]/g, "Z");
          if (pa === pb && /I{4,}/.test(a) && /I{4,}/.test(b)) {
            console.log(
              `  same ice pattern L${LEVELS[i].id} ${LEVELS[i].name} / L${LEVELS[j].id} ${LEVELS[j].name}`
            );
            console.log(`    ${JSON.stringify(a)}`);
            console.log(`    ${JSON.stringify(b)}`);
          }
        }
      }
    }
  }
}

// --- Catalog summary ---
console.log("\n=== 6. FULL CATALOG ===");
for (const l of LEVELS) {
  const f = features(l);
  const tags = [];
  if (f.ice) tags.push(`ice${f.ice}`);
  if (f.portal) tags.push("portal");
  if (f.doors) tags.push(`door${f.doors}`);
  if (f.plates) tags.push(`P${f.plates}`);
  tags.push(`${f.crates}c/${f.goals}g`);
  console.log(
    String(l.id).padStart(2) +
      " " +
      l.name.padEnd(18) +
      " " +
      tags.join(" ").padEnd(28) +
      " " +
      l.objective.slice(0, 55)
  );
}
