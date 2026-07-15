/** EN / RU UI strings + language preference. */

export type Lang = "en" | "ru";

type Dict = {
  brand: string;
  eyebrow: string;
  tagline: string;
  play: string;
  continue: string;
  newGame: string;
  levels: string;
  how: string;
  back: string;
  next: string;
  again: string;
  menu: string;
  settings: string;
  resume: string;
  pause: string;
  gamePaused: string;
  restartLevel: string;
  muted: string;
  unmuted: string;
  soundEffects: string;
  soundEffectsDesc: string;
  volume: string;
  volumeDesc: string;
  musicVolume: string;
  musicVolumeDesc: string;
  autoOrbit: string;
  autoOrbitDesc: string;
  language: string;
  languageDesc: string;
  controls: string;
  controlsDesc: string;
  options: string;
  campaign: string;
  levelsTitle: string;
  howTitle: string;
  manual: string;
  levelCleared: string;
  campaignDone: string;
  moves: string;
  goals: string;
  tipDesktop: string;
  tipMobile: string;
  footerControls: string;
  howItems: readonly string[];
  cameraReset: string;
  nothingUndo: string;
  restarted: string;
  teleported: string;
  adLoading: string;
  platformMuted: string;
  loading: string;
  loadingEngine: string;
  loadingWorld: string;
  loadingAudio: string;
  loadingReady: string;
  chapter: (n: number) => string;
  progressFresh: (levels: number) => string;
  progressMid: (done: number, total: number, stars: number, maxStars: number) => string;
  winStats: (moves: number, pushes: number, par?: number, stars?: number) => string;
};

const en: Dict = {
  brand: "BLOCKSCAPE",
  eyebrow: "2.5D ISOMETRIC PUZZLE",
  tagline: "Push crystals. Open gates. Master ice and portals.",
  play: "Play",
  continue: "Continue",
  newGame: "New Game",
  levels: "Level Select",
  how: "How to Play",
  back: "Back",
  next: "Next",
  again: "Replay",
  menu: "Main Menu",
  settings: "Settings",
  resume: "Resume",
  pause: "Paused",
  gamePaused: "Game Paused",
  restartLevel: "Restart Level",
  muted: "Sound off",
  unmuted: "Sound on",
  soundEffects: "Sound effects",
  soundEffectsDesc: "Moves, pushes, UI feedback",
  volume: "SFX volume",
  volumeDesc: "Moves, pushes, UI feedback",
  musicVolume: "Music volume",
  musicVolumeDesc: "Background soundtrack",
  autoOrbit: "Camera auto-orbit",
  autoOrbitDesc: "Slow spin on menus",
  language: "Language",
  languageDesc: "Interface language",
  controls: "Controls",
  controlsDesc: "WASD / arrows · Z undo · R restart · Drag camera · Esc menu",
  options: "Options",
  campaign: "Campaign",
  levelsTitle: "Level Select",
  howTitle: "How to Play",
  manual: "Manual",
  levelCleared: "Level cleared",
  campaignDone: "Campaign complete!",
  moves: "moves",
  goals: "goals",
  tipDesktop: "Click tile · Drag orbit · WASD · Z undo · R restart · Esc pause",
  tipMobile: "Tap tile · Drag orbit · Pad · ☰ pause",
  footerControls: "Click tile · WASD · Drag orbit",
  howItems: [
    "Walk the grid and push crystals onto orange goals",
    "Every goal needs a crystal — Undo if you get stuck",
    "Plates open doors permanently",
    "Portals A ↔ B teleport you (not crates)",
    "Ice slides you and crates until blocked",
    "Drag to orbit the camera and plan routes",
  ],
  cameraReset: "Camera reset",
  nothingUndo: "Nothing to undo",
  restarted: "Level restarted",
  teleported: "Teleported!",
  adLoading: "Please wait…",
  platformMuted: "Sound off (site)",
  loading: "Loading…",
  loadingEngine: "Starting engine…",
  loadingWorld: "Building world…",
  loadingAudio: "Loading soundtrack…",
  loadingReady: "Ready",
  chapter: (n) => `Chapter ${n}`,
  progressFresh: (levels) => `${levels} levels · 5 chapters`,
  progressMid: (done, total, stars, maxStars) =>
    `${done}/${total} cleared · ${stars}/${maxStars}★`,
  winStats: (moves, pushes, par, stars) => {
    const p =
      par !== undefined
        ? moves <= par
          ? ` · par ${par} ✓`
          : ` · par ${par}`
        : "";
    const s = stars !== undefined ? ` · ${stars}★` : "";
    return `${moves} moves · ${pushes} pushes${p}${s}`;
  },
};

