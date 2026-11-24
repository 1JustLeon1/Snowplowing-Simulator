import { Volume2, VolumeX } from 'lucide-react';
import { GameMode } from '../game/types';

interface TitleScreenProps {
  gameMode: GameMode;
  highScore: number;
  muted: boolean;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleScreen({
  gameMode,
  highScore,
  muted,
  onSelectMode,
  onStart,
  onToggleMute,
}: TitleScreenProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
      {/* Subtle left-side contrast gradient over live village diorama */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-2xl"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,18,32,0.88) 0%, rgba(10,18,32,0.62) 58%, rgba(10,18,32,0) 100%)',
        }}
      />

      {/* Top row: quiet utility mute button */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-medium text-[#9fb5d1]">
          <span>Pinehearth Valley</span>
          {highScore > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#f5c76b]">
                Best {highScore.toLocaleString()}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute synth audio' : 'Mute synth audio'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#2a3c57] bg-[#111d30]/90 text-[#d8e6f8] transition-colors duration-150 hover:border-[#f5b041] hover:text-[#ffcf6e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b041]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Center-left bespoke SVG lockup & primary action */}
      <div className="relative z-10 my-auto max-w-md">
        <div className="mb-5">
          <svg
            viewBox="0 0 360 92"
            className="h-auto w-full max-w-[330px]"
            role="img"
            aria-label="Hearthplow"
          >
            {/* Nordic snowflake & curved brass plow blade emblem */}
            <g transform="translate(4, 14)">
              <path
                d="M12 44 C18 22, 40 16, 56 20 L52 48 C36 46, 22 49, 12 44 Z"
                fill="#f5b041"
              />
              <path
                d="M14 44 C22 39, 36 38, 52 41 L51 48 C36 46, 22 49, 14 44 Z"
                fill="#c97e1a"
              />
              <path
                d="M6 37 L22 33"
                stroke="#d94b3d"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              {/* Crisp alpine star above blade */}
              <path
                d="M36 2 L38.6 9.4 L46 12 L38.6 14.6 L36 22 L33.4 14.6 L26 12 L33.4 9.4 Z"
                fill="#eaf3ff"
              />
              <circle cx="52" cy="9" r="2.2" fill="#9bd5ff" />
            </g>

            {/* Editorial Fraunces display wordmark */}
            <text
              x="74"
              y="55"
              fill="#f5f8fd"
              fontFamily="Fraunces, Georgia, serif"
              fontSize="44"
              fontWeight="700"
              letterSpacing="-0.02em"
            >
              Hearthplow
            </text>
            <text
              x="76"
              y="77"
              fill="#a8bfd9"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontSize="13.5"
              fontWeight="500"
              letterSpacing="0.02em"
            >
              Cozy Isometric Snow-Plowing
            </text>
          </svg>
        </div>

        <p className="mb-6 max-w-sm text-sm leading-relaxed text-[#c6d6ea]">
          Carve clean cobblestone lanes through twilight alpine snowdrifts, warm village cottages,
          chain musical winter combos, and outfit your plow in the garage.
        </p>

        {/* Functional Mode Switcher */}
        <div
          className="pointer-events-auto mb-5 inline-flex items-center gap-1 rounded-lg border border-[#253650] bg-[#0e1828] p-1"
          role="group"
          aria-label="Game mode"
        >
          <button
            type="button"
            onClick={() => onSelectMode('SHIFT')}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#f5b041] ${
              gameMode === 'SHIFT'
                ? 'bg-[#22344f] text-[#fff4db]'
                : 'text-[#8ea6c4] hover:text-[#dce8f7]'
            }`}
          >
            Shift Challenge
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('ZEN')}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#f5b041] ${
              gameMode === 'ZEN'
                ? 'bg-[#22344f] text-[#fff4db]'
                : 'text-[#8ea6c4] hover:text-[#dce8f7]'
            }`}
          >
            Zen Plow
          </button>
        </div>

        <div className="mb-2 text-xs text-[#8ea6c4]">
          {gameMode === 'SHIFT'
            ? 'Clear each village district before dawn to earn shift bonuses and unlock new neighborhoods.'
            : 'No countdown clock — drift at your own pace, gather frost crystals, and upgrade freely.'}
        </div>

        <div className="pointer-events-auto mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="whitespace-nowrap rounded-lg bg-[#f5b041] px-7 py-3 text-sm font-bold text-[#141c29] transition-transform duration-150 hover:bg-[#ffbe55] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffda85]"
          >
            Start Plowing
          </button>
          <span className="font-mono text-xs text-[#91a9c7]">Press Enter</span>
        </div>
      </div>

      {/* Bottom flat control hint line */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9cb3cf]">
        <span>WASD / Arrows / Drag Steer</span>
        <span aria-hidden="true">·</span>
        <span>Space Boost</span>
        <span aria-hidden="true">·</span>
        <span>U Workshop</span>
        <span aria-hidden="true">·</span>
        <span>M Sound</span>
        <span aria-hidden="true">·</span>
        <span>Esc Pause</span>
      </div>
    </div>
  );
}
