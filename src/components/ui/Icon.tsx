// One stroke icon family (24px grid, 1.8 stroke) used across the product.
const paths = {
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'M6 6l12 12M6 18 18 6', back: 'm14 6-6 6 6 6', next: 'm10 6 6 6-6 6', down: 'm6 9 6 6 6-6',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', calendar: 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14',
  camera: 'M8 5 6 8H3v12h18V8h-3l-2-3zM16 13.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14z', star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  check: 'm5 12 4 4L19 6', checkCircle: 'M21 12a9 9 0 1 1-9-9m-5 9 4 4L21 5',
  drop: 'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z', glass: 'M5 3h14l-2 18H7zM6 9h12',
  bowl: 'M3 10h18a9 9 0 0 1-18 0zM9 3v3m6-3v3M8 21h8',
  fruit: 'M12 8c-4-5-11-1-8 7 2 6 5 7 8 5 3 2 6 1 8-5 3-8-4-12-8-7zM12 8V3m0 3c1-4 5-4 5-4',
  egg: 'M19 14c0 5-3 7-7 7s-7-2-7-7S9 2 12 2s7 7 7 12z', plate: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  roti: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8 8h.1M14 7h.1M16 13h.1M10 15h.1M8 12h.1M13 11h.1',
  cube: 'm12 3 8 5v9l-8 4-8-4V8zM4 8l8 5 8-5m-8 5v8', leaf: 'M20 3c-9-1-17 3-15 11 2 8 16 6 15-11zM3 21 16 8',
  nuts: 'M7 5c-6 4-5 13 1 14 5 1 7-8 4-12-2-3-3-3-5-2zM9 5 7 19m9-12c7-1 8 9 3 12-2 2-4 1-5-1',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  sunrise: 'M4 17h16M2 21h20M7 17a5 5 0 0 1 10 0M12 3v5M4 10l3 3m10 0 3-3',
  moon: 'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11z', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  diary: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5', chart: 'M4 20V4m0 16h17M8 16v-4m5 4V7m5 9v-7',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3', users: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M3 20v-2a6 6 0 0 1 12 0v2m2-9a3 3 0 0 0 0-6m4 15v-2a6 6 0 0 0-4-5.6',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', sliders: 'M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4',
  quote: 'M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6', image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M16 9h.1',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload: 'M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6m0-10v.1',
  arrow: 'M5 12h14m-6-6 6 6-6 6', bolt: 'm13 2-9 12h7l-1 8 10-12h-7z', heart: 'M12 21S2 14 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 6-10 13-10 13z',
  type: 'M4 7V4h16v3M9 20h6M12 4v16', logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11', google: '',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size, className = '', label }: { name: IconName; size?: 'sm'; className?: string; label?: string }) {
  if (name === 'google') {
    return (
      <svg className={`icon ${size ?? ''} ${className}`} viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} style={{ stroke: 'none' }}>
        <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
    );
  }
  return (
    <svg className={`icon ${size ?? ''} ${className}`} viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={paths[name]} />
    </svg>
  );
}

const FOOD_ICONS = new Set<IconName>(['bowl', 'fruit', 'glass', 'egg', 'plate', 'roti', 'cube', 'leaf', 'nuts']);
export function FoodTile({ icon, photo, className = '' }: { icon: string; photo?: string | null; className?: string }) {
  return (
    <span className={`food-tile ${className}`}>
      {photo ? <img src={photo} alt="" /> : <Icon name={FOOD_ICONS.has(icon as IconName) ? (icon as IconName) : 'bowl'} />}
    </span>
  );
}
