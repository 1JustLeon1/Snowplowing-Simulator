import { TruckStats, UpgradeDef, UpgradeKey, UpgradeLevels } from './types';

export const INITIAL_UPGRADES: UpgradeLevels = {
  blade: 0,
  engine: 0,
  heater: 0,
  blower: 0,
  combo: 0,
  lantern: 0,
};

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: 'blade',
    name: 'Wide Brass Blade',
    summary: 'Broadens the curved snowplow swath and adds wing extensions.',
    maxLevel: 5,
    baseCost: 55,
    costMultiplier: 1.72,
    effectLabel: (lvl) => `${(1.15 + lvl * 0.24).toFixed(2)} tile swath`,
    nextEffectLabel: (lvl) => `${(1.15 + (lvl + 1) * 0.24).toFixed(2)} tile swath`,
  },
  {
    key: 'engine',
    name: 'Alpine Turbo Drive',
    summary: 'Boosts cruising speed, torque in deep snow, and boost recovery.',
    maxLevel: 5,
    baseCost: 60,
    costMultiplier: 1.75,
    effectLabel: (lvl) => `${Math.round((1 + lvl * 0.14) * 100)}% drive power`,
    nextEffectLabel: (lvl) => `${Math.round((1 + (lvl + 1) * 0.14) * 100)}% drive power`,
  },
  {
    key: 'heater',
    name: 'Heated Salt Spreader',
    summary: 'Melts thick drifts, grips icy patches, and warms trailing edge snow.',
    maxLevel: 5,
    baseCost: 75,
    costMultiplier: 1.8,
    effectLabel: (lvl) =>
      lvl === 0 ? 'Standard traction' : `Tier ${lvl} thermal melt`,
    nextEffectLabel: (lvl) => `Tier ${lvl + 1} thermal melt`,
  },
  {
    key: 'blower',
    name: 'Rotary Snow Chute',
    summary: 'Periodically arcs cleared snow forward to clear nearby drifts.',
    maxLevel: 5,
    baseCost: 90,
    costMultiplier: 1.85,
    effectLabel: (lvl) =>
      lvl === 0 ? 'Not installed' : `Pulse every ${(2.4 - lvl * 0.34).toFixed(1)}s`,
    nextEffectLabel: (lvl) => `Pulse every ${(2.4 - (lvl + 1) * 0.34).toFixed(1)}s`,
  },
  {
    key: 'combo',
    name: 'Hearth Flow Magnet',
    summary: 'Extends combo hold time, raises max multiplier, and pulls pickups.',
    maxLevel: 5,
    baseCost: 70,
    costMultiplier: 1.78,
    effectLabel: (lvl) => `Max ${5 + lvl * 1.5}x · ${(2.8 + lvl * 0.55).toFixed(1)}s hold`,
    nextEffectLabel: (lvl) => `Max ${5 + (lvl + 1) * 1.5}x · ${(2.8 + (lvl + 1) * 0.55).toFixed(1)}s hold`,
  },
  {
    key: 'lantern',
    name: 'Golden Halogen Rig',
    summary: 'Brightens headlights, spots buried crystals, and lifts coin payouts.',
    maxLevel: 5,
    baseCost: 65,
    costMultiplier: 1.75,
    effectLabel: (lvl) => `+${lvl * 18}% village coins`,
    nextEffectLabel: (lvl) => `+${(lvl + 1) * 18}% village coins`,
  },
];

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const def = UPGRADE_DEFS.find((d) => d.key === key);
  if (!def) return 9999;
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, currentLevel)) / 5) * 5;
}

export function canAffordAnyUpgrade(coins: number, levels: UpgradeLevels): boolean {
  return UPGRADE_DEFS.some(
    (def) => levels[def.key] < def.maxLevel && coins >= getUpgradeCost(def.key, levels[def.key])
  );
}

export function computeTruckStats(levels: UpgradeLevels): TruckStats {
  return {
    bladeRadius: 0.92 + levels.blade * 0.21,
    clearRate: 3.1 + levels.blade * 0.55 + levels.heater * 0.45,
    maxSpeed: 4.35 + levels.engine * 0.52,
    accel: 14.5 + levels.engine * 2.2,
    boostMult: 1.48 + levels.engine * 0.06,
    boostRecharge: 0.22 + levels.engine * 0.055,
    driftBreakPower: 1.0 + levels.heater * 0.42 + levels.blade * 0.18,
    iceGrip: Math.min(1, 0.34 + levels.heater * 0.16),
    saltTrailRadius: levels.heater > 0 ? 0.65 + levels.heater * 0.18 : 0,
    blowerInterval: levels.blower > 0 ? Math.max(0.65, 2.4 - levels.blower * 0.34) : 0,
    blowerRange: levels.blower > 0 ? 2.4 + levels.blower * 0.42 : 0,
    comboDuration: 2.8 + levels.combo * 0.55,
    maxCombo: 5 + levels.combo * 1.5,
    magnetRadius: 1.15 + levels.combo * 0.58,
    headlightLength: 3.2 + levels.lantern * 0.55,
    coinBonusMult: 1 + levels.lantern * 0.18,
  };
}
