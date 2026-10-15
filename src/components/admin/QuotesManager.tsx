'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { createQuote, deleteQuote, moveQuote, setQuoteActive, updateQuote } from '@/lib/admin/actions';
import type { FieldErrors } from '@/lib/admin/schemas';
import type { Quote } from '@/lib/types';
import s from './admin.module.css';
import { ConfirmDialog, Switch, useAdminAction, useConfirm } from './primitives';

const clip = (t: string, n = 48) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function QuotesManager({ quotes }: { quotes: Quote[] }) {
  const [previewId, setPreviewId] = useState<number | 'draft' | null>(null);
  const [draft, setDraft] = useState({ text: '', author: '' });
  const [addErrors, setAddErrors] = useState<FieldErrors>({});
  const { run, pending } = useAdminAction();
  const confirm = useConfirm<Quote>();

  const active = quotes.filter(q => q.active);
  const preview =
    previewId === 'draft' && draft.text.trim()
      ? { text: draft.text, author: draft.author }
      : quotes.find(q => q.id === previewId) ?? active[0] ?? null;

  return (
    <div className={s.contentGrid}>
      <div>
        {quotes.length === 0 ? (
          <div className={`${s.empty} panel`}>
            <strong>No quotes yet</strong>
            <p>The splash skips straight to the home page until there’s at least one active quote. Add one below.</p>
          </div>
        ) : (
          <ol className={s.list} style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Quotes in display order">
            {quotes.map((q, i) => (
              <QuoteRow
                key={`${q.id}:${q.sort}:${q.text}:${q.author ?? ''}:${q.active}`}
                quote={q}
                first={i === 0}
                last={i === quotes.length - 1}
                pending={pending}
                onPreview={() => setPreviewId(q.id)}
                onSave={(v, onErr) => run(() => updateQuote(q.id, { ...v, active: q.active }), { onDone: r => !r.ok && onErr(r.fieldErrors ?? {}) })}
                onActive={v => run(() => setQuoteActive(q.id, v), { undo: () => setQuoteActive(q.id, !v) })}
                onMove={dir => run(() => moveQuote(q.id, dir), { success: dir === 'up' ? 'Moved up.' : 'Moved down.' })}
                onDelete={() => confirm.ask(q)}
              />
            ))}
          </ol>
        )}

        <form
          className={s.addBox}
          noValidate
          onSubmit={e => {
            e.preventDefault();
            run(() => createQuote({ ...draft, active: true }), {
              onDone: r => {
                if (r.ok) { setDraft({ text: '', author: '' }); setAddErrors({}); setPreviewId(null); } else setAddErrors(r.fieldErrors ?? {});
              },
            });
          }}
        >
          <span className="label">Add a quote</span>
          <div>
            <label htmlFor="new-quote" className="sr-only">Quote text</label>
            <textarea
              id="new-quote"
              rows={2}
              maxLength={200}
              placeholder="One good meal is a rep. Stack them."
              value={draft.text}
              onFocus={() => setPreviewId('draft')}
              onChange={e => { setDraft(d => ({ ...d, text: e.target.value })); setPreviewId('draft'); }}
              aria-invalid={addErrors.text ? true : undefined}
              aria-describedby="new-quote-count new-quote-err"
            />
            <p id="new-quote-count" className="field-help">{draft.text.trim().length}/200</p>
            <p id="new-quote-err" className="error-text">{addErrors.text ?? ''}</p>
          </div>
          <div className={s.row}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="new-quote-author" className="sr-only">Author (optional)</label>
              <input id="new-quote-author" placeholder="Author (optional)" maxLength={80} value={draft.author} onChange={e => setDraft(d => ({ ...d, author: e.target.value }))} />
            </div>
            <button type="submit" className="btn-secondary" disabled={pending}><Icon name="plus" size="sm" />Add quote</button>
          </div>
        </form>
      </div>

      <aside aria-label="Splash preview">
        <p className="label" style={{ marginBottom: 8 }}>Splash preview</p>
        <div className={s.splash} aria-hidden={preview ? undefined : true}>
          <span className={s.splashBrand}>Katori</span>
          <div>
            {preview ? (
              <>
                <p className={s.splashQuote}>{preview.text}</p>
                {preview.author && <p className={s.splashAuthor}>{preview.author}</p>}
              </>
            ) : (
              <p className="muted">No active quote. The splash is skipped.</p>
            )}
          </div>
          <div className={s.splashDots} aria-hidden="true"><span /><span /><span /></div>
        </div>
        <p className="field-help">{active.length} active of {quotes.length}. Click a quote to preview it.</p>
      </aside>

      <ConfirmDialog
        open={confirm.target !== null}
        title="Delete this quote?"
        confirmLabel="Delete quote"
        onCancel={confirm.close}
        onConfirm={() => { const q = confirm.target; confirm.close(); if (q) run(() => deleteQuote(q.id)); }}
      >
        <p>“{clip(confirm.target?.text ?? '', 120)}” will be removed from the splash rotation for good. To keep it for later, switch it off instead.</p>
      </ConfirmDialog>
    </div>
  );
}

function QuoteRow({ quote, first, last, pending, onPreview, onSave, onActive, onMove, onDelete }: {
  quote: Quote;
  first: boolean;
  last: boolean;
  pending: boolean;
  onPreview: () => void;
  onSave: (v: { text: string; author: string }, onErr: (e: FieldErrors) => void) => void;
  onActive: (v: boolean) => void;
  onMove: (dir: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(quote.text);
  const [author, setAuthor] = useState(quote.author ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = text !== quote.text || author !== (quote.author ?? '');
  const short = clip(quote.text);
  const tid = `q-${quote.id}`;

  return (
    <li className={`${s.item} ${quote.active ? '' : s.off}`} onFocus={onPreview} onClick={onPreview}>
      <div className={s.order}>
        <button type="button" className="btn-icon" aria-label={`Move “${short}” up`} disabled={first || pending} onClick={() => onMove('up')}><Icon name="down" size="sm" className={s.flip} /></button>
        <button type="button" className="btn-icon" aria-label={`Move “${short}” down`} disabled={last || pending} onClick={() => onMove('down')}><Icon name="down" size="sm" /></button>
      </div>
      <form className={s.itemBody} noValidate onSubmit={e => { e.preventDefault(); onSave({ text, author }, setErrors); }}>
        <label htmlFor={`${tid}-text`} className="sr-only">Quote text</label>
        <textarea id={`${tid}-text`} rows={2} maxLength={200} value={text} onChange={e => setText(e.target.value)} aria-invalid={errors.text ? true : undefined} aria-describedby={`${tid}-err`} />
        <p id={`${tid}-err`} className="error-text">{errors.text ?? errors.author ?? ''}</p>
        <div className={s.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor={`${tid}-author`} className="sr-only">Author</label>
            <input id={`${tid}-author`} placeholder="Author (optional)" maxLength={80} value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
          {dirty && (
            <>
              <button type="button" className="btn-text" style={{ color: 'var(--muted)' }} onClick={() => { setText(quote.text); setAuthor(quote.author ?? ''); setErrors({}); }}>Reset</button>
              <button type="submit" className="btn-secondary" disabled={pending}>Save</button>
            </>
          )}
        </div>
      </form>
      <div className={s.itemSide}>
        <Switch pressed={quote.active} hideLabel label={`Show “${short}” on the splash`} disabled={pending} onChange={onActive} />
        <button type="button" className="btn-icon" aria-label={`Delete “${short}”`} onClick={onDelete}><Icon name="trash" size="sm" /></button>
      </div>
    </li>
  );
}