const ru: Dict = {
  brand: "BLOCKSCAPE",
  eyebrow: "2.5D ИЗОМЕТРИЧЕСКАЯ ГОЛОВОЛОМКА",
  tagline: "Толкай кристаллы. Открывай двери. Освой лёд и порталы.",
  play: "Играть",
  continue: "Продолжить",
  newGame: "Новая игра",
  levels: "Выбор уровня",
  how: "Как играть",
  back: "Назад",
  next: "Дальше",
  again: "Ещё раз",
  menu: "В меню",
  settings: "Настройки",
  resume: "Продолжить",
  pause: "Пауза",
  gamePaused: "Игра на паузе",
  restartLevel: "Заново",
  muted: "Звук выкл",
  unmuted: "Звук вкл",
  soundEffects: "Звуки",
  soundEffectsDesc: "Ходы, толчки, интерфейс",
  volume: "Громкость эффектов",
  volumeDesc: "Ходы, толчки, интерфейс",
  musicVolume: "Громкость музыки",
  musicVolumeDesc: "Фоновый саундтрек",
  autoOrbit: "Авто-оборот камеры",
  autoOrbitDesc: "Медленное вращение в меню",
  language: "Язык",
  languageDesc: "Язык интерфейса",
  controls: "Управление",
  controlsDesc: "WASD / стрелки · Z отмена · R заново · Тяни камеру · Esc меню",
  options: "Параметры",
  campaign: "Кампания",
  levelsTitle: "Выбор уровня",
  howTitle: "Как играть",
  manual: "Справка",
  levelCleared: "Уровень пройден",
  campaignDone: "Кампания пройдена!",
  moves: "ходы",
  goals: "цели",
  tipDesktop: "Клик по клетке · Тяни обзор · WASD · Z отмена · R · Esc пауза",
  tipMobile: "Тап по клетке · Тяни обзор · Пад · ☰ пауза",
  footerControls: "Клик по клетке · WASD · Тяни обзор",
  howItems: [
    "Ходи по клеткам и толкай кристаллы на оранжевые цели",
    "Каждая цель нужна кристаллу — используй отмену, если застрял",
    "Плиты навсегда открывают двери",
    "Порталы A ↔ B телепортируют тебя (не блоки)",
    "На льду ты и блоки скользите до упора",
    "Крути камеру, чтобы спланировать маршрут",
  ],
  cameraReset: "Камера сброшена",
  nothingUndo: "Нечего отменять",
  restarted: "Уровень перезапущен",
  teleported: "Телепорт!",
  adLoading: "Подождите…",
  platformMuted: "Звук выкл (сайт)",
  loading: "Загрузка…",
  loadingEngine: "Запуск движка…",
  loadingWorld: "Сборка мира…",
  loadingAudio: "Загрузка музыки…",
  loadingReady: "Готово",
  chapter: (n) => `Глава ${n}`,
  progressFresh: (levels) => `${levels} уровней · 5 глав`,
  progressMid: (done, total, stars, maxStars) =>
    `${done}/${total} пройдено · ${stars}/${maxStars}★`,
  winStats: (moves, pushes, par, stars) => {
    const p =
      par !== undefined
        ? moves <= par
          ? ` · норма ${par} ✓`
          : ` · норма ${par}`
        : "";
    const s = stars !== undefined ? ` · ${stars}★` : "";
    return `${moves} ходов · ${pushes} толчков${p}${s}`;
  },
};

