import "./style.css";
import { Game, type GameScreen, type Progress } from "./game/Game";
import type { Dir } from "./types";
import { LEVELS, chapterOf } from "./levels";
import {
  getLang,
  loadLangPref,
  setLang,
  t,
  type Lang,
} from "./i18n";
import {
  bgmTrackForLevel,
  bindAudioLifecycle,
  getMusicVolume,
  getVolume,
  isMuted,
  isPlatformMuted,
  isUserMuted,
  loadMutePref,
  playBgm,
  resumeAudio,
  setMuted,
  setMusicVolume,
  setVolume,
  sfx,
} from "./audio";
import {
  getEnvironment,
  initPlatform,
  isAdUiLocked,
  loadingStart,
  loadingStop,
  onAdUiLock,
  onMuteUiChange,
} from "./platform/crazygames";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

const el = {
  hud: document.getElementById("hud")!,
  levelTitle: document.getElementById("level-title")!,
  moveCount: document.getElementById("move-count")!,
  goalCount: document.getElementById("goal-count")!,
  objective: document.getElementById("objective")!,
  hint: document.getElementById("hint")!,
  dpad: document.getElementById("dpad")!,
  title: document.getElementById("screen-title")!,
  levels: document.getElementById("screen-levels")!,
  how: document.getElementById("screen-how")!,
  settings: document.getElementById("screen-settings")!,
  pause: document.getElementById("screen-pause")!,
  win: document.getElementById("screen-win")!,
  winTitle: document.getElementById("win-title")!,
  winStats: document.getElementById("win-stats")!,
  winStars: document.getElementById("win-stars")!,
  levelGrid: document.getElementById("level-grid")!,
  menuProgress: document.getElementById("menu-progress")!,
  btnPlay: document.getElementById("btn-play")!,
  btnPlayLabel: document.getElementById("btn-play-label")!,
  btnLevels: document.getElementById("btn-levels")!,
  btnHow: document.getElementById("btn-how")!,
  btnSettings: document.getElementById("btn-settings")!,
  btnLevelsBack: document.getElementById("btn-levels-back")!,
  btnHowBack: document.getElementById("btn-how-back")!,
  btnSettingsBack: document.getElementById("btn-settings-back")!,
  btnResume: document.getElementById("btn-resume")!,
  btnPauseRestart: document.getElementById("btn-pause-restart")!,
  btnPauseSettings: document.getElementById("btn-pause-settings")!,
  btnPauseMenu: document.getElementById("btn-pause-menu")!,
  btnNext: document.getElementById("btn-next")!,
  btnWinRestart: document.getElementById("btn-win-restart")!,
  btnWinMenu: document.getElementById("btn-win-menu")!,
  btnUndo: document.getElementById("btn-undo")!,
  btnRestart: document.getElementById("btn-restart")!,
  btnCam: document.getElementById("btn-cam")!,
  btnMute: document.getElementById("btn-mute")!,
  btnMenu: document.getElementById("btn-menu")!,
  settingSfx: document.getElementById("setting-sfx")!,
  settingVolume: document.getElementById("setting-volume") as HTMLInputElement,
  settingVolumeVal: document.getElementById("setting-volume-val")!,
  settingMusicVolume: document.getElementById(
    "setting-music-volume"
  ) as HTMLInputElement,
  settingMusicVolumeVal: document.getElementById("setting-music-volume-val")!,
  settingOrbit: document.getElementById("setting-orbit")!,
  langEn: document.getElementById("lang-en")!,
  langRu: document.getElementById("lang-ru")!,
  howtoList: document.getElementById("howto-list")!,
  adBlock: document.getElementById("ad-block")!,
  adBlockText: document.getElementById("ad-block-text")!,
};

function text(id: string, value: string) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function show(node: HTMLElement, on: boolean) {
  node.classList.toggle("hidden", !on);
  node.toggleAttribute("hidden", !on);
  node.setAttribute("aria-hidden", on ? "false" : "true");
  if ("inert" in node) {
    (node as HTMLElement & { inert: boolean }).inert = !on;
  }
}

function setScreen(screen: GameScreen) {
  show(el.title, screen === "title");
  show(el.levels, screen === "levels");
  show(el.how, screen === "how");
  show(el.settings, screen === "settings");
  show(el.pause, screen === "pause");
  show(el.win, screen === "win");
  const playing = screen === "play";
  show(el.hud, playing);
  show(el.dpad, playing);
  if (!playing) show(el.hint, false);
  document.body.dataset.screen = screen;
}

