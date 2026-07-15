# Blockscape

2.5D isometric puzzle game (Three.js + TypeScript + Vite), prepared for **CrazyGames**.

Push crystals onto goals · plates & doors · ice · portals · **48 levels** · stars · mobile support · CrazyGames SDK v3.

## Play / develop (local)

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).  
**Do not** open raw `index.html` in the browser — CSS/JS are bundled by Vite, so styles will look broken.

## Production build

```bash
npm run build
npm run preview   # serve dist/ locally
```

Or full checks:

```bash
npm run verify   # levels + visual audit + production build + Full Launch static checks
```

Upload everything in `dist/` via [developer.crazygames.com](https://developer.crazygames.com/).

## GitHub Pages

This repo deploys **built** `dist/` via GitHub Actions (not the source tree).

1. Repo → **Settings → Pages**
2. **Source:** GitHub Actions
3. Push to `main` (or run the **Deploy GitHub Pages** workflow)
4. Site URL: `https://jeannydev.github.io/blockscape/`

Opening the repo’s raw `index.html` on GitHub (or `file://`) will show unstyled HTML — that is expected.

See **[SUBMISSION.md](./SUBMISSION.md)** for store copy, Full Launch SDK checklist, and cover requirements.

## Controls

| Desktop | Mobile |
|---------|--------|
| WASD / arrows | On-screen pad |
| Drag orbit, wheel zoom | Drag orbit, pinch zoom |
| Z undo, R restart | HUD buttons |

## Stack

- Three.js orthographic 2.5D scene  
- Pure TS game logic + BFS level verifier  
- CrazyGames SDK: gameplay events, midgame ads, data storage  
