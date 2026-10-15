'use client';
import s from '@/components/admin/admin.module.css';

/** Admin pages throw when Supabase is unreachable or a migration is missing. Say so plainly and offer a retry. */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={s.empty} role="alert">
      <strong>Couldn’t load this page</strong>
      <p>{error.message || 'The database didn’t answer.'} If this keeps happening, check that the Supabase migrations ran and the env vars are set.</p>
      {error.digest && <p className={s.mono}>Ref {error.digest}</p>}
      <button type="button" className="btn-secondary" onClick={() => retry()}>Try again</button>
    </div>
  );
}
