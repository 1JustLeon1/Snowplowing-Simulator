import { ArrowRight, Play, RotateCcw, Wrench } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface OverlayModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onOpenWorkshop: () => void;
  onNextStage: () => void;
  onRetryStage: () => void;
  onNewGame: () => void;
  onReturnTitle: () => void;
}

export function OverlayModals({
  hud,
  onResume,
  onOpenWorkshop,
  onNextStage,
  onRetryStage,
  onNewGame,
  onReturnTitle,
}: OverlayModalsProps) {
  if (hud.gameState === 'PAUSED') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070d17]/75 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm rounded-xl border border-[#2a3d5a] bg-[#111d2f] p-6 text-[#f3f6fb]"
        >
          <h2
            id="pause-title"
            className="text-2xl font-bold text-[#f7fafe]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Shift Paused
          </h2>
          <p className="mt-1 text-xs text-[#9cb3cf]">
            {hud.stageName} · {hud.clearedPercent}% cleared
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#f5b041] px-4 py-2.5 text-sm font-bold text-[#141c29] transition-colors hover:bg-[#ffbe55]"
            >
              <Play className="h-4 w-4" />
              <span>Resume Plowing</span>
            </button>
            <button
              type="button"
              onClick={onOpenWorkshop}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#2b3f5d] bg-[#17263d] px-4 py-2.5 text-sm font-semibold text-[#e6effa] transition-colors hover:border-[#4b6891]"
            >
              <Wrench className="h-4 w-4" />
              <span>Open Garage ({hud.coins} Coins)</span>
            </button>
            <button
              type="button"
              onClick={onRetryStage}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#243650] bg-transparent px-4 py-2.5 text-sm font-medium text-[#b5cae3] transition-colors hover:bg-[#162338] hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart District</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="mt-1 w-full whitespace-nowrap py-2 text-xs font-medium text-[#8ea6c5] transition-colors hover:text-[#dce8f8]"
            >
              Return to Title Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((hud.gameState === 'ROUND_SUMMARY' || hud.gameState === 'GAME_OVER') && hud.roundSummary) {
    const summary = hud.roundSummary;
    const isWin = summary.isVictory;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070d17]/78 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-title"
          className="w-full max-w-md rounded-xl border border-[#2a3d5a] bg-[#111d2f] p-6 text-[#f3f6fb]"
        >
          <div className="text-xs font-medium text-[#f5b041]">
            {isWin ? `District ${summary.stageIndex + 1} Complete` : 'Morning Bell Rang'}
          </div>
          <h2
            id="summary-title"
            className="mt-1 text-2xl font-bold text-[#f7fafe]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {isWin ? `${summary.stageName} Cleared` : `Snowed In at ${summary.stageName}`}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#9cb3cf]">
            {isWin
              ? 'Warm hearth lights glow along the freshly swept cobblestones. Visit the garage or roll into the next neighborhood.'
              : `You cleared ${summary.clearedPercent}% of the ${summary.targetPercent}% target. Retry the district or upgrade your rig first.`}
          </p>

          {/* Clean Tabular Breakdown */}
          <div className="mt-5 divide-y divide-[#1e2f47] border-y border-[#1e2f47] text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[#9cb3cf]">Streets Cleared</span>
              <span className="font-mono font-semibold tabular-nums text-[#f5f8fd]">
                {summary.clearedPercent}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[#9cb3cf]">Cottages Warmed</span>
              <span className="font-mono font-semibold tabular-nums text-[#f5f8fd]">
                {summary.cabinsWarmed} / {summary.totalCabins}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[#9cb3cf]">Best Combo Streak</span>
              <span className="font-mono font-semibold tabular-nums text-[#ffcf5c]">
                {summary.maxComboReached.toFixed(1)}x
              </span>
            </div>
            {isWin && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#9cb3cf]">Shift Bonus</span>
                <span className="font-mono font-semibold tabular-nums text-[#ffcf5c]">
                  +{(summary.stageBonusCoins + summary.pristineBonusCoins).toLocaleString()} Coins
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[#9cb3cf]">Total Score</span>
              <span className="font-mono font-semibold tabular-nums text-[#f5f8fd]">
                {hud.score.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {isWin ? (
              <>
                <button
                  type="button"
                  onClick={onNextStage}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#f5b041] px-4 py-2.5 text-sm font-bold text-[#141c29] transition-colors hover:bg-[#ffbe55]"
                >
                  <span>Next District</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenWorkshop}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#2b3f5d] bg-[#17263d] px-4 py-2.5 text-sm font-semibold text-[#ffda85] transition-colors hover:border-[#f5b041]"
                >
                  <Wrench className="h-4 w-4" />
                  <span>Upgrade Truck ({hud.coins.toLocaleString()} Coins)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRetryStage}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#f5b041] px-4 py-2.5 text-sm font-bold text-[#141c29] transition-colors hover:bg-[#ffbe55]"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Retry District</span>
                </button>
                <button
                  type="button"
                  onClick={onNewGame}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#2b3f5d] bg-[#17263d] px-4 py-2.5 text-sm font-semibold text-[#e6effa] transition-colors hover:border-[#4b6891]"
                >
                  <span>Play Again from District 1</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onReturnTitle}
              className="mt-1 w-full whitespace-nowrap py-1.5 text-xs font-medium text-[#8ea6c5] transition-colors hover:text-[#dce8f8]"
            >
              Return to Title Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
