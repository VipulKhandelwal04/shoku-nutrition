// The Shoku brand: the kettlebell-bowl icon (training and food in one mark) and the SHOKU wordmark with its pink O.
// The same shapes live in src/app/icon.svg (favicon); change both together.
import s from './brand.module.css';

/** The icon's shapes on a 64 grid: kettlebell handle and body, a bowl inside, three lines of steam. */
function Shapes({ ink, bowl }: { ink: string; bowl: string }) {
  return (
    <>
      <rect x="17.5" y="10" width="29" height="17" rx="8.5" fill="none" stroke={ink} strokeWidth="5.5" />
      <circle cx="32" cy="40" r="20" fill={ink} />
      <path d="M16 40h32a16 16 0 0 1-32 0z" fill={bowl} />
      <path d="M25.5 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3M32 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3M38.5 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3"
        fill="none" stroke={bowl} strokeWidth="2.4" strokeLinecap="round" />
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
        <rect x="17.5" y="10" width="29" height="17" rx="8.5" />
        <circle cx="32" cy="40" r="20" />
        <path d="M16 40h32a16 16 0 0 1-32 0z" />
        <path d="M25.5 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3M32 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3M38.5 35.5c-2.4-2.4 2.4-4.4 0-7.2c-1.4-1.6-.4-3 .8-4.3" />
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
