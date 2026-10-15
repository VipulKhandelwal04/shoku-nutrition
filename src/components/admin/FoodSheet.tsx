'use client';
import { useState, type ChangeEvent } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { FoodTile, Icon, type IconName } from '@/components/ui/Icon';
import { createFood, deleteFood, setFoodActive, updateFood } from '@/lib/admin/actions';
import { DIETS, FOOD_ICONS, slugify, type FieldErrors } from '@/lib/admin/schemas';
import { GROUPS, type GroupKey, DEFAULT_CUISINE, cuisineOf } from '@/lib/nutrition';
import type { FoodRow } from '@/lib/types';
import s from './admin.module.css';
import { ConfirmDialog, Switch, useAdminAction } from './primitives';

type NumKey = 'grams' | 'kcal' | 'p' | 'c' | 'f' | 'fibre';
type Draft = {
  id: string; name: string; category: string; cuisine: string; unit: string; aliases: string;
  diet: FoodRow['diet']; icon: (typeof FOOD_ICONS)[number]; active: boolean;
} & Record<NumKey, string> & { groups: Record<GroupKey, string> };

const str = (n: number | undefined | null) => (n === undefined || n === null ? '' : String(Number(n)));

function toDraft(f: FoodRow | null): Draft {
  const groups = Object.fromEntries(GROUPS.map(g => [g.key, str(f?.groups?.[g.key])])) as Record<GroupKey, string>;
  if (!f) return { id: '', name: '', category: '', cuisine: DEFAULT_CUISINE, unit: '', aliases: '', diet: 'veg', icon: 'bowl', active: true, grams: '', kcal: '', p: '', c: '', f: '', fibre: '', groups };
  const icon = (FOOD_ICONS as readonly string[]).includes(f.icon) ? (f.icon as Draft['icon']) : 'bowl';
  return {
    id: f.id, name: f.name, category: f.category, cuisine: cuisineOf(f), unit: f.unit, aliases: f.aliases ?? '', diet: f.diet, icon, active: f.active,
    grams: str(f.grams), kcal: str(f.kcal), p: str(f.p), c: str(f.c), f: str(f.f), fibre: str(f.fibre), groups,
  };
}

const omit = (o: FieldErrors, key: string): FieldErrors => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

const DIET_LABEL: Record<Draft['diet'], string> = { veg: 'Veg', egg: 'Egg', nonveg: 'Non-veg' };
const MACROS: { key: NumKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'p', label: 'Protein', unit: 'g' },
  { key: 'c', label: 'Carbs', unit: 'g' },
  { key: 'f', label: 'Fat', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
];

