/**
 * CrazyGames SDK v3 adapter (Full Launch).
 * Safe no-op fallback when SDK is missing or environment is disabled.
 * Docs: https://docs.crazygames.com/sdk/intro/
 */

import {
  setAdMuted,
  setPlatformMuted,
} from "../audio";

export type SdkEnvironment = "local" | "crazygames" | "disabled" | "none";

export interface GameSettings {
  disableChat?: boolean;
  muteAudio?: boolean;
}

interface CrazySdk {
  init: () => Promise<void>;
  environment?: SdkEnvironment;
  game: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime: () => void;
    loadingStart?: () => void;
    loadingStop?: () => void;
    settings?: GameSettings;
    addSettingsChangeListener?: (listener: (s: GameSettings) => void) => void;
    removeSettingsChangeListener?: (listener: (s: GameSettings) => void) => void;
    reportGameCompletedPercentage?: (pct: number) => void;
    setGameContext?: (ctx: Record<string, string>) => void;
    clearGameContext?: () => void;
  };
  ad: {
    requestAd: (
      type: "midgame" | "rewarded",
      callbacks?: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (err: unknown) => void;
      }
    ) => Promise<void>;
    hasAdblock?: () => Promise<boolean>;
  };
  data?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem?: (key: string) => Promise<void>;
  };
  user?: {
    isUserAccountAvailable?: boolean;
    getUser: () => Promise<{ username?: string; profilePictureUrl?: string } | null>;
    systemInfo?: {
      locale?: string;
    };
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
  }
}

let ready = false;
let env: SdkEnvironment = "none";
let gameplayActive = false;
let levelsSinceAd = 0;
let adUiLocked = false;
let loadingDepth = 0;
let settingsListener: ((s: GameSettings) => void) | null = null;
const AD_EVERY_N_LEVELS = 3;

/** UI lock callbacks for midgame ads (spinner + inert UI). */
type AdUiHandler = (locked: boolean) => void;
let adUiHandler: AdUiHandler | null = null;
type MuteUiHandler = () => void;
let muteUiHandler: MuteUiHandler | null = null;

function sdk(): CrazySdk | null {
  return window.CrazyGames?.SDK ?? null;
}

function usable(): boolean {
  return ready && (env === "local" || env === "crazygames");
}

export function onAdUiLock(handler: AdUiHandler) {
  adUiHandler = handler;
}

export function onMuteUiChange(handler: MuteUiHandler) {
  muteUiHandler = handler;
}

export function isAdUiLocked(): boolean {
  return adUiLocked;
}

function setAdUiLocked(locked: boolean) {
  adUiLocked = locked;
  try {
    adUiHandler?.(locked);
  } catch {
    /* ignore */
  }
  document.body.classList.toggle("ad-locked", locked);
}

function applyMuteAudioSetting(settings: GameSettings | undefined) {
  const force = Boolean(settings?.muteAudio);
  setPlatformMuted(force);
  try {
    muteUiHandler?.();
  } catch {
    /* ignore */
  }
}

function settingsChanged(settings: GameSettings) {
  applyMuteAudioSetting(settings);
}

export async function initPlatform(): Promise<void> {
  const s = sdk();
  if (!s) {
    env = "none";
    ready = false;
    return;
  }
  try {
    await s.init();
    env = (s.environment as SdkEnvironment) || "local";
    ready = true;

    applyMuteAudioSetting(s.game.settings);

    if (typeof s.game.addSettingsChangeListener === "function") {
      settingsListener = settingsChanged;
      s.game.addSettingsChangeListener(settingsListener);
    }
  } catch (e) {
    console.warn("[Blockscape] CrazyGames SDK init failed", e);
    env = "disabled";
    ready = false;
  }
}

/** Track load duration (optional Full SDK metrics). Nested-safe. */
export function loadingStart(): void {
  loadingDepth += 1;
  if (loadingDepth !== 1) return;
  if (!usable()) return;
  try {
    sdk()!.game.loadingStart?.();
  } catch {
    /* ignore */
  }
}

export function loadingStop(): void {
  if (loadingDepth <= 0) return;
  loadingDepth -= 1;
  if (loadingDepth !== 0) return;
  if (!usable()) return;
  try {
    sdk()!.game.loadingStop?.();
  } catch {
    /* ignore */
  }
}

export function getEnvironment(): SdkEnvironment {
  return env;
}

export function isSdkReady(): boolean {
  return usable();
}

export function gameplayStart(): void {
  if (!usable() || gameplayActive) return;
  try {
    sdk()!.game.gameplayStart();
    gameplayActive = true;
  } catch (e) {
    console.warn("[Blockscape] gameplayStart", e);
  }
}

export function gameplayStop(): void {
  if (!usable() || !gameplayActive) return;
  try {
    sdk()!.game.gameplayStop();
    gameplayActive = false;
  } catch (e) {
    console.warn("[Blockscape] gameplayStop", e);
  }
}

/** Use sparingly — special moments only (e.g. campaign clear). */
export function happytime(): void {
  if (!usable()) return;
  try {
    sdk()!.game.happytime();
  } catch {
    /* ignore */
  }
}

export function reportProgressPercent(completedLevels: number, totalLevels: number): void {
  if (!usable() || totalLevels <= 0) return;
  const pct = Math.max(
    0,
    Math.min(100, Math.round((completedLevels / totalLevels) * 100))
  );
  try {
    sdk()!.game.reportGameCompletedPercentage?.(pct);
  } catch {
    /* ignore */
  }
}

export function setLevelContext(levelId: number): void {
  if (!usable()) return;
  try {
    sdk()!.game.setGameContext?.({ level: String(levelId) });
  } catch {
    /* ignore */
  }
}

export function clearLevelContext(): void {
  if (!usable()) return;
  try {
    sdk()!.game.clearGameContext?.();
  } catch {
    /* ignore */
  }
}

/**
 * Midgame ad every N cleared levels.
 * - Locks UI for the whole request (auction latency).
 * - Mutes game audio only on `adStarted` (not on unfilled requests).
 * - Always continues on finish/error/timeout.
 */
export async function maybeShowMidgameAd(): Promise<void> {
  levelsSinceAd += 1;
  if (levelsSinceAd < AD_EVERY_N_LEVELS) return;
  if (!usable()) return;

  levelsSinceAd = 0;
  gameplayStop();
  setAdUiLocked(true);

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setAdMuted(false);
      setAdUiLocked(false);
      try {
        muteUiHandler?.();
      } catch {
        /* ignore */
      }
      resolve();
    };

    try {
      const p = sdk()!.ad.requestAd("midgame", {
        adStarted: () => {
          setAdMuted(true);
          try {
            muteUiHandler?.();
          } catch {
            /* ignore */
          }
        },
        adFinished: finish,
        adError: finish,
      });
      if (p && typeof p.then === "function") {
        p.then(finish).catch(finish);
      }
      // Safety if callbacks never fire
      window.setTimeout(finish, 120_000);
    } catch {
      finish();
    }
  });
}

export async function loadData(key: string): Promise<string | null> {
  if (usable() && sdk()?.data) {
    try {
      const v = await sdk()!.data!.getItem(key);
      if (v != null) return v;
    } catch {
      /* fall through */
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function saveData(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  if (usable() && sdk()?.data) {
    try {
      await sdk()!.data!.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}
