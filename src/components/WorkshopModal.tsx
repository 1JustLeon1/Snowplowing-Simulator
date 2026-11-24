import { ArrowRight, Check, X } from 'lucide-react';
import { HudSnapshot, UpgradeKey } from '../game/types';
import { getUpgradeCost, UPGRADE_DEFS } from '../game/upgrades';

interface WorkshopModalProps {
  hud: HudSnapshot;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onClose: () => void;
}

export function WorkshopModal({ hud, onBuyUpgrade, onClose }: WorkshopModalProps) {
  const isBetweenStages = Boolean(hud.roundSummary?.isVictory);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070d17]/78 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workshop-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#2a3d5a] bg-[#111d2f] text-[#f3f6fb]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#22324a] px-6 py-4">
          <div>
            <h2
              id="workshop-title"
              className="text-xl font-bold text-[#f7fafe]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Village Plow Garage
            </h2>
            <p className="mt-0.5 text-xs text-[#9cb3cf]">
              Outfit your truck with wider blades, thermal salt spreaders, and hearth combo gear.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-[#8ea6c5]">Available Coins</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#ffcf5c]">
                {hud.coins.toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close garage"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#293c58] bg-[#17253b] text-[#c7d7ec] transition-colors hover:border-[#4b6790] hover:text-white focus-visible:outline-2 focus-visible:outline-[#f5b041]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Upgrade List Grid */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto px-6 py-4 sm:grid-cols-2">
          {UPGRADE_DEFS.map((def) => {
            const level = hud.upgrades[def.key];
            const maxed = level >= def.maxLevel;
            const cost = getUpgradeCost(def.key, level);
            const affordable = !maxed && hud.coins >= cost;

            return (
              <div
                key={def.key}
                className="flex flex-col justify-between border-b border-[#1d2d45] py-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#f5f8fd]">{def.name}</h3>
                    <span className="font-mono text-xs tabular-nums text-[#8ea6c5]">
                      Tier {level}/{def.maxLevel}
                    </span>
                  </div>

                  {/* Clean tier progress bar segments */}
                  <div className="mt-2 flex gap-1.5">
                    {Array.from({ length: def.maxLevel }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 flex-1 rounded-full ${
                          idx < level ? 'bg-[#f5b041]' : 'bg-[#21324c]'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-[#9cb3cf]">{def.summary}</p>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-3">
                  <div className="text-xs text-[#c8d8ec]">
                    <span>{def.effectLabel(level)}</span>
                    {!maxed && (
                      <span className="text-[#ffcf63]"> → {def.nextEffectLabel(level)}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!affordable}
                    onClick={() => onBuyUpgrade(def.key)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#f5b041] ${
                      maxed
                        ? 'cursor-default bg-[#1a293f] text-[#7e98b8]'
                        : affordable
                          ? 'bg-[#f5b041] text-[#141c29] hover:bg-[#ffbe55]'
                          : 'cursor-not-allowed border border-[#243650] bg-[#142034] text-[#6d84a3]'
                    }`}
                  >
                    {maxed ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Maxed</span>
                      </>
                    ) : (
                      <span className="font-mono tabular-nums">{cost} Coins</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between gap-4 border-t border-[#22324a] px-6 py-4">
          <span className="text-xs text-[#8ea6c5]">
            Upgrades apply immediately and carry across all districts.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#f5b041] px-5 py-2.5 text-sm font-bold text-[#141c29] transition-colors hover:bg-[#ffbe55] focus-visible:outline-2 focus-visible:outline-[#ffda85]"
          >
            <span>{isBetweenStages ? 'Start Next Shift' : 'Back to Lanes'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
