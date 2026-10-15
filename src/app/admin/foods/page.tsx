import type { Metadata } from 'next';
import { FoodsManager } from '@/components/admin/FoodsManager';
import s from '@/components/admin/admin.module.css';
import { adminFoods } from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Foods' };

export default async function FoodsPage() {
  const foods = await adminFoods();
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Catalogue</p>
          <h1>Foods</h1>
          <p>The shared catalogue everyone searches. Members’ own custom foods stay private and never show here. Edits apply to new logs only: past entries keep the values they were logged with.</p>
        </div>
      </div>
      <FoodsManager foods={foods} />
    </>
  );
}
