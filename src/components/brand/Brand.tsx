// The Shoku brand: the kettlebell-bowl icon (training and food in one mark) and the SHOKU wordmark with its pink O.
// The same shapes live in src/app/icon.svg (favicon); change both together.
import s from './brand.module.css';

/** The mark on a 64 grid, defined once: kettlebell handle and body, a bowl inside, three lines of steam. */
const HANDLE = 'M17.5 26.2V18.5a8.5 8.5 0 0 1 8.5-8.5h12a8.5 8.5 0 0 1 8.5 8.5v7.7';
const BODY = { cx: 32, cy: 40, r: 20 };
const BOWL = 'M16 40h32a16 16 0 0 1-32 0z';
const STEAM = [25.5, 32, 38.5].map(x => `M${x} 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3`).join('');

function Shapes({ ink, bowl }: { ink: string; bowl: string }) {
  return (
    <>
      {/* Filled: the handle is a ring (rect stroke) so its window shows the tile through it. */}
      <rect x="17.5" y="10" width="29" height="17" rx="8.5" fill="none" stroke={ink} strokeWidth="5.5" />
      <circle {...BODY} fill={ink} />
      <path d={BOWL} fill={bowl} />
      <path d={STEAM} fill="none" stroke={bowl} strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
}

/** The app icon: black kettlebell-bowl on the pink tile. Decorative by default (the wordmark names the brand). */
export function BrandIcon({ size = 36, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`${s.icon} ${className}`}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <rect width="64" height="64" rx="14" fill="var(--accent, #ff3f6c)" />
      <Shapes ink="#0b0b0e" bowl="var(--accent, #ff3f6c)" />
    </svg>
  );
}

/** The bare mark with no tile, outlined: a large, quiet backdrop (e.g. behind the splash). */
export function BrandOutline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".35" strokeLinecap="round">
        {/* Outlined: the handle stops where it meets the body, so the outline doesn't cross it. */}
        <path d={HANDLE} />
        <circle {...BODY} />
        <path d={BOWL} />
        <path d={STEAM} />
      </g>
    </svg>
  );
}

/** SHOKU with the pink O. Size it with font-size on `className`. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`${s.word} ${className}`}>
      SH<span>O</span>KU
    </span>
  );
}

/** Icon + wordmark, the lockup used in every top bar. */
export function BrandLockup({ size = 36, className = '', wordClass = '' }: { size?: number; className?: string; wordClass?: string }) {
  return (
    <span className={`${s.lockup} ${className}`}>
      <BrandIcon size={size} />
      <Wordmark className={wordClass} />
    </span>
  );
}
