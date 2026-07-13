# Blockscape

2.5D isometric puzzle game (Three.js + TypeScript + Vite), prepared for **CrazyGames**.

Push crystals onto goals · plates & doors · ice · portals · **48 levels** · stars · mobile support · CrazyGames SDK v3.

## Develop

```bash
npm install
npm run dev
```

## Build for CrazyGames

```bash
npm run verify   # levels + production build + Full Launch static checks
```

Upload everything in `dist/` via [developer.crazygames.com](https://developer.crazygames.com/).

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
