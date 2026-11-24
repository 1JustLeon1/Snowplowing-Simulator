import {
  AmbientFlake,
  CrystalPickup,
  FloatingText,
  Particle,
  StageConfig,
  Tile,
  TireMark,
  TruckState,
  TruckStats,
  UpgradeLevels,
} from './types';

export const TILE_W = 68;
export const TILE_H = 34;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
const Z_SCALE = 28;

export interface CameraState {
  x: number; // world screen-space center X
  y: number; // world screen-space center Y
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export interface RenderContextData {
  width: number;
  height: number;
  time: number;
  stageConfig: StageConfig;
  size: number;
  tiles: Tile[][];
  truck: TruckState;
  stats: TruckStats;
  upgrades: UpgradeLevels;
  pickups: CrystalPickup[];
  tireMarks: TireMark[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  ambientFlakes: AmbientFlake[];
  camera: CameraState;
  comboMultiplier: number;
  squallIntensity: number;
  pointerTarget: { x: number; y: number; active: boolean };
}

export function isoToWorld(gx: number, gy: number, gz = 0): { x: number; y: number } {
  return {
    x: (gx - gy) * HALF_W,
    y: (gx + gy) * HALF_H - gz * Z_SCALE,
  };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: CameraState
): { gx: number; gy: number } {
  const wx = (screenX - canvasWidth * 0.5 - camera.shakeX) / camera.zoom + camera.x;
  const wy = (screenY - canvasHeight * 0.5 - camera.shakeY) / camera.zoom + camera.y;
  const gx = (wx / HALF_W + wy / HALF_H) * 0.5;
  const gy = (wy / HALF_H - wx / HALF_W) * 0.5;
  return { gx, gy };
}

const CABIN_WALL_COLORS = [
  { left: '#7d4532', right: '#5e3224', roofL: '#d9e5f4', roofR: '#b8cbe2' },
  { left: '#6d4b3a', right: '#503629', roofL: '#dde8f6', roofR: '#bccfe5' },
  { left: '#8a3e38', right: '#662b27', roofL: '#e1ebf8', roofR: '#c0d2e8' },
  { left: '#4c5f6e', right: '#384754', roofL: '#dce7f5', roofR: '#b7cae0' },
];

export function renderGameFrame(ctx: CanvasRenderingContext2D, data: RenderContextData): void {
  const { width, height, time, size, tiles, truck, stats, upgrades, camera } = data;

  // 1. Cozy twilight alpine sky backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0a1220');
  bgGrad.addColorStop(0.55, '#122036');
  bgGrad.addColorStop(1, '#1a2c47');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient aurora / warm horizon vignette
  const horizonGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    width * 0.08,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.65
  );
  horizonGlow.addColorStop(0, 'rgba(54, 88, 134, 0.22)');
  horizonGlow.addColorStop(0.6, 'rgba(20, 36, 62, 0.08)');
  horizonGlow.addColorStop(1, 'rgba(6, 11, 20, 0.45)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle twilight stars in upper background
  drawBackgroundStars(ctx, width, height, time);

  // Enter isometric world camera transform
  ctx.save();
  ctx.translate(
    Math.round(width * 0.5 + camera.shakeX),
    Math.round(height * 0.5 + camera.shakeY)
  );
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // 2. Floating diorama cliff skirt beneath front edges of the village grid
  drawDioramaBase(ctx, size);

  // 3. Ground tiles (back-to-front painter's order)
  for (let sum = 0; sum <= (size - 1) * 2; sum++) {
    for (let gx = 0; gx < size; gx++) {
      const gy = sum - gx;
      if (gy < 0 || gy >= size) continue;
      drawGroundTile(ctx, tiles[gy][gx], time);
    }
  }

  // 4. Tire marks on cleared ground
  drawTireMarks(ctx, data.tireMarks);

  // 5. Optional gentle pointer steering target ring
  if (data.pointerTarget.active) {
    const pt = isoToWorld(data.pointerTarget.x, data.pointerTarget.y, 0.03);
    const pulse = 0.7 + 0.3 * Math.sin(time * 7);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 202, 92, ${0.42 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, 16, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Headlight volumetric cone cast over ground/snow beneath truck & props
  drawHeadlightCones(ctx, truck, stats, data.comboMultiplier);

  // 7. Depth-sorted 3D entities (Cabins, Pines, Lamps, Pickups, Snowplow Truck)
  type DrawItem = { depth: number; draw: () => void };
  const drawList: DrawItem[] = [];

  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const tile = tiles[gy][gx];
      if (tile.kind === 'cabin') {
        drawList.push({
          depth: gx + gy + 0.55,
          draw: () => drawCabin(ctx, tile, time),
        });
      } else if (tile.kind === 'pine') {
        drawList.push({
          depth: gx + gy + 0.5,
          draw: () => drawPine(ctx, tile, time),
        });
      } else if (tile.kind === 'lamp') {
        drawList.push({
          depth: gx + gy + 0.5,
          draw: () => drawLamp(ctx, tile, time),
        });
      }
    }
  }

  for (const p of data.pickups) {
    if (p.collected) continue;
    const gx = Math.floor(p.x);
    const gy = Math.floor(p.y);
    const tile = tiles[gy]?.[gx];
    const hiddenUnderDeepSnow = tile && tile.snow > 1.05 && upgrades.lantern === 0;
    if (hiddenUnderDeepSnow) continue;
    drawList.push({
      depth: p.x + p.y,
      draw: () => drawPickup(ctx, p, time, Boolean(tile && tile.snow > 0.65)),
    });
  }

  drawList.push({
    depth: truck.x + truck.y + 0.12,
    draw: () => drawPlowTruck(ctx, truck, upgrades, time, data.comboMultiplier),
  });

  drawList.sort((a, b) => a.depth - b.depth);
  for (const item of drawList) {
    item.draw();
  }

  // 8. Warm radial lantern light blooms (soft screen/lighter feel)
  drawLanternBlooms(ctx, tiles, size, time);

  // 9. World-space particles (snow spray, drift clumps, chimney smoke, hearth sparks)
  drawParticles(ctx, data.particles);

  // 10. Floating world-space score & milestone texts
  drawFloatingTexts(ctx, data.floatingTexts);

  ctx.restore();

  // 11. Screen-space falling snow & gentle squall wind streaks
  drawAmbientSnow(ctx, data.ambientFlakes, width, height, data.squallIntensity, time);
}

function drawBackgroundStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  ctx.save();
  for (let i = 0; i < 36; i++) {
    const sx = ((i * 197.3) % 1) * width;
    const sy = ((i * 83.7) % 0.48) * height;
    const twinkle = 0.25 + 0.35 * Math.sin(time * (1.2 + (i % 5) * 0.35) + i * 2.1);
    const r = i % 4 === 0 ? 1.6 : 1.0;
    ctx.fillStyle = `rgba(226, 238, 255, ${twinkle.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDioramaBase(ctx: CanvasRenderingContext2D, size: number): void {
  const depth = 34;
  const topCorner = isoToWorld(0, 0, 0);
  const rightCorner = isoToWorld(size, 0, 0);
  const bottomCorner = isoToWorld(size, size, 0);
  const leftCorner = isoToWorld(0, size, 0);

  // Soft drop shadow beneath floating village island
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 16, 0.45)';
  ctx.beginPath();
  ctx.moveTo(topCorner.x, topCorner.y + depth + 16);
  ctx.lineTo(rightCorner.x + 12, rightCorner.y + depth + 16);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + depth + 26);
  ctx.lineTo(leftCorner.x - 12, leftCorner.y + depth + 16);
  ctx.closePath();
  ctx.fill();

  // Left cliff face (along y = size, x from 0 to size)
  const leftGrad = ctx.createLinearGradient(0, leftCorner.y, 0, bottomCorner.y + depth);
  leftGrad.addColorStop(0, '#36465c');
  leftGrad.addColorStop(0.28, '#263448');
  leftGrad.addColorStop(1, '#182334');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.moveTo(leftCorner.x, leftCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + depth);
  ctx.lineTo(leftCorner.x, leftCorner.y + depth);
  ctx.closePath();
  ctx.fill();

  // Right cliff face (along x = size, y from 0 to size)
  const rightGrad = ctx.createLinearGradient(0, rightCorner.y, 0, bottomCorner.y + depth);
  rightGrad.addColorStop(0, '#273549');
  rightGrad.addColorStop(0.3, '#1d293b');
  rightGrad.addColorStop(1, '#121b29');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.moveTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(rightCorner.x, rightCorner.y);
  ctx.lineTo(rightCorner.x, rightCorner.y + depth);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + depth);
  ctx.closePath();
  ctx.fill();

  // Crisp snow rim lip along front edges
  ctx.strokeStyle = 'rgba(218, 232, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftCorner.x, leftCorner.y + 1);
  ctx.lineTo(bottomCorner.x, bottomCorner.y + 1);
  ctx.lineTo(rightCorner.x, rightCorner.y + 1);
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1
): void {
  const hw = HALF_W * scale;
  const hh = HALF_H * scale;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function drawGroundTile(ctx: CanvasRenderingContext2D, tile: Tile, time: number): void {
  const c = isoToWorld(tile.gx + 0.5, tile.gy + 0.5, 0);

  // Base ground material
  if (tile.kind === 'water') {
    const shimmer = Math.sin(time * 1.8 + tile.gx * 0.9 + tile.gy * 0.5) * 0.5 + 0.5;
    drawDiamond(ctx, c.x, c.y + 3, 1.01);
    ctx.fillStyle = shimmer > 0.55 ? '#264f73' : '#204465';
    ctx.fill();
    // Subtle ice sheen stroke
    ctx.strokeStyle = 'rgba(173, 219, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(c.x - 11, c.y + 2);
    ctx.lineTo(c.x + 8, c.y - 3);
    ctx.stroke();
    return;
  }

  if (tile.kind === 'park' || tile.kind === 'cabin' || tile.kind === 'pine' || tile.kind === 'lamp') {
    // Undisturbed crisp alpine snow meadow
    drawDiamond(ctx, c.x, c.y, 1.015);
    const shade = (tile.gx + tile.gy) % 2 === 0 ? '#dce7f5' : '#d4e1f1';
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = 'rgba(155, 179, 210, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    return;
  }

  // Plowable surfaces: road, courtyard, bridge, driveway
  drawDiamond(ctx, c.x, c.y, 1.015);
  if (tile.kind === 'bridge') {
    ctx.fillStyle = tile.cleared ? '#7d573e' : '#654632';
    ctx.fill();
    // Timber plank lines
    ctx.strokeStyle = 'rgba(42, 26, 16, 0.45)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x - 14 + i * 3, c.y - 7 + i * 2);
      ctx.lineTo(c.x + 14 + i * 3, c.y + 7 + i * 2);
      ctx.stroke();
    }
  } else if (tile.kind === 'courtyard') {
    ctx.fillStyle = (tile.gx + tile.gy) % 2 === 0 ? '#465266' : '#3e4a5d';
    ctx.fill();
    drawDiamond(ctx, c.x, c.y, 0.72);
    ctx.strokeStyle = 'rgba(195, 210, 232, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (tile.kind === 'driveway') {
    ctx.fillStyle = tile.cleared ? '#574e59' : '#474352';
    ctx.fill();
    // Warm hearth stone rim once cleared
    if (tile.cleared) {
      drawDiamond(ctx, c.x, c.y, 0.84);
      ctx.strokeStyle = 'rgba(245, 176, 65, 0.34)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  } else {
    // Village cobblestone road
    const alt = (tile.gx + tile.gy) % 2 === 0;
    ctx.fillStyle = alt ? '#394557' : '#344051';
    ctx.fill();
    // Subtle cobble speckles
    ctx.fillStyle = 'rgba(204, 218, 238, 0.08)';
    ctx.fillRect(c.x - 8 + tile.variant * 8, c.y - 3, 6, 3);
    ctx.fillRect(c.x + 2 - tile.variant * 5, c.y + 3, 7, 3);
  }

  // Subtle tile grid grout line
  drawDiamond(ctx, c.x, c.y, 1.0);
  ctx.strokeStyle = 'rgba(22, 31, 44, 0.38)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // Slippery glacial ice patch
  if (tile.icy) {
    drawDiamond(ctx, c.x, c.y, 0.86);
    ctx.fillStyle = 'rgba(130, 206, 245, 0.36)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 243, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x - 10, c.y + 1);
    ctx.lineTo(c.x + 7, c.y - 6);
    ctx.stroke();
  }

  // Heated salt spreader warm residual glow
  if (tile.saltGlow > 0.02) {
    drawDiamond(ctx, c.x, c.y, 0.82);
    ctx.fillStyle = `rgba(248, 158, 66, ${(tile.saltGlow * 0.22).toFixed(3)})`;
    ctx.fill();
  }

  // Cleared pop flash sparkle
  if (tile.popAnim > 0.01 && tile.cleared) {
    drawDiamond(ctx, c.x, c.y, 0.92);
    ctx.fillStyle = `rgba(255, 224, 150, ${(tile.popAnim * 0.32).toFixed(3)})`;
    ctx.fill();
  }

  // Layered Snow Cushion & Deep Snowdrift Mounds
  if (tile.snow > 0.02) {
    const snowRatio = Math.min(1, tile.snow);
    const lift = 3 + snowRatio * 6.5;
    const scale = 0.42 + snowRatio * 0.57;
    const hw = HALF_W * scale;
    const hh = HALF_H * scale;

    // Front-left bevel of snow slab
    ctx.fillStyle = '#b9cbe2';
    ctx.beginPath();
    ctx.moveTo(c.x - hw, c.y - lift);
    ctx.lineTo(c.x, c.y + hh - lift);
    ctx.lineTo(c.x, c.y + hh);
    ctx.lineTo(c.x - hw, c.y);
    ctx.closePath();
    ctx.fill();

    // Front-right bevel of snow slab (cooler shadow)
    ctx.fillStyle = '#9bb3d1';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + hh - lift);
    ctx.lineTo(c.x + hw, c.y - lift);
    ctx.lineTo(c.x + hw, c.y);
    ctx.lineTo(c.x, c.y + hh);
    ctx.closePath();
    ctx.fill();

    // Top luminous snow face
    drawDiamond(ctx, c.x, c.y - lift, scale);
    ctx.fillStyle = tile.snow > 1.05 ? '#f5f9ff' : '#eaf2fc';
    ctx.fill();

    // Subtle crisp snow highlight rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Deep packed snowdrift mound (> 1.0 depth)
    if (tile.snow > 1.02) {
      const moundT = Math.min(1, (tile.snow - 1.0) / 0.75);
      const mh = 7 + moundT * 11;
      const mw = 17 + moundT * 7;

      // Soft drift base shadow
      ctx.fillStyle = 'rgba(128, 155, 190, 0.45)';
      ctx.beginPath();
      ctx.ellipse(c.x + 2, c.y - lift + 2, mw, mh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Puffy twin snowdrift pillow
      const driftGrad = ctx.createRadialGradient(
        c.x - 5,
        c.y - lift - mh * 0.5,
        2,
        c.x,
        c.y - lift - mh * 0.1,
        mw
      );
      driftGrad.addColorStop(0, '#ffffff');
      driftGrad.addColorStop(0.65, '#e5effb');
      driftGrad.addColorStop(1, '#bdd0e8');
      ctx.fillStyle = driftGrad;
      ctx.beginPath();
      ctx.ellipse(c.x - 3, c.y - lift - mh * 0.28, mw * 0.88, mh * 0.68, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + 7, c.y - lift - mh * 0.15, mw * 0.62, mh * 0.5, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTireMarks(ctx: CanvasRenderingContext2D, marks: TireMark[]): void {
  if (marks.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const m of marks) {
    if (m.alpha <= 0.01) continue;
    const p1 = isoToWorld(m.x1, m.y1, 0.01);
    const p2 = isoToWorld(m.x2, m.y2, 0.01);
    ctx.strokeStyle = m.heated
      ? `rgba(245, 166, 70, ${(m.alpha * 0.34).toFixed(3)})`
      : `rgba(18, 25, 36, ${(m.alpha * 0.38).toFixed(3)})`;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeadlightCones(
  ctx: CanvasRenderingContext2D,
  truck: TruckState,
  stats: TruckStats,
  combo: number
): void {
  const dirX = Math.cos(truck.angle);
  const dirY = Math.sin(truck.angle);
  const perpX = -dirY;
  const perpY = dirX;

  const frontStart = isoToWorld(truck.x + dirX * 0.34, truck.y + dirY * 0.34, 0.18);
  const beamLen = stats.headlightLength;
  const farLeft = isoToWorld(
    truck.x + dirX * beamLen + perpX * (0.95 + beamLen * 0.22),
    truck.y + dirY * beamLen + perpY * (0.95 + beamLen * 0.22),
    0.04
  );
  const farRight = isoToWorld(
    truck.x + dirX * beamLen - perpX * (0.95 + beamLen * 0.22),
    truck.y + dirY * beamLen - perpY * (0.95 + beamLen * 0.22),
    0.04
  );
  const farCenter = isoToWorld(truck.x + dirX * beamLen, truck.y + dirY * beamLen, 0.04);

  const grad = ctx.createLinearGradient(frontStart.x, frontStart.y, farCenter.x, farCenter.y);
  const flowWarmth = combo >= 4 ? 0.32 : 0.24;
  grad.addColorStop(0, `rgba(255, 214, 128, ${flowWarmth})`);
  grad.addColorStop(0.55, 'rgba(255, 198, 96, 0.11)');
  grad.addColorStop(1, 'rgba(255, 190, 82, 0)');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(frontStart.x, frontStart.y);
  ctx.lineTo(farLeft.x, farLeft.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCabin(ctx: CanvasRenderingContext2D, tile: Tile, time: number): void {
  const c = isoToWorld(tile.gx + 0.5, tile.gy + 0.5, 0);
  const palette = CABIN_WALL_COLORS[tile.styleIndex % CABIN_WALL_COLORS.length];
  const bounce = tile.popAnim > 0 ? Math.sin(tile.popAnim * Math.PI) * 4.5 : 0;
  const cy = c.y - bounce;

  const w = 23;
  const d = 11.5;
  const wallH = 22;
  const roofPeak = 18;

  // Ground shadow
  ctx.fillStyle = 'rgba(13, 24, 42, 0.28)';
  ctx.beginPath();
  ctx.ellipse(c.x + 4, c.y + 4, 29, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left timber wall
  ctx.fillStyle = palette.left;
  ctx.beginPath();
  ctx.moveTo(c.x - w, cy);
  ctx.lineTo(c.x, cy + d);
  ctx.lineTo(c.x, cy + d - wallH);
  ctx.lineTo(c.x - w, cy - wallH);
  ctx.closePath();
  ctx.fill();

  // Right timber wall
  ctx.fillStyle = palette.right;
  ctx.beginPath();
  ctx.moveTo(c.x, cy + d);
  ctx.lineTo(c.x + w, cy);
  ctx.lineTo(c.x + w, cy - wallH);
  ctx.lineTo(c.x, cy + d - wallH);
  ctx.closePath();
  ctx.fill();

  // Warm hearth windows (brighter amber & subtle glow once driveway is cleared!)
  const flicker = 0.92 + 0.08 * Math.sin(time * 3.5 + tile.gx * 2 + tile.gy);
  const winColor = tile.cabinLit
    ? `rgba(255, 208, 92, ${flicker.toFixed(3)})`
    : 'rgba(232, 162, 74, 0.76)';

  // Left window
  ctx.fillStyle = winColor;
  ctx.beginPath();
  ctx.moveTo(c.x - 16, cy - 6);
  ctx.lineTo(c.x - 7, cy - 1.5);
  ctx.lineTo(c.x - 7, cy - 10.5);
  ctx.lineTo(c.x - 16, cy - 15);
  ctx.closePath();
  ctx.fill();

  // Right cozy door + window
  ctx.fillStyle = '#3c2117';
  ctx.beginPath();
  ctx.moveTo(c.x + 5, cy + 8.5);
  ctx.lineTo(c.x + 12, cy + 5);
  ctx.lineTo(c.x + 12, cy - 6);
  ctx.lineTo(c.x + 5, cy - 2.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = winColor;
  ctx.beginPath();
  ctx.moveTo(c.x + 14.5, cy - 2);
  ctx.lineTo(c.x + 20, cy - 4.8);
  ctx.lineTo(c.x + 20, cy - 12);
  ctx.lineTo(c.x + 14.5, cy - 9.2);
  ctx.closePath();
  ctx.fill();

  // Stone chimney on back-right roof slope
  ctx.fillStyle = '#5f6b7d';
  ctx.fillRect(c.x + 7, cy - wallH - roofPeak + 1, 7, 14);
  ctx.fillStyle = '#eef5ff';
  ctx.fillRect(c.x + 6, cy - wallH - roofPeak, 9, 3);

  // Pitched Snow-Laden Roof
  const overhang = 4;
  // Front-left roof slope
  ctx.fillStyle = palette.roofL;
  ctx.beginPath();
  ctx.moveTo(c.x - w - overhang, cy - wallH + 2);
  ctx.lineTo(c.x, cy + d - wallH + overhang * 0.5);
  ctx.lineTo(c.x, cy - wallH - roofPeak + 4);
  ctx.lineTo(c.x - w * 0.55, cy - wallH - roofPeak - 4);
  ctx.closePath();
  ctx.fill();

  // Front-right roof gable & slope
  ctx.fillStyle = palette.roofR;
  ctx.beginPath();
  ctx.moveTo(c.x, cy + d - wallH + overhang * 0.5);
  ctx.lineTo(c.x + w + overhang, cy - wallH + 2);
  ctx.lineTo(c.x + w * 0.55, cy - wallH - roofPeak - 4);
  ctx.lineTo(c.x, cy - wallH - roofPeak + 4);
  ctx.closePath();
  ctx.fill();

  // Crisp roof ridge snow highlight
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x - w * 0.52, cy - wallH - roofPeak - 3.5);
  ctx.lineTo(c.x, cy - wallH - roofPeak + 4);
  ctx.lineTo(c.x + w * 0.52, cy - wallH - roofPeak - 3.5);
  ctx.stroke();

  // Warm golden aura around cabin once its driveway is cleared
  if (tile.cabinLit) {
    const aura = ctx.createRadialGradient(c.x, cy - 6, 4, c.x, cy - 6, 44);
    aura.addColorStop(0, 'rgba(255, 198, 92, 0.28)');
    aura.addColorStop(1, 'rgba(255, 180, 70, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(c.x, cy - 6, 44, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPine(ctx: CanvasRenderingContext2D, tile: Tile, time: number): void {
  const c = isoToWorld(tile.gx + 0.5, tile.gy + 0.5, 0);
  const scale = 0.85 + tile.variant * 0.34;
  const sway = Math.sin(time * 1.4 + tile.gx * 1.3 + tile.gy * 0.7) * 1.1;

  // Soft snow shadow
  ctx.fillStyle = 'rgba(20, 35, 58, 0.24)';
  ctx.beginPath();
  ctx.ellipse(c.x + 3, c.y + 2, 16 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  ctx.fillStyle = '#4e3427';
  ctx.fillRect(c.x - 2.5 * scale, c.y - 7 * scale, 5 * scale, 8 * scale);

  // Three layered spruce boughs with snowy caps
  const layers = [
    { y: -6, w: 17, h: 16, col: '#1f493d', hi: '#2b5e4e' },
    { y: -16, w: 13.5, h: 15, col: '#245446', hi: '#326c5a' },
    { y: -25, w: 9.5, h: 13, col: '#2a6252', hi: '#3a7a66' },
  ];

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    const lx = c.x + sway * (i + 1) * 0.35;
    const ly = c.y + l.y * scale;
    const lw = l.w * scale;
    const lh = l.h * scale;

    // Dark side
    ctx.fillStyle = l.col;
    ctx.beginPath();
    ctx.moveTo(lx, ly - lh);
    ctx.lineTo(lx + lw, ly + 2);
    ctx.lineTo(lx, ly + 5);
    ctx.closePath();
    ctx.fill();

    // Lit side
    ctx.fillStyle = l.hi;
    ctx.beginPath();
    ctx.moveTo(lx, ly - lh);
    ctx.lineTo(lx - lw, ly + 2);
    ctx.lineTo(lx, ly + 5);
    ctx.closePath();
    ctx.fill();

    // Snowy tip frosting
    ctx.fillStyle = '#eef5ff';
    ctx.beginPath();
    ctx.moveTo(lx, ly - lh);
    ctx.lineTo(lx - lw * 0.56, ly - lh * 0.25);
    ctx.lineTo(lx, ly - lh * 0.1);
    ctx.lineTo(lx + lw * 0.52, ly - lh * 0.28);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, tile: Tile, time: number): void {
  const c = isoToWorld(tile.gx + 0.5, tile.gy + 0.5, 0);
  const pulse = 0.9 + 0.1 * Math.sin(time * 3 + tile.gx * 1.7);

  // Shadow
  ctx.fillStyle = 'rgba(16, 28, 46, 0.28)';
  ctx.beginPath();
  ctx.ellipse(c.x + 2, c.y + 1, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iron pole
  ctx.strokeStyle = '#222c3c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x, c.y - 31);
  ctx.stroke();

  // Lantern housing
  ctx.fillStyle = '#1c2432';
  ctx.fillRect(c.x - 4.5, c.y - 38, 9, 8);

  // Warm glowing glass
  ctx.fillStyle = `rgba(255, 214, 114, ${pulse.toFixed(3)})`;
  ctx.fillRect(c.x - 3, c.y - 36.5, 6, 5.5);

  // Snow cap on lantern roof
  ctx.fillStyle = '#f2f7ff';
  ctx.beginPath();
  ctx.moveTo(c.x - 6, c.y - 38);
  ctx.lineTo(c.x, c.y - 42);
  ctx.lineTo(c.x + 6, c.y - 38);
  ctx.closePath();
  ctx.fill();
}

function drawLanternBlooms(
  ctx: CanvasRenderingContext2D,
  tiles: Tile[][],
  size: number,
  time: number
): void {
  ctx.save();
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      if (tiles[gy][gx].kind !== 'lamp') continue;
      const c = isoToWorld(gx + 0.5, gy + 0.5, 0);
      const flick = 0.92 + 0.08 * Math.sin(time * 2.6 + gx + gy);
      const grad = ctx.createRadialGradient(c.x, c.y - 30, 3, c.x, c.y - 6, 76);
      grad.addColorStop(0, `rgba(255, 215, 115, ${(0.34 * flick).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 185, 78, ${(0.12 * flick).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 175, 65, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 12, 76, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  p: CrystalPickup,
  time: number,
  buried: boolean
): void {
  const bob = Math.sin(time * 3.4 + p.bobPhase) * 3.5;
  const c = isoToWorld(p.x, p.y, 0.32);
  const y = c.y + bob;

  ctx.save();
  if (buried) {
    ctx.globalAlpha = 0.55;
  }

  // Soft ground sparkle halo
  const halo = ctx.createRadialGradient(c.x, y, 2, c.x, y, 22);
  if (p.kind === 'cocoa') {
    halo.addColorStop(0, 'rgba(255, 184, 82, 0.5)');
    halo.addColorStop(1, 'rgba(255, 184, 82, 0)');
  } else {
    halo.addColorStop(0, 'rgba(130, 226, 255, 0.52)');
    halo.addColorStop(1, 'rgba(130, 226, 255, 0)');
  }
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c.x, y, 22, 0, Math.PI * 2);
  ctx.fill();

  if (p.kind === 'cocoa') {
    // Cozy steaming mug of hot cocoa
    ctx.fillStyle = '#d9534f';
    ctx.beginPath();
    ctx.roundRect(c.x - 6, y - 6, 12, 11, 3);
    ctx.fill();
    // Handle
    ctx.strokeStyle = '#f3d8c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x + 6.5, y - 0.5, 3, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    // Cream foam rim
    ctx.fillStyle = '#fff5e4';
    ctx.beginPath();
    ctx.ellipse(c.x, y - 5.5, 5.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tiny steam wisp
    ctx.strokeStyle = 'rgba(255, 245, 228, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c.x - 2, y - 9);
    ctx.quadraticCurveTo(c.x + Math.sin(time * 5) * 3, y - 13, c.x - 1, y - 17);
    ctx.stroke();
  } else {
    // Faceted Frost Crystal diamond
    ctx.fillStyle = '#8be4ff';
    ctx.beginPath();
    ctx.moveTo(c.x, y - 11);
    ctx.lineTo(c.x + 7, y);
    ctx.lineTo(c.x, y + 9);
    ctx.lineTo(c.x - 7, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dff8ff';
    ctx.beginPath();
    ctx.moveTo(c.x, y - 11);
    ctx.lineTo(c.x + 2, y);
    ctx.lineTo(c.x, y + 9);
    ctx.lineTo(c.x - 7, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders the 360-degree isometric snowplow truck using true rotated local 3D box geometry
 * projected into isometric screen coordinates so every turn looks crisp and solid.
 */
function drawPlowTruck(
  ctx: CanvasRenderingContext2D,
  truck: TruckState,
  upgrades: UpgradeLevels,
  time: number,
  combo: number
): void {
  const cos = Math.cos(truck.angle);
  const sin = Math.sin(truck.angle);
  const bounceZ =
    Math.sin(time * 16) * Math.min(0.035, truck.speed * 0.006) - truck.squash * 0.09;
  const stretchXY = 1 + truck.squash * 0.09;

  // Project truck-local (forward, right, up) coordinates to isometric world coordinates
  const proj = (fwd: number, right: number, up: number) => {
    const f = fwd * stretchXY;
    const r = right * stretchXY;
    const gx = truck.x + f * cos - r * sin;
    const gy = truck.y + f * sin + r * cos;
    return isoToWorld(gx, gy, Math.max(0, up + bounceZ));
  };

  // Soft ground shadow
  const shadowC = isoToWorld(truck.x, truck.y, 0.01);
  ctx.save();
  ctx.fillStyle = 'rgba(10, 18, 32, 0.42)';
  ctx.beginPath();
  ctx.ellipse(shadowC.x, shadowC.y + 3, 25, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle golden Hearth Flow ring under truck when combo >= 4x
  if (combo >= 4) {
    const ringPulse = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.strokeStyle = `rgba(255, 202, 92, ${(0.35 + ringPulse * 0.25).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(shadowC.x, shadowC.y + 1, 29, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Helper to draw a rotated 3D box in truck-local space with crisp painter-sorted faces
  const drawLocalBox = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    colors: { top: string; front: string; back: string; left: string; right: string }
  ) => {
    const corners = [
      proj(x0, y0, z0), // 0: back-left-bot
      proj(x1, y0, z0), // 1: front-left-bot
      proj(x1, y1, z0), // 2: front-right-bot
      proj(x0, y1, z0), // 3: back-right-bot
      proj(x0, y0, z1), // 4: back-left-top
      proj(x1, y0, z1), // 5: front-left-top
      proj(x1, y1, z1), // 6: front-right-top
      proj(x0, y1, z1), // 7: back-right-top
    ];

    // Camera views from (+1, +1) iso direction -> face visible if its grid normal dot (1, 1) > 0
    const faces: { idx: number[]; color: string; depth: number }[] = [];

    const addSide = (
      idx: number[],
      nx: number,
      ny: number,
      color: string
    ) => {
      // Transform local normal to grid space
      const gnx = nx * cos - ny * sin;
      const gny = nx * sin + ny * cos;
      if (gnx + gny > -0.02) {
        const avgY = idx.reduce((acc, k) => acc + corners[k].y, 0) / idx.length;
        faces.push({ idx, color, depth: avgY });
      }
    };

    addSide([1, 2, 6, 5], 1, 0, colors.front);
    addSide([3, 0, 4, 7], -1, 0, colors.back);
    addSide([0, 1, 5, 4], 0, -1, colors.left);
    addSide([2, 3, 7, 6], 0, 1, colors.right);

    faces.sort((a, b) => a.depth - b.depth);
    for (const f of faces) {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(corners[f.idx[0]].x, corners[f.idx[0]].y);
      for (let i = 1; i < f.idx.length; i++) {
        ctx.lineTo(corners[f.idx[i]].x, corners[f.idx[i]].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Always draw top face last
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.fill();
  };

  // Determine whether plow blade is in front of or behind truck body from isometric camera view
  const bladeInFront = cos + sin >= 0;

  const drawBlade = () => {
    const bladeHalfW = 0.42 + upgrades.blade * 0.085;
    const bladeColorTop = upgrades.blade >= 2 ? '#f6bd41' : '#eab134';
    const bladeColorFront = upgrades.blade >= 2 ? '#d9951f' : '#cc8b1e';

    // Connecting push arms
    const armL0 = proj(0.28, -0.18, 0.14);
    const armL1 = proj(0.5, -0.22, 0.11);
    const armR0 = proj(0.28, 0.18, 0.14);
    const armR1 = proj(0.5, 0.22, 0.11);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(armL0.x, armL0.y);
    ctx.lineTo(armL1.x, armL1.y);
    ctx.moveTo(armR0.x, armR0.y);
    ctx.lineTo(armR1.x, armR1.y);
    ctx.stroke();

    // Main curved plow blade
    drawLocalBox(0.46, 0.62, -bladeHalfW, bladeHalfW, 0.03, 0.34, {
      top: bladeColorTop,
      front: bladeColorFront,
      back: '#8c5d11',
      left: '#b57b18',
      right: '#b57b18',
    });

    // Brass side wing tips on upgraded blade
    if (upgrades.blade >= 2) {
      drawLocalBox(0.52, 0.68, -bladeHalfW - 0.06, -bladeHalfW + 0.04, 0.04, 0.31, {
        top: '#ffe08a',
        front: '#e5a428',
        back: '#8c5d11',
        left: '#c28518',
        right: '#c28518',
      });
      drawLocalBox(0.52, 0.68, bladeHalfW - 0.04, bladeHalfW + 0.06, 0.04, 0.31, {
        top: '#ffe08a',
        front: '#e5a428',
        back: '#8c5d11',
        left: '#c28518',
        right: '#c28518',
      });
    }

    // Puff of pushed snow curling ahead of blade when plowing
    if (truck.plowLoad > 0.1) {
      const snowPuff = proj(0.68, 0, 0.14);
      ctx.fillStyle = `rgba(244, 250, 255, ${Math.min(0.92, truck.plowLoad).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(
        snowPuff.x,
        snowPuff.y,
        10 + bladeHalfW * 12,
        5 + truck.plowLoad * 4,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  };

  if (!bladeInFront) {
    drawBlade();
  }

  // Wheels (chunky dark rubber)
  const wheelOffsets = [
    [0.2, -0.27],
    [0.2, 0.27],
    [-0.26, -0.27],
    [-0.26, 0.27],
  ];
  for (const [wx, wy] of wheelOffsets) {
    const wp = proj(wx, wy, 0.09);
    ctx.fillStyle = '#18202c';
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#536278';
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heated Salt Spreader Bar on rear bumper (visible when heater >= 1)
  if (upgrades.heater >= 1) {
    drawLocalBox(-0.58, -0.45, -0.27, 0.27, 0.09, 0.22, {
      top: '#ff9c47',
      front: '#d96926',
      back: '#ff8a33',
      left: '#c95c1e',
      right: '#c95c1e',
    });
  }

  // Main truck lower chassis + hood (vintage Nordic crimson)
  drawLocalBox(-0.46, 0.42, -0.26, 0.26, 0.12, 0.36, {
    top: '#e05344',
    front: '#b8392c',
    back: '#8c281e',
    left: '#cc4537',
    right: '#a83226',
  });

  // Rear wooden/steel salt flatbed box
  drawLocalBox(-0.44, -0.06, -0.23, 0.23, 0.36, 0.5, {
    top: upgrades.heater >= 1 ? '#e2c79d' : '#cfdbe8',
    front: '#5d4a3d',
    back: '#47372d',
    left: '#6e5849',
    right: '#524035',
  });

  // Cozy Truck Cab with frosted snow-dusted roof
  drawLocalBox(-0.04, 0.26, -0.24, 0.24, 0.36, 0.64, {
    top: '#f4f8ff', // Snow-capped roof!
    front: '#7db5d8', // Windshield blue sheen
    back: '#9c2d22',
    left: '#c94133',
    right: '#a33024',
  });

  // Rotary Snowblower Chute mounted behind cab (visible when blower >= 1)
  if (upgrades.blower >= 1) {
    drawLocalBox(-0.22, -0.08, -0.1, 0.1, 0.5, 0.78, {
      top: '#f5b83d',
      front: '#d48d1e',
      back: '#a16a14',
      left: '#c7831b',
      right: '#b07115',
    });
  }

  // Spinning Warm Amber Roof Beacon
  const beaconPos = proj(0.11, 0, 0.7);
  const beaconGlow = 0.65 + 0.35 * Math.sin(truck.beaconPhase * 6.5);
  const bGrad = ctx.createRadialGradient(beaconPos.x, beaconPos.y, 1, beaconPos.x, beaconPos.y, 16);
  bGrad.addColorStop(0, `rgba(255, 206, 92, ${(0.85 * beaconGlow).toFixed(3)})`);
  bGrad.addColorStop(1, 'rgba(255, 168, 46, 0)');
  ctx.fillStyle = bGrad;
  ctx.beginPath();
  ctx.arc(beaconPos.x, beaconPos.y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffcb57';
  ctx.beginPath();
  ctx.arc(beaconPos.x, beaconPos.y, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Warm Twin Headlights on front grille
  const hl1 = proj(0.43, -0.16, 0.24);
  const hl2 = proj(0.43, 0.16, 0.24);
  ctx.fillStyle = '#fff1b8';
  ctx.beginPath();
  ctx.arc(hl1.x, hl1.y, 2.7, 0, Math.PI * 2);
  ctx.arc(hl2.x, hl2.y, 2.7, 0, Math.PI * 2);
  ctx.fill();

  // Turbo Boost warm exhaust glow
  if (truck.boosting) {
    const ex = proj(-0.54, 0, 0.18);
    const eGrad = ctx.createRadialGradient(ex.x, ex.y, 1, ex.x, ex.y, 14);
    eGrad.addColorStop(0, 'rgba(255, 224, 130, 0.9)');
    eGrad.addColorStop(0.5, 'rgba(245, 132, 48, 0.45)');
    eGrad.addColorStop(1, 'rgba(245, 132, 48, 0)');
    ctx.fillStyle = eGrad;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  if (bladeInFront) {
    drawBlade();
  }

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  ctx.save();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    const t = p.life / p.maxLife;
    const alpha = p.kind === 'smoke' ? t * 0.42 : Math.min(1, t * 1.4);
    const pos = isoToWorld(p.x, p.y, p.z);

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;

    if (p.kind === 'spark' || p.kind === 'heart') {
      const r = p.size * (0.6 + 0.5 * t);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - r * 1.5);
      ctx.lineTo(pos.x + r, pos.y);
      ctx.lineTo(pos.x, pos.y + r * 1.5);
      ctx.lineTo(pos.x - r, pos.y);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'clump') {
      const r = p.size * (0.5 + 0.5 * t);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c4d6ec';
      ctx.beginPath();
      ctx.arc(pos.x + r * 0.25, pos.y + r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = p.kind === 'smoke' ? p.size * (1.8 - t * 0.8) : p.size * (0.4 + 0.6 * t);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of texts) {
    if (!ft.active) continue;
    const t = ft.life / ft.maxLife;
    const alpha = Math.min(1, t * 1.8);
    const pos = isoToWorld(ft.x, ft.y, ft.z);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `700 ${Math.round(13 * ft.scale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
    ctx.fillText(ft.text, pos.x + 1, pos.y + 1.5);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, pos.x, pos.y);
    if (ft.subtext) {
      ctx.font = `600 10px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#fff5dc';
      ctx.fillText(ft.subtext, pos.x, pos.y + 13);
    }
  }
  ctx.restore();
}

function drawAmbientSnow(
  ctx: CanvasRenderingContext2D,
  flakes: AmbientFlake[],
  width: number,
  height: number,
  squall: number,
  time: number
): void {
  ctx.save();
  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i];
    const x = f.x * width;
    const y = f.y * height;
    ctx.fillStyle = `rgba(235, 244, 255, ${(f.alpha * (1 + squall * 0.45)).toFixed(3)})`;
    if (squall > 0.25) {
      // Wind-blown snow streaks during a gentle alpine squall
      ctx.strokeStyle = `rgba(235, 244, 255, ${(f.alpha * 0.7).toFixed(3)})`;
      ctx.lineWidth = f.size * 0.85;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 * squall + Math.sin(time + f.phase) * 2, y - 5 * squall);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
