import type { Dir, GameSnapshot, LevelRuntime } from "../types";
import { LEVELS, getLevel } from "../levels";
import {
  cloneSnapshot,
  createSnapshot,
  goalsFilled,
  isWon,
  parseLevel,
  pathForClick,
  tryMove,
} from "./logic";
import { WorldView } from "./WorldView";
import { bgmTrackForLevel, playBgm, sfx } from "../audio";
import { levelName, levelObjective, starCount, t } from "../i18n";
import {
  clearLevelContext,
  gameplayStart,
  gameplayStop,
  happytime,
  isAdUiLocked,
  loadData,
  maybeShowMidgameAd,
  reportProgressPercent,
  saveData,
  setLevelContext,
} from "../platform/crazygames";

const SAVE_KEY = "blockscape-progress-v2";

export interface Progress {
  unlocked: number;
  completed: number[];
  bestMoves: Record<number, number>;
  bestStars: Record<number, number>;
  /** Last level the player started (for Continue after full clear). */
  lastPlayed?: number;
}

export type GameScreen =
  | "title"
  | "levels"
  | "how"
  | "settings"
  | "pause"
  | "play"
  | "win";

export interface GameUIHooks {
  onScreen: (screen: GameScreen) => void;
  onHud: (data: {
    levelId: number;
    name: string;
    objective: string;
    moves: number;
    pushes: number;
    goals: number;
    goalsTotal: number;
  }) => void;
  onWin: (data: {
    levelId: number;
    name: string;
    moves: number;
    pushes: number;
    par?: number;
    stars: number;
    isLast: boolean;
  }) => void;
  onProgress: (p: Progress) => void;
  onHint: (text: string | null) => void;
}

