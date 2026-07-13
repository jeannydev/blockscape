/**
 * BFS solvability checker for Blockscape levels.
 * Run: node scripts/verify-levels.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline minimal port of game logic (keep in sync with src/game/logic.ts)
const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIRS = ["up", "down", "left", "right"];

function parseLevel(def) {
  const height = def.map.length;
  const width = Math.max(...def.map.map((r) => r.length));
  const tiles = [];
  const crates = [];
  const goals = [];
  let playerStart = { x: 1, y: 1 };
  let portalA = null;
  let portalB = null;
  let crateId = 0;

  for (let y = 0; y < height; y++) {
    const row = def.map[y].padEnd(width, " ");
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
        case "A":
          tiles[y][x] = "A";
          portalA = { x, y };
          break;
        case "B":
          tiles[y][x] = "B";
          portalB = { x, y };
          break;
        case "I":
          tiles[y][x] = "I";
          break;
        case "D":
          tiles[y][x] = ".";
          break;
        case "#":
          tiles[y][x] = "#";
          break;
        case ".":
          tiles[y][x] = ".";
          break;
        default:
          tiles[y][x] = " ";
          break;
      }
    }
  }

  const doors = (def.doors ?? []).map((d, i) => ({
    id: `door-${i}`,
    x: d.x,
    y: d.y,
    plates: d.plates.map((p) => ({ ...p })),
    open: false,
  }));

  return {
    width,
    height,
    tiles,
    playerStart,
    crates,
    doors,
    goals,
    portalA,
    portalB,
    def,
  };
}

function stateKey(s) {
  const crates = [...s.crates]
    .sort((a, b) => a.id - b.id)
    .map((c) => `${c.x},${c.y}`)
    .join(";");
  const doors = s.doors.map((d) => (d.open ? "1" : "0")).join("");
  return `${s.player.x},${s.player.y}|${crates}|${doors}`;
}

function isWall(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true;
  const t = level.tiles[y][x];
  return t === "#" || t === " ";
}

function crateAt(state, x, y) {
  return state.crates.find((c) => c.x === x && c.y === y);
}

function doorAt(state, x, y) {
  return state.doors.find((d) => d.x === x && d.y === y);
}

function isBlocked(level, state, x, y, ignoreCrateId) {
  if (isWall(level, x, y)) return true;
  const door = doorAt(state, x, y);
  if (door && !door.open) return true;
  const crate = crateAt(state, x, y);
  if (crate && crate.id !== ignoreCrateId) return true;
  return false;
}

function updateDoors(state) {
  for (const door of state.doors) {
    if (door.open) continue;
    const active = door.plates.every((p) => {
      const playerOn = state.player.x === p.x && state.player.y === p.y;
      const crateOn = state.crates.some((c) => c.x === p.x && c.y === p.y);
      return playerOn || crateOn;
    });
    if (active) door.open = true;
  }
}

function tryTeleport(level, state) {
  const { player } = state;
  const tile = level.tiles[player.y]?.[player.x];
  if (tile === "A" && level.portalB) {
    if (!isBlocked(level, state, level.portalB.x, level.portalB.y)) {
      player.x = level.portalB.x;
      player.y = level.portalB.y;
    }
  } else if (tile === "B" && level.portalA) {
    if (!isBlocked(level, state, level.portalA.x, level.portalA.y)) {
      player.x = level.portalA.x;
      player.y = level.portalA.y;
    }
  }
}

function slideOnIce(level, state, dir, isCrate, crateId) {
  const delta = DIR[dir];
  for (;;) {
    let cx, cy;
    if (isCrate) {
      const crate = state.crates.find((c) => c.id === crateId);
      if (!crate) return;
      cx = crate.x;
      cy = crate.y;
    } else {
      cx = state.player.x;
      cy = state.player.y;
    }
    if (level.tiles[cy]?.[cx] !== "I") break;
    const nx = cx + delta.x;
    const ny = cy + delta.y;
    if (isBlocked(level, state, nx, ny, isCrate ? crateId : undefined)) break;
    if (isCrate) {
      const crate = state.crates.find((c) => c.id === crateId);
      crate.x = nx;
      crate.y = ny;
    } else {
      if (crateAt(state, nx, ny)) break;
      state.player.x = nx;
      state.player.y = ny;
    }
  }
}

function cloneState(s) {
  return {
    player: { ...s.player },
    crates: s.crates.map((c) => ({ ...c })),
    doors: s.doors.map((d) => ({
      ...d,
      plates: d.plates.map((p) => ({ ...p })),
      open: d.open,
    })),
    moves: s.moves,
  };
}

function tryMove(level, state, dir) {
  const next = cloneState(state);
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
    slideOnIce(level, next, dir, true, crate.id);
  }
  next.player.x = tx;
  next.player.y = ty;
  next.moves += 1;
  slideOnIce(level, next, dir, false);
  tryTeleport(level, next);
  updateDoors(next);
  return next;
}

function isWon(level, state) {
  if (level.goals.length === 0) return false;
  const onGoal = state.crates.filter((c) =>
    level.goals.some((g) => g.x === c.x && g.y === c.y)
  );
  return onGoal.length === level.goals.length;
}

function solve(level, maxNodes = 4_000_000) {
  const start = {
    player: { ...level.playerStart },
    crates: level.crates.map((c) => ({ ...c })),
    doors: level.doors.map((d) => ({
      ...d,
      plates: d.plates.map((p) => ({ ...p })),
      open: false,
    })),
    moves: 0,
  };
  updateDoors(start);

  if (isWon(level, start)) return { ok: true, moves: 0, nodes: 0 };

  const seen = new Set([stateKey(start)]);
  const q = [start];
  let nodes = 0;
  let head = 0;

  while (head < q.length) {
    const cur = q[head++];
    nodes++;
    if (nodes > maxNodes) return { ok: false, reason: "limit", nodes, moves: cur.moves };

    for (const dir of DIRS) {
      const next = tryMove(level, cur, dir);
      if (!next) continue;
      const k = stateKey(next);
      if (seen.has(k)) continue;
      if (isWon(level, next)) return { ok: true, moves: next.moves, nodes };
      seen.add(k);
      q.push(next);
    }
  }
  return { ok: false, reason: "unsolvable", nodes, explored: seen.size };
}

// Load levels from TS file by eval-like extraction
const levelsPath = join(__dirname, "../src/levels.ts");
const src = readFileSync(levelsPath, "utf8");

// Dynamic import won't work on TS; duplicate by running through a small transform
// Instead: write levels as JSON-friendly parse via Function from the array literal
const match = src.match(/export const LEVELS[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!match) {
  console.error("Could not parse LEVELS from levels.ts");
  process.exit(1);
}

const LEVELS = new Function(`return ${match[1]}`)();

let failed = 0;
for (const def of LEVELS) {
  const level = parseLevel(def);
  const t0 = Date.now();
  const result = solve(level);
  const ms = Date.now() - t0;
  if (result.ok) {
    console.log(
      `✓ L${def.id} "${def.name}" — solvable in ≤${result.moves} moves (${result.nodes} nodes, ${ms}ms)`
    );
  } else {
    failed++;
    console.log(
      `✗ L${def.id} "${def.name}" — ${result.reason} (${result.nodes} nodes, ${ms}ms)`
    );
  }
}

console.log(failed ? `\n${failed} level(s) failed` : "\nAll levels solvable");
process.exit(failed ? 1 : 0);
