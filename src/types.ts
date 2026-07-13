/** Tile legend used in level maps */
export const Tile = {
  Empty: " ",
  Floor: ".",
  Wall: "#",
  Goal: "G",
  Plate: "P",
  Ice: "I",
  PortalA: "A",
  PortalB: "B",
} as const;

export type TileChar = (typeof Tile)[keyof typeof Tile] | string;

export type Dir = "up" | "down" | "left" | "right";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Crate {
  id: number;
  x: number;
  y: number;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  /** Plate coordinates that open this door */
  plates: Vec2[];
  open: boolean;
}

export interface LevelDef {
  id: number;
  name: string;
  objective: string;
  /** Row-major map; player `@`, crate `$`, wall `#`, floor `.`, goal `G`, plate `P`, ice `I`, portals `A`/`B` */
  map: string[];
  /** Optional doors not encoded in map (door tiles use `D` + metadata) */
  doors?: Array<{
    x: number;
    y: number;
    plates: Vec2[];
  }>;
  parMoves?: number;
}

export interface GameSnapshot {
  player: Vec2;
  crates: Crate[];
  doors: Door[];
  moves: number;
  pushes: number;
}

export interface LevelRuntime {
  width: number;
  height: number;
  tiles: string[][];
  playerStart: Vec2;
  crates: Crate[];
  doors: Door[];
  goals: Vec2[];
  plates: Vec2[];
  portalA: Vec2 | null;
  portalB: Vec2 | null;
  def: LevelDef;
}

export const DIR_DELTA: Record<Dir, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}