/** Russian level titles & objectives (EN lives on LevelDef in levels.ts). */
const ruLevels: Record<number, { name: string; objective: string }> = {
  1: {
    name: "Первый толчок",
    objective: "Затолкни кристалл на оранжевую цель.",
  },
  2: {
    name: "Два кристалла",
    objective: "Оба кристалла должны стоять на целях.",
  },
  3: {
    name: "Коридор",
    objective: "Не загони ящик в угол.",
  },
  4: {
    name: "Плита и дверь",
    objective: "Наступи на плиту, чтобы открыть дверь, затем поставь кристалл на цель.",
  },
  5: {
    name: "Комната с ключом",
    objective: "Нажми плиту наверху, затем протолкни кристалл через ворота к цели.",
  },
  6: {
    name: "Каток",
    objective: "Затолкни кристалл на лёд — он скользит, пока что-то его не остановит.",
  },
  7: {
    name: "Прыжок в портал",
    objective: "Войди в портал A, чтобы оказаться у B.",
  },
  8: {
    name: "Зеркало",
    objective: "Два кристалла, две цели — держи симметрию в уме.",
  },
  9: {
    name: "Шлюзы",
    objective: "Две двери подряд. У каждой своя плита.",
  },
  10: {
    name: "Ледяной лабиринт",
    objective: "Проскользи кристаллом по ледяным коридорам. Неверный поворот — промах.",
  },
  11: {
    name: "Портальный спуск",
    objective: "Используй портал, чтобы попасть в нижнее хранилище.",
  },
  12: {
    name: "Архитектор",
    objective: "Нажми плиту, войди в портал, поставь оба кристалла.",
  },
  13: {
    name: "Шаг в сторону",
    objective: "Оставь себе место перед финальным толчком.",
  },
  14: {
    name: "Тройка",
    objective: "Три кристалла, три цели.",
  },
  15: {
    name: "Открытые ворота",
    objective: "Плита открывает ворота в нишу с целью.",
  },
  16: {
    name: "Склад",
    objective: "Поставь ящики так, чтобы не запереть себя.",
  },
  17: {
    name: "Широкий двор",
    objective: "Много места — всё равно думай наперёд.",
  },
  18: {
    name: "Дверь хранилища",
    objective: "Открой хранилище и доставь оба кристалла.",
  },
  19: {
    name: "Толчок на коньках",
    objective: "Встань на лёд и толкни — кристалл поедет, пока не остановится.",
  },
  20: {
    name: "Ледяное кольцо",
    objective: "Проедь по ледяному кольцу и в нужный момент выйди в хранилище.",
  },
  21: {
    name: "Пара порталов",
    objective: "Телепортируйся за стену, затем закончи работу.",
  },
  22: {
    name: "Мёрзлые ворота",
    objective: "Открой плиту, затем прокати кристалл по льду через ворота.",
  },
  23: {
    name: "Двойной отсек",
    objective: "Два кристалла, две цели — открытое поле.",
  },
  24: {
    name: "Долгое скольжение",
    objective: "Неверное направление — и ты промахнёшься.",
  },
  25: {
    name: "Ключ-портал",
    objective: "Портал к плите, открой ворота, затем доставь кристалл.",
  },
  26: {
    name: "Двойной лёд",
    objective: "Две ледяные дорожки. Прокати каждый кристалл домой.",
  },
  27: {
    name: "Обход",
    objective: "Обойди стены длинным путём и зайди в нишу.",
  },
  28: {
    name: "Холодное хранилище",
    objective: "Спусти кристалл по ледяной шахте через ворота.",
  },
  29: {
    name: "Складской зал",
    objective: "Четыре кристалла — важен порядок укладки.",
  },
  30: {
    name: "Вложенные ворота",
    objective: "Открой внешние ворота, затем внутреннюю нишу — поставь оба кристалла.",
  },
  31: {
    name: "Смена полосы",
    objective: "Переходи между полосами через проёмы.",
  },
  32: {
    name: "Эстафета",
    objective: "Открой дверь и забей кристалл.",
  },
  33: {
    name: "Ледяная развилка",
    objective: "Выбери правильную ледяную полосу — боковой путь ловушка.",
  },
  34: {
    name: "Портальный отсек",
    objective: "Портал в отсек — поставь оба кристалла.",
  },
  35: {
    name: "П-изгиб",
    objective: "Проведи кристалл вокруг преграды в нишу.",
  },
  36: {
    name: "Два ключа",
    objective: "Две плиты открывают две двери на пути к цели.",
  },
  37: {
    name: "Углы",
    objective: "Верни далёкие ящики домой.",
  },
  38: {
    name: "Лёд и железо",
    objective: "Скользи, открой, доставь.",
  },
  39: {
    name: "Пробка",
    objective: "Три кристалла в тесном дворе.",
  },
  40: {
    name: "Каскад",
    objective: "Три двери — открывай по порядку.",
  },
  41: {
    name: "Квартет",
    objective: "Четыре кристалла, четыре цели — открытая схема.",
  },
  42: {
    name: "Спираль",
    objective: "Открой оба замка и поставь кристалл за ними.",
  },
  43: {
    name: "Портальный рубеж",
    objective: "Лёд, плита, портал — поставь кристалл.",
  },
  44: {
    name: "Узкое место",
    objective: "Два кристалла через узкий проход.",
  },
  45: {
    name: "Морозная эстафета",
    objective: "Открой ворота и поставь оба кристалла в отсек.",
  },
  46: {
    name: "Финальная сборка",
    objective: "Четыре кристалла. Очисти отсек.",
  },
  47: {
    name: "Глубокое хранилище",
    objective: "Открой охранные ворота, затем поставь оба кристалла.",
  },
  48: {
    name: "Шедевр",
    objective: "Плита, портал, оба кристалла. Без ошибок.",
  },
};

const dicts: Record<Lang, Dict> = { en, ru };

let lang: Lang = "en";

export function getLang(): Lang {
  return lang;
}

export function loadLangPref(): Lang {
  try {
    const v = localStorage.getItem("blockscape-lang");
    if (v === "ru" || v === "en") lang = v;
  } catch {
    /* ignore */
  }
  return lang;
}

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem("blockscape-lang", next);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next === "ru" ? "ru" : "en";
}

/** Active dictionary */
export function t(): Dict {
  return dicts[lang];
}

/** Localized level title; falls back to LevelDef.name (English). */
export function levelName(id: number, fallback: string): string {
  if (lang === "en") return fallback;
  return ruLevels[id]?.name ?? fallback;
}

/** Localized level objective; falls back to LevelDef.objective (English). */
export function levelObjective(id: number, fallback: string): string {
  if (lang === "en") return fallback;
  return ruLevels[id]?.objective ?? fallback;
}

export function starCount(moves: number, par?: number): number {
  if (par === undefined) return 2;
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}