function setToggle(btn: HTMLElement, on: boolean) {
  btn.setAttribute("aria-checked", on ? "true" : "false");
}

function applyLocale() {
  const s = t();
  document.documentElement.lang = getLang() === "ru" ? "ru" : "en";

  text("i18n-eyebrow", s.eyebrow);
  text("i18n-tagline", s.tagline);
  text("btn-levels-label", s.levels);
  text("btn-how-label", s.how);
  text("btn-settings-label", s.settings);
  text("i18n-footer-controls", s.footerControls);

  text("i18n-options", s.options);
  text("i18n-settings-title", s.settings);
  text("i18n-settings-back", s.back);
  text("i18n-sfx-name", s.soundEffects);
  text("i18n-sfx-desc", s.soundEffectsDesc);
  text("i18n-vol-name", s.volume);
  text("i18n-vol-desc", s.volumeDesc);
  text("i18n-music-vol-name", s.musicVolume);
  text("i18n-music-vol-desc", s.musicVolumeDesc);
  text("i18n-orbit-name", s.autoOrbit);
  text("i18n-orbit-desc", s.autoOrbitDesc);
  text("i18n-lang-name", s.language);
  text("i18n-lang-desc", s.languageDesc);
  text("i18n-controls-name", s.controls);
  text("i18n-controls-desc", s.controlsDesc);

  text("i18n-campaign", s.campaign);
  text("i18n-levels-title", s.levelsTitle);
  text("i18n-levels-back", s.back);

  text("i18n-manual", s.manual);
  text("i18n-how-title", s.howTitle);
  text("i18n-how-back", s.back);

  const howtoTexts = el.howtoList.querySelectorAll(".howto-text");
  s.howItems.forEach((item, i) => {
    if (howtoTexts[i]) howtoTexts[i].textContent = item;
  });

  text("i18n-pause-kicker", s.pause);
  text("i18n-pause-title", s.gamePaused);
  text("i18n-resume", s.resume);
  text("i18n-pause-restart", s.restartLevel);
  text("i18n-pause-settings", s.settings);
  text("i18n-pause-menu", s.menu);

  text("i18n-win-kicker", s.levelCleared);
  text("i18n-next", s.next);
  text("i18n-again", s.again);
  text("i18n-win-menu", s.menu);

  text("i18n-moves", s.moves);
  text("i18n-goals", s.goals);
  text("i18n-tip-desktop", s.tipDesktop);
  text("i18n-tip-mobile", s.tipMobile);

  el.langEn.classList.toggle("active", getLang() === "en");
  el.langRu.classList.toggle("active", getLang() === "ru");

  updatePlayLabel(game.getProgress());
  renderLevelGrid(game.getProgress());
  updateMuteBtn();
}

function syncSettingsUi() {
  const platform = isPlatformMuted();
  // Show effective mute; when platform forces mute, toggle cannot re-enable audio.
  setToggle(el.settingSfx, !isMuted());
  el.settingSfx.toggleAttribute("disabled", platform);
  el.settingSfx.setAttribute("aria-disabled", platform ? "true" : "false");
  el.settingVolume.value = String(Math.round(getVolume() * 100));
  el.settingVolumeVal.textContent = `${Math.round(getVolume() * 100)}%`;
  el.settingVolume.disabled = platform;
  el.settingMusicVolume.value = String(Math.round(getMusicVolume() * 100));
  el.settingMusicVolumeVal.textContent = `${Math.round(getMusicVolume() * 100)}%`;
  el.settingMusicVolume.disabled = platform;
  setToggle(el.settingOrbit, game.getAutoOrbitPref());
  el.langEn.classList.toggle("active", getLang() === "en");
  el.langRu.classList.toggle("active", getLang() === "ru");
  updateMuteBtn();
}

function updateMuteBtn() {
  const muted = isMuted();
  const platform = isPlatformMuted();
  el.btnMute.textContent = muted ? "♫" : "♪";
  el.btnMute.title = platform
    ? t().platformMuted
    : muted
      ? t().muted
      : t().unmuted;
  el.btnMute.classList.toggle("off", muted);
  el.btnMute.toggleAttribute("disabled", platform);
}

function updatePlayLabel(progress: Progress) {
  const s = t();
  const started = progress.completed.length > 0 || progress.unlocked > 1;
  el.btnPlayLabel.textContent = started ? s.continue : s.newGame;
  const stars = Object.values(progress.bestStars).reduce((a, b) => a + b, 0);
  const maxStars = LEVELS.length * 3;
  el.menuProgress.textContent = started
    ? s.progressMid(progress.completed.length, LEVELS.length, stars, maxStars)
    : s.progressFresh(LEVELS.length);
}

