import { CrystalPickup, StageConfig, Tile, TileKind } from './types';

export const STAGE_CONFIGS: StageConfig[] = [
  {
    index: 0,
    name: "Bakers' Lane",
    subtitle: 'First dusting over the morning hearth cottages',
    size: 15,
    targetPercent: 84,
    timeLimit: 95,
    driftDensity: 0.12,
    iceDensity: 0,
    squallInterval: 0,
    ambientTint: '#111d30',
  },
  {
    index: 1,
    name: 'Lantern Square',
    subtitle: 'Cobblestone market plaza with fresh drifts & frost patches',
    size: 17,
    targetPercent: 85,
    timeLimit: 105,
    driftDensity: 0.2,
    iceDensity: 0.08,
    squallInterval: 34,
    ambientTint: '#0f1b2e',
  },
  {
    index: 2,
    name: 'Timber Creek Crossing',
    subtitle: 'Twin wooden bridges spanning the frozen alpine brook',
    size: 18,
    targetPercent: 85,
    timeLimit: 112,
    driftDensity: 0.25,
    iceDensity: 0.14,
    squallInterval: 30,
    ambientTint: '#0d192b',
  },
  {
    index: 3,
    name: 'Pinecrest Commons',
    subtitle: 'Winding spruce avenues and heavy midnight snowdrifts',
    size: 19,
    targetPercent: 86,
    timeLimit: 120,
    driftDensity: 0.3,
    iceDensity: 0.18,
    squallInterval: 27,
    ambientTint: '#0b1627',
  },
  {
    index: 4,
    name: 'Starlight Overlook',
    subtitle: 'Grand hillside village under a crisp northern flurry',
    size: 20,
    targetPercent: 86,
    timeLimit: 125,
    driftDensity: 0.35,
    iceDensity: 0.22,
    squallInterval: 24,
    ambientTint: '#0a1324',
  },
];

