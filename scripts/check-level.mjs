/** Quick BFS check for one level: node scripts/check-level.mjs 5 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const id = Number(process.argv[2] || 5);
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../src/levels.ts"), "utf8");
const match = src.match(/export const LEVELS[^=]*=\s*(\[[\s\S]*\]);/);
if (!match) {
  console.error("Could not parse LEVELS");
  process.exit(1);
}
const LEVELS = Function(`"use strict"; return (${match[1]});`)();
const def = LEVELS.find((l) => l.id === id);
if (!def) {
  console.error(`Level ${id} missing`);
  process.exit(1);
}

const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIRS = ["up", "down", "left", "right"];

function parseLevel(d) {
  const height = d.map.length;
  const width = Math.max(...d.map.map((r) => r.length));
  const tiles = [];
  const crates = [];
  const goals = [];
  let playerStart = { x: 1, y: 1 };
  let crateId = 0;
  for (let y = 0; y < height; y++) {
    const row = d.map[y].padEnd(width, " ");
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      switch (ch) {
        case "@":
          playerStart = { x, y };
          tiles[y][x] = ".";
          break;
        case "$":
          crates.push({ id: crateId++, x, y });
          tiles[y][x] = ".";
          break;
        case "*":
          crates.push({ id: crateId++, x, y });
          tiles[y][x] = "G";
          goals.push({ x, y });
          break;
        case "G":
          tiles[y][x] = "G";
          goals.push({ x, y });
          break;
        case "P":
          tiles[y][x] = "P";
          break;
        case "D":
        case ".":
          tiles[y][x] = ".";
          break;
        case "I":
          tiles[y][x] = "I";
          break;
        case "A":
          tiles[y][x] = "A";
          break;
        case "B":
          tiles[y][x] = "B";
          break;
        case "#":
          tiles[y][x] = "#";
          break;
        default:
          tiles[y][x] = " ";
      }
    }
  }
  const doors = (d.doors || []).map((door, i) => ({
    id: `door-${i}`,
    x: door.x,
    y: door.y,
    plates: door.plates.map((p) => ({ ...p })),
    open: false,
  }));
  return { width, height, tiles, playerStart, crates, doors, goals };
}

function createSnapshot(level) {
  return {
    player: { ...level.playerStart },
    crates: level.crates.map((c) => ({ ...c })),
    doors: level.doors.map((door) => ({
      ...door,
      plates: door.plates.map((p) => ({ ...p })),
      open: false,
    })),
    moves: 0,
    pushes: 0,
  };
}

function isWall(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true;
  const t = level.tiles[y][x];
  return t === "#" || t === " ";
}
function crateAt(s, x, y) {
  return s.crates.find((c) => c.x === x && c.y === y);
}
function doorAt(s, x, y) {
  return s.doors.find((d) => d.x === x && d.y === y);
}
function isBlocked(level, s, x, y, ignore) {
  if (isWall(level, x, y)) return true;
  const d = doorAt(s, x, y);
  if (d && !d.open) return true;
  const c = crateAt(s, x, y);
  if (c && c.id !== ignore) return true;
  return false;
}
function updateDoors(s) {
  for (const door of s.doors) {
    if (door.open) continue;
    const active = door.plates.every((p) => {
      const po = s.player.x === p.x && s.player.y === p.y;
      const co = s.crates.some((c) => c.x === p.x && c.y === p.y);
      return po || co;
    });
    if (active) door.open = true;
  }
}
function clone(s) {
  return {
    player: { ...s.player },
    crates: s.crates.map((c) => ({ ...c })),
    doors: s.doors.map((d) => ({
      ...d,
      plates: d.plates.map((p) => ({ ...p })),
    })),
    moves: s.moves,
    pushes: s.pushes,
  };
}
function tryMove(level, state, dir) {
  const next = clone(state);
  const delta = DIR[dir];
  const tx = next.player.x + delta.x;
  const ty = next.player.y + delta.y;
  if (isWall(level, tx, ty)) return null;
  const door = doorAt(next, tx, ty);
  if (door && !door.open) return null;
  const crate = crateAt(next, tx, ty);
  if (crate) {
    const cx = crate.x + delta.x;
    const cy = crate.y + delta.y;
    if (isBlocked(level, next, cx, cy, crate.id)) return null;
    crate.x = cx;
    crate.y = cy;
    next.pushes++;
  }
  next.player.x = tx;
  next.player.y = ty;
  next.moves++;
  updateDoors(next);
  return next;
}
function isWon(level, s) {
  if (!level.goals.length) return false;
  const on = s.crates.filter((c) =>
    level.goals.some((g) => g.x === c.x && g.y === c.y)
  );
  return on.length === level.goals.length;
}
function key(s) {
  return (
    s.player.x +
    "," +
    s.player.y +
    "|" +
    s.crates
      .map((c) => c.x + "," + c.y)
      .sort()
      .join(";") +
    "|" +
    s.doors.map((d) => (d.open ? 1 : 0)).join("")
  );
}

function bfs(forbidOpenDoor) {
  const level = parseLevel(def);
  const start = createSnapshot(level);
  const q = [[start, 0]];
  const seen = new Set([key(start)]);
  while (q.length) {
    const [st, dist] = q.shift();
    if (forbidOpenDoor && st.doors.some((d) => d.open)) continue;
    if (isWon(level, st)) return { dist, nodes: seen.size };
    if (dist > 150) break;
    for (const dir of DIRS) {
      const n = tryMove(level, st, dir);
      if (!n) continue;
      if (forbidOpenDoor && n.doors.some((d) => d.open)) continue;
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([n, dist + 1]);
    }
  }
  return { dist: null, nodes: seen.size };
}

console.log(`L${id} "${def.name}"`);
console.log(def.map.join("\n"));
const noDoor = def.doors?.length ? bfs(true) : { dist: null };
const ok = bfs(false);
console.log("without door:", noDoor.dist ?? "impossible");
console.log("optimal:", ok.dist, "par:", def.parMoves);
if (ok.dist == null) {
  console.error("FAIL unsolvable");
  process.exit(1);
}
if (def.doors?.length && noDoor.dist != null) {
  console.error("FAIL bypassable without door");
  process.exit(1);
}
console.log("OK");