function renderLevelGrid(progress: Progress) {
  el.levelGrid.innerHTML = "";
  let lastChapter = 0;
  for (const level of LEVELS) {
    const ch = chapterOf(level.id);
    if (ch !== lastChapter) {
      lastChapter = ch;
      const label = document.createElement("div");
      label.className = `chapter-label chapter-${ch}`;
      label.textContent = t().chapter(ch);
      el.levelGrid.appendChild(label);
    }

    const btn = document.createElement("button");
    btn.className = `level-btn chapter-${ch}`;
    btn.type = "button";
    const done = progress.completed.includes(level.id);
    const locked = level.id > progress.unlocked;
    if (done) btn.classList.add("done");
    btn.disabled = locked;

    const num = document.createElement("span");
    num.textContent = String(level.id);
    btn.appendChild(num);

    if (done) {
      const stars = progress.bestStars[level.id] ?? 1;
      const s = document.createElement("small");
      s.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
      btn.appendChild(s);
    } else if (locked) {
      const s = document.createElement("small");
      s.textContent = "•";
      btn.appendChild(s);
    }

    btn.addEventListener("click", () => {
      sfx.click();
      game.startLevel(level.id);
    });
    el.levelGrid.appendChild(btn);
  }
  updatePlayLabel(progress);
}

let hintTimer = 0;

const game = new Game(canvas, {
  onScreen: (s) => {
    setScreen(s);
    if (s === "settings") syncSettingsUi();
    if (s === "title") updatePlayLabel(game.getProgress());
  },
  onHud: (data) => {
    el.levelTitle.textContent = `${data.levelId}. ${data.name}`;
    el.moveCount.textContent = String(data.moves);
    el.goalCount.textContent = `${data.goals}/${data.goalsTotal}`;
    el.objective.textContent = data.objective;
  },
  onWin: (data) => {
    const s = t();
    el.winTitle.textContent = data.isLast ? s.campaignDone : data.name;
    el.winStars.textContent = "★".repeat(data.stars) + "☆".repeat(3 - data.stars);
    el.winStats.textContent = s.winStats(
      data.moves,
      data.pushes,
      data.par,
      data.stars
    );
    // Campaign end: primary = Menu, secondary = Replay — hide the extra Menu.
    text("i18n-next", data.isLast ? s.menu : s.next);
    show(el.btnNext, true);
    show(el.btnWinMenu, !data.isLast);
  },
  onProgress: (p) => renderLevelGrid(p),
  onHint: (textVal) => {
    window.clearTimeout(hintTimer);
    if (!textVal) {
      show(el.hint, false);
      return;
    }
    el.hint.textContent = textVal;
    show(el.hint, true);
    hintTimer = window.setTimeout(() => show(el.hint, false), 1400);
  },
});

function bindMenuHover(root: ParentNode = document) {
  for (const btn of root.querySelectorAll<HTMLElement>(".menu-btn, .level-btn, .icon-btn, .lang-btn")) {
    btn.addEventListener("mouseenter", () => {
      if (!btn.hasAttribute("disabled")) sfx.hover();
    });
  }
}

function switchLang(next: Lang) {
  if (next === getLang()) return;
  setLang(next);
  sfx.click();
  applyLocale();
  syncSettingsUi();
  game.refreshLocale();
}

function setAdBlockVisible(locked: boolean) {
  el.adBlockText.textContent = t().adLoading;
  show(el.adBlock, locked);
}

onAdUiLock(setAdBlockVisible);
onMuteUiChange(() => {
  updateMuteBtn();
  syncSettingsUi();
});

async function boot() {
  loadMutePref();
  loadLangPref();
  updateMuteBtn();

  try {
    // Init SDK first so loadingStart/Stop metrics can report to the platform.
    await initPlatform();
    loadingStart();
    await game.bootstrap();
  } catch (e) {
    console.error("[Blockscape] boot error", e);
  } finally {
    loadingStop();
  }

  console.info(
    `[Blockscape] ready · SDK env: ${getEnvironment()} · levels: ${LEVELS.length}`
  );

  applyLocale();
  bindMenuHover();
  syncSettingsUi();

  // CrazyGames Full Launch requires 0 clicks to play; local/dev opens the menu.
  if (getEnvironment() === "crazygames") {
    game.continueGame();
    playBgm(bgmTrackForLevel(game.getCurrentLevelId()));
  } else {
    game.setScreen("title");
    playBgm("diorama");
  }
}