export function getStageConfig(stageIndex: number): StageConfig {
  if (stageIndex < STAGE_CONFIGS.length) {
    return STAGE_CONFIGS[stageIndex];
  }
  const extra = stageIndex - STAGE_CONFIGS.length + 1;
  const names = [
    'Frostpine Hollow',
    'Aurora Ridge',
    'Cinderbell Terrace',
    'Winterberry Wharf',
    'Solstice Promenade',
  ];
  return {
    index: stageIndex,
    name: `${names[(extra - 1) % names.length]} ${Math.floor((extra - 1) / names.length) + 1}`,
    subtitle: 'Endless deep-winter shift across Pinehearth Valley',
    size: Math.min(22, 20 + Math.floor(extra / 2)),
    targetPercent: Math.min(90, 86 + Math.min(4, extra)),
    timeLimit: Math.max(105, 128 - extra * 2),
    driftDensity: Math.min(0.48, 0.36 + extra * 0.03),
    iceDensity: Math.min(0.28, 0.22 + extra * 0.02),
    squallInterval: Math.max(18, 24 - extra),
    ambientTint: '#0a1324',
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedStage {
  config: StageConfig;
  size: number;
  tiles: Tile[][];
  spawnX: number;
  spawnY: number;
  totalPlowable: number;
  totalCabins: number;
  pickups: CrystalPickup[];
}

export function generateStage(stageIndex: number): GeneratedStage {
  const config = getStageConfig(stageIndex);
  const size = config.size;
  const rand = mulberry32(104729 + stageIndex * 7919);

  // Initialize base grid as park/snowy ground
  const kindGrid: TileKind[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'park' as TileKind)
  );

  const mid = Math.floor(size / 2);
  const hasCreek = stageIndex === 2 || (stageIndex >= 5 && stageIndex % 2 === 1);

  // 1. Carve wide loop avenues + central plaza
  const margin = 2;
  const innerMax = size - 3;

  const paintRect = (x0: number, y0: number, x1: number, y1: number, kind: TileKind) => {
    for (let y = Math.max(1, y0); y <= Math.min(size - 2, y1); y++) {
      for (let x = Math.max(1, x0); x <= Math.min(size - 2, x1); x++) {
        kindGrid[y][x] = kind;
      }
    }
  };

  // Perimeter ring road (2 tiles wide for cozy sweeping turns)
  paintRect(margin, margin, innerMax, margin + 1, 'road');
  paintRect(margin, innerMax - 1, innerMax, innerMax, 'road');
  paintRect(margin, margin, margin + 1, innerMax, 'road');
  paintRect(innerMax - 1, margin, innerMax, innerMax, 'road');

  // Cross avenues
  paintRect(mid - 1, margin, mid, innerMax, 'road');
  paintRect(margin, mid - 1, innerMax, mid, 'road');

  // Central cobblestone courtyard
  paintRect(mid - 2, mid - 2, mid + 1, mid + 1, 'courtyard');

  // Optional frozen creek with twin wooden bridges
  if (hasCreek) {
    const creekY = mid;
    for (let x = 0; x < size; x++) {
      kindGrid[creekY][x] = 'water';
      if (creekY + 1 < size - 1 && x % 3 !== 0 && (x < margin || x > innerMax)) {
        kindGrid[creekY + 1][x] = 'water';
      }
    }
    // Restore bridges across the creek at the 3 road crossings
    const bridgeXs = [margin, margin + 1, mid - 1, mid, innerMax - 1, innerMax];
    for (const bx of bridgeXs) {
      if (bx >= 1 && bx <= size - 2) {
        kindGrid[creekY][bx] = 'bridge';
        if (kindGrid[creekY - 1][bx] === 'park') kindGrid[creekY - 1][bx] = 'road';
        if (kindGrid[creekY + 1][bx] === 'park' || kindGrid[creekY + 1][bx] === 'water') {
          kindGrid[creekY + 1][bx] = 'road';
        }
      }
    }
  }

  // Secondary pocket plazas in quadrants for variety
  if (stageIndex % 2 === 1) {
    paintRect(4, 4, 6, 5, 'courtyard');
    paintRect(size - 7, size - 6, size - 5, size - 5, 'courtyard');
  }

  // 2. Place cozy cabins on park tiles adjacent to roads, and mark adjacent road tiles as driveways
  const cabinPositions: { x: number; y: number; id: number }[] = [];
  const candidates: { x: number; y: number }[] = [];

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (kindGrid[y][x] !== 'park') continue;
      // Avoid outer top-right / bottom-left corners right on border
      const adjRoad =
        isDriveable(kindGrid[y - 1]?.[x]) ||
        isDriveable(kindGrid[y + 1]?.[x]) ||
        isDriveable(kindGrid[y]?.[x - 1]) ||
        isDriveable(kindGrid[y]?.[x + 1]);
      if (adjRoad) {
        candidates.push({ x, y });
      }
    }
  }

  // Shuffle candidates deterministically
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const targetCabins = Math.min(9, 4 + stageIndex);
  for (const cand of candidates) {
    if (cabinPositions.length >= targetCabins) break;
    // Keep cabins spaced nicely apart
    const tooClose = cabinPositions.some(
      (c) => Math.abs(c.x - cand.x) + Math.abs(c.y - cand.y) < 3
    );
    if (tooClose) continue;
    // Ensure not blocking all paths and not next to water
    const nearWater =
      kindGrid[cand.y - 1]?.[cand.x] === 'water' ||
      kindGrid[cand.y + 1]?.[cand.x] === 'water' ||
      kindGrid[cand.y]?.[cand.x - 1] === 'water' ||
      kindGrid[cand.y]?.[cand.x + 1] === 'water';
    if (nearWater) continue;

    kindGrid[cand.y][cand.x] = 'cabin';
    cabinPositions.push({ x: cand.x, y: cand.y, id: cabinPositions.length + 1 });
  }

  // 3. Place warm wrought-iron village lamps at courtyard corners and intersections
  const lampCandidates = [
    { x: mid - 3, y: mid - 3 },
    { x: mid + 2, y: mid - 3 },
    { x: mid - 3, y: mid + 2 },
    { x: mid + 2, y: mid + 2 },
    { x: 1, y: margin },
    { x: size - 2, y: margin },
    { x: 1, y: innerMax },
    { x: size - 2, y: innerMax },
    { x: mid, y: 1 },
    { x: mid, y: size - 2 },
  ];
  for (const lc of lampCandidates) {
    if (
      lc.x >= 0 &&
      lc.x < size &&
      lc.y >= 0 &&
      lc.y < size &&
      kindGrid[lc.y][lc.x] === 'park'
    ) {
      kindGrid[lc.y][lc.x] = 'lamp';
    }
  }

  // 4. Fill remaining scenic park border tiles with snow-laden spruce pines
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (kindGrid[y][x] !== 'park') continue;
      const isEdge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const chance = isEdge ? 0.56 : 0.42;
      if (rand() < chance) {
        kindGrid[y][x] = 'pine';
      }
    }
  }

  // Build final Tile matrix
  const tiles: Tile[][] = Array.from({ length: size }, (_, gy) =>
    Array.from({ length: size }, (_, gx) => {
      const kind = kindGrid[gy][gx];
      const plowable = isDriveable(kind);
      const variant = rand();
      let snow = 0;
      let icy = false;

      if (plowable) {
        // Base snow blanket: 0.72..1.0; some deep drifts up to 1.75
        const isDrift = rand() < config.driftDensity;
        snow = isDrift ? 1.35 + rand() * 0.45 : 0.78 + rand() * 0.22;
        if (!isDrift && kind !== 'bridge' && rand() < config.iceDensity) {
          icy = true;
          snow = 0.65 + rand() * 0.25;
        }
      } else if (kind === 'park') {
        snow = 1.0;
      }

      return {
        gx,
        gy,
        kind,
        plowable,
        snow,
        maxSnow: Math.max(1, snow),
        cleared: !plowable,
        icy,
        saltGlow: 0,
        variant,
        styleIndex: Math.floor(rand() * 4),
        cabinLit: false,
        popAnim: 0,
        cabinId: 0,
      };
    })
  );

  // Assign cabin IDs and link immediate front/adjacent plowable tiles as driveways
  for (const cab of cabinPositions) {
    tiles[cab.y][cab.x].cabinId = cab.id;
    const dirs = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    let linked = 0;
    for (const [dx, dy] of dirs) {
      const nx = cab.x + dx;
      const ny = cab.y + dy;
      const neighbor = tiles[ny]?.[nx];
      if (neighbor && neighbor.plowable && neighbor.cabinId === 0 && linked < 2) {
        neighbor.kind = neighbor.kind === 'bridge' ? 'bridge' : 'driveway';
        neighbor.cabinId = cab.id;
        linked++;
      }
    }
  }

  // Pick a guaranteed safe open spawn tile near center courtyard
  let spawnX = mid - 0.5;
  let spawnY = mid - 1.5;
  if (!tiles[Math.floor(spawnY)]?.[Math.floor(spawnX)]?.plowable) {
    outer: for (let r = 0; r < size; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = mid + dx;
          const ty = mid + dy;
          if (tiles[ty]?.[tx]?.plowable) {
            spawnX = tx + 0.5;
            spawnY = ty + 0.5;
            break outer;
          }
        }
      }
    }
  }

  // Clear a cozy tiny patch right beneath the parked truck at start
  const stx = Math.floor(spawnX);
  const sty = Math.floor(spawnY);
  if (tiles[sty]?.[stx]?.plowable) {
    tiles[sty][stx].snow = 0;
    tiles[sty][stx].cleared = true;
    tiles[sty][stx].icy = false;
  }

  // Count total plowable tiles
  let totalPlowable = 0;
  const plowableList: Tile[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (tiles[y][x].plowable) {
        totalPlowable++;
        if (x !== stx || y !== sty) {
          plowableList.push(tiles[y][x]);
        }
      }
    }
  }

  // Spawn bonus Frost Crystals & steaming Hot Cocoa mugs
  const pickups: CrystalPickup[] = [];
  const pickupCount = Math.min(10, 4 + stageIndex);
  for (let i = plowableList.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [plowableList[i], plowableList[j]] = [plowableList[j], plowableList[i]];
  }
  for (let i = 0; i < Math.min(pickupCount, plowableList.length); i++) {
    const tile = plowableList[i];
    const distFromSpawn = Math.hypot(tile.gx + 0.5 - spawnX, tile.gy + 0.5 - spawnY);
    if (distFromSpawn < 2.5) continue;
    pickups.push({
      id: i + 1,
      x: tile.gx + 0.5,
      y: tile.gy + 0.5,
      kind: i % 3 === 0 ? 'cocoa' : 'crystal',
      collected: false,
      bobPhase: rand() * Math.PI * 2,
      revealed: tile.snow <= 1.05,
    });
  }

  return {
    config,
    size,
    tiles,
    spawnX,
    spawnY,
    totalPlowable,
    totalCabins: cabinPositions.length,
    pickups,
  };
}

function isDriveable(kind?: TileKind): boolean {
  return kind === 'road' || kind === 'courtyard' || kind === 'bridge' || kind === 'driveway';
}
