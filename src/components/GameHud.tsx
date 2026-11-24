import { Pause, Volume2, VolumeX, Wrench } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onOpenWorkshop: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

function getComboTitle(mult: number): string {
  if (mult >= 6) return 'Alpine Aurora';
  if (mult >= 4) return 'Hearth Flow';
  if (mult >= 2.5) return 'Snow Dancer';
  return 'Crisp Path';
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GameHud({
  hud,
  onOpenWorkshop,
  onTogglePause,
  onToggleMute,
}: GameHudProps) {
  const progressRatio = Math.min(100, (hud.clearedPercent / Math.max(1, hud.targetPercent)) * 100);
  const lowTime = hud.gameMode === 'SHIFT' && hud.timeRemaining <= 15;
  const showCombo = hud.comboStreakCount >= 2 && hud.comboTimerRatio > 0;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: District Progress & Shift Timer */}
        <div className="rounded-lg border border-[#243650] bg-[#101b2c]/92 px-4 py-3 text-[#f2f6fc]">
          <div className="flex items-baseline gap-2.5">
            <span
              className="text-base font-semibold tracking-tight text-[#f7fafe]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {hud.stageName}
            </span>
            <span className="text-xs text-[#8ea6c5]">District {hud.stageIndex + 1}</span>
          </div>

          {/* Slim Clear Progress Bar */}
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-36 overflow-hidden rounded-full bg-[#1d2c42] sm:w-44">
              <div
                className="h-full rounded-full bg-[#f5b041] transition-transform duration-150 origin-left"
                style={{ transform: `scaleX(${(progressRatio / 100).toFixed(3)})` }}
              />
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#ffda85]">
              {hud.clearedPercent}% / {hud.gameMode === 'SHIFT' ? `${hud.targetPercent}%` : '100%'}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2.5 text-xs text-[#9cb4d2]">
            <span className="font-mono tabular-nums">
              {hud.gameMode === 'SHIFT' ? (
                <span className={lowTime ? 'font-semibold text-[#ff7b6b]' : 'text-[#dce8f8]'}>
                  {formatClock(hud.timeRemaining)} left
                </span>
              ) : (
                <span className="text-[#a8d8ff]">Zen Plow</span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Cottages {hud.cabinsWarmed}/{hud.totalCabins}
            </span>
            {hud.squallWarning > 0.3 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#9cd9ff]">Snow Flurry</span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right: Economy Readout & Interactive Utility Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden rounded-lg border border-[#243650] bg-[#101b2c]/92 px-3.5 py-2 text-right sm:block">
            <div className="flex items-center gap-3 text-xs">
              <div>
                <span className="mr-1.5 text-[#8ea6c5]">Coins</span>
                <span className="font-mono font-semibold tabular-nums text-[#ffcf63]">
                  {hud.coins.toLocaleString()}
                </span>
              </div>
              <span className="text-[#354b6b]" aria-hidden="true">
                |
              </span>
              <div>
                <span className="mr-1.5 text-[#8ea6c5]">Score</span>
                <span className="font-mono font-semibold tabular-nums text-[#f2f6fc]">
                  {hud.score.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile compact coin readout */}
          <div className="rounded-lg border border-[#243650] bg-[#101b2c]/92 px-3 py-2 font-mono text-xs font-semibold tabular-nums text-[#ffcf63] sm:hidden">
            {hud.coins} c
          </div>

          <button
            type="button"
            onClick={onOpenWorkshop}
            className={`pointer-events-auto flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b041] ${
              hud.canAffordAnyUpgrade
                ? 'border-[#f5b041] bg-[#2a2417]/95 text-[#ffda85] hover:bg-[#382f1d]'
                : 'border-[#253752] bg-[#101b2c]/92 text-[#d6e4f6] hover:border-[#4b678f]'
            }`}
          >
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>Workshop</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Unmute sound' : 'Mute sound'}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#253752] bg-[#101b2c]/92 text-[#d6e4f6] transition-colors duration-150 hover:border-[#4b678f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b041]"
          >
            {hud.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Pause game"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#253752] bg-[#101b2c]/92 text-[#d6e4f6] transition-colors duration-150 hover:border-[#4b678f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b041]"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Perimeter: Combo Multiplier & Boost Meter */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Quiet control whisper */}
        <div className="hidden text-xs text-[#8ea6c5]/90 md:block">
          WASD / Drag Steer · Space Boost · U Workshop
        </div>

        {/* Bottom-Center: Active Combo Multiplier */}
        <div
          className={`mx-auto transition-opacity duration-150 ${
            showCombo ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="min-w-[184px] rounded-lg border border-[#3a4e6d] bg-[#101b2c]/92 px-4 py-2 text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span className="font-mono text-xl font-bold tabular-nums text-[#ffcf5c]">
                {hud.comboMultiplier.toFixed(1)}x
              </span>
              <span className="text-xs font-medium text-[#d8e6f8]">
                {getComboTitle(hud.comboMultiplier)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1f2f46]">
              <div
                className="h-full origin-left rounded-full bg-[#ffbe4f]"
                style={{ transform: `scaleX(${hud.comboTimerRatio.toFixed(3)})` }}
              />
            </div>
          </div>
        </div>

        {/* Bottom-Right: Turbo Boost Energy */}
        <div className="rounded-lg border border-[#243650] bg-[#101b2c]/92 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-[#b5cae3]">Boost</span>
            <span className="font-mono text-[11px] text-[#8ea6c5]">Space</span>
          </div>
          <div className="mt-1.5 h-2 w-28 overflow-hidden rounded-full bg-[#1c2b40]">
            <div
              className={`h-full origin-left rounded-full ${
                hud.boosting ? 'bg-[#ffd875]' : 'bg-[#e89838]'
              }`}
              style={{ transform: `scaleX(${hud.boostEnergy.toFixed(3)})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
