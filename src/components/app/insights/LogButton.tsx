'use client';
import { useTransition } from 'react';
import { addEntries, deleteEntries } from '@/lib/data/diary';
import type { Meal } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const BADGE_NAMES: Record<string, string> = { starter: 'Starter', 'week-warrior': 'Week warrior', 'fortnight-force': 'Fortnight force', 'thirty-club': '30-day club' };

/** 44px "+" that logs planned food(s) in one tap, with an Undo toast. The server action revalidates the page. */
export function LogButton({ day, items, label, done }: {
  day: string;
  items: { meal: Meal; foodId: string; quantity: number }[];
  /** Accessible name, e.g. "Log 1 bowl Dal to Lunch". */
  label: string;
  /** Toast text after logging, e.g. "Dal logged to Lunch." */
  done: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-add"
      aria-label={label}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => start(async () => {
        const res = await addEntries({ day, items: items.map(i => ({ ...i, quantity: Math.round(i.quantity * 100) / 100, source: 'plan' })) });
        if (!res.ok) { toast(res.error); return; }
        const ids = res.data.ids;
        const badge = res.data.newBadges[0];
        if (badge) toast(`${BADGE_NAMES[badge] ?? 'New badge'} unlocked. ${done}`, { tone: 'win', undo: async () => { await deleteEntries(ids); } });
        else toast(done, { undo: async () => { const r = await deleteEntries(ids); if (!r.ok) toast(r.error); } });
      })}
    >
      <Icon name="plus" size="sm" />
    </button>
  );
}
