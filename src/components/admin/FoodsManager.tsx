'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import { cuisineOf } from '@/lib/nutrition';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { setFoodActive } from '@/lib/admin/actions';
import { DIETS } from '@/lib/admin/schemas';
import type { FoodRow } from '@/lib/types';
import s from './admin.module.css';
import { FoodSheet } from './FoodSheet';
import { Switch, useAdminAction } from './primitives';

export const DIET_LABEL: Record<(typeof DIETS)[number], string> = { veg: 'Veg', egg: 'Egg', nonveg: 'Non-veg' };
type Status = 'all' | 'active' | 'inactive';

export function FoodsManager({ foods }: { foods: FoodRow[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cuisine, setCuisine] = useState('all');
  const [diet, setDiet] = useState<'all' | FoodRow['diet']>('all');
  const [status, setStatus] = useState<Status>('all');
  // Sheet identity changes per open (remounts the form fresh); `open` drives the dialog so it can close gracefully.
  const [target, setTarget] = useState<{ food: FoodRow | null; n: number }>({ food: null, n: 0 });
  const [open, setOpen] = useState(false);
  const edit = (food: FoodRow | null) => { setTarget(t => ({ food, n: t.n + 1 })); setOpen(true); };
  const { run, pending } = useAdminAction();
  const q = useDeferredValue(query.trim().toLowerCase());

  const categories = useMemo(() => Array.from(new Set(foods.map(f => f.category))).sort(), [foods]);
  const cuisines = useMemo(() => Array.from(new Set(foods.map(f => cuisineOf(f)))).sort(), [foods]);
  const rows = useMemo(
    () =>
      foods.filter(
        f =>
          (category === 'all' || f.category === category) &&
          (cuisine === 'all' || cuisineOf(f) === cuisine) &&
          (diet === 'all' || f.diet === diet) &&
          (status === 'all' || (status === 'active' ? f.active : !f.active)) &&
          (!q || f.name.toLowerCase().includes(q) || f.id.includes(q) || f.aliases.toLowerCase().includes(q)),
      ),
    [foods, category, cuisine, diet, status, q],
  );
  const filtered = rows.length !== foods.length;

  const toggle = (f: FoodRow) =>
    run(() => setFoodActive(f.id, !f.active), { undo: () => setFoodActive(f.id, f.active) });

  return (
    <>
      <div className={s.toolbar} role="search" aria-label="Filter foods">
        <div className={s.search}>
          <label htmlFor="food-q" className="sr-only">Search foods</label>
          <Icon name="search" size="sm" />
          <input id="food-q" type="search" placeholder="Search name, id or alias" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <div className={`field ${s.filter}`}>
          <label htmlFor="food-cat" className="sr-only">Category</label>
          <select id="food-cat" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={`field ${s.filter}`}>
          <label htmlFor="food-cuisine-filter" className="sr-only">Cuisine</label>
          <select id="food-cuisine-filter" value={cuisine} onChange={e => setCuisine(e.target.value)}>
            <option value="all">All cuisines</option>
            {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={`field ${s.filter}`}>
          <label htmlFor="food-diet" className="sr-only">Diet</label>
          <select id="food-diet" value={diet} onChange={e => setDiet(e.target.value as typeof diet)}>
            <option value="all">Any diet</option>
            {DIETS.map(d => <option key={d} value={d}>{DIET_LABEL[d]}</option>)}
          </select>
        </div>
        <div className={`field ${s.filter}`}>
          <label htmlFor="food-status" className="sr-only">Status</label>
          <select id="food-status" value={status} onChange={e => setStatus(e.target.value as Status)}>
            <option value="all">Active and hidden</option>
            <option value="active">Active only</option>
            <option value="inactive">Hidden only</option>
          </select>
        </div>
        <button type="button" className="btn accent" onClick={() => edit(null)}>
          <Icon name="plus" size="sm" />Add food
        </button>
      </div>

      <div className={s.tableWrap}>
        {foods.length === 0 ? (
          <div className={s.empty}>
            <strong>No foods yet</strong>
            <p>Run the seed migration for the starter catalogue, or add the first food by hand. Members can’t log anything until the catalogue has foods.</p>
            <button type="button" className="btn-secondary" onClick={() => edit(null)}><Icon name="plus" size="sm" />Add the first food</button>
          </div>
        ) : rows.length === 0 ? (
          <div className={s.empty}>
            <strong>No matches</strong>
            <p>Nothing fits these filters.</p>
            <button type="button" className="btn-secondary" onClick={() => { setQuery(''); setCategory('all'); setCuisine('all'); setDiet('all'); setStatus('all'); }}>Clear filters</button>
          </div>
        ) : (
          <table className={s.table} style={{ minWidth: 900 }}>
            <caption>
              {filtered ? `${rows.length} of ${foods.length} foods match` : `${foods.length} foods`} · per serving · hidden foods stay on old entries but leave search
            </caption>
            <thead>
              <tr>
                <th scope="col">Food</th>
                <th scope="col">Category</th>
                <th scope="col">Cuisine</th>
                <th scope="col">Serving</th>
                <th scope="col" className={s.num}>kcal</th>
                <th scope="col" className={s.num}>Protein</th>
                <th scope="col" className={s.num}>Carbs</th>
                <th scope="col" className={s.num}>Fat</th>
                <th scope="col">Diet</th>
                <th scope="col">Active</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(f => (
                <tr key={f.id} className={f.active ? undefined : s.inactiveRow}>
                  <th scope="row" className={s.rowHead}>
                    <div className={s.cellMain}>
                      <FoodTile icon={f.icon} />
                      <div>
                        <strong>{f.name}</strong>
                        <span className={s.mono}>{f.id}</span>
                      </div>
                    </div>
                  </th>
                  <td className={s.nowrap}>{f.category}</td>
                  <td className={s.nowrap}>{cuisineOf(f)}</td>
                  <td className={s.nowrap}>1 {f.unit} · {Number(f.grams)} g</td>
                  <td className={s.num}>{Number(f.kcal)}</td>
                  <td className={s.num}>{Number(f.p)} g</td>
                  <td className={s.num}>{Number(f.c)} g</td>
                  <td className={s.num}>{Number(f.f)} g</td>
                  <td><span className={`chip ${f.diet === 'veg' ? 'ok' : f.diet === 'egg' ? 'warn' : 'accent'}`}>{DIET_LABEL[f.diet]}</span></td>
                  <td>
                    <Switch pressed={f.active} hideLabel label={`${f.name} active`} disabled={pending} onChange={() => toggle(f)} />
                  </td>
                  <td>
                    <div className={s.actions}>
                      <button type="button" className="btn-icon" aria-label={`Edit ${f.name}`} onClick={() => edit(f)}><Icon name="edit" size="sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <FoodSheet key={target.n} food={target.food} open={open} categories={categories} cuisines={cuisines} onClose={() => setOpen(false)} />
    </>
  );
}