export class Game {
  private view: WorldView;
  private ui: GameUIHooks;
  private level!: LevelRuntime;
  private state!: GameSnapshot;
  private history: GameSnapshot[] = [];
  private levelId = 1;
  private screen: GameScreen = "title";
  private progress: Progress = {
    unlocked: 1,
    completed: [],
    bestMoves: {},
    bestStars: {},
  };
  private inputLocked = false;
  private won = false;
  private ready = false;
  private autoOrbitPref = true;
  private pauseReturn: GameScreen = "title";
  /** Click-to-move destination; repath each step (ice/teleport safe). */
  private pathGoal: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, ui: GameUIHooks) {
    this.view = new WorldView(canvas);
    this.ui = ui;
    try {
      this.autoOrbitPref = localStorage.getItem("blockscape-orbit") !== "0";
    } catch {
      this.autoOrbitPref = true;
    }
    this.view.onTileClick = (cell) => this.handleTileClick(cell);
    this.bindInput();
    this.loop();
  }

  setAutoOrbitPref(on: boolean) {
    this.autoOrbitPref = on;
    try {
      localStorage.setItem("blockscape-orbit", on ? "1" : "0");
    } catch {
      /* ignore */
    }
    const menus =
      this.screen === "title" ||
      this.screen === "levels" ||
      this.screen === "how" ||
      this.screen === "settings" ||
      this.screen === "pause";
    this.view.setAutoOrbit(on && menus);
  }

  getAutoOrbitPref() {
    return this.autoOrbitPref;
  }

  getCurrentLevelId() {
    return this.levelId;
  }

  pause() {
    if (this.screen !== "play" || this.won) return;
    this.setScreen("pause");
  }

  resume() {
    if (this.screen !== "pause") return;
    this.setScreen("play");
    this.view.setAutoOrbit(false);
  }

  /** Call after platform init. Does not change UI screen — caller owns boot flow. */
  async bootstrap() {
    this.progress = await this.loadProgress();
    this.levelId = 1;
    this.level = parseLevel(LEVELS[0]);
    this.state = createSnapshot(this.level);
    this.view.buildLevel(this.level, this.state);
    this.ready = true;
    this.view.setAutoOrbit(true);
    reportProgressPercent(this.progress.completed.length, LEVELS.length);
    this.ui.onProgress(this.progress);
  }

  private async loadProgress(): Promise<Progress> {
    const empty: Progress = {
      unlocked: 1,
      completed: [],
      bestMoves: {},
      bestStars: {},
    };
    try {
      const raw = await loadData(SAVE_KEY);
      if (!raw) {
        // migrate v1
        const v1 = localStorage.getItem("blockscape-progress-v1");
        if (v1) {
          const old = JSON.parse(v1) as Progress;
          return this.sanitizeProgress({
            unlocked: old.unlocked ?? 1,
            completed: old.completed ?? [],
            bestMoves: old.bestMoves ?? {},
            bestStars: old.bestStars ?? {},
            lastPlayed: old.lastPlayed,
          });
        }
        return empty;
      }
      const p = JSON.parse(raw) as Progress;
      return this.sanitizeProgress({
        unlocked: p.unlocked ?? 1,
        completed: p.completed ?? [],
        bestMoves: p.bestMoves ?? {},
        bestStars: p.bestStars ?? {},
        lastPlayed: p.lastPlayed,
      });
    } catch {
      return empty;
    }
  }

  /** Clamp ids / unlock so a bad save cannot skip the player to the finale. */
  private sanitizeProgress(p: Progress): Progress {
    const maxId = LEVELS.length;
    const completed = [
      ...new Set(
        (p.completed ?? []).filter(
          (id) => Number.isFinite(id) && id >= 1 && id <= maxId
        )
      ),
    ].sort((a, b) => a - b);

    let unlocked = Math.floor(Number(p.unlocked) || 1);
    if (!Number.isFinite(unlocked) || unlocked < 1) unlocked = 1;
    unlocked = Math.min(unlocked, maxId);

    // Unlock must cover every completed level (+ next if not finished).
    const maxDone = completed.length ? Math.max(...completed) : 0;
    if (maxDone >= maxId) {
      unlocked = maxId;
    } else if (maxDone > 0) {
      unlocked = Math.max(unlocked, Math.min(maxDone + 1, maxId));
    }

    let lastPlayed = p.lastPlayed;
    if (
      lastPlayed !== undefined &&
      (!Number.isFinite(lastPlayed) || lastPlayed < 1 || lastPlayed > maxId)
    ) {
      lastPlayed = undefined;
    }

    return {
      unlocked,
      completed,
      bestMoves: p.bestMoves ?? {},
      bestStars: p.bestStars ?? {},
      lastPlayed,
    };
  }

  private async saveProgress() {
    await saveData(SAVE_KEY, JSON.stringify(this.progress));
    reportProgressPercent(this.progress.completed.length, LEVELS.length);
    this.ui.onProgress(this.progress);
  }

  getProgress() {
    return this.progress;
  }

  getLevelCount() {
    return LEVELS.length;
  }

  setScreen(screen: GameScreen) {
    if (isAdUiLocked() && screen !== "win") {
      // Block navigation away while a midgame ad request/playback is active.
      return;
    }

    if (screen === "settings" && this.screen === "pause") {
      this.pauseReturn = "pause";
    } else if (screen === "settings") {
      this.pauseReturn = "title";
    }

    this.screen = screen;
    const menuOrbit =
      this.autoOrbitPref &&
      (screen === "title" ||
        screen === "levels" ||
        screen === "how" ||
        screen === "settings" ||
        screen === "pause" ||
        screen === "win");
    this.view.setAutoOrbit(menuOrbit);
    this.view.setOrbitEnabled(true);

    if (screen === "play") {
      gameplayStart();
      setLevelContext(this.levelId);
    } else {
      gameplayStop();
      if (screen !== "pause" && screen !== "win") clearLevelContext();
    }

    this.ui.onScreen(screen);
  }

  leaveSettings() {
    this.setScreen(this.pauseReturn === "pause" ? "pause" : "title");
  }

  startLevel(id: number) {
    if (!this.ready || isAdUiLocked()) return;
    const def = getLevel(id);
    if (!def) return;
    if (id > this.progress.unlocked) {
      sfx.locked();
      return;
    }

    this.levelId = id;
    this.progress.lastPlayed = id;
    this.level = parseLevel(def);
    this.state = createSnapshot(this.level);
    this.history = [];
    this.won = false;
    this.inputLocked = false;
    this.pathGoal = null;
    this.view.buildLevel(this.level, this.state);
    this.view.setAutoOrbit(false);
    this.view.setClickEnabled(true);
    playBgm(bgmTrackForLevel(id));
    this.setScreen("play");
    this.pushHud();
    // Short beginner toast on first levels only (HUD tip handles controls).
    if (id <= 2 && !this.progress.completed.includes(id)) {
      this.ui.onHint(t().tipBeginner);
    } else {
      this.ui.onHint(null);
    }
    // Persist lastPlayed so Continue returns here after a menu visit.
    void this.saveProgress();
  }

  move(dir: Dir) {
    this.pathGoal = null;
    this.attempt(dir);
  }

  private handleTileClick(cell: { x: number; y: number }) {
    if (this.screen !== "play" || this.won || this.inputLocked) return;
    // Ignore void/wall clicks
    const tile = this.level.tiles[cell.y]?.[cell.x];
    if (tile === undefined || tile === "#" || tile === " ") {
      sfx.locked();
      return;
    }

    const path = pathForClick(this.level, this.state, cell);
    if (!path || path.length === 0) {
      if (
        this.state.player.x === cell.x &&
        this.state.player.y === cell.y
      ) {
        return;
      }
      sfx.locked();
      return;
    }

    // Store final goal: last cell after walking path (approx player target)
    this.pathGoal = { x: cell.x, y: cell.y };
    // Take first step immediately if free
    if (!this.view.isAnimating) {
      this.stepAlongPath();
    }
  }

  private stepAlongPath() {
    if (!this.pathGoal || this.screen !== "play" || this.won) {
      this.pathGoal = null;
      return;
    }
    if (this.view.isAnimating || this.inputLocked) return;

    const path = pathForClick(this.level, this.state, this.pathGoal);
    if (!path || path.length === 0) {
      this.pathGoal = null;
      return;
    }

    const dir = path[0];
    const before = {
      x: this.state.player.x,
      y: this.state.player.y,
    };
    this.attempt(dir);
    // If move failed or didn't change anything meaningful, stop
    if (
      this.state.player.x === before.x &&
      this.state.player.y === before.y &&
      this.state.moves === (this.history[this.history.length - 1]?.moves ?? -1)
    ) {
      // attempt may have no-op'd
    }
    // Clear goal when we arrived (or path done after this step was only push)
    if (
      this.state.player.x === this.pathGoal.x &&
      this.state.player.y === this.pathGoal.y
    ) {
      this.pathGoal = null;
    } else if (path.length === 1) {
      // Last planned step done (e.g. push onto crate cell — player may not be on goal)
      this.pathGoal = null;
    }
  }

  resetCamera() {
    this.view.resetCamera();
    this.ui.onHint(t().cameraReset);
  }

  continueGame() {
    const unlocked = Math.min(
      Math.max(this.progress.unlocked || 1, 1),
      LEVELS.length
    );

    // Prefer the earliest unlocked level that is not yet cleared.
    for (let id = 1; id <= unlocked; id++) {
      if (!this.progress.completed.includes(id)) {
        this.startLevel(id);
        return;
      }
    }

    // Campaign fully cleared — resume last played (not always L48).
    const last = this.progress.lastPlayed ?? unlocked;
    this.startLevel(Math.min(Math.max(last, 1), LEVELS.length));
  }

  private pushHud() {
    const def = this.level.def;
    this.ui.onHud({
      levelId: def.id,
      name: levelName(def.id, def.name),
      objective: levelObjective(def.id, def.objective),
      moves: this.state.moves,
      pushes: this.state.pushes,
      goals: goalsFilled(this.level, this.state),
      goalsTotal: this.level.goals.length,
    });
  }

  /** Re-emit HUD / win copy after language change. */
  refreshLocale() {
    if (!this.ready) return;
    if (this.screen === "play" || this.screen === "pause") {
      this.pushHud();
    }
    if (this.screen === "win") {
      const def = this.level.def;
      this.ui.onWin({
        levelId: def.id,
        name: levelName(def.id, def.name),
        moves: this.state.moves,
        pushes: this.state.pushes,
        par: def.parMoves,
        stars: starCount(this.state.moves, def.parMoves),
        isLast: def.id >= LEVELS.length,
      });
    }
  }

  undo() {
    if (this.screen !== "play" || this.won) return;
    if (this.view.isAnimating) return;
    this.pathGoal = null;
    const prev = this.history.pop();
    if (!prev) {
      this.ui.onHint(t().nothingUndo);
      return;
    }
    this.state = prev;
    this.view.syncImmediate(this.state);
    this.pushHud();
    sfx.undo();
    this.ui.onHint(null);
  }

  restart() {
    if (isAdUiLocked()) return;
    if (
      this.screen !== "play" &&
      this.screen !== "pause" &&
      this.screen !== "win"
    ) {
      return;
    }
    this.startLevel(this.levelId);
    sfx.restart();
    this.ui.onHint(t().restarted);
  }

  private attempt(dir: Dir) {
    if (this.screen !== "play" || this.won) return;
    if (this.view.isAnimating || this.inputLocked) return;

    const result = tryMove(this.level, this.state, dir);
    if (!result.ok) {
      this.pathGoal = null;
      return;
    }

    this.history.push(cloneSnapshot(this.state));
    if (this.history.length > 300) this.history.shift();

    const prev = this.state;
    this.state = result.state;
    this.view.faceDir(dir);
    this.view.animateTo(prev, this.state);
    this.pushHud();

    if (result.teleported) {
      sfx.portal();
      this.ui.onHint(t().teleported);
    } else if (result.pushed) {
      sfx.push();
      this.ui.onHint(null);
    } else {
      sfx.move();
    }

    if (isWon(this.level, this.state)) {
      this.pathGoal = null;
      this.inputLocked = true;
      window.setTimeout(() => void this.handleWin(), 300);
    }
  }

  private async handleWin() {
    this.won = true;
    const id = this.level.def.id;
    const stars = starCount(this.state.moves, this.level.def.parMoves);

    if (!this.progress.completed.includes(id)) {
      this.progress.completed.push(id);
    }
    const best = this.progress.bestMoves[id];
    if (best === undefined || this.state.moves < best) {
      this.progress.bestMoves[id] = this.state.moves;
    }
    const bestS = this.progress.bestStars[id] ?? 0;
    if (stars > bestS) this.progress.bestStars[id] = stars;

    if (this.progress.unlocked < id + 1 && id < LEVELS.length) {
      this.progress.unlocked = id + 1;
    }
    if (id === LEVELS.length) {
      this.progress.unlocked = LEVELS.length;
    }
    await this.saveProgress();

    sfx.win();
    // happytime sparingly — campaign clear only (not every level/3★)
    if (id === LEVELS.length) happytime();

    this.ui.onWin({
      levelId: id,
      name: levelName(id, this.level.def.name),
      moves: this.state.moves,
      pushes: this.state.pushes,
      par: this.level.def.parMoves,
      stars,
      isLast: id >= LEVELS.length,
    });
    this.setScreen("win");

    // Midgame ads between levels (not on final screen spam)
    if (id < LEVELS.length) {
      await maybeShowMidgameAd();
    }
  }

  async nextLevel() {
    if (isAdUiLocked()) return;
    if (this.levelId >= LEVELS.length) {
      this.setScreen("title");
      return;
    }
    this.startLevel(this.levelId + 1);
  }

  private bindInput() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (isAdUiLocked()) return;

      // Use e.code (physical key) so WASD works on RU/any layout.
      // e.key would be "ц/ф/ы/в" when the OS keyboard is Russian.
      const code = e.code;

      if (code === "Escape") {
        if (this.screen === "play") this.pause();
        else if (this.screen === "pause") this.resume();
        else if (this.screen === "settings") this.leaveSettings();
        else if (this.screen === "levels" || this.screen === "how") {
          this.setScreen("title");
        } else if (this.screen === "win") {
          this.setScreen("title");
        }
        return;
      }

      if (this.screen !== "play") return;

      if (code === "KeyZ" || ((e.ctrlKey || e.metaKey) && code === "KeyZ")) {
        e.preventDefault();
        this.undo();
        return;
      }
      if (code === "KeyR") {
        e.preventDefault();
        this.restart();
        return;
      }

      const map: Record<string, Dir> = {
        KeyW: "up",
        ArrowUp: "up",
        KeyS: "down",
        ArrowDown: "down",
        KeyA: "left",
        ArrowLeft: "left",
        KeyD: "right",
        ArrowRight: "right",
      };
      const dir = map[code];
      if (dir) {
        e.preventDefault();
        this.pathGoal = null;
        this.attempt(dir);
      }
    });
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    // Path stepping + render only when tab is visible (WorldView also no-ops draw).
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    this.view.update();
    // Continue click-path after each step animation finishes
    if (
      this.pathGoal &&
      this.screen === "play" &&
      !this.view.isAnimating &&
      !this.inputLocked &&
      !this.won
    ) {
      this.stepAlongPath();
    }
  };
}
