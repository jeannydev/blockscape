import {
  DIR_DELTA,
  type Dir,
  type Door,
  type GameSnapshot,
  type LevelDef,
  type LevelRuntime,
  type Vec2,
} from "../types";

function cloneCrates(crates: LevelRuntime["crates"]) {
  return crates.map((c) => ({ ...c }));
}

function cloneDoors(doors: Door[]) {
  return doors.map((d) => ({
    ...d,
    plates: d.plates.map((p) => ({ ...p })),
  }));
}

export function parseLevel(def: LevelDef): LevelRuntime {
  const height = def.map.length;
  const width = Math.max(...def.map.map((row) => row.length));
  const tiles: string[][] = [];
  const crates: LevelRuntime["crates"] = [];
  const goals: Vec2[] = [];
  const plates: Vec2[] = [];
  let playerStart: Vec2 = { x: 1, y: 1 };
  let portalA: Vec2 | null = null;
  let portalB: Vec2 | null = null;
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
        case "*": // crate on goal
          crates.push({ id: crateId++, x, y });
          tiles[y][x] = "G";
          goals.push({ x, y });
          break;
        case "+": // player on goal
          playerStart = { x, y };
          tiles[y][x] = "G";
          goals.push({ x, y });
          break;
        case "G":
          tiles[y][x] = "G";
          goals.push({ x, y });
          break;
        case "P":
          tiles[y][x] = "P";
          plates.push({ x, y });
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
          tiles[y][x] = "."; // door entity overlays floor
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

  const doors: Door[] = (def.doors ?? []).map((d, i) => ({
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
    plates,
    portalA,
    portalB,
    def,
  };
}

export function createSnapshot(level: LevelRuntime): GameSnapshot {
  return {
    player: { ...level.playerStart },
    crates: cloneCrates(level.crates),
    doors: cloneDoors(level.doors).map((d) => ({ ...d, open: false })),
    moves: 0,
    pushes: 0,
  };
}

export function cloneSnapshot(s: GameSnapshot): GameSnapshot {
  return {
    player: { ...s.player },
    crates: cloneCrates(s.crates),
    doors: cloneDoors(s.doors),
    moves: s.moves,
    pushes: s.pushes,
  };
}

function inBounds(level: LevelRuntime, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < level.width && y < level.height;
}

function isWall(level: LevelRuntime, x: number, y: number): boolean {
  if (!inBounds(level, x, y)) return true;
  return level.tiles[y][x] === "#" || level.tiles[y][x] === " ";
}

function crateAt(state: GameSnapshot, x: number, y: number) {
  return state.crates.find((c) => c.x === x && c.y === y);
}

function doorAt(state: GameSnapshot, x: number, y: number) {
  return state.doors.find((d) => d.x === x && d.y === y);
}

function isBlocked(
  level: LevelRuntime,
  state: GameSnapshot,
  x: number,
  y: number,
  ignoreCrateId?: number
): boolean {
  if (isWall(level, x, y)) return true;
  const door = doorAt(state, x, y);
  if (door && !door.open) return true;
  const crate = crateAt(state, x, y);
  if (crate && crate.id !== ignoreCrateId) return true;
  return false;
}

function updateDoors(level: LevelRuntime, state: GameSnapshot): void {
  // Doors latch open: once activated they stay open so crates can pass
  // without someone permanently camping the plate.
  for (const door of state.doors) {
    if (door.open) continue;
    const active = door.plates.every((p) => {
      const playerOn = state.player.x === p.x && state.player.y === p.y;
      const crateOn = state.crates.some((c) => c.x === p.x && c.y === p.y);
      return playerOn || crateOn;
    });
    if (active) door.open = true;
  }
  void level;
}

function tryTeleport(level: LevelRuntime, state: GameSnapshot): void {
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

function slideOnIce(
  level: LevelRuntime,
  state: GameSnapshot,
  dir: Dir,
  isCrate: boolean,
  crateId?: number
): void {
  const delta = DIR_DELTA[dir];
  // Player or crate already moved onto ice; continue sliding
  for (;;) {
    let cx: number;
    let cy: number;
    if (isCrate && crateId !== undefined) {
      const crate = state.crates.find((c) => c.id === crateId);
      if (!crate) return;
      cx = crate.x;
      cy = crate.y;
    } else {
      cx = state.player.x;
      cy = state.player.y;
    }

    const tile = level.tiles[cy]?.[cx];
    if (tile !== "I") break;

    const nx = cx + delta.x;
    const ny = cy + delta.y;
    if (isBlocked(level, state, nx, ny, isCrate ? crateId : undefined)) break;

    // Don't slide crate into another crate / closed door
    if (isCrate && crateId !== undefined) {
      const crate = state.crates.find((c) => c.id === crateId)!;
      crate.x = nx;
      crate.y = ny;
    } else {
      // If player would hit a crate while sliding, stop (no multi-push on ice)
      if (crateAt(state, nx, ny)) break;
      state.player.x = nx;
      state.player.y = ny;
    }
  }
}

export type MoveResult =
  | { ok: false }
  | {
      ok: true;
      state: GameSnapshot;
      pushed: boolean;
      teleported: boolean;
    };

export function tryMove(
  level: LevelRuntime,
  state: GameSnapshot,
  dir: Dir
): MoveResult {
  const next = cloneSnapshot(state);
  const delta = DIR_DELTA[dir];
  const tx = next.player.x + delta.x;
  const ty = next.player.y + delta.y;

  if (isWall(level, tx, ty)) return { ok: false };

  const door = doorAt(next, tx, ty);
  if (door && !door.open) return { ok: false };

  let pushed = false;
  const crate = crateAt(next, tx, ty);

  if (crate) {
    const cx = crate.x + delta.x;
    const cy = crate.y + delta.y;
    if (isBlocked(level, next, cx, cy, crate.id)) return { ok: false };
    crate.x = cx;
    crate.y = cy;
    pushed = true;
    next.pushes += 1;
    // crate ice slide
    slideOnIce(level, next, dir, true, crate.id);
  }

  next.player.x = tx;
  next.player.y = ty;
  next.moves += 1;

  // player ice slide (after push resolved)
  slideOnIce(level, next, dir, false);

  const before = { x: next.player.x, y: next.player.y };
  tryTeleport(level, next);
  const teleported =
    before.x !== next.player.x || before.y !== next.player.y;

  updateDoors(level, next);

  return { ok: true, state: next, pushed, teleported };
}

export function isWon(level: LevelRuntime, state: GameSnapshot): boolean {
  if (level.goals.length === 0) return false;
  // Every goal has a crate, and every crate is on a goal (when counts match)
  const goals = level.goals;
  const onGoal = state.crates.filter((c) =>
    goals.some((g) => g.x === c.x && g.y === c.y)
  );
  return onGoal.length === goals.length && state.crates.length >= goals.length;
}

export function goalsFilled(level: LevelRuntime, state: GameSnapshot): number {
  return state.crates.filter((c) =>
    level.goals.some((g) => g.x === c.x && g.y === c.y)
  ).length;
}

export function plateActive(
  state: GameSnapshot,
  plate: Vec2
): boolean {
  return (
    (state.player.x === plate.x && state.player.y === plate.y) ||
    state.crates.some((c) => c.x === plate.x && c.y === plate.y)
  );
}

/** Tile is free for the player to stand on (not wall / closed door / crate). */
export function canStand(
  level: LevelRuntime,
  state: GameSnapshot,
  x: number,
  y: number
): boolean {
  return !isBlocked(level, state, x, y);
}

/**
 * BFS walk path (4-dir). Avoids walls, closed doors, crates.
 * Returns sequence of directions, or null if unreachable.
 */
export function findWalkPath(
  level: LevelRuntime,
  state: GameSnapshot,
  from: Vec2,
  to: Vec2
): Dir[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!canStand(level, state, to.x, to.y)) return null;

  const dirs: Dir[] = ["up", "down", "left", "right"];
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, { x: number; y: number; dir: Dir }>();
  const q: Vec2[] = [{ x: from.x, y: from.y }];
  const seen = new Set<string>([key(from.x, from.y)]);

  while (q.length) {
    const cur = q.shift()!;
    for (const dir of dirs) {
      const d = DIR_DELTA[dir];
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (!canStand(level, state, nx, ny) && !(nx === to.x && ny === to.y)) {
        continue;
      }
      // destination already checked walkable
      if (!canStand(level, state, nx, ny)) continue;
      seen.add(k);
      prev.set(k, { x: cur.x, y: cur.y, dir });
      if (nx === to.x && ny === to.y) {
        // reconstruct
        const path: Dir[] = [];
        let cx = nx;
        let cy = ny;
        while (!(cx === from.x && cy === from.y)) {
          const p = prev.get(key(cx, cy))!;
          path.push(p.dir);
          cx = p.x;
          cy = p.y;
        }
        path.reverse();
        return path;
      }
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

/**
 * Resolve a click: walk to empty tile, or walk next to a crate and push it.
 * Returns dirs to execute (last dir may be a push into the crate).
 */
export function pathForClick(
  level: LevelRuntime,
  state: GameSnapshot,
  target: Vec2
): Dir[] | null {
  const from = state.player;
  if (from.x === target.x && from.y === target.y) return [];

  // Empty tile — walk there
  if (canStand(level, state, target.x, target.y)) {
    return findWalkPath(level, state, from, target);
  }

  // Crate — path to an adjacent cell then push toward crate if free beyond
  const crate = state.crates.find((c) => c.x === target.x && c.y === target.y);
  if (!crate) return null;

  const dirs: Dir[] = ["up", "down", "left", "right"];
  let best: Dir[] | null = null;

  for (const dir of dirs) {
    const d = DIR_DELTA[dir];
    // stand on opposite side of push direction: approach from -dir
    const standX = crate.x - d.x;
    const standY = crate.y - d.y;
    const beyondX = crate.x + d.x;
    const beyondY = crate.y + d.y;
    if (!canStand(level, state, standX, standY) && !(from.x === standX && from.y === standY)) {
      continue;
    }
    if (isBlocked(level, state, beyondX, beyondY, crate.id)) continue;

    let path: Dir[] | null;
    if (from.x === standX && from.y === standY) {
      path = [];
    } else if (canStand(level, state, standX, standY)) {
      path = findWalkPath(level, state, from, { x: standX, y: standY });
    } else {
      path = null;
    }
    if (path === null) continue;
    const full = [...path, dir];
    if (!best || full.length < best.length) best = full;
  }

  // Fallback: just walk next to crate without requiring push
  if (!best) {
    for (const dir of dirs) {
      const d = DIR_DELTA[dir];
      const nx = crate.x + d.x;
      const ny = crate.y + d.y;
      if (!canStand(level, state, nx, ny)) continue;
      const path = findWalkPath(level, state, from, { x: nx, y: ny });
      if (path && (!best || path.length < best.length)) best = path;
    }
  }

  return best;
}
