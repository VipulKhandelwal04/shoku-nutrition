'use client';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useDiary, type SheetView } from './DiaryProvider';
import { FoodSearch, type SearchFilter } from './FoodSearch';
import { PortionFooter, PortionForm } from './PortionForm';
import { CustomFoodForm } from './CustomFoodForm';

/** One native-dialog sheet whose content switches between search, portion and custom food. */
export function LogSheets({ view, setView }: { view: SheetView | null; setView: Dispatch<SetStateAction<SheetView | null>> }) {
  const { frequentIds } = useDiary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const viewKey = view ? `${view.kind}:${view.kind === 'portion' ? view.food.id : ''}` : '';
  const wasOpen = useRef(false);

  // Move focus deliberately when the sheet opens or switches views, so keyboard users never land on <body>.
  useEffect(() => {
    if (!viewKey) { wasOpen.current = false; return; }
    const first = !wasOpen.current;
    wasOpen.current = true;
    const id = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('dialog[open] [data-autofocus]');
      if (!target) return;
      // On touch devices, don't pop the keyboard the moment search opens.
      if (first && target instanceof HTMLInputElement && target.type === 'search' && !matchMedia('(pointer: fine)').matches) return;
      target.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [viewKey]);

  const close = () => {
    setView(null);
    setQuery('');
    setFilter('all');
    setVegOnly(false);
  };

  const backToSearch = () => setView(v => (v ? { kind: 'search', meal: v.meal, frequent: frequentIds } : v));

  let title = 'Add food';
  let onBack: (() => void) | undefined;
  let body = null;
  let footer = null;
  if (view?.kind === 'search') {
    body = (
      <FoodSearch
        meal={view.meal}
        frequent={view.frequent}
        query={query} setQuery={setQuery}
        filter={filter} setFilter={setFilter}
        vegOnly={vegOnly} setVegOnly={setVegOnly}
        onMeal={meal => setView({ ...view, meal })}
        onPick={food => setView({ kind: 'portion', food, meal: view.meal, back: 'search' })}
        onCustom={() => setView({ kind: 'custom', meal: view.meal, name: query.trim() })}
      />
    );
  } else if (view?.kind === 'portion') {
    title = view.entry ? 'Edit food' : 'Your portion';
    onBack = view.back ? backToSearch : undefined;
    body = <PortionForm key={`${view.food.id}-${view.entry?.id ?? 'new'}`} view={view} onDone={close} />;
    footer = <PortionFooter view={view} onDone={close} />;
  } else if (view?.kind === 'custom') {
    title = 'Add your own food';
    onBack = backToSearch;
    body = <CustomFoodForm initialName={view.name} onCreated={food => setView({ kind: 'portion', food, meal: view.meal, back: 'search' })} />;
    footer = <button type="submit" form="custom-food-form" className="btn accent full">Save food &amp; choose portion</button>;
  }

  return (
    <Sheet open={!!view} onClose={close} title={title} onBack={onBack} footer={footer}>
      {body}
    </Sheet>
  );
}
