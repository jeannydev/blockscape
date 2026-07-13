/**
 * Audio: procedural SFX (Web Audio) + looping BGM from /public/audio.
 * Mute layers: user · CrazyGames platform · midgame ad.
 */

let ctx: AudioContext | null = null;

/** Player preference (localStorage). */
let userMuted = false;
/** CrazyGames SDK `game.settings.muteAudio` — always wins over user preference. */
let platformMuted = false;
/** Temporary mute while a midgame/rewarded video ad is playing. */
let adMuted = false;
/** SFX master (0–1). */
let sfxVolume = 0.7;
/** Music master (0–1). */
let musicVolume = 0.45;

export type BgmTrack = "diorama" | "portals" | "tactics";

const BGM_URLS: Record<BgmTrack, string> = {
  diorama: "/audio/Crystal Diorama.mp3",
  portals: "/audio/Crystal Portal Drift.mp3",
  tactics: "/audio/Crystal Tactics.mp3",
};

let musicEl: HTMLAudioElement | null = null;
let currentTrack: BgmTrack | null = null;
let musicWanted = true;
let fadeTimer = 0;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** True when no game audio should play (user, platform, or ad). */
export function isEffectivelyMuted(): boolean {
  return userMuted || platformMuted || adMuted;
}

/**
 * Player mute toggle. No-ops enable when platform muteAudio is forced on.
 * Does not clear platform/ad mute layers.
 */
export function setMuted(on: boolean) {
  if (!on && platformMuted) {
    // Platform mute takes priority — keep user pref as unmuted so audio
    // returns when CrazyGames lifts muteAudio.
    userMuted = false;
  } else {
    userMuted = on;
  }
  try {
    localStorage.setItem("blockscape-muted", userMuted ? "1" : "0");
  } catch {
    /* ignore */
  }
  applyMusicVolume();
}

/** Effective mute for HUD / settings UI. */
export function isMuted(): boolean {
  return isEffectivelyMuted();
}

export function isUserMuted(): boolean {
  return userMuted;
}

export function isPlatformMuted(): boolean {
  return platformMuted;
}

/** Called from CrazyGames SDK settings (muteAudio). */
export function setPlatformMuted(on: boolean) {
  platformMuted = on;
  applyMusicVolume();
}

/**
 * Mute only while a video ad is actually playing (`adStarted`).
 * Do not call on ad request — unfilled ads must not flash-mute.
 */
export function setAdMuted(on: boolean) {
  adMuted = on;
  applyMusicVolume();
}

export function isAdMuted(): boolean {
  return adMuted;
}

/** @deprecated use setSfxVolume — kept as alias for SFX. */
export function setVolume(v: number) {
  setSfxVolume(v);
}

export function getVolume(): number {
  return sfxVolume;
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem("blockscape-volume", String(sfxVolume));
  } catch {
    /* ignore */
  }
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function setMusicVolume(v: number) {
  musicVolume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem("blockscape-music-volume", String(musicVolume));
  } catch {
    /* ignore */
  }
  applyMusicVolume();
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function loadMutePref() {
  try {
    userMuted = localStorage.getItem("blockscape-muted") === "1";
    const v = localStorage.getItem("blockscape-volume");
    if (v != null) sfxVolume = Math.min(1, Math.max(0, parseFloat(v)));
    const mv = localStorage.getItem("blockscape-music-volume");
    if (mv != null) musicVolume = Math.min(1, Math.max(0, parseFloat(mv)));
  } catch {
    userMuted = false;
  }
  applyMusicVolume();
}

function ensureMusicEl(): HTMLAudioElement {
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.preload = "auto";
    musicEl.crossOrigin = "anonymous";
  }
  return musicEl;
}

function effectiveMusicGain(): number {
  if (isEffectivelyMuted() || !musicWanted) return 0;
  return musicVolume;
}

function applyMusicVolume() {
  if (!musicEl) return;
  musicEl.volume = Math.min(1, Math.max(0, effectiveMusicGain()));
}

/**
 * Resume WebAudio + try to keep BGM playing after gesture / tab focus.
 */
export function resumeAudio() {
  try {
    const c = ac();
    // "interrupted" is used on some WebKit builds after backgrounding.
    if (c.state !== "running") void c.resume();
  } catch {
    /* ignore */
  }
  if (musicWanted && musicEl && currentTrack) {
    applyMusicVolume();
    if (musicEl.paused && effectiveMusicGain() > 0) {
      void musicEl.play().catch(() => {
        /* autoplay blocked until gesture */
      });
    }
  }
}

/** Map campaign chapter (1–5) → BGM variation. */
export function bgmTrackForChapter(chapter: number): BgmTrack {
  if (chapter <= 2) return "diorama";
  if (chapter === 3) return "portals";
  return "tactics";
}

export function bgmTrackForLevel(levelId: number): BgmTrack {
  if (levelId <= 8) return "diorama";
  if (levelId <= 18) return "diorama";
  if (levelId <= 28) return "portals";
  if (levelId <= 38) return "tactics";
  return "tactics";
}

/** Soft-switch BGM; no-ops if already on this track. */
export function playBgm(track: BgmTrack) {
  musicWanted = true;
  const el = ensureMusicEl();
  const url = BGM_URLS[track];

  if (currentTrack === track && el.src && !el.error) {
    applyMusicVolume();
    if (el.paused && effectiveMusicGain() > 0) {
      void el.play().catch(() => {
        /* ignore */
      });
    }
    return;
  }

  currentTrack = track;
  const nextSrc = encodeURI(url);
  const abs = new URL(nextSrc, window.location.href).href;
  if (el.src !== abs) {
    el.src = nextSrc;
  }

  applyMusicVolume();
  void el.play().catch(() => {
    /* needs user gesture — resumeAudio will retry */
  });
}

/** Fade out then stop (optional soft stop). */
export function stopBgm(fadeMs = 400) {
  musicWanted = false;
  if (!musicEl) return;
  window.clearInterval(fadeTimer);
  if (fadeMs <= 0 || !musicEl.volume) {
    musicEl.pause();
    return;
  }
  const start = musicEl.volume;
  const steps = 8;
  let i = 0;
  fadeTimer = window.setInterval(() => {
    i++;
    if (!musicEl) {
      window.clearInterval(fadeTimer);
      return;
    }
    musicEl.volume = start * (1 - i / steps);
    if (i >= steps) {
      window.clearInterval(fadeTimer);
      musicEl.pause();
      applyMusicVolume();
    }
  }, fadeMs / steps);
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  slideTo?: number
) {
  if (isEffectivelyMuted() || sfxVolume <= 0.001) return;
  const c = ac();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const amp = gain * sfxVolume;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(amp, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  move: () => beep(220, 0.05, "triangle", 0.04),
  push: () => beep(140, 0.08, "square", 0.05, 90),
  undo: () => beep(320, 0.06, "sine", 0.04, 200),
  portal: () => {
    beep(480, 0.1, "sine", 0.05, 720);
    window.setTimeout(() => beep(720, 0.08, "sine", 0.04), 40);
  },
  win: () => {
    beep(523, 0.1, "sine", 0.06);
    window.setTimeout(() => beep(659, 0.1, "sine", 0.06), 90);
    window.setTimeout(() => beep(784, 0.18, "sine", 0.07), 180);
  },
  click: () => beep(600, 0.04, "sine", 0.035),
  hover: () => beep(880, 0.025, "sine", 0.02),
  restart: () => beep(180, 0.1, "triangle", 0.05, 120),
  locked: () => beep(90, 0.12, "sawtooth", 0.03),
};
