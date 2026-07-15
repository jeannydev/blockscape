import * as THREE from "three";
import type { Dir, GameSnapshot, LevelRuntime, Vec2 } from "../types";
import { plateActive } from "./logic";

const TILE = 1;
const COLORS = {
  floor: 0x1c2744,
  floorAlt: 0x222f52,
  wall: 0x3a4a78,
  wallTop: 0x5b6ea8,
  goal: 0xff9f6e,
  goalGlow: 0xffb48a,
  plate: 0x6ef0b0,
  plateOff: 0x2a5a48,
  ice: 0xa8d8ff,
  portalA: 0x5ce1ff,
  portalB: 0x7a6eff,
  crate: 0xc48bff,
  crateOnGoal: 0xffc46e,
  player: 0x6ea8ff,
  playerDeep: 0x3d6ec4,
  playerSoft: 0xa8c8ff,
  playerCore: 0xe8f2ff,
  playerAccent: 0x5ce1ff,
  playerGold: 0xffc46e,
  // Spirit Flame palette
  flame: 0x6ec8ff,
  flameDeep: 0x3a7fd4,
  flameCore: 0xe8f6ff,
  flameHot: 0xa8e8ff,
  door: 0xff6e8a,
  doorOpen: 0x3d4a5c,
  void: 0x070b16,
};

type Theme = {
  name: string;
  sky: number;
  fog: number;
  floor: number;
  floorAlt: number;
  wall: number;
  wallTop: number;
  base: number;
  accent: number;
  accentWarm: number;
  door: number;
  crate: number;
  keyLight: number;
  fillLight: number;
};

