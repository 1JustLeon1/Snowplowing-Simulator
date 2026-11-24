import { CozyAudioEngine } from './audio';
import { CameraState, isoToWorld, renderGameFrame, screenToGrid } from './renderer';
import { generateStage } from './stages';
import {
  AmbientFlake,
  CrystalPickup,
  FloatingText,
  GameMode,
  GameState,
  HudSnapshot,
  Particle,
  RoundSummaryData,
  StageConfig,
  Tile,
  TireMark,
  TruckState,
  TruckStats,
  UpgradeKey,
  UpgradeLevels,
} from './types';
import {
  canAffordAnyUpgrade,
  computeTruckStats,
  getUpgradeCost,
  INITIAL_UPGRADES,
  UPGRADE_DEFS,
} from './upgrades';

const HIGH_SCORE_STORAGE_KEY = 'hearthplow_highscore_v1';

export class HearthplowEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audio = new CozyAudioEngine();

  private rafId = 0;
  private lastFrameTs = 0;
  private simTime = 0;
  private hitstopTimer = 0;
  private lastHudEmitTs = 0;

  private onHudUpdate: (snapshot: HudSnapshot) => void;

  // Game progression state
  private gameState: GameState = 'TITLE_MENU';
  private gameMode: GameMode = 'SHIFT';
  private stageIndex = 0;
  private stageConfig!: StageConfig;
  private size = 15;
  private tiles: Tile[][] = [];
  private totalPlowable = 1;
  private clearedCount = 0;
  private totalCabins = 0;
  private cabinsWarmed = 0;
  private pickups: CrystalPickup[] = [];
  private timeRemaining = 95;

  // Economy & Combo
  private score = 0;
  private stageStartScore = 0;
  private highScore = 0;
  private coins = 0;
  private upgrades: UpgradeLevels = { ...INITIAL_UPGRADES };
  private stats: TruckStats = computeTruckStats(INITIAL_UPGRADES);

  private comboMultiplier = 1;
  private comboStreakCount = 0;
  private comboTimer = 0;
  private maxComboReached = 1;

  private roundSummary: RoundSummaryData | null = null;

  // Squall weather rhythm
  private squallTimer = 28;
  private squallActiveTimer = 0;
  private squallWarning = 0;

  // Entities & Visual Pools
  private truck: TruckState = {
    x: 7.5,
    y: 7.5,
    vx: 0,
    vy: 0,
    angle: Math.PI * 0.25,
    speed: 0,
    boostEnergy: 1,
    boosting: false,
    squash: 0,
    beaconPhase: 0,
    blowerCooldown: 1.2,
    plowLoad: 0,
    headlightFlicker: 0,
  };

  private camera: CameraState = { x: 0, y: 200, zoom: 1, shakeX: 0, shakeY: 0 };
  private shakeMag = 0;
  private lastTireX = 0;
  private lastTireY = 0;
  private chimneyTimer = 0;
  private snowContactSmooth = 0;
  private autopilotAngle = 0;

  private tireMarks: TireMark[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private ambientFlakes: AmbientFlake[] = [];

  // Input state (continuous held keys + edge-triggered actions + pointer steering)
  private heldKeys = new Set<string>();
  private pointerDown = false;
  private pointerGridX = 0;
  private pointerGridY = 0;
  private canvasW = 1280;
  private canvasH = 720;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = ctx;
    this.onHudUpdate = onHudUpdate;

    // Load saved high score safely
    try {
      const saved = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (saved) this.highScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // Ignore storage failures
    }

    // Pre-allocate pooled particles & floating texts
    for (let i = 0; i < 240; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 3,
        life: 0,
        maxLife: 1,
        color: '#ffffff',
        kind: 'snow',
      });
    }
    for (let i = 0; i < 36; i++) {
      this.floatingTexts.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        text: '',
        color: '#ffda79',
        life: 0,
        maxLife: 1,
        scale: 1,
      });
    }
    for (let i = 0; i < 95; i++) {
      this.ambientFlakes.push({
        x: Math.random(),
        y: Math.random(),
        size: 1.1 + Math.random() * 2.2,
        speedY: 0.035 + Math.random() * 0.075,
        driftX: -0.015 - Math.random() * 0.02,
        alpha: 0.25 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.loadStage(0, true);
    this.handleResize();
    this.bindEvents();
    this.emitHud(true);

    this.lastFrameTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.audio.updateContinuous(false, 0, 0, false);
  }

  // ---- Public Actions from React UI ----

  public setMode(mode: GameMode): void {
    this.gameMode = mode;
    this.emitHud(true);
  }

  public startNewGame(mode?: GameMode): void {
    if (mode) this.gameMode = mode;
    this.audio.unlock();
    this.score = 0;
    this.coins = 0;
    this.upgrades = { ...INITIAL_UPGRADES };
    this.stats = computeTruckStats(this.upgrades);
    this.stageIndex = 0;
    this.roundSummary = null;
    this.loadStage(0, false);
    this.gameState = 'PLAYING';
    this.audio.playBoost();
    this.emitHud(true);
  }

  public nextStage(): void {
    this.audio.unlock();
    this.stageIndex += 1;
    this.roundSummary = null;
    this.loadStage(this.stageIndex, false);
    this.gameState = 'PLAYING';
    this.audio.playBoost();
    this.emitHud(true);
  }

  public retryStage(): void {
    this.audio.unlock();
    this.roundSummary = null;
    this.loadStage(this.stageIndex, false);
    this.gameState = 'PLAYING';
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.heldKeys.clear();
      this.pointerDown = false;
      this.emitHud(true);
    } else if (this.gameState === 'PAUSED') {
      this.audio.unlock();
      this.gameState = 'PLAYING';
      this.emitHud(true);
    }
  }

  public openWorkshop(): void {
    if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED' || this.gameState === 'ROUND_SUMMARY') {
      this.audio.unlock();
      this.heldKeys.clear();
      this.pointerDown = false;
      this.gameState = 'WORKSHOP';
      this.emitHud(true);
    }
  }

  public closeWorkshop(): void {
    if (this.gameState !== 'WORKSHOP') return;
    if (this.roundSummary && this.roundSummary.isVictory) {
      this.nextStage();
    } else {
      this.gameState = 'PLAYING';
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.heldKeys.clear();
    this.pointerDown = false;
    this.roundSummary = null;
    this.loadStage(0, true);
    this.gameState = 'TITLE_MENU';
    this.emitHud(true);
  }

  public buyUpgrade(key: UpgradeKey): boolean {
    const def = UPGRADE_DEFS.find((d) => d.key === key);
    if (!def) return false;
    const cur = this.upgrades[key];
    if (cur >= def.maxLevel) return false;
    const cost = getUpgradeCost(key, cur);
    if (this.coins < cost) return false;

    this.audio.unlock();
    this.coins -= cost;
    this.upgrades = { ...this.upgrades, [key]: cur + 1 };
    this.stats = computeTruckStats(this.upgrades);
    this.audio.playUpgradeBuy();
    this.emitHud(true);
    return true;
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHud(true);
  }

  // ---- Stage Setup ----

  private loadStage(index: number, isTitlePreview: boolean): void {
    const gen = generateStage(index);
    this.stageConfig = gen.config;
    this.size = gen.size;
    this.tiles = gen.tiles;
    this.totalPlowable = Math.max(1, gen.totalPlowable);
    this.totalCabins = gen.totalCabins;
    this.pickups = gen.pickups;
    this.timeRemaining = gen.config.timeLimit;
    this.stageStartScore = this.score;

    this.clearedCount = 0;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.tiles[y][x].plowable && this.tiles[y][x].cleared) {
          this.clearedCount++;
        }
      }
    }
    this.cabinsWarmed = 0;
    this.comboMultiplier = 1;
    this.comboStreakCount = 0;
    this.comboTimer = 0;
    this.maxComboReached = 1;

    this.squallTimer = gen.config.squallInterval > 0 ? gen.config.squallInterval : 9999;
    this.squallActiveTimer = 0;
    this.squallWarning = 0;

    this.truck = {
      x: gen.spawnX,
      y: gen.spawnY,
      vx: 0,
      vy: 0,
      angle: Math.PI * 0.25,
      speed: 0,
      boostEnergy: 1,
      boosting: false,
      squash: 0,
      beaconPhase: 0,
      blowerCooldown: 1.0,
      plowLoad: 0,
      headlightFlicker: 0,
    };

    this.lastTireX = this.truck.x;
    this.lastTireY = this.truck.y;
    this.tireMarks = [];
    for (const p of this.particles) p.active = false;
    for (const ft of this.floatingTexts) ft.active = false;

    const centerWorld = isoToWorld(this.size * 0.5, this.size * 0.5, 0);
    if (isTitlePreview) {
      this.camera.x = centerWorld.x - 75;
      this.camera.y = centerWorld.y - 12;
    } else {
      const startW = isoToWorld(this.truck.x, this.truck.y, 0);
      this.camera.x = startW.x;
      this.camera.y = startW.y;
    }
    this.updateCameraZoom();
  }

  private updateCameraZoom(): void {
    // Fit diorama generously while keeping crisp cozy zoom during active play
    const baseFit = Math.min(this.canvasW / 1080, this.canvasH / 680);
    if (this.gameState === 'TITLE_MENU') {
      this.camera.zoom = Math.max(0.76, Math.min(1.12, baseFit * 0.98));
    } else {
      this.camera.zoom = Math.max(0.84, Math.min(1.26, baseFit * 1.12));
    }
  }

  // ---- Input Wiring ----

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleResize = (): void => {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    this.canvasW = Math.max(320, Math.floor(rect?.width ?? window.innerWidth));
    this.canvasH = Math.max(320, Math.floor(rect?.height ?? window.innerHeight));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.canvasW * this.dpr);
    this.canvas.height = Math.floor(this.canvasH * this.dpr);
    this.canvas.style.width = `${this.canvasW}px`;
    this.canvas.style.height = `${this.canvasH}px`;
    this.updateCameraZoom();
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.pointerDown = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.gameState === 'TITLE_MENU') {
      if (code === 'Enter' || code === 'Space') {
        this.startNewGame();
      }
      return;
    }

    if (code === 'Escape') {
      if (this.gameState === 'WORKSHOP') {
        this.closeWorkshop();
      } else {
        this.togglePause();
      }
      return;
    }

    if (code === 'KeyU') {
      if (this.gameState === 'PLAYING') {
        this.openWorkshop();
      } else if (this.gameState === 'WORKSHOP') {
        this.closeWorkshop();
      }
      return;
    }

    if (this.gameState === 'PLAYING') {
      this.audio.unlock();
      if ((code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') && !this.heldKeys.has(code)) {
        if (this.truck.boostEnergy > 0.25) {
          this.audio.playBoost();
          this.truck.squash = 0.35;
        }
      }
      this.heldKeys.add(code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.gameState !== 'PLAYING') return;
    this.audio.unlock();
    this.pointerDown = true;
    this.updatePointerGrid(e.clientX, e.clientY);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown || this.gameState !== 'PLAYING') return;
    this.updatePointerGrid(e.clientX, e.clientY);
  };

  private handlePointerUp = (): void => {
    this.pointerDown = false;
  };

  private updatePointerGrid(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const g = screenToGrid(sx, sy, this.canvasW, this.canvasH, this.camera);
    this.pointerGridX = Math.max(0.5, Math.min(this.size - 0.5, g.gx));
    this.pointerGridY = Math.max(0.5, Math.min(this.size - 0.5, g.gy));
  }

  // ---- Main 60fps Loop ----

  private loop = (ts: number): void => {
    const rawDt = (ts - this.lastFrameTs) / 1000;
    this.lastFrameTs = ts;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.step(dt);
    this.render();

    if (ts - this.lastHudEmitTs >= 85) {
      this.emitHud(false);
      this.lastHudEmitTs = ts;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    this.simTime += dt;
    this.updateAmbientSnow(dt);
    this.updateChimneySmoke(dt);

    if (this.gameState === 'TITLE_MENU') {
      this.stepTitleAutopilot(dt);
      this.updateParticles(dt);
      this.updateFloatingTexts(dt);
      this.audio.updateContinuous(false, 0, 0, false);
      return;
    }

    if (this.gameState !== 'PLAYING') {
      this.audio.updateContinuous(false, 0, 0, false);
      return;
    }

    // Brief 35-55ms micro-hitstop when smashing big snowdrifts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
      return;
    }

    // Shift timer (Shift Challenge mode)
    if (this.gameMode === 'SHIFT') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) {
        this.finishStage(false);
        return;
      }
    }

    // Gentle snow squalls on later stages
    this.stepWeatherSquall(dt);

    // Truck movement, steering, collisions, snow clearing
    this.stepTruck(dt);

    // Rotary Snow Chute upgrade pulse
    if (this.stats.blowerInterval > 0) {
      this.truck.blowerCooldown -= dt;
      if (this.truck.blowerCooldown <= 0 && this.truck.speed > 0.6) {
        this.triggerSnowblowerPulse();
        this.truck.blowerCooldown = this.stats.blowerInterval;
      }
    }

    // Pickups & magnet
    this.stepPickups(dt);

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboMultiplier = 1;
        this.comboStreakCount = 0;
      }
    }

    // Tile animations & salt glow decay
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t.popAnim > 0) t.popAnim = Math.max(0, t.popAnim - dt * 2.4);
        if (t.saltGlow > 0) t.saltGlow = Math.max(0, t.saltGlow - dt * 0.45);
      }
    }

    // Fade tire marks
    for (let i = this.tireMarks.length - 1; i >= 0; i--) {
      this.tireMarks[i].alpha -= dt * 0.045;
      if (this.tireMarks[i].alpha <= 0.01) {
        this.tireMarks.splice(i, 1);
      }
    }

    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateCamera(dt);

    // Continuous cozy synth audio modulation
    this.audio.updateContinuous(
      true,
      this.truck.speed / Math.max(1, this.stats.maxSpeed),
      this.snowContactSmooth,
      this.truck.boosting
    );

    // Check stage completion (Shift mode completes at 100%, or offers win once >= target% AND player reaches 100% — let's trigger crisp victory at target% in Shift mode or 99% in Zen!)
    const clearedPct = (this.clearedCount / this.totalPlowable) * 100;
    if (this.gameMode === 'SHIFT' && clearedPct >= this.stageConfig.targetPercent) {
      this.finishStage(true);
    } else if (this.gameMode === 'ZEN' && clearedPct >= 99.2) {
      // In Zen Mode, celebrate clearing the whole village & seamlessly offer next neighborhood!
      this.finishStage(true);
    }
  }

  private stepTitleAutopilot(dt: number): void {
    // Gentle scenic camera drift & slow looping snowplow demo on title screen
    this.autopilotAngle += dt * 0.35;
    const centerWorld = isoToWorld(this.size * 0.5, this.size * 0.5, 0);
    this.camera.x = centerWorld.x - 65 + Math.cos(this.autopilotAngle * 0.7) * 28;
    this.camera.y = centerWorld.y - 10 + Math.sin(this.autopilotAngle * 0.5) * 18;
    this.camera.shakeX = 0;
    this.camera.shakeY = 0;
    this.truck.beaconPhase += dt;

    // Slowly cruise around the central perimeter road
    const r = Math.max(3, this.size * 0.5 - 2.5);
    const cx = this.size * 0.5;
    const cy = this.size * 0.5;
    const targetX = cx + Math.cos(this.autopilotAngle) * r;
    const targetY = cy + Math.sin(this.autopilotAngle) * r;
    const dx = targetX - this.truck.x;
    const dy = targetY - this.truck.y;
    const desiredAngle = Math.atan2(dy, dx);
    this.truck.angle = lerpAngle(this.truck.angle, desiredAngle, dt * 3.5);
    this.truck.x += Math.cos(this.truck.angle) * dt * 1.45;
    this.truck.y += Math.sin(this.truck.angle) * dt * 1.45;
    this.truck.speed = 1.45;

    if (Math.random() < dt * 16) {
      this.spawnParticle(
        this.truck.x + Math.cos(this.truck.angle) * 0.5,
        this.truck.y + Math.sin(this.truck.angle) * 0.5,
        0.15,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        1.4 + Math.random() * 1.2,
        2.8,
        0.45,
        '#eef5ff',
        'snow'
      );
    }
  }

  private stepTruck(dt: number): void {
    // 1. Read desired movement vector in screen space -> convert to isometric grid space!
    // In our iso projection:
    //   screen +X (Right) corresponds to grid (+1, -1)
    //   screen +Y (Down)  corresponds to grid (+1, +1)
    let sx = 0;
    let sy = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) sy -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) sy += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) sx -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) sx += 1;

    let inputGx = 0;
    let inputGy = 0;
    let hasInput = false;

    if (sx !== 0 || sy !== 0) {
      inputGx = sx + sy;
      inputGy = sy - sx;
      const len = Math.hypot(inputGx, inputGy) || 1;
      inputGx /= len;
      inputGy /= len;
      hasInput = true;
    } else if (this.pointerDown) {
      const dx = this.pointerGridX - this.truck.x;
      const dy = this.pointerGridY - this.truck.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.25) {
        inputGx = dx / dist;
        inputGy = dy / dist;
        hasInput = true;
      }
    }

    // 2. Boost energy management
    const boostHeld =
      this.heldKeys.has('Space') ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight');
    if (boostHeld && hasInput && this.truck.boostEnergy > 0.04) {
      this.truck.boosting = true;
      this.truck.boostEnergy = Math.max(0, this.truck.boostEnergy - dt * 0.55);
    } else {
      this.truck.boosting = false;
      this.truck.boostEnergy = Math.min(
        1,
        this.truck.boostEnergy + dt * this.stats.boostRecharge
      );
    }

    // Check current ground tile for snow resistance & ice traction
    const curTx = Math.floor(this.truck.x);
    const curTy = Math.floor(this.truck.y);
    const curTile = this.tiles[curTy]?.[curTx];
    const onIce = Boolean(curTile?.icy);
    const snowDrag = curTile && curTile.snow > 0.1
      ? Math.max(0.58, 1 - (curTile.snow * 0.22) / this.stats.driftBreakPower)
      : 1;

    const topSpeed =
      this.stats.maxSpeed *
      snowDrag *
      (this.truck.boosting ? this.stats.boostMult : 1);

    const grip = onIce ? this.stats.iceGrip : 1;

    if (hasInput) {
      const targetAngle = Math.atan2(inputGy, inputGx);
      const turnRate = (onIce ? 5.2 : 9.8) * (0.7 + grip * 0.3);
      this.truck.angle = lerpAngle(this.truck.angle, targetAngle, Math.min(1, dt * turnRate));

      const acc = this.stats.accel * (0.55 + grip * 0.45) * (this.truck.boosting ? 1.45 : 1);
      this.truck.vx += inputGx * acc * dt;
      this.truck.vy += inputGy * acc * dt;

      // Clamp to top speed
      const curSpd = Math.hypot(this.truck.vx, this.truck.vy);
      if (curSpd > topSpeed) {
        const scale = topSpeed / curSpd;
        this.truck.vx *= scale;
        this.truck.vy *= scale;
      }
    } else {
      // Cozy smooth braking / ice glide
      const friction = onIce ? Math.pow(0.24, dt * grip) : Math.pow(0.0012, dt);
      this.truck.vx *= friction;
      this.truck.vy *= friction;
      if (Math.hypot(this.truck.vx, this.truck.vy) < 0.05) {
        this.truck.vx = 0;
        this.truck.vy = 0;
      }
    }

    // 3. Move with smooth axis-separated collision against buildings, pines, water, and edges
    const radius = 0.34;
    const nextX = this.truck.x + this.truck.vx * dt;
    if (this.canTruckOccupy(nextX, this.truck.y, radius)) {
      this.truck.x = nextX;
    } else {
      this.truck.vx *= -0.12;
      this.truck.squash = Math.max(this.truck.squash, 0.22);
    }

    const nextY = this.truck.y + this.truck.vy * dt;
    if (this.canTruckOccupy(this.truck.x, nextY, radius)) {
      this.truck.y = nextY;
    } else {
      this.truck.vy *= -0.12;
      this.truck.squash = Math.max(this.truck.squash, 0.22);
    }

    this.truck.speed = Math.hypot(this.truck.vx, this.truck.vy);
    this.truck.beaconPhase += dt * (this.truck.boosting ? 2.1 : 1.0);
    this.truck.squash = Math.max(0, this.truck.squash - dt * 2.8);

    // 4. Leave cozy dual tire tracks on cleared road
    const movedDist = Math.hypot(this.truck.x - this.lastTireX, this.truck.y - this.lastTireY);
    if (movedDist > 0.22 && curTile?.cleared) {
      const px = -Math.sin(this.truck.angle) * 0.16;
      const py = Math.cos(this.truck.angle) * 0.16;
      const heated = this.upgrades.heater >= 1;
      this.tireMarks.push(
        {
          x1: this.lastTireX + px,
          y1: this.lastTireY + py,
          x2: this.truck.x + px,
          y2: this.truck.y + py,
          alpha: 0.75,
          heated,
        },
        {
          x1: this.lastTireX - px,
          y1: this.lastTireY - py,
          x2: this.truck.x - px,
          y2: this.truck.y - py,
          alpha: 0.75,
          heated,
        }
      );
      if (this.tireMarks.length > 160) {
        this.tireMarks.splice(0, this.tireMarks.length - 160);
      }
      this.lastTireX = this.truck.x;
      this.lastTireY = this.truck.y;
    }

    // 5. Plow blade snow carving!
    this.performSnowPlowing(dt);
  }

  private canTruckOccupy(x: number, y: number, r: number): boolean {
    if (x < r || y < r || x > this.size - r || y > this.size - r) return false;
    const checks = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    for (const [cx, cy] of checks) {
      const tx = Math.floor(cx);
      const ty = Math.floor(cy);
      const tile = this.tiles[ty]?.[tx];
      if (!tile || !tile.plowable) return false;
    }
    return true;
  }

  private performSnowPlowing(dt: number): void {
    const fwdX = Math.cos(this.truck.angle);
    const fwdY = Math.sin(this.truck.angle);
    const bladeX = this.truck.x + fwdX * 0.56;
    const bladeY = this.truck.y + fwdY * 0.56;
    const radius = this.stats.bladeRadius;

    const minX = Math.max(0, Math.floor(bladeX - radius - 0.6));
    const maxX = Math.min(this.size - 1, Math.ceil(bladeX + radius + 0.6));
    const minY = Math.max(0, Math.floor(bladeY - radius - 0.6));
    const maxY = Math.min(this.size - 1, Math.ceil(bladeY + radius + 0.6));

    let snowCarvedThisFrame = 0;
    const speedFactor = Math.max(0.45, Math.min(2.1, this.truck.speed / 2.2));

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const tile = this.tiles[gy][gx];
        if (!tile.plowable || tile.snow <= 0) continue;

        const dist = Math.hypot(gx + 0.5 - bladeX, gy + 0.5 - bladeY);
        if (dist > radius) continue;

        const falloff = 1 - (dist / radius) * 0.35;
        const wasDrift = tile.snow > 1.05;
        const removeAmt =
          this.stats.clearRate *
          speedFactor *
          falloff *
          (this.truck.boosting ? 1.4 : 1) *
          (wasDrift ? this.stats.driftBreakPower * 0.62 : 1) *
          dt;

        const prevSnow = tile.snow;
        tile.snow = Math.max(0, tile.snow - removeAmt);
        const carved = prevSnow - tile.snow;
        snowCarvedThisFrame += carved;

        // Melt ice if Heated Salt Spreader is installed
        if (tile.icy && this.upgrades.heater >= 1) {
          tile.icy = false;
          tile.saltGlow = 1;
        }

        // Breaking through a heavy snowdrift mound triggers juicy smash feedback!
        if (wasDrift && tile.snow <= 0.92) {
          this.onDriftSmashed(gx + 0.5, gy + 0.5);
        }

        // Snap cleanly to 0% snow once almost clear so no frustrating micro-slivers linger
        if (tile.snow <= 0.14 && !tile.cleared) {
          this.completeTileClear(tile, wasDrift);
        }
      }
    }

    // Heated Salt Spreader trailing thermal warmth melts edge snow behind the truck
    if (this.stats.saltTrailRadius > 0 && this.truck.speed > 0.35) {
      const rearX = this.truck.x - fwdX * 0.45;
      const rearY = this.truck.y - fwdY * 0.45;
      const sr = this.stats.saltTrailRadius;
      for (let gy = Math.max(0, Math.floor(rearY - 1)); gy <= Math.min(this.size - 1, Math.ceil(rearY + 1)); gy++) {
        for (let gx = Math.max(0, Math.floor(rearX - 1)); gx <= Math.min(this.size - 1, Math.ceil(rearX + 1)); gx++) {
          const tile = this.tiles[gy][gx];
          if (!tile.plowable) continue;
          if (Math.hypot(gx + 0.5 - rearX, gy + 0.5 - rearY) <= sr) {
            tile.saltGlow = Math.max(tile.saltGlow, 0.85);
            if (tile.icy) tile.icy = false;
            if (tile.snow > 0) {
              tile.snow = Math.max(0, tile.snow - dt * (1.2 + this.upgrades.heater * 0.55));
              if (tile.snow <= 0.14 && !tile.cleared) {
                this.completeTileClear(tile, false);
              }
            }
          }
        }
      }
      if (Math.random() < dt * 16) {
        this.spawnParticle(
          rearX + (Math.random() - 0.5) * 0.3,
          rearY + (Math.random() - 0.5) * 0.3,
          0.1,
          -fwdX * 0.6,
          -fwdY * 0.6,
          0.9,
          2.2,
          0.35,
          '#ffaa4c',
          'salt'
        );
      }
    }

    // Update snow-contact audio & blade snow-spray particles
    const targetContact = Math.min(1, snowCarvedThisFrame * 14);
    this.snowContactSmooth += (targetContact - this.snowContactSmooth) * Math.min(1, dt * 12);
    this.truck.plowLoad += (Math.min(1, snowCarvedThisFrame * 12) - this.truck.plowLoad) * Math.min(1, dt * 8);

    if (snowCarvedThisFrame > 0.006 && this.truck.speed > 0.4) {
      const perpX = -fwdY;
      const perpY = fwdX;
      const sprayCount = Math.min(4, Math.ceil(snowCarvedThisFrame * 28));
      for (let i = 0; i < sprayCount; i++) {
        const side = Math.random() < 0.5 ? 1 : -1;
        this.spawnParticle(
          bladeX + perpX * side * (0.2 + Math.random() * 0.35),
          bladeY + perpY * side * (0.2 + Math.random() * 0.35),
          0.12,
          perpX * side * (1.6 + Math.random() * 1.9) + fwdX * 0.8,
          perpY * side * (1.6 + Math.random() * 1.9) + fwdY * 0.8,
          1.7 + Math.random() * 1.8,
          2.4 + Math.random() * 2.2,
          0.42 + Math.random() * 0.25,
          Math.random() < 0.25 ? '#d4e4f7' : '#f7fbff',
          'snow'
        );
      }
    }
  }

  private onDriftSmashed(gx: number, gy: number): void {
    this.hitstopTimer = 0.036;
    this.shakeMag = Math.max(this.shakeMag, 4.2);
    this.truck.squash = Math.max(this.truck.squash, 0.42);
    this.audio.playDriftSmash();

    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 2.8;
      this.spawnParticle(
        gx,
        gy,
        0.22,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        2.5 + Math.random() * 2.2,
        3.5 + Math.random() * 2.5,
        0.58 + Math.random() * 0.25,
        '#ffffff',
        'clump'
      );
    }
  }

  private completeTileClear(tile: Tile, wasDrift: boolean): void {
    tile.snow = 0;
    tile.cleared = true;
    tile.popAnim = 1;
    this.clearedCount++;

    // Advance Combo Streak!
    this.comboStreakCount++;
    this.comboTimer = this.stats.comboDuration;
    this.comboMultiplier = Math.min(
      this.stats.maxCombo,
      Math.round((1 + Math.floor(this.comboStreakCount / 3) * 0.5) * 10) / 10
    );
    this.maxComboReached = Math.max(this.maxComboReached, this.comboMultiplier);

    const basePoints = wasDrift ? 24 : 12;
    const pts = Math.round(basePoints * this.comboMultiplier);
    const earnedCoins = Math.max(
      1,
      Math.round((wasDrift ? 4 : 2) * (0.7 + this.comboMultiplier * 0.3) * this.stats.coinBonusMult)
    );

    this.addScore(pts);
    this.coins += earnedCoins;

    this.audio.playTileCleared(this.comboStreakCount, wasDrift);

    // Subtle sparkle pop on cleared tile
    this.spawnParticle(
      tile.gx + 0.5,
      tile.gy + 0.5,
      0.14,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      1.6,
      2.6,
      0.45,
      this.comboMultiplier >= 4 ? '#ffd166' : '#cfe7ff',
      'spark'
    );

    if (wasDrift || this.comboStreakCount % 4 === 0) {
      this.spawnFloatingText(
        tile.gx + 0.5,
        tile.gy + 0.5,
        0.45,
        `+${pts}`,
        this.comboMultiplier >= 2 ? `${this.comboMultiplier.toFixed(1)}x` : undefined,
        this.comboMultiplier >= 4 ? '#ffcf5c' : '#e6f2ff',
        wasDrift ? 1.12 : 0.92
      );
    }

    // Check if this driveway belongs to a cozy cottage!
    if (tile.cabinId > 0) {
      this.checkCabinDrivewayCleared(tile.cabinId);
    }
  }

  private checkCabinDrivewayCleared(cabinId: number): void {
    let cabinTile: Tile | null = null;
    let allDrivewaysCleared = true;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t.cabinId !== cabinId) continue;
        if (t.kind === 'cabin') {
          cabinTile = t;
        } else if (t.plowable && !t.cleared) {
          allDrivewaysCleared = false;
        }
      }
    }

    if (cabinTile && !cabinTile.cabinLit && allDrivewaysCleared) {
      cabinTile.cabinLit = true;
      cabinTile.popAnim = 1;
      this.cabinsWarmed++;

      const bonusCoins = Math.round(28 * this.stats.coinBonusMult);
      const bonusScore = Math.round(180 * this.comboMultiplier);
      this.coins += bonusCoins;
      this.addScore(bonusScore);
      this.comboTimer = this.stats.comboDuration;
      this.shakeMag = Math.max(this.shakeMag, 3.2);
      this.audio.playCabinWarmed();

      // Golden warm celebration sparks from cottage chimney
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnParticle(
          cabinTile.gx + 0.5,
          cabinTile.gy + 0.5,
          0.95,
          Math.cos(a) * (0.8 + Math.random() * 1.4),
          Math.sin(a) * (0.8 + Math.random() * 1.4),
          2.2 + Math.random() * 1.8,
          3.4,
          0.85,
          i % 2 === 0 ? '#ffd166' : '#ff9f43',
          'heart'
        );
      }

      this.spawnFloatingText(
        cabinTile.gx + 0.5,
        cabinTile.gy + 0.5,
        1.25,
        `+${bonusCoins} Coins`,
        'Driveway Warmed!',
        '#ffd166',
        1.22
      );
    }
  }

  private triggerSnowblowerPulse(): void {
    const fwdX = Math.cos(this.truck.angle);
    const fwdY = Math.sin(this.truck.angle);
    const range = this.stats.blowerRange;
    let hitAny = false;

    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) {
        const tile = this.tiles[gy][gx];
        if (!tile.plowable || tile.snow <= 0) continue;
        const dx = gx + 0.5 - this.truck.x;
        const dy = gy + 0.5 - this.truck.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range || dist < 0.7) continue;
        // Forward 90-degree cone
        const dot = (dx * fwdX + dy * fwdY) / dist;
        if (dot > 0.45) {
          tile.snow = Math.max(0, tile.snow - (0.58 + this.upgrades.blower * 0.14));
          hitAny = true;
          if (tile.snow <= 0.14 && !tile.cleared) {
            this.completeTileClear(tile, false);
          }
        }
      }
    }

    if (hitAny) {
      this.audio.playBlowerPulse();
      for (let i = 0; i < 10; i++) {
        const spread = (Math.random() - 0.5) * 0.9;
        const a = this.truck.angle + spread;
        const spd = 2.6 + Math.random() * 2.2;
        this.spawnParticle(
          this.truck.x,
          this.truck.y,
          0.62,
          Math.cos(a) * spd,
          Math.sin(a) * spd,
          2.1 + Math.random() * 1.4,
          3.1,
          0.52,
          '#e3f1ff',
          'blower'
        );
      }
    }
  }

  private stepPickups(dt: number): void {
    const magR = this.stats.magnetRadius;
    for (const p of this.pickups) {
      if (p.collected) continue;
      const dx = this.truck.x - p.x;
      const dy = this.truck.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < magR && dist > 0.05) {
        const pull = (1 - dist / magR) * 5.8 + 1.8;
        p.x += (dx / dist) * pull * dt;
        p.y += (dy / dist) * pull * dt;
      }

      if (dist < 0.62) {
        p.collected = true;
        this.audio.playPickup(p.kind);
        if (p.kind === 'cocoa') {
          this.truck.boostEnergy = 1;
          this.comboTimer = this.stats.comboDuration;
          this.comboStreakCount += 4;
          const bonusPts = Math.round(120 * this.comboMultiplier);
          this.addScore(bonusPts);
          this.spawnFloatingText(
            p.x,
            p.y,
            0.7,
            'Hot Cocoa!',
            'Boost Full · Combo Held',
            '#ffbe6b',
            1.1
          );
        } else {
          const crystalCoins = Math.round(22 * this.stats.coinBonusMult);
          const crystalPts = Math.round(95 * this.comboMultiplier);
          this.coins += crystalCoins;
          this.addScore(crystalPts);
          this.spawnFloatingText(
            p.x,
            p.y,
            0.7,
            `+${crystalCoins} Coins`,
            'Frost Crystal',
            '#8ee5ff',
            1.08
          );
        }

        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          this.spawnParticle(
            p.x,
            p.y,
            0.35,
            Math.cos(a) * 1.8,
            Math.sin(a) * 1.8,
            2.1,
            3,
            0.55,
            p.kind === 'cocoa' ? '#ffbe6b' : '#9cecff',
            'spark'
          );
        }
      }
    }
  }

  private stepWeatherSquall(dt: number): void {
    if (this.stageConfig.squallInterval <= 0) {
      this.squallWarning = 0;
      return;
    }

    if (this.squallActiveTimer > 0) {
      this.squallActiveTimer = Math.max(0, this.squallActiveTimer - dt);
      this.squallWarning = Math.min(1, this.squallActiveTimer / 3.5);
      return;
    }

    this.squallTimer -= dt;
    if (this.squallTimer <= 3.5 && this.squallTimer > 0) {
      this.squallWarning = (3.5 - this.squallTimer) / 3.5;
    } else if (this.squallTimer <= 0) {
      // Gentle localized flurry dusts a tiny 2-3 tile pocket (never undoes huge progress)
      this.squallTimer = this.stageConfig.squallInterval;
      this.squallActiveTimer = 3.6;
      this.audio.playSquallWind();

      let dusted = 0;
      for (let tries = 0; tries < 24 && dusted < 3; tries++) {
        const rx = Math.floor(Math.random() * this.size);
        const ry = Math.floor(Math.random() * this.size);
        const tile = this.tiles[ry]?.[rx];
        if (!tile || !tile.plowable || tile.cabinId > 0) continue;
        if (Math.hypot(rx + 0.5 - this.truck.x, ry + 0.5 - this.truck.y) < 3.2) continue;
        if (tile.cleared) {
          tile.cleared = false;
          tile.snow = 0.62;
          this.clearedCount = Math.max(0, this.clearedCount - 1);
          dusted++;
        }
      }
    } else {
      this.squallWarning = Math.max(0, this.squallWarning - dt);
    }
  }

  private finishStage(isVictory: boolean): void {
    this.heldKeys.clear();
    this.pointerDown = false;
    this.audio.updateContinuous(false, 0, 0, false);

    const clearedPercent = Math.round((this.clearedCount / this.totalPlowable) * 100);
    const stageBonusCoins = isVictory
      ? Math.round((45 + this.stageIndex * 18 + Math.floor(this.timeRemaining * 0.6)) * this.stats.coinBonusMult)
      : 0;
    const pristineBonusCoins = isVictory && clearedPercent >= 98 ? 40 : 0;

    if (isVictory) {
      this.coins += stageBonusCoins + pristineBonusCoins;
      this.addScore(Math.round((stageBonusCoins + pristineBonusCoins) * 10));
      this.audio.playStageComplete();
    } else {
      this.audio.playShiftOver();
    }

    this.roundSummary = {
      stageIndex: this.stageIndex,
      stageName: this.stageConfig.name,
      clearedPercent,
      targetPercent: this.stageConfig.targetPercent,
      timeRemaining: Math.ceil(this.timeRemaining),
      maxComboReached: this.maxComboReached,
      cabinsWarmed: this.cabinsWarmed,
      totalCabins: this.totalCabins,
      stageBonusCoins,
      pristineBonusCoins,
      scoreEarned: this.score - this.stageStartScore,
      isVictory,
    };

    this.gameState = isVictory ? 'ROUND_SUMMARY' : 'GAME_OVER';
    this.emitHud(true);
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(this.highScore));
      } catch {
        // Ignore storage errors
      }
    }
  }

  // ---- Particles, Smoke, Camera ----

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    maxLife: number,
    color: string,
    kind: Particle['kind']
  ): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.size = size;
        p.life = maxLife;
        p.maxLife = maxLife;
        p.color = color;
        p.kind = kind;
        return;
      }
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    z: number,
    text: string,
    subtext: string | undefined,
    color: string,
    scale = 1
  ): void {
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      if (!ft.active) {
        ft.active = true;
        ft.x = x;
        ft.y = y;
        ft.z = z;
        ft.text = text;
        ft.subtext = subtext;
        ft.color = color;
        ft.life = 1.05;
        ft.maxLife = 1.05;
        ft.scale = scale;
        return;
      }
    }
  }

  private updateChimneySmoke(dt: number): void {
    this.chimneyTimer -= dt;
    if (this.chimneyTimer > 0) return;
    this.chimneyTimer = 0.24;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t.kind !== 'cabin') continue;
        if (Math.random() < (t.cabinLit ? 0.55 : 0.28)) {
          this.spawnParticle(
            x + 0.55,
            y + 0.25,
            1.42,
            0.22 + Math.random() * 0.18,
            -0.18 + Math.random() * 0.14,
            0.75 + Math.random() * 0.3,
            4.5,
            1.8,
            t.cabinLit ? '#f4e6d4' : '#d5e0ee',
            'smoke'
          );
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind === 'smoke') {
        p.vx += dt * 0.12;
      } else if (p.kind === 'heart' || p.kind === 'spark') {
        p.vz -= dt * 2.2;
      } else {
        p.vz -= dt * 7.8;
        if (p.z < 0.02) {
          p.z = 0.02;
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.vz = 0;
        }
      }
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (const ft of this.floatingTexts) {
      if (!ft.active) continue;
      ft.life -= dt;
      ft.z += dt * 0.85;
      if (ft.life <= 0) ft.active = false;
    }
  }

  private updateAmbientSnow(dt: number): void {
    const squallBoost = 1 + this.squallWarning * 2.4;
    for (const f of this.ambientFlakes) {
      f.y += f.speedY * dt * (1 + this.squallWarning * 0.7);
      f.x += (f.driftX * squallBoost + Math.sin(this.simTime * 0.9 + f.phase) * 0.006) * dt;
      if (f.y > 1.03) {
        f.y = -0.03;
        f.x = Math.random();
      }
      if (f.x < -0.03) f.x = 1.03;
      if (f.x > 1.03) f.x = -0.03;
    }
  }

  private updateCamera(dt: number): void {
    // Smoothly track plow truck with slight look-ahead while anchored softly toward village center
    const truckW = isoToWorld(
      this.truck.x + Math.cos(this.truck.angle) * 0.85,
      this.truck.y + Math.sin(this.truck.angle) * 0.85,
      0
    );
    const centerW = isoToWorld(this.size * 0.5, this.size * 0.5, 0);
    const targetX = truckW.x * 0.68 + centerW.x * 0.32;
    const targetY = truckW.y * 0.68 + centerW.y * 0.32;

    const lerp = 1 - Math.exp(-dt * 4.5);
    this.camera.x += (targetX - this.camera.x) * lerp;
    this.camera.y += (targetY - this.camera.y) * lerp;

    if (this.shakeMag > 0.08) {
      this.camera.shakeX = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.camera.shakeY = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeMag *= Math.exp(-dt * 14);
    } else {
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
      this.shakeMag = 0;
    }
  }

  // ---- Rendering ----

  private render(): void {
    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);
    renderGameFrame(this.ctx, {
      width: this.canvasW,
      height: this.canvasH,
      time: this.simTime,
      stageConfig: this.stageConfig,
      size: this.size,
      tiles: this.tiles,
      truck: this.truck,
      stats: this.stats,
      upgrades: this.upgrades,
      pickups: this.pickups,
      tireMarks: this.tireMarks,
      particles: this.particles,
      floatingTexts: this.floatingTexts,
      ambientFlakes: this.ambientFlakes,
      camera: this.camera,
      comboMultiplier: this.comboMultiplier,
      squallIntensity: this.squallWarning,
      pointerTarget: {
        x: this.pointerGridX,
        y: this.pointerGridY,
        active: this.pointerDown && this.gameState === 'PLAYING',
      },
    });
    this.ctx.restore();
  }

  // ---- HUD Snapshot Emission ----

  private emitHud(force: boolean): void {
    if (!force && this.gameState === 'TITLE_MENU') return;
    const clearedPercent = Math.min(100, Math.round((this.clearedCount / this.totalPlowable) * 100));
    this.onHudUpdate({
      gameState: this.gameState,
      gameMode: this.gameMode,
      stageIndex: this.stageIndex,
      stageName: this.stageConfig.name,
      stageSubtitle: this.stageConfig.subtitle,
      clearedTiles: this.clearedCount,
      totalPlowableTiles: this.totalPlowable,
      clearedPercent,
      targetPercent: this.stageConfig.targetPercent,
      timeRemaining: Math.ceil(this.timeRemaining),
      score: this.score,
      highScore: this.highScore,
      coins: this.coins,
      comboMultiplier: this.comboMultiplier,
      comboTimerRatio:
        this.stats.comboDuration > 0 ? Math.max(0, this.comboTimer / this.stats.comboDuration) : 0,
      comboStreakCount: this.comboStreakCount,
      maxComboCap: this.stats.maxCombo,
      boostEnergy: this.truck.boostEnergy,
      boosting: this.truck.boosting,
      cabinsWarmed: this.cabinsWarmed,
      totalCabins: this.totalCabins,
      upgrades: this.upgrades,
      canAffordAnyUpgrade: canAffordAnyUpgrade(this.coins, this.upgrades),
      muted: this.audio.isMuted(),
      squallWarning: this.squallWarning,
      roundSummary: this.roundSummary,
    });
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
