export type GameMode = 'SHIFT' | 'ZEN';

export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'WORKSHOP'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export type TileKind =
  | 'road'
  | 'courtyard'
  | 'bridge'
  | 'driveway'
  | 'cabin'
  | 'pine'
  | 'lamp'
  | 'water'
  | 'park';

export interface Tile {
  gx: number;
  gy: number;
  kind: TileKind;
  plowable: boolean;
  /** Snow depth: 0 = cleared, 0..1 = fresh snow, 1..1.85 = deep packed drift */
  snow: number;
  maxSnow: number;
  /** True once tile snow has been cleared to 0 */
  cleared: boolean;
  /** Slippery ice patch beneath or on the surface */
  icy: boolean;
  /** Subtle salt glow decay timer after heated spreader passes */
  saltGlow: number;
  /** Visual variant seed 0..1 */
  variant: number;
  /** Cabin roof tint index or pine scale */
  styleIndex: number;
  /** If this tile is a cabin, whether its connected driveway has been fully cleared */
  cabinLit: boolean;
  /** Animation pop timer when newly cleared or cabin lit */
  popAnim: number;
  /** Cabin ID linking driveway tiles to their cabin */
  cabinId: number;
}

export interface CrystalPickup {
  id: number;
  x: number; // grid space float
  y: number;
  kind: 'crystal' | 'cocoa';
  collected: boolean;
  bobPhase: number;
  revealed: boolean;
}

export interface TireMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  heated: boolean;
}

export interface Particle {
  active: boolean;
  x: number; // grid space
  y: number;
  z: number; // elevation
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'snow' | 'clump' | 'spark' | 'smoke' | 'salt' | 'heart' | 'blower';
}

export interface AmbientFlake {
  x: number; // screen normalized 0..1
  y: number;
  size: number;
  speedY: number;
  driftX: number;
  alpha: number;
  phase: number;
}

export interface FloatingText {
  active: boolean;
  x: number; // grid space
  y: number;
  z: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface TruckState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians in grid space
  speed: number;
  boostEnergy: number; // 0..1
  boosting: boolean;
  squash: number; // 0 = neutral, >0 compressed
  beaconPhase: number;
  blowerCooldown: number;
  plowLoad: number; // 0..1 snow piled in front of blade
  headlightFlicker: number;
}

export type UpgradeKey =
  | 'blade'
  | 'engine'
  | 'heater'
  | 'blower'
  | 'combo'
  | 'lantern';

export type UpgradeLevels = Record<UpgradeKey, number>;

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  summary: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectLabel: (level: number) => string;
  nextEffectLabel: (level: number) => string;
}

export interface TruckStats {
  bladeRadius: number;
  clearRate: number;
  maxSpeed: number;
  accel: number;
  boostMult: number;
  boostRecharge: number;
  driftBreakPower: number;
  iceGrip: number;
  saltTrailRadius: number;
  blowerInterval: number;
  blowerRange: number;
  comboDuration: number;
  maxCombo: number;
  magnetRadius: number;
  headlightLength: number;
  coinBonusMult: number;
}

export interface StageConfig {
  index: number;
  name: string;
  subtitle: string;
  size: number;
  targetPercent: number;
  timeLimit: number; // seconds
  driftDensity: number;
  iceDensity: number;
  squallInterval: number; // 0 = none
  ambientTint: string;
}

export interface RoundSummaryData {
  stageIndex: number;
  stageName: string;
  clearedPercent: number;
  targetPercent: number;
  timeRemaining: number;
  maxComboReached: number;
  cabinsWarmed: number;
  totalCabins: number;
  stageBonusCoins: number;
  pristineBonusCoins: number;
  scoreEarned: number;
  isVictory: boolean;
}

export interface HudSnapshot {
  gameState: GameState;
  gameMode: GameMode;
  stageIndex: number;
  stageName: string;
  stageSubtitle: string;
  clearedTiles: number;
  totalPlowableTiles: number;
  clearedPercent: number;
  targetPercent: number;
  timeRemaining: number;
  score: number;
  highScore: number;
  coins: number;
  comboMultiplier: number;
  comboTimerRatio: number; // 0..1
  comboStreakCount: number;
  maxComboCap: number;
  boostEnergy: number; // 0..1
  boosting: boolean;
  cabinsWarmed: number;
  totalCabins: number;
  upgrades: UpgradeLevels;
  canAffordAnyUpgrade: boolean;
  muted: boolean;
  squallWarning: number; // 0..1
  roundSummary: RoundSummaryData | null;
}
