/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { OverlayModals } from './components/OverlayModals';
import { TitleScreen } from './components/TitleScreen';
import { WorkshopModal } from './components/WorkshopModal';
import { HearthplowEngine } from './game/engine';
import { HudSnapshot } from './game/types';
import { INITIAL_UPGRADES } from './game/upgrades';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  gameMode: 'SHIFT',
  stageIndex: 0,
  stageName: "Bakers' Lane",
  stageSubtitle: 'First dusting over the morning hearth cottages',
  clearedTiles: 0,
  totalPlowableTiles: 100,
  clearedPercent: 0,
  targetPercent: 84,
  timeRemaining: 95,
  score: 0,
  highScore: 0,
  coins: 0,
  comboMultiplier: 1,
  comboTimerRatio: 0,
  comboStreakCount: 0,
  maxComboCap: 5,
  boostEnergy: 1,
  boosting: false,
  cabinsWarmed: 0,
  totalCabins: 4,
  upgrades: INITIAL_UPGRADES,
  canAffordAnyUpgrade: false,
  muted: false,
  squallWarning: 0,
  roundSummary: null,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<HearthplowEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new HearthplowEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0d1624]">
      {/* Isolated full-viewport canvas layer — never re-mounted by HUD updates */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair"
          aria-label="Hearthplow isometric snow-plowing village"
        />
      </div>

      {/* Title Screen */}
      {hud.gameState === 'TITLE_MENU' && (
        <TitleScreen
          gameMode={hud.gameMode}
          highScore={hud.highScore}
          muted={hud.muted}
          onSelectMode={(mode) => engineRef.current?.setMode(mode)}
          onStart={() => engineRef.current?.startNewGame()}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {/* Low-occlusion in-game HUD */}
      {hud.gameState !== 'TITLE_MENU' && (
        <GameHud
          hud={hud}
          onOpenWorkshop={() => engineRef.current?.openWorkshop()}
          onTogglePause={() => engineRef.current?.togglePause()}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {/* Village Garage Workshop */}
      {hud.gameState === 'WORKSHOP' && (
        <WorkshopModal
          hud={hud}
          onBuyUpgrade={(key) => engineRef.current?.buyUpgrade(key)}
          onClose={() => engineRef.current?.closeWorkshop()}
        />
      )}

      {/* Pause / Victory / Shift Over Modals */}
      <OverlayModals
        hud={hud}
        onResume={() => engineRef.current?.togglePause()}
        onOpenWorkshop={() => engineRef.current?.openWorkshop()}
        onNextStage={() => engineRef.current?.nextStage()}
        onRetryStage={() => engineRef.current?.retryStage()}
        onNewGame={() => engineRef.current?.startNewGame()}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
      />
    </main>
  );
}
