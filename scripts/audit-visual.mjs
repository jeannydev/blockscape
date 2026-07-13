/**
 * Visual / layout consistency audit for all levels.
 * node scripts/audit-visual.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../src/levels.ts"), "utf8");
const match = src.match(/export const LEVELS[^=]*=\s*(\[[\s\S]*\]);/);
const LEVELS = Function(`"use strict"; return (${match[1]});`)();

function solid(map, x, y) {
  if (y < 0 || y >= map.length) return true;
  const row = map[y];
  if (x < 0 || x >= row.length) return true;
  const ch = row[x];
  return ch === "#" || ch === " ";
}

function walkable(map, x, y) {
  if (y < 0 || y >= map.length) return false;
  const row = map[y];
  if (x < 0 || x >= row.length) return false;
  const ch = row[x];
  return ch !== "#" && ch !== " ";
}

function doorYaw(map, x, y) {
  const wallN = solid(map, x, y - 1);
  const wallS = solid(map, x, y + 1);
  const wallW = solid(map, x - 1, y);
  const wallE = solid(map, x + 1, y);
  if (wallN && wallS && !(wallW && wallE)) return Math.PI / 2; // EW passage
  if (wallW && wallE && !(wallN && wallS)) return 0; // NS passage
  const openNS = (wallN ? 0 : 1) + (wallS ? 0 : 1);
  const openEW = (wallW ? 0 : 1) + (wallE ? 0 : 1);
  return openEW > openNS ? Math.PI / 2 : 0;
}

function passageAxis(map, x, y) {
  const n = walkable(map, x, y - 1);
  const s = walkable(map, x, y + 1);
  const w = walkable(map, x - 1, y);
  const e = walkable(map, x + 1, y);
  const ns = (n ? 1 : 0) + (s ? 1 : 0);
  const ew = (w ? 1 : 0) + (e ? 1 : 0);
  if (ew > ns) return "EW";
  if (ns > ew) return "NS";
  if (ew === 2 && ns === 2) return "OPEN";
  if (ew === 0 && ns === 0) return "BLOCKED";
  return ew >= ns ? "EW" : "NS";
}

function framedForAxis(map, x, y, axis) {
  // A "proper" gate has solid flanks perpendicular to travel.
  if (axis === "NS") return solid(map, x - 1, y) && solid(map, x + 1, y);
  if (axis === "EW") return solid(map, x, y - 1) && solid(map, x, y + 1);
  return false;
}

let issues = 0;
function issue(id, name, msg) {
  issues++;
  console.log(`L${id} "${name}": ${msg}`);
}

for (const def of LEVELS) {
  const map = def.map;
  const widths = map.map((r) => r.length);
  const maxW = Math.max(...widths);
  if (widths.some((w) => w !== maxW)) {
    issue(def.id, def.name, `uneven row widths ${[...new Set(widths)].join(",")}`);
  }

  // Collect D and P from map
  const Ds = [];
  const Ps = [];
  let A = null;
  let B = null;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch === "D") Ds.push({ x, y });
      if (ch === "P") Ps.push({ x, y });
      if (ch === "A") A = { x, y };
      if (ch === "B") B = { x, y };
    }
  }

  const doors = def.doors || [];
  if (Ds.length !== doors.length) {
    issue(
      def.id,
      def.name,
      `D count ${Ds.length} != doors[] ${doors.length}`
    );
  }

  // Match each doors[] entry to a D
  for (const d of doors) {
    const onD = Ds.some((c) => c.x === d.x && c.y === d.y);
    if (!onD) {
      issue(def.id, def.name, `doors[] (${d.x},${d.y}) has no D on map`);
    }
    for (const p of d.plates) {
      const ch = map[p.y]?.[p.x];
      if (ch !== "P") {
        issue(
          def.id,
          def.name,
          `plate (${p.x},${p.y}) is '${ch ?? "oob"}' not P`
        );
      }
    }

    const axis = passageAxis(map, d.x, d.y);
    const yaw = doorYaw(map, d.x, d.y);
    const yawAxis = yaw === 0 ? "NS-face" : "EW-face";
    // NS-face blocks NS travel; good when passage is NS
    // EW-face (π/2) blocks EW travel; good when passage is EW
    const faceBlocks = yaw === 0 ? "NS" : "EW";
    if (axis === "OPEN") {
      issue(
        def.id,
        def.name,
        `door (${d.x},${d.y}) in open 4-way space (no wall frame)`
      );
    } else if (axis === "EW" || axis === "NS") {
      if (!framedForAxis(map, d.x, d.y, axis)) {
        issue(
          def.id,
          def.name,
          `door (${d.x},${d.y}) passage ${axis} but missing wall flanks`
        );
      }
      if (faceBlocks !== axis && axis !== "OPEN") {
        issue(
          def.id,
          def.name,
          `door (${d.x},${d.y}) visual face blocks ${faceBlocks} but passage is ${axis} (will look wrong)`
        );
      }
    }
  }

  for (const c of Ds) {
    if (!doors.some((d) => d.x === c.x && d.y === c.y)) {
      issue(def.id, def.name, `orphan D at (${c.x},${c.y}) not in doors[]`);
    }
  }

  if ((A && !B) || (!A && B)) {
    issue(def.id, def.name, `portal pair incomplete A=${!!A} B=${!!B}`);
  }

  // Decorative plates not linked to any door
  for (const p of Ps) {
    const linked = doors.some((d) =>
      d.plates.some((pl) => pl.x === p.x && pl.y === p.y)
    );
    if (!linked) {
      issue(def.id, def.name, `orphan plate P at (${p.x},${p.y})`);
    }
  }
}

console.log("");
console.log(issues ? `${issues} visual issue(s)` : "No visual issues");
process.exit(issues ? 1 : 0);
