# Blockscape — CrazyGames Submission Kit (Full Launch)

## Game info

| Field | Value |
|--------|--------|
| **Title** | Blockscape |
| **Genre** | Puzzle / Sokoban-like / Isometric |
| **Engine** | HTML5 + TypeScript + Three.js + Vite |
| **Levels** | 48 handcrafted |
| **Orientation** | Landscape + portrait (responsive) |
| **PEGI** | PEGI 3 / Everyone (no violence, no chat) — CG audience 13+ / PEGI 12 max content |
| **Languages** | English + Russian UI |
| **Target** | **Full Launch** (SDK + ads + data) |

## Short description (store)

> Push glowing crystals across isometric 2.5D stages. Open doors with pressure plates, slide on ice, and warp through portals. 48 levels, stars for efficiency, undo anytime.

## Long description

Blockscape is a stylish 2.5D isometric puzzle game. Move on a grid, push crystal crates onto goals, and solve rooms that introduce:

- Pressure plates & latched doors  
- Ice sliding  
- Linked portals  
- Multi-crate logistics  

Features: orbit camera, undo/restart, mobile D-pad, star ratings, progress via CrazyGames Data API (with local fallback). Lands directly in gameplay after load.

## Controls

| Input | Action |
|--------|--------|
| WASD / Arrow keys | Move |
| Click / tap free tile | Pathfind move |
| Z | Undo |
| R | Restart |
| Mouse drag / touch drag | Orbit camera |
| Mouse wheel / pinch | Zoom |
| On-screen pad | Move (mobile) |
| Esc | Pause / back |

## Build & upload

```bash
npm install
npm run verify          # levels + production build + Full Launch static checks
```

Or step by step:

```bash
npm run verify-levels
npm run build
npm run verify-full-launch
```

Upload the **contents** of the `dist/` folder (entry: `index.html`).

CrazyGames SDK v3 is loaded from:

`https://sdk.crazygames.com/crazygames-sdk-v3.js`

### Full Launch SDK checklist

- [x] Script tag in `index.html` head  
- [x] `await CrazyGames.SDK.init()` on boot  
- [x] `loadingStart` / `loadingStop` around bootstrap (after init)  
- [x] `gameplayStart` when entering a level  
- [x] `gameplayStop` on menu / pause / win break  
- [x] `happytime` only on campaign clear (sparingly)  
- [x] Midgame ads every 3 completed levels (between levels)  
- [x] UI locked + spinner for entire ad request (auction latency)  
- [x] Game audio muted only on `adStarted`, unmuted on finish/error  
- [x] `game.settings.muteAudio` + `addSettingsChangeListener` (priority over in-game mute)  
- [x] `data.getItem` / `setItem` for progress (localStorage fallback)  
- [x] `reportGameCompletedPercentage` from save progress  
- [x] `setGameContext` / `clearGameContext` with current level  
- [x] Instant gameplay on boot (Full Launch: 0 clicks to play)  
- [x] Works with missing SDK / AdBlock / unfilled ads (graceful no-op)  
- [x] No external ads  
- [x] Mobile `user-select: none` + safe areas  
- [x] Initial download well under 50MB (~0.6MB)  

### QA notes

- Localhost: SDK `local` env (demo ads overlay)  
- Preview: Developer Portal QA tool  
- Test with `?muteAudio=true` for platform mute  
- Confirm unfilled ads still unlock UI and keep audio playing  

## Assets to prepare (developer only — not in build)

CrazyGames also requires:

1. **Cover image** — [Game covers](https://docs.crazygames.com/requirements/game-covers)  
2. **Gameplay trailer / GIF** (15–30s)  
3. **Square icon** if requested by portal  
4. **Store metadata** in [developer.crazygames.com](https://developer.crazygames.com/) (description, controls, tags)  
5. **Portal QA pass** in the preview tool before requesting Full Launch  

Capture from the running game (orbit a mid-level, show push + door + ice/portal).

## Quality guidelines addressed

| Guideline | How |
|-----------|-----|
| Content volume | 48 levels, 5 chapters |
| Difficulty curve | Tutorial → expert Masterwork |
| Mobile | Touch orbit, D-pad, safe areas, no text select |
| Instant play | Boot → continue current level |
| English | Full EN UI (+ RU) |
| Sound | Procedural SFX + mute; SDK muteAudio + ad mute |
| Replay | Stars / best moves per level |
| Ads UX | Between levels only, UI blocked, audio muted on start |

## Verify levels locally

```bash
node scripts/verify-levels.mjs
```

All levels must report solvable before a release build.