const THEMES: Theme[] = [
  // Academy — a clear, welcoming introduction.
  { name: "academy", sky: 0x081026, fog: 0x081026, floor: 0x20335d, floorAlt: 0x293e6d, wall: 0x354b83, wallTop: 0x7796dc, base: 0x111c38, accent: 0x72b8ff, accentWarm: 0xffbc7f, door: 0xff718d, crate: 0xc991ff, keyLight: 0xfff0de, fillLight: 0x70a8ff },
  // Foundry — darker metal, warm safety lights.
  { name: "foundry", sky: 0x17111b, fog: 0x17111b, floor: 0x3a303d, floorAlt: 0x4a3b47, wall: 0x5d4a55, wallTop: 0xd09a6d, base: 0x241c28, accent: 0xffc36b, accentWarm: 0xff7c61, door: 0xff6e61, crate: 0xe69a7a, keyLight: 0xffc48f, fillLight: 0xff7f62 },
  // Frost caverns — blue glass and cold moonlight.
  { name: "frost", sky: 0x071826, fog: 0x071826, floor: 0x17425a, floorAlt: 0x20566e, wall: 0x2f6d87, wallTop: 0xa6ecff, base: 0x0d2a3b, accent: 0x9eeaff, accentWarm: 0x8fd7ff, door: 0x7dd8ff, crate: 0x99dcff, keyLight: 0xd8f8ff, fillLight: 0x65cfff },
  // Archive — muted stone, verdigris and old violet energy.
  { name: "archive", sky: 0x151323, fog: 0x151323, floor: 0x36354b, floorAlt: 0x46445d, wall: 0x5a5774, wallTop: 0xa9a0d8, base: 0x222137, accent: 0xa9a0ff, accentWarm: 0x83e1c1, door: 0xbb83dc, crate: 0xd0a0ff, keyLight: 0xe5dcff, fillLight: 0x8b8cff },
  // Sanctum — final chapter, obsidian and gilded runes.
  { name: "sanctum", sky: 0x170f21, fog: 0x170f21, floor: 0x30233c, floorAlt: 0x402d50, wall: 0x5c3e72, wallTop: 0xf0bd70, base: 0x24182e, accent: 0xf3c66f, accentWarm: 0xff8c9e, door: 0xef8ea7, crate: 0xf0a1d0, keyLight: 0xffe2a6, fillLight: 0xd278ff },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

/**
 * Render quality profile.
 * LOW is only for real phones/tablets — never strip desktop/PC visuals
 * just because of RAM, core count, or a touch-capable laptop.
 */
export type RenderQuality = "high" | "low";

function isPhoneOrTablet(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  try {
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
    // iPadOS 13+ reports as Mac but has multi-touch
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      return true;
    }
    // Narrow touch-first viewport only (not desktop windows that happen to be resized)
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(max-width: 720px)").matches
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function detectRenderQuality(): RenderQuality {
  return isPhoneOrTablet() ? "low" : "high";
}

/** Layout zoom helpers — viewport only, independent of GPU quality. */
function isPhoneLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 720;
}

interface AnimTarget {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  duration: number;
}

export class WorldView {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly quality: RenderQuality;

  private root = new THREE.Group();
  private entityRoot = new THREE.Group();
  private playerMesh!: THREE.Group;
  private playerAvatar!: THREE.Group;
  /** Procedural 2D flame billboard (no 3D mesh character). */
  private flameCanvas: HTMLCanvasElement | null = null;
  private flameCtx: CanvasRenderingContext2D | null = null;
  private flameTexture: THREE.CanvasTexture | null = null;
  private flameFlip = 1;
  private flameFrame = 0;
  private readonly flameEveryN: number;
  private readonly maxPixelRatio: number;
  private readonly shadowsEnabled: boolean;
  private crateMeshes = new Map<number, THREE.Mesh>();
  private doorMeshes = new Map<string, THREE.Mesh>();
  private plateMeshes: Array<{ mesh: THREE.Mesh; pos: Vec2 }> = [];
  private goalMarkers: THREE.Object3D[] = [];
  private portalRings: THREE.Object3D[] = [];
  private crystalGems: THREE.Object3D[] = [];
  private ambientFloaters: THREE.Object3D[] = [];
  private plateLinks: Array<{ mesh: THREE.Mesh; plate: Vec2 }> = [];
  private effects: Array<{ mesh: THREE.Mesh; life: number; total: number; velocity: THREE.Vector3 }> = [];
  private anims: AnimTarget[] = [];
  private clock = new THREE.Clock();
  private bobT = 0;
  private level!: LevelRuntime;
  private camTarget = new THREE.Vector3();
  private pulseMats: THREE.MeshStandardMaterial[] = [];
  private theme = THEMES[0];
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.PointLight;

  /** Spherical orbit around scene center */
  private azimuth = Math.PI / 4;
  private polar = 0.95; // ~54° from top-down-ish elevation
  private camDistance = 20;
  private frustumSize = 9;
  private baseFrustum = 9;
  private autoOrbit = true;
  private userOrbiting = false;

  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  private dragPrev: { x: number; y: number } | null = null;
  private orbitEnabled = true;
  private pointerStart: { x: number; y: number } | null = null;
  private didOrbitDrag = false;
  private readonly dragThreshold = 8;
  private clickEnabled = true;

  /** Fired on primary click/tap on a grid cell (not a camera drag). */
  onTileClick: ((cell: Vec2) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.quality = detectRenderQuality();
    const low = this.quality === "low";
    this.maxPixelRatio = low ? 1.25 : Math.min(window.devicePixelRatio || 1, 2);
    this.shadowsEnabled = !low;
    this.flameEveryN = low ? 3 : 1;

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const frustum = this.frustumSize;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      200
    );
    this.camera.up.set(0, 1, 0);
    this.applyCamera();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !low,
      alpha: true,
      powerPreference: low ? "low-power" : "high-performance",
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = this.shadowsEnabled;
    this.renderer.shadowMap.type = low
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES is pretty but costly on mobile GPUs.
    this.renderer.toneMapping = low
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = low ? 1 : 1.15;

    this.scene.background = new THREE.Color(COLORS.void);
    this.scene.fog = new THREE.Fog(COLORS.void, 14, 40);

    this.setupLights();
    this.scene.add(this.root);
    this.root.add(this.entityRoot);

    try {
      document.body.dataset.renderQuality = this.quality;
    } catch {
      /* ignore */
    }

    window.addEventListener("resize", () => this.onResize());
    this.bindOrbitControls();
  }

  setAutoOrbit(on: boolean) {
    this.autoOrbit = on;
  }

  setOrbitEnabled(on: boolean) {
    this.orbitEnabled = on;
    if (!on) {
      this.pointers.clear();
      this.dragPrev = null;
      this.userOrbiting = false;
      this.canvas.style.cursor = "default";
    }
  }

  resetCamera() {
    this.azimuth = Math.PI / 4;
    this.polar = 0.95;
    this.frustumSize = this.baseFrustum;
    this.userOrbiting = false;
    this.applyCamera();
  }

  private bindOrbitControls() {
    const el = this.canvas;

    el.addEventListener("pointerdown", (e) => {
      if (!this.orbitEnabled) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.pointerStart = { x: e.clientX, y: e.clientY };
        this.dragPrev = { x: e.clientX, y: e.clientY };
        this.didOrbitDrag = false;
        this.userOrbiting = false;
        el.style.cursor = "pointer";
      } else if (this.pointers.size === 2) {
        this.dragPrev = null;
        this.didOrbitDrag = true;
        this.userOrbiting = true;
        this.lastPinchDist = this.pinchDistance();
      }
    });

    el.addEventListener("pointermove", (e) => {
      if (!this.orbitEnabled || !this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2) {
        this.didOrbitDrag = true;
        const dist = this.pinchDistance();
        if (this.lastPinchDist > 0) {
          const scale = this.lastPinchDist / dist;
          this.zoomBy(scale);
        }
        this.lastPinchDist = dist;

        const pts = [...this.pointers.values()];
        const mid = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        if (this.dragPrev) {
          this.orbitBy(mid.x - this.dragPrev.x, mid.y - this.dragPrev.y);
        }
        this.dragPrev = mid;
        return;
      }

      if (this.dragPrev && this.pointerStart) {
        const totalDx = e.clientX - this.pointerStart.x;
        const totalDy = e.clientY - this.pointerStart.y;
        if (
          !this.didOrbitDrag &&
          Math.hypot(totalDx, totalDy) > this.dragThreshold
        ) {
          this.didOrbitDrag = true;
          this.userOrbiting = true;
          this.autoOrbit = false;
          el.style.cursor = "grabbing";
        }
        if (this.didOrbitDrag) {
          const dx = e.clientX - this.dragPrev.x;
          const dy = e.clientY - this.dragPrev.y;
          this.orbitBy(dx, dy);
          this.dragPrev = { x: e.clientX, y: e.clientY };
        }
      }
    });

    const endPointer = (e: PointerEvent) => {
      const wasPrimary = this.pointers.size === 1;
      const start = this.pointerStart;
      const dragged = this.didOrbitDrag;
      this.pointers.delete(e.pointerId);

      if (this.pointers.size === 0) {
        // Click-to-move: short press without camera drag
        if (
          wasPrimary &&
          !dragged &&
          start &&
          this.clickEnabled &&
          this.onTileClick &&
          this.level
        ) {
          const cell = this.pickGrid(e.clientX, e.clientY);
          if (cell) this.onTileClick(cell);
        }
        this.dragPrev = null;
        this.pointerStart = null;
        this.didOrbitDrag = false;
        this.userOrbiting = false;
        this.lastPinchDist = 0;
        el.style.cursor = this.orbitEnabled ? "pointer" : "default";
      } else if (this.pointers.size === 1) {
        const remaining = [...this.pointers.values()][0];
        this.dragPrev = { ...remaining };
        this.pointerStart = { ...remaining };
        this.lastPinchDist = 0;
      }
    };

    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);

    el.addEventListener(
      "wheel",
      (e) => {
        if (!this.orbitEnabled) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
        this.zoomBy(factor);
        this.autoOrbit = false;
      },
      { passive: false }
    );

    el.style.cursor = "pointer";
    el.style.touchAction = "none";
  }

  /** Screen coords → grid cell under the Y=0 plane. */
  pickGrid(clientX: number, clientY: number): Vec2 | null {
    if (!this.level) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;

    const ox = -((this.level.width - 1) * TILE) / 2;
    const oz = -((this.level.height - 1) * TILE) / 2;
    const gx = Math.round((hit.x - ox) / TILE);
    const gy = Math.round((hit.z - oz) / TILE);
    if (
      gx < 0 ||
      gy < 0 ||
      gx >= this.level.width ||
      gy >= this.level.height
    ) {
      return null;
    }
    return { x: gx, y: gy };
  }

  /** Face walk direction (grid: up=-Z, down=+Z, right=+X, left=-X). */
  faceDir(dir: Dir) {
    // Billboard flame: flip sprite for left/right.
    if (dir === "left") this.flameFlip = -1;
    else if (dir === "right") this.flameFlip = 1;
  }

  setClickEnabled(on: boolean) {
    this.clickEnabled = on;
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private orbitBy(dx: number, dy: number) {
    const sens = 0.0055;
    this.azimuth -= dx * sens;
    // Keep elevation out of extreme side-on angles where the board's
    // rectangular platform reads as a hard "broken" stage edge.
    this.polar = THREE.MathUtils.clamp(this.polar - dy * sens, 0.42, 1.12);
    this.applyCamera();
  }

  private zoomBy(factor: number) {
    this.frustumSize = THREE.MathUtils.clamp(this.frustumSize * factor, 4, 18);
    this.applyCamera();
  }

  private applyCamera() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const f = this.frustumSize;
    this.camera.left = -f * aspect;
    this.camera.right = f * aspect;
    this.camera.top = f;
    this.camera.bottom = -f;
    this.camera.updateProjectionMatrix();

    const x = this.camDistance * Math.sin(this.polar) * Math.sin(this.azimuth);
    const y = this.camDistance * Math.cos(this.polar);
    const z = this.camDistance * Math.sin(this.polar) * Math.cos(this.azimuth);
    this.camera.position.set(
      this.camTarget.x + x,
      this.camTarget.y + y,
      this.camTarget.z + z
    );
    this.camera.lookAt(this.camTarget);
  }

  private setupLights() {
    const low = this.quality === "low";
    // Slightly brighter ambient when shadows are off so the scene stays readable.
    this.ambientLight = new THREE.AmbientLight(0x8aa0d0, low ? 0.85 : 0.62);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xb8c8ff, 0x1a1028, low ? 0.82 : 0.68);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0e0, low ? 1.05 : 1.25);
    this.keyLight.position.set(8, 16, 6);
    this.keyLight.castShadow = this.shadowsEnabled;
    if (this.shadowsEnabled) {
      // Full soft shadows on PC; keep maps modest only if somehow enabled on low.
      const map = low ? 1024 : 2048;
      this.keyLight.shadow.mapSize.set(map, map);
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 40;
      this.keyLight.shadow.camera.left = -16;
      this.keyLight.shadow.camera.right = 16;
      this.keyLight.shadow.camera.top = 16;
      this.keyLight.shadow.camera.bottom = -16;
      this.keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x6ea8ff, low ? 0.45 : 0.6);
    this.rimLight.position.set(-10, 8, -6);
    this.scene.add(this.rimLight);

    // Point fill — full on desktop; skip on mobile low.
    this.fillLight = new THREE.PointLight(0xff9f6e, low ? 0 : 0.48, 30);
    this.fillLight.position.set(0, 6, 0);
    if (!low) this.scene.add(this.fillLight);
  }

  private applyTheme(level: LevelRuntime) {
    // Chapter 1 has eight levels; every following chapter has ten.
    const chapter = level.def.id <= 8 ? 0 : Math.min(THEMES.length - 1, 1 + Math.floor((level.def.id - 9) / 10));
    this.theme = THEMES[chapter];
    this.scene.background = new THREE.Color(this.theme.sky);
    // Fog is sized to the board so the horizon softens before ground edges show.
    const span = Math.max(level.width, level.height, 8);
    this.scene.fog = new THREE.Fog(
      this.theme.fog,
      Math.max(10, span * 0.9 + 6),
      Math.max(26, span * 2.4 + 14)
    );
    this.ambientLight.color.setHex(this.theme.accent);
    this.hemiLight.color.setHex(this.theme.wallTop);
    this.hemiLight.groundColor.setHex(this.theme.base);
    this.keyLight.color.setHex(this.theme.keyLight);
    this.rimLight.color.setHex(this.theme.fillLight);
    this.fillLight.color.setHex(this.theme.accentWarm);
    document.body.dataset.theme = this.theme.name;
    const accent = new THREE.Color(this.theme.accent).getStyle();
    const warm = new THREE.Color(this.theme.accentWarm).getStyle();
    document.documentElement.style.setProperty("--chapter-accent", accent);
    document.documentElement.style.setProperty("--chapter-warm", warm);
  }

  private onResize() {
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.maxPixelRatio)
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (this.level) this.refitCameraToLevel();
    else this.applyCamera();
  }

  /** Orthographic zoom / orbit distance. Phone zoom is viewport-based only — not GPU quality. */
  private refitCameraToLevel() {
    if (!this.level) return;
    const span = Math.max(this.level.width, this.level.height);
    const portrait = this.isCompactPortrait;
    // Desktop/PC always use the original framing, even if quality were low.
    const phone = portrait || isPhoneLayoutViewport();
    if (!phone) {
      // Original desktop fit
      this.baseFrustum = Math.max(5.8, span * 0.72);
      this.frustumSize = this.baseFrustum;
      this.camDistance = THREE.MathUtils.clamp(14 + span * 0.55, 16, 28);
      this.applyCamera();
      return;
    }
    const minF = portrait ? 4.35 : 5.1;
    const spanMul = portrait ? 0.52 : 0.62;
    let base = Math.max(minF, span * spanMul);
    if (portrait) base *= 0.92;
    const zoomRatio =
      this.baseFrustum > 0.01 ? this.frustumSize / this.baseFrustum : 1;
    this.baseFrustum = base;
    this.frustumSize = THREE.MathUtils.clamp(base * zoomRatio, 3.5, 18);
    this.camDistance = THREE.MathUtils.clamp(12 + span * 0.48, 13, 24);
    this.applyCamera();
  }

  private gridToWorld(x: number, y: number, h = 0): THREE.Vector3 {
    const ox = -((this.level.width - 1) * TILE) / 2;
    const oz = -((this.level.height - 1) * TILE) / 2;
    return new THREE.Vector3(ox + x * TILE, h, oz + y * TILE);
  }

  private get isCompactPortrait() {
    return window.innerWidth <= 720 && window.innerHeight > window.innerWidth;
  }

  buildLevel(level: LevelRuntime, state: GameSnapshot) {
    this.level = level;
    this.applyTheme(level);
    this.clearGroup(this.root);
    this.root.add(this.entityRoot);
    this.clearGroup(this.entityRoot);
    this.crateMeshes.clear();
    this.doorMeshes.clear();
    this.plateMeshes = [];
    this.goalMarkers = [];
    this.portalRings = [];
    this.crystalGems = [];
    this.ambientFloaters = [];
    this.plateLinks = [];
    this.effects = [];
    this.pulseMats = [];
    this.anims = [];

    const span = Math.max(level.width, level.height);

    // Compact pedestal under the playable tiles (hidden sides via larger discs).
    const baseGeo = new THREE.BoxGeometry(
      level.width + 0.9,
      0.28,
      level.height + 0.9
    );
    const baseMat = new THREE.MeshStandardMaterial({
      color: this.theme.base,
      roughness: 0.92,
      metalness: 0.04,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, -0.32, 0);
    base.receiveShadow = this.shadowsEnabled;
    this.root.add(base);

    // Soft mid foundation — reads as ground under the board.
    const midR = span * 2.2 + 4;
    const discSeg = this.quality === "low" ? 32 : 72;
    const midDisc = new THREE.Mesh(
      new THREE.CircleGeometry(midR, discSeg),
      new THREE.MeshStandardMaterial({
        color: this.theme.base,
        roughness: 1,
        metalness: 0,
      })
    );
    midDisc.rotation.x = -Math.PI / 2;
    midDisc.position.y = -0.52;
    midDisc.receiveShadow = this.shadowsEnabled;
    this.root.add(midDisc);

    // Huge sky-matched ground so orbit/zoom never shows a hard disc rim or void "cut".
    // Extra large on desktop — extreme camera angles still stay inside the disc.
    const voidR = Math.max(this.quality === "low" ? 72 : 110, span * 9 + 48);
    const voidSeg = this.quality === "low" ? 40 : 96;
    const voidGround = new THREE.Mesh(
      new THREE.CircleGeometry(voidR, voidSeg),
      new THREE.MeshBasicMaterial({
        color: this.theme.sky,
        depthWrite: true,
      })
    );
    voidGround.rotation.x = -Math.PI / 2;
    voidGround.position.y = -0.68;
    this.root.add(voidGround);

    // Gentle rim between mid ground and void (slightly darker, fog-friendly).
    const rimSeg = this.quality === "low" ? 32 : 72;
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(midR * 0.92, midR * 1.35, rimSeg),
      new THREE.MeshBasicMaterial({
        color: this.theme.fog,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.51;
    this.root.add(rim);

    this.addBackdrop(level);

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const tile = level.tiles[y][x];
        if (tile === " " || tile === "#") {
          if (tile === "#") this.addWall(x, y);
          continue;
        }
        this.addFloor(x, y, tile);
        if (tile === "G") this.addGoal(x, y);
        if (tile === "P") this.addPlate(x, y);
        if (tile === "A" || tile === "B") this.addPortal(x, y, tile);
        if (tile === "I") this.addIceSheen(x, y);
      }
    }

    for (const door of state.doors) {
      this.addDoor(door.id, door.x, door.y, door.open);
      for (const plate of door.plates) this.addPlateLink(plate, { x: door.x, y: door.y });
    }

    for (const crate of state.crates) {
      this.addCrate(crate.id, crate.x, crate.y);
    }

    this.addPlayer(state.player.x, state.player.y);

    // Center camera on map and fit frustum / orbit distance to board size.
    this.camTarget.set(0, 0.2, 0);
    this.azimuth = Math.PI / 4;
    this.polar = this.isCompactPortrait ? 0.88 : 0.95;
    this.refitCameraToLevel();
    // Fresh level: snap to fitted frustum (drop previous zoom ratio).
    this.frustumSize = this.baseFrustum;
    this.applyCamera();
    this.syncImmediate(state);
  }

  /** A small, deterministic diorama around the board. It gives every level depth without affecting play space. */
  private addBackdrop(level: LevelRuntime) {
    // Decorative props — skip on low quality for fill-rate / draw-call savings.
    if (this.quality === "low") return;

    const span = Math.max(level.width, level.height);
    // Keep props close to the board so they don't silhouette against the void at shallow angles.
    const radius = span * 0.62 + 1.8;
    const crystalMat = new THREE.MeshStandardMaterial({
      color: this.theme.accent,
      emissive: this.theme.accent,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.5,
      transparent: true,
      opacity: 0.72,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: this.theme.wall,
      roughness: 0.88,
      metalness: 0.08,
    });

    const count = this.isCompactPortrait ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i * (Math.PI * 2 / count) + 0.2;
      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * radius, -0.36, Math.sin(angle) * radius);
      group.rotation.y = angle;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.08, 0), rockMat);
      rock.scale.set(1.2, 0.5, 0.8);
      group.add(rock);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + (i % 2) * 0.05), crystalMat);
      crystal.position.set(0.06, 0.24, 0);
      crystal.scale.y = 1.9;
      group.add(crystal);
      this.root.add(group);
      this.ambientFloaters.push(group);
    }
  }

  private addFloor(x: number, y: number, tile: string) {
    const geo = new THREE.BoxGeometry(0.96, 0.18, 0.96);
    const alt = (x + y) % 2 === 0;
    let color = alt ? this.theme.floor : this.theme.floorAlt;
    if (tile === "I") color = this.theme.floorAlt;
    if (tile === "G") color = this.theme.base;
    if (tile === "P") color = this.theme.wall;

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: tile === "I" ? 0.15 : 0.75,
      metalness: tile === "I" ? 0.45 : 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pos = this.gridToWorld(x, y, 0);
    mesh.position.copy(pos);
    mesh.receiveShadow = this.shadowsEnabled;
    mesh.castShadow = this.shadowsEnabled;
    this.root.add(mesh);

    // Board edge always present so the level reads clearly without shadows.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.04, 1),
      new THREE.MeshStandardMaterial({
        color: this.theme.base,
        emissive: this.quality === "low" ? this.theme.accent : 0x000000,
        emissiveIntensity: this.quality === "low" ? 0.06 : 0,
        roughness: 1,
      })
    );
    edge.position.set(pos.x, -0.11, pos.z);
    this.root.add(edge);

    // A recessed panel gives the otherwise simple grid a crafted, modular look.
    // Skip translucent inlays on low — many transparent draws hurt mobile.
    if (this.quality === "low") return;

    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.012, 0.72),
      new THREE.MeshStandardMaterial({
        color: this.theme.wallTop,
        emissive: this.theme.accent,
        emissiveIntensity: 0.025,
        roughness: 0.55,
        metalness: 0.25,
        transparent: true,
        opacity: tile === "I" ? 0.2 : 0.08,
      })
    );
    inlay.position.set(pos.x, 0.096, pos.z);
    this.root.add(inlay);
  }

  private addWall(x: number, y: number) {
    const h = 0.85;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, h, 0.98),
      new THREE.MeshStandardMaterial({
        color: this.theme.wall,
        roughness: 0.7,
        metalness: 0.15,
      })
    );
    const pos = this.gridToWorld(x, y, h / 2);
    body.position.copy(pos);
    body.castShadow = this.shadowsEnabled;
    body.receiveShadow = this.shadowsEnabled;
    this.root.add(body);

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.08, 0.98),
      new THREE.MeshStandardMaterial({
        color: this.theme.wallTop,
        roughness: 0.45,
        metalness: 0.35,
        emissive: this.theme.accent,
        emissiveIntensity: 0.14,
      })
    );
    top.position.set(pos.x, h + 0.02, pos.z);
    top.castShadow = this.shadowsEnabled;
    this.root.add(top);
  }

  private addGoal(x: number, y: number) {
    const group = new THREE.Group();
    const low = this.quality === "low";
    const mat = new THREE.MeshStandardMaterial({
      color: this.theme.accentWarm,
      emissive: this.theme.accentWarm,
      emissiveIntensity: low ? 1.05 : 0.75,
      roughness: 0.35,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95,
    });
    this.pulseMats.push(mat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, low ? 0.065 : 0.05, low ? 8 : 10, low ? 16 : 24),
      mat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    group.add(ring);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, low ? 12 : 20),
      new THREE.MeshStandardMaterial({
        color: this.theme.accentWarm,
        emissive: this.theme.accentWarm,
        emissiveIntensity: low ? 1.2 : 0.9,
        transparent: true,
        opacity: low ? 0.72 : 0.55,
      })
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.12;
    group.add(core);

    if (!low) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.2, 0.72, 16, 1, true),
        new THREE.MeshStandardMaterial({
          color: this.theme.accentWarm,
          emissive: this.theme.accentWarm,
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
        })
      );
      beam.position.y = 0.46;
      group.add(beam);
    }
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(low ? 0.11 : 0.09), mat);
    rune.position.y = low ? 0.42 : 0.55;
    group.add(rune);
    group.position.copy(this.gridToWorld(x, y));
    this.root.add(group);
    this.goalMarkers.push(group);
  }

  private addPlate(x: number, y: number) {
    const mat = new THREE.MeshStandardMaterial({
      color: this.theme.base,
      emissive: this.theme.accent,
      emissiveIntensity: 0.15,
      roughness: 0.4,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.08, this.quality === "low" ? 10 : 20),
      mat
    );
    const pos = this.gridToWorld(x, y, 0.12);
    mesh.position.copy(pos);
    mesh.receiveShadow = this.shadowsEnabled;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.028, 8, 20),
      new THREE.MeshStandardMaterial({ color: this.theme.accent, emissive: this.theme.accent, emissiveIntensity: 0.3 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.045;
    mesh.add(rim);
    this.root.add(mesh);
    this.plateMeshes.push({ mesh, pos: { x, y } });
  }

  /** Low emissive conduit: visualizes which plate controls a door, never changes navigation. */
  private addPlateLink(plate: Vec2, door: Vec2) {
    const from = this.gridToWorld(plate.x, plate.y, 0.17);
    const to = this.gridToWorld(door.x, door.y, 0.17);
    const delta = to.clone().sub(from);
    const length = delta.length();
    if (length < 0.1) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, length, 6),
      new THREE.MeshBasicMaterial({
        color: this.theme.accent,
        transparent: true,
        opacity: 0.12,
      })
    );
    mesh.position.copy(from.clone().add(to).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    this.root.add(mesh);
    this.plateLinks.push({ mesh, plate });
  }

  private addPortal(x: number, y: number, kind: string) {
    const color = kind === "A" ? this.theme.accent : this.theme.accentWarm;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2,
      metalness: 0.6,
    });
    this.pulseMats.push(mat);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 28), mat);
    torus.rotation.x = -Math.PI / 2;
    torus.position.y = 0.16;
    group.add(torus);

    const swirl = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 24),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.35,
      })
    );
    swirl.rotation.x = -Math.PI / 2;
    swirl.position.y = 0.13;
    group.add(swirl);
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.19), mat);
      const a = i * Math.PI * 2 / 3;
      shard.position.set(Math.cos(a) * 0.16, 0.19, Math.sin(a) * 0.16);
      shard.rotation.y = -a;
      group.add(shard);
    }
    const tagCanvas = document.createElement("canvas");
    tagCanvas.width = 96;
    tagCanvas.height = 96;
    const context = tagCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 96, 96);
      context.fillStyle = "#07101f";
      context.beginPath();
      context.arc(48, 48, 29, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = new THREE.Color(color).getStyle();
      context.lineWidth = 5;
      context.stroke();
      context.fillStyle = "#ffffff";
      context.font = "700 44px system-ui";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(kind, 48, 51);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(tagCanvas),
          transparent: true,
          depthWrite: false,
        })
      );
      label.position.set(0, 0.42, 0);
      label.scale.set(0.28, 0.28, 1);
      group.add(label);
    }
    group.position.copy(this.gridToWorld(x, y));
    this.root.add(group);
    this.portalRings.push(group);
  }

  private addIceSheen(x: number, y: number) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshStandardMaterial({
        color: this.theme.accent,
        emissive: this.theme.accent,
        emissiveIntensity: 0.28,
        transparent: true,
        opacity: 0.25,
        roughness: 0.05,
        metalness: 0.8,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    const pos = this.gridToWorld(x, y, 0.11);
    mesh.position.copy(pos);
    this.root.add(mesh);
    // Fracture lines keep ice recognizable even on small mobile screens.
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.008, 0.33 - i * 0.06),
        new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.24 })
      );
      crack.position.set(pos.x + (i - 1) * 0.1, 0.118, pos.z + (i % 2 ? 0.03 : -0.03));
      crack.rotation.y = 0.45 + i * 0.6;
      this.root.add(crack);
    }
  }

  /**
   * Door mesh is a thin slab (Box 0.92 × 0.95 × 0.22). Default faces ±Z (grid north/south).
   * For a horizontal corridor (walls N/S, open E/W) we yaw 90° so the slab seals the passage.
   * Orientation is inferred from neighboring tiles — no per-level flag needed.
   */
  private doorYawFromNeighbors(x: number, y: number): number {
    const isSolid = (tx: number, ty: number) => {
      if (!this.level) return true;
      if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) {
        return true;
      }
      const t = this.level.tiles[ty][tx];
      return t === "#" || t === " ";
    };
    const wallN = isSolid(x, y - 1);
    const wallS = isSolid(x, y + 1);
    const wallW = isSolid(x - 1, y);
    const wallE = isSolid(x + 1, y);

    // Classic gate in a horizontal run: solid above+below → face east/west.
    if (wallN && wallS && !(wallW && wallE)) return Math.PI / 2;
    // Classic gate in a vertical run: solid left+right → face north/south (default).
    if (wallW && wallE && !(wallN && wallS)) return 0;

    // Ambiguous (open room / corner): prefer the axis with more open neighbors.
    const openNS = (wallN ? 0 : 1) + (wallS ? 0 : 1);
    const openEW = (wallW ? 0 : 1) + (wallE ? 0 : 1);
    return openEW > openNS ? Math.PI / 2 : 0;
  }

  private addDoor(id: string, x: number, y: number, open: boolean) {
    const mat = new THREE.MeshStandardMaterial({
      color: open ? this.theme.base : this.theme.door,
      emissive: open ? 0x000000 : this.theme.door,
      emissiveIntensity: open ? 0 : 0.35,
      roughness: 0.45,
      metalness: 0.35,
      transparent: true,
      opacity: open ? 0.15 : 0.95,
    });
    // Thin axis = local Z. Default blocks north/south travel on the grid.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.95, 0.22), mat);
    const pos = this.gridToWorld(x, y, open ? 1.2 : 0.55);
    mesh.position.copy(pos);
    mesh.rotation.y = this.doorYawFromNeighbors(x, y);
    mesh.castShadow = this.shadowsEnabled;
    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11),
      new THREE.MeshStandardMaterial({ color: this.theme.accentWarm, emissive: this.theme.accentWarm, emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.25 })
    );
    // Badge/rails sit on the front face (local +Z) so they follow yaw with the door.
    badge.position.set(0, 0.02, 0.125);
    mesh.add(badge);
    for (const side of [-0.32, 0.32]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.07), new THREE.MeshStandardMaterial({ color: this.theme.wallTop, metalness: 0.5, roughness: 0.35 }));
      rail.position.set(side, 0, 0.13);
      mesh.add(rail);
    }
    this.entityRoot.add(mesh);
    this.doorMeshes.set(id, mesh);
  }

  private addCrate(id: number, x: number, y: number) {
    const mat = new THREE.MeshStandardMaterial({
      color: this.theme.crate,
      emissive: this.theme.crate,
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.45,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), mat);
    const pos = this.gridToWorld(x, y, 0.48);
    mesh.position.copy(pos);
    mesh.castShadow = this.shadowsEnabled;
    mesh.receiveShadow = this.shadowsEnabled;
    this.entityRoot.add(mesh);
    this.crateMeshes.set(id, mesh);

    // crystal top
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: this.theme.crate,
        emissiveIntensity: 0.5,
        roughness: 0.15,
        metalness: 0.7,
      })
    );
    gem.position.y = 0.48;
    mesh.add(gem);
    this.crystalGems.push(gem);

    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.055, 0.76),
      new THREE.MeshStandardMaterial({ color: this.theme.accentWarm, emissive: this.theme.accentWarm, emissiveIntensity: 0.22, metalness: 0.55, roughness: 0.25, transparent: true, opacity: 0.72 })
    );
    band.position.y = 0.02;
    mesh.add(band);
  }

  /**
   * Animated 2D flame mascot — drawn on canvas each frame, shown as a billboard.
   * No 3D character mesh; still sits in the isometric scene.
   */
  private addPlayer(x: number, y: number) {
    const root = new THREE.Group();
    const avatar = new THREE.Group();
    avatar.name = "avatar";

    const accent = this.theme.accent;
    // Soft ground glow (still 3D, tiny)
    const aura = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, this.quality === "low" ? 12 : 28),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: this.quality === "low" ? 0.38 : 0.22,
        depthWrite: false,
      })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -0.4;
    root.add(aura);

    // Canvas texture for the flame sprite (smaller on low-end = less 2D fill per frame)
    const size = this.quality === "low" ? 64 : 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    this.flameCanvas = canvas;
    this.flameCtx = ctx;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    this.flameTexture = tex;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.95), mat);
    plane.position.y = 0.12;
    plane.name = "flameBillboard";
    avatar.add(plane);

    this.flameFlip = 1;

    root.add(avatar);
    root.position.copy(this.gridToWorld(x, y, 0.55));
    this.entityRoot.add(root);
    this.playerMesh = root;
    this.playerAvatar = avatar;

    this.paintFlame(0);
  }

  private hexRgb(hex: number): { r: number; g: number; b: number } {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255,
    };
  }

  /** Draw one animated frame of the cute spirit-flame onto the canvas texture. */
  private paintFlame(t: number) {
    const ctx = this.flameCtx;
    const canvas = this.flameCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const sc = w / 128;
    const cx = w * 0.5;
    const cy = h * 0.58;
    ctx.clearRect(0, 0, w, h);

    const accent = this.hexRgb(this.theme.accent);
    const warm = this.hexRgb(this.theme.accentWarm);
    const flick = Math.sin(t * 7.2) * 0.04 + Math.sin(t * 11.1) * 0.025;
    const bob = Math.sin(t * 2.6) * 3 * sc;
    const glowR = 52 * sc;

    // Soft outer glow
    const glow = ctx.createRadialGradient(cx, cy + bob, 4 * sc, cx, cy + bob, glowR);
    glow.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},0.45)`);
    glow.addColorStop(0.55, `rgba(${accent.r},${accent.g},${accent.b},0.12)`);
    glow.addColorStop(1, `rgba(${accent.r},${accent.g},${accent.b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Flame tongues (layered teardrops)
    const drawTongue = (
      ox: number,
      oy: number,
      scaleX: number,
      scaleY: number,
      color: string,
      alpha: number
    ) => {
      ctx.save();
      ctx.translate(cx + ox * sc, cy + oy * sc + bob);
      ctx.scale(scaleX * sc, scaleY * sc);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      // Teardrop path (point up) — units relative to 128px art
      ctx.moveTo(0, -38);
      ctx.bezierCurveTo(18, -20, 22, 8, 0, 28);
      ctx.bezierCurveTo(-22, 8, -18, -20, 0, -38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const a = `rgb(${accent.r},${accent.g},${accent.b})`;
    const aHot = `rgb(${Math.min(255, accent.r + 40)},${Math.min(255, accent.g + 50)},${Math.min(255, accent.b + 40)})`;
    const core = `rgb(255,255,255)`;
    const tip = `rgb(${warm.r},${warm.g},${warm.b})`;

    // Back tongues (animated sway)
    drawTongue(-10 + flick * 40, 2, 0.7 + flick, 0.95, a, 0.45);
    drawTongue(12 - flick * 35, 0, 0.65 - flick, 0.9, a, 0.4);
    // Main body
    drawTongue(0, 0, 1.05, 1.1 + flick * 0.5, a, 0.92);
    // Hot inner
    drawTongue(0, 4, 0.72, 0.85, aHot, 0.75);
    // White core
    drawTongue(0, 10, 0.42, 0.55, core, 0.85);
    // Warm tip spark
    drawTongue(2 + flick * 20, -18, 0.28, 0.4, tip, 0.7);

    // Embers (fewer on low)
    const emberCount = this.quality === "low" ? 2 : 5;
    for (let i = 0; i < emberCount; i++) {
      const phase = t * (1.8 + i * 0.35) + i * 1.7;
      const ex = cx + Math.sin(phase) * (14 + i * 3) * sc;
      const ey = cy + bob - (28 + ((t * 28 + i * 17) % 40)) * sc;
      const er = (1.5 + (i % 3) * 0.6) * sc;
      ctx.fillStyle = `rgba(${warm.r},${warm.g},${warm.b},${0.35 + (i % 2) * 0.2})`;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.flameTexture) this.flameTexture.needsUpdate = true;
  }

  /** Snap entities without animation (undo / restart). */
  syncImmediate(state: GameSnapshot) {
    const p = this.gridToWorld(state.player.x, state.player.y, 0.55);
    this.playerMesh.position.copy(p);

    for (const crate of state.crates) {
      const mesh = this.crateMeshes.get(crate.id);
      if (!mesh) continue;
      mesh.position.copy(this.gridToWorld(crate.x, crate.y, 0.48));
      this.tintCrate(mesh, crate, state);
    }

    for (const door of state.doors) {
      this.setDoorVisual(door.id, door.open, true);
    }

    this.updatePlates(state);
    this.anims = [];
  }

  /** Animate transition from previous to new state. */
  animateTo(prev: GameSnapshot, next: GameSnapshot) {
    // player
    this.queueMove(
      this.playerMesh,
      this.gridToWorld(prev.player.x, prev.player.y, 0.55),
      this.gridToWorld(next.player.x, next.player.y, 0.55),
      0.14
    );
    this.spawnBurst(this.gridToWorld(prev.player.x, prev.player.y, 0.28), this.theme.accent, 3);

    for (const crate of next.crates) {
      const mesh = this.crateMeshes.get(crate.id);
      if (!mesh) continue;
      const old = prev.crates.find((c) => c.id === crate.id);
      if (!old) continue;
      if (old.x !== crate.x || old.y !== crate.y) {
        this.queueMove(
          mesh,
          this.gridToWorld(old.x, old.y, 0.48),
          this.gridToWorld(crate.x, crate.y, 0.48),
          0.14
        );
        const landedOnGoal = this.level.goals.some((goal) => goal.x === crate.x && goal.y === crate.y);
        this.spawnBurst(
          this.gridToWorld(crate.x, crate.y, 0.46),
          landedOnGoal ? this.theme.accentWarm : this.theme.crate,
          landedOnGoal ? 10 : 5
        );
      }
      this.tintCrate(mesh, crate, next);
    }

    for (const door of next.doors) {
      const prevDoor = prev.doors.find((d) => d.id === door.id);
      if (!prevDoor || prevDoor.open !== door.open) {
        this.setDoorVisual(door.id, door.open, false);
      }
    }

    this.updatePlates(next);
  }

  private tintCrate(
    mesh: THREE.Mesh,
    crate: { x: number; y: number },
    state: GameSnapshot
  ) {
    const onGoal = this.level.goals.some((g) => g.x === crate.x && g.y === crate.y);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(onGoal ? this.theme.accentWarm : this.theme.crate);
    mat.emissive.setHex(onGoal ? this.theme.accentWarm : this.theme.crate);
    const low = this.quality === "low";
    mat.emissiveIntensity = onGoal ? (low ? 0.95 : 0.65) : low ? 0.32 : 0.24;
    void state;
  }

  private setDoorVisual(id: string, open: boolean, immediate: boolean) {
    const mesh = this.doorMeshes.get(id);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const targetY = open ? 1.35 : 0.55;
    const from = mesh.position.clone();
    const to = mesh.position.clone();
    to.y = targetY;

    mat.color.setHex(open ? this.theme.base : this.theme.door);
    mat.emissive.setHex(open ? 0x000000 : this.theme.door);
    mat.emissiveIntensity = open ? 0 : 0.35;
    mat.opacity = open ? 0.12 : 0.95;
    mat.transparent = true;

    if (immediate) {
      mesh.position.y = targetY;
    } else {
      this.queueMove(mesh, from, to, 0.22);
    }
  }

  private updatePlates(state: GameSnapshot) {
    for (const { mesh, pos } of this.plateMeshes) {
      const active = plateActive(state, pos);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(active ? this.theme.accent : this.theme.base);
      mat.emissive.setHex(this.theme.accent);
      mat.emissiveIntensity = active ? 0.8 : 0.14;
      mesh.scale.y = active ? 0.55 : 1;
    }
    for (const { mesh, plate } of this.plateLinks) {
      const active = plateActive(state, plate);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(active ? this.theme.accentWarm : this.theme.accent);
      mat.opacity = active ? 0.72 : 0.1;
    }
  }

  private spawnBurst(position: THREE.Vector3, color: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + (i % 2) * 0.018), mat);
      mesh.position.copy(position);
      this.entityRoot.add(mesh);
      const angle = (i / count) * Math.PI * 2 + this.bobT;
      this.effects.push({
        mesh,
        life: 0,
        total: 0.34 + (i % 3) * 0.05,
        velocity: new THREE.Vector3(Math.cos(angle) * 0.55, 0.45 + (i % 2) * 0.16, Math.sin(angle) * 0.55),
      });
    }
  }

  private queueMove(
    mesh: THREE.Object3D,
    from: THREE.Vector3,
    to: THREE.Vector3,
    duration: number
  ) {
    mesh.position.copy(from);
    this.anims.push({ mesh, from: from.clone(), to: to.clone(), t: 0, duration });
  }

  get isAnimating() {
    return this.anims.length > 0;
  }

  update() {
    // Do not burn GPU while the tab is in the background.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.clock.getDelta();
      return;
    }

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.bobT += dt;
    const low = this.quality === "low";

    // animations
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const u = smoothstep(Math.min(1, a.t / a.duration));
      a.mesh.position.set(
        lerp(a.from.x, a.to.x, u),
        lerp(a.from.y, a.to.y, u),
        lerp(a.from.z, a.to.z, u)
      );
      if (a.t >= a.duration) {
        a.mesh.position.copy(a.to);
        this.anims.splice(i, 1);
      }
    }

    // 2D flame billboard: redraw + always face camera + bob + flip
    if (this.playerAvatar && this.playerMesh) {
      this.flameFrame++;
      if (this.flameFrame % this.flameEveryN === 0) {
        this.paintFlame(this.bobT);
      }
      this.playerAvatar.position.y = Math.sin(this.bobT * 2.5) * 0.03;
      // Billboard: copy camera orientation so sprite stays readable
      this.playerAvatar.quaternion.copy(this.camera.quaternion);
      // Face left/right via scale.x
      const bobScale = 1 + Math.sin(this.bobT * 5.5) * 0.04;
      this.playerAvatar.scale.set(this.flameFlip * bobScale, bobScale, 1);
    }

    // pulse materials — stronger on low so goals stay readable without shadows
    if (!low || this.flameFrame % 2 === 0) {
      const pulse = (low ? 0.55 : 0.35) + Math.sin(this.bobT * 2.5) * (low ? 0.28 : 0.15);
      for (const m of this.pulseMats) {
        m.emissiveIntensity = pulse;
      }
    }

    for (let i = 0; i < this.goalMarkers.length; i++) {
      const goal = this.goalMarkers[i];
      const s = 1 + Math.sin(this.bobT * 2.2 + i) * (low ? 0.1 : 0.08);
      goal.scale.setScalar(s);
      goal.rotation.y += dt * (low ? 0.55 : 0.7);
    }
    for (let i = 0; i < this.portalRings.length; i++) {
      const portal = this.portalRings[i];
      portal.rotation.y += dt * (i % 2 ? -1.4 : 1.4) * (low ? 0.6 : 1);
      if (!low) {
        portal.position.y = Math.sin(this.bobT * 2 + i) * 0.025;
      }
    }
    for (let i = 0; i < this.crystalGems.length; i++) {
      const gem = this.crystalGems[i];
      gem.rotation.y += dt * (low ? 0.6 : 1.2);
      if (!low) {
        gem.position.y = 0.48 + Math.sin(this.bobT * 2.5 + i) * 0.018;
      }
    }
    for (let i = 0; i < this.ambientFloaters.length; i++) {
      const floater = this.ambientFloaters[i];
      floater.position.y = -0.36 + Math.sin(this.bobT * 0.8 + i) * 0.05;
      floater.rotation.y += dt * 0.12;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life += dt;
      effect.mesh.position.addScaledVector(effect.velocity, dt);
      effect.velocity.y -= dt * 1.8;
      const progress = effect.life / effect.total;
      const mat = effect.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 * (1 - progress));
      effect.mesh.scale.setScalar(1 - progress * 0.45);
      if (progress >= 1) {
        this.entityRoot.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        mat.dispose();
        this.effects.splice(i, 1);
      }
    }

    // Menu ambience: slow auto-orbit when idle (slower on low)
    if (this.autoOrbit && !this.userOrbiting) {
      this.azimuth += dt * (low ? 0.06 : 0.12);
      this.applyCamera();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length) {
      const child = g.children[0];
      g.remove(child);
      child.traverse((obj) => {
        const renderable = obj as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        renderable.geometry?.dispose();
        const materials = renderable.material
          ? Array.isArray(renderable.material)
            ? renderable.material
            : [renderable.material]
          : [];
        for (const material of materials) {
          (material as THREE.MeshBasicMaterial).map?.dispose();
          material.dispose();
        }
      });
    }
  }
}