export function FoodSheet({ food, open, categories, cuisines, onClose }: { food: FoodRow | null; open: boolean; categories: string[]; cuisines: string[]; onClose: () => void }) {
  const isNew = food === null;
  const [d, setD] = useState<Draft>(() => toDraft(food));
  const [idTouched, setIdTouched] = useState(!isNew);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useAdminAction();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'name' && isNew && !idTouched) next.id = slugify(String(v));
      return next;
    });
    if (errors[k as string]) setErrors(prev => omit(prev, k as string));
  };
  const setGroup = (k: GroupKey, v: string) => {
    setD(prev => ({ ...prev, groups: { ...prev.groups, [k]: v } }));
    const key = `groups.${k}`;
    if (errors[key]) setErrors(prev => omit(prev, key));
  };

  /** Props shared by every text/number input: label wiring, error state, described-by. */
  const bind = (key: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement>) => void) => ({
    id: `food-${key.replace('.', '-')}`,
    value,
    onChange,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `food-${key.replace('.', '-')}-err` : undefined,
    className: errors[key] ? s.invalid : undefined,
  });
  const err = (key: string) => (errors[key] ? <p id={`food-${key.replace('.', '-')}-err`} className="error-text" style={{ marginTop: 6 }}>{errors[key]}</p> : null);

  const submit = () => {
    const payload = { ...d };
    run(() => (isNew ? createFood(payload) : updateFood(payload)), {
      onDone: r => {
        if (r.ok) return onClose();
        const fe = r.fieldErrors ?? {};
        setErrors(fe);
        const first = Object.keys(fe)[0];
        if (first) requestAnimationFrame(() => document.getElementById(`food-${first.replace('.', '-')}`)?.focus());
      },
    });
  };

  const name = d.name.trim() || 'New food';

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isNew ? 'Add food' : 'Edit food'}
        labelledBy="food-sheet-title"
        footer={
          <div className={s.footRow}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="food-form" className="btn accent" disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add food' : 'Save'}</button>
          </div>
        }
      >
        <div className={s.preview} aria-label="Preview">
          <FoodTile icon={d.icon} />
          <div style={{ minWidth: 0 }}>
            <strong>{name}</strong>
            <span>1 {d.unit.trim() || 'serving'}{d.grams ? ` · ${d.grams} g` : ''} · {DIET_LABEL[d.diet]}</span>
          </div>
          <div className={s.previewKcal}>{d.kcal || '0'}<small>kcal</small></div>
        </div>

        <form id="food-form" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
          {errors._ && <p className="error-text" role="alert">{errors._}</p>}
          <div className={s.formGrid}>
            <div className={`field ${s.span2}`}>
              <label htmlFor="food-name">Name</label>
              <input {...bind('name', d.name, e => set('name', e.target.value))} maxLength={120} required autoComplete="off" />
              {err('name')}
            </div>
            <div className={`field ${s.span2}`}>
              <label htmlFor="food-id">Id</label>
              <input
                {...bind('id', d.id, e => { setIdTouched(true); set('id', e.target.value.toLowerCase()); })}
                readOnly={!isNew}
                maxLength={60}
                spellCheck={false}
                autoComplete="off"
                aria-describedby={[errors.id ? 'food-id-err' : '', 'food-id-help'].filter(Boolean).join(' ')}
              />
              <p id="food-id-help" className="field-help">{isNew ? 'Lowercase slug, unique. It can’t change after you save.' : 'Ids are permanent: entries and plans point to them.'}</p>
              {err('id')}
            </div>
            <div className="field">
              <label htmlFor="food-category">Category</label>
              <input {...bind('category', d.category, e => set('category', e.target.value))} list="food-categories" maxLength={40} autoComplete="off" />
              <datalist id="food-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
              {err('category')}
            </div>
            <div className="field">
              <label htmlFor="food-cuisine">Cuisine</label>
              <input {...bind('cuisine', d.cuisine, e => set('cuisine', e.target.value))} list="food-cuisines" maxLength={40} autoComplete="off" placeholder="Indian, Italian, Thai…" />
              <datalist id="food-cuisines">{cuisines.map(c => <option key={c} value={c} />)}</datalist>
              {err('cuisine')}
            </div>
            <div className="field">
              <label htmlFor="food-unit">Serving unit</label>
              <input {...bind('unit', d.unit, e => set('unit', e.target.value))} placeholder="bowl, piece, glass" maxLength={40} autoComplete="off" />
              {err('unit')}
            </div>
            <div className="field">
              <label htmlFor="food-grams">Grams per serving</label>
              <div className={s.unitInput}>
                <input {...bind('grams', d.grams, e => set('grams', e.target.value))} inputMode="decimal" />
                <span aria-hidden="true">g</span>
              </div>
              {err('grams')}
            </div>
          </div>

          <fieldset className={s.fieldset}>
            <legend>Per serving</legend>
            <div className={s.formGrid3}>
              {MACROS.map(m => (
                <div className="field" key={m.key}>
                  <label htmlFor={`food-${m.key}`}>{m.label}</label>
                  <div className={s.unitInput}>
                    <input {...bind(m.key, d[m.key], e => set(m.key, e.target.value))} inputMode="decimal" />
                    <span aria-hidden="true">{m.unit}</span>
                  </div>
                  {err(m.key)}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <span className="field-label" id="food-diet-label">Diet</span>
            <div className="seg" role="group" aria-labelledby="food-diet-label">
              {DIETS.map(x => (
                <button key={x} type="button" aria-pressed={d.diet === x} onClick={() => set('diet', x)}>{DIET_LABEL[x]}</button>
              ))}
            </div>
            {err('diet')}
          </div>

          <div className="field">
            <span className="field-label" id="food-icon-label">Icon</span>
            <div className={s.iconPick} role="group" aria-labelledby="food-icon-label">
              {FOOD_ICONS.map(i => (
                <button key={i} type="button" className={s.iconOpt} aria-pressed={d.icon === i} aria-label={i} onClick={() => set('icon', i)}>
                  <Icon name={i as IconName} />
                </button>
              ))}
            </div>
            {err('icon')}
          </div>

          <div className="field">
            <label htmlFor="food-aliases">Aliases</label>
            <input {...bind('aliases', d.aliases, e => set('aliases', e.target.value))} placeholder="Hindi names, spellings: kela, keli" maxLength={300} autoComplete="off" />
            <p className="field-help">Space-separated words people might search for.</p>
            {err('aliases')}
          </div>

          <fieldset className={s.fieldset}>
            <legend>Food groups per serving</legend>
            <p className="field-help" style={{ margin: '0 0 12px' }}>Raw weight that counts toward each My Plate group. Leave blank for none.</p>
            <div className={s.formGrid4}>
              {GROUPS.map(g => (
                <div className="field" key={g.key}>
                  <label htmlFor={`food-groups-${g.key}`}>{g.label}</label>
                  <div className={s.unitInput}>
                    <input {...bind(`groups.${g.key}`, d.groups[g.key], e => setGroup(g.key, e.target.value))} inputMode="decimal" />
                    <span aria-hidden="true">{g.unit}</span>
                  </div>
                  {err(`groups.${g.key}`)}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <Switch pressed={d.active} label={d.active ? 'Active: shows in search' : 'Hidden: not in search'} onChange={v => set('active', v)} />
          </div>
        </form>

        {!isNew && food && (
          <div className={s.danger}>
            <span className="label">Retire this food</span>
            <p className="fine-print">
              Deactivating hides {food.name} from search and quick-add. Members’ past entries keep their saved values. This is the safe choice.
            </p>
            <div className={s.row}>
              {food.active && (
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => setFoodActive(food.id, false), { onDone: r => r.ok && onClose(), undo: () => setFoodActive(food.id, true) })}>
                  Deactivate
                </button>
              )}
              <button type="button" className={`btn-text ${s.dangerBtn}`} onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size="sm" />Delete permanently
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {food && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${food.name}?`}
          confirmLabel={`Delete ${food.name}`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            run(() => deleteFood(food.id), { onDone: r => r.ok && onClose() });
          }}
        >
          <p>
            This removes <strong>{food.name}</strong> ({food.id}) from the catalogue for good. Entries already logged keep their numbers but lose the
            link to this food, so “log again” and plans that use it stop working. Deactivating is usually better.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