// Resume WebAudio + BGM after first gesture + after iOS interrupt/background.
window.addEventListener(
  "pointerdown",
  () => {
    resumeAudio();
    playBgm(bgmTrackForLevel(game.getCurrentLevelId()));
  },
  { passive: true }
);
document.addEventListener(
  "touchend",
  () => {
    resumeAudio();
    playBgm(bgmTrackForLevel(game.getCurrentLevelId()));
  },
  { passive: true }
);
// Pause BGM/SFX when leaving this tab; resume when returning.
bindAudioLifecycle();

el.btnPlay.addEventListener("click", () => {
  resumeAudio();
  sfx.click();
  game.continueGame();
});

el.btnLevels.addEventListener("click", () => {
  sfx.click();
  game.setScreen("levels");
});

el.btnHow.addEventListener("click", () => {
  sfx.click();
  game.setScreen("how");
});

el.btnSettings.addEventListener("click", () => {
  sfx.click();
  game.setScreen("settings");
});

el.btnLevelsBack.addEventListener("click", () => {
  sfx.click();
  game.setScreen("title");
});
el.btnHowBack.addEventListener("click", () => {
  sfx.click();
  game.setScreen("title");
});
el.btnSettingsBack.addEventListener("click", () => {
  sfx.click();
  game.leaveSettings();
});

el.btnResume.addEventListener("click", () => {
  sfx.click();
  game.resume();
});
el.btnPauseRestart.addEventListener("click", () => {
  sfx.click();
  game.restart();
});
el.btnPauseSettings.addEventListener("click", () => {
  sfx.click();
  game.setScreen("settings");
});
el.btnPauseMenu.addEventListener("click", () => {
  sfx.click();
  game.setScreen("title");
});

el.btnMenu.addEventListener("click", () => {
  sfx.click();
  game.pause();
});
el.btnUndo.addEventListener("click", () => game.undo());
el.btnRestart.addEventListener("click", () => game.restart());
el.btnCam.addEventListener("click", () => game.resetCamera());
el.btnMute.addEventListener("click", () => {
  if (isPlatformMuted()) return;
  setMuted(!isUserMuted());
  updateMuteBtn();
  syncSettingsUi();
  if (!isMuted()) {
    resumeAudio();
    sfx.click();
  }
});

el.btnNext.addEventListener("click", () => {
  if (isAdUiLocked()) return;
  sfx.click();
  void game.nextLevel();
});
el.btnWinRestart.addEventListener("click", () => {
  if (isAdUiLocked()) return;
  sfx.click();
  game.restart();
});
el.btnWinMenu.addEventListener("click", () => {
  if (isAdUiLocked()) return;
  sfx.click();
  game.setScreen("title");
});

el.settingSfx.addEventListener("click", () => {
  if (isPlatformMuted()) return;
  setMuted(!isUserMuted());
  syncSettingsUi();
  if (!isMuted()) {
    resumeAudio();
    sfx.click();
  }
});

el.settingVolume.addEventListener("input", () => {
  if (isPlatformMuted()) return;
  const v = Number(el.settingVolume.value) / 100;
  setVolume(v);
  if (v > 0 && isUserMuted()) setMuted(false);
  syncSettingsUi();
});

el.settingVolume.addEventListener("change", () => {
  resumeAudio();
  sfx.click();
});

el.settingMusicVolume.addEventListener("input", () => {
  if (isPlatformMuted()) return;
  const v = Number(el.settingMusicVolume.value) / 100;
  setMusicVolume(v);
  if (v > 0 && isUserMuted()) setMuted(false);
  resumeAudio();
  syncSettingsUi();
});

el.settingMusicVolume.addEventListener("change", () => {
  resumeAudio();
  sfx.click();
});

el.settingOrbit.addEventListener("click", () => {
  const next = !game.getAutoOrbitPref();
  game.setAutoOrbitPref(next);
  sfx.click();
  syncSettingsUi();
});

el.langEn.addEventListener("click", () => switchLang("en"));
el.langRu.addEventListener("click", () => switchLang("ru"));

for (const btn of el.dpad.querySelectorAll<HTMLButtonElement>(".dpad-btn")) {
  const dir = btn.dataset.dir as Dir;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.move(dir);
  });
}
el.dpad.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

void boot();
