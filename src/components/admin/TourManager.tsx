'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { createTourSlide, deleteTourSlide, moveTourSlide, setTourSlideActive, updateTourSlide } from '@/lib/admin/actions';
import type { FieldErrors } from '@/lib/admin/schemas';
import type { TourSlide } from '@/lib/types';
import s from './admin.module.css';
import { ConfirmDialog, Switch, useAdminAction, useConfirm } from './primitives';

export function TourManager({ slides, images }: { slides: TourSlide[]; images: string[] }) {
  const [target, setTarget] = useState<{ slide: TourSlide | null; n: number }>({ slide: null, n: 0 });
  const [open, setOpen] = useState(false);
  const { run, pending } = useAdminAction();
  const confirm = useConfirm<TourSlide>();
  const edit = (slide: TourSlide | null) => { setTarget(t => ({ slide, n: t.n + 1 })); setOpen(true); };

  return (
    <>
      {slides.length === 0 ? (
        <div className={`${s.empty} panel`}>
          <strong>No tour slides</strong>
          <p>The home page skips the feature tour until there’s at least one active slide.</p>
          <button type="button" className="btn-secondary" onClick={() => edit(null)}><Icon name="plus" size="sm" />Add the first slide</button>
        </div>
      ) : (
        <ol className={s.list} style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Tour slides in display order">
          {slides.map((t, i) => (
            <li key={t.id} className={`${s.item} ${t.active ? '' : s.off}`}>
              <div className={s.order}>
                <button type="button" className="btn-icon" aria-label={`Move “${t.title}” up`} disabled={i === 0 || pending} onClick={() => run(() => moveTourSlide(t.id, 'up'), { success: 'Moved up.' })}>
                  <Icon name="down" size="sm" className={s.flip} />
                </button>
                <button type="button" className="btn-icon" aria-label={`Move “${t.title}” down`} disabled={i === slides.length - 1 || pending} onClick={() => run(() => moveTourSlide(t.id, 'down'), { success: 'Moved down.' })}>
                  <Icon name="down" size="sm" />
                </button>
              </div>
              <div className={s.cellMain} style={{ minWidth: 0, alignItems: 'flex-start' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails may be arbitrary https URLs */}
                <img className={s.thumb} src={t.image_url} alt="" loading="lazy" />
                <div style={{ minWidth: 0 }}>
                  <strong>{t.title}</strong>
                  <span style={{ display: 'block' }}>{t.body}</span>
                  <span className={s.mono}>{t.image_url}</span>
                </div>
              </div>
              <div className={s.itemSide}>
                <Switch pressed={t.active} hideLabel label={`Show “${t.title}” in the tour`} disabled={pending} onChange={v => run(() => setTourSlideActive(t.id, v), { undo: () => setTourSlideActive(t.id, !v) })} />
                <div style={{ display: 'flex' }}>
                  <button type="button" className="btn-icon" aria-label={`Edit “${t.title}”`} onClick={() => edit(t)}><Icon name="edit" size="sm" /></button>
                  <button type="button" className="btn-icon" aria-label={`Delete “${t.title}”`} onClick={() => confirm.ask(t)}><Icon name="trash" size="sm" /></button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {slides.length > 0 && (
        <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => edit(null)}><Icon name="plus" size="sm" />Add slide</button>
      )}

      <SlideSheet key={target.n} slide={target.slide} images={images} open={open} onClose={() => setOpen(false)} />

      <ConfirmDialog
        open={confirm.target !== null}
        title={`Delete “${confirm.target?.title ?? ''}”?`}
        confirmLabel="Delete slide"
        onCancel={confirm.close}
        onConfirm={() => { const t = confirm.target; confirm.close(); if (t) run(() => deleteTourSlide(t.id)); }}
      >
        <p>The slide leaves the home tour for good. To keep it for later, switch it off instead.</p>
      </ConfirmDialog>
    </>
  );
}

function SlideSheet({ slide, images, open, onClose }: { slide: TourSlide | null; images: string[]; open: boolean; onClose: () => void }) {
  const isNew = slide === null;
  const [title, setTitle] = useState(slide?.title ?? '');
  const [body, setBody] = useState(slide?.body ?? '');
  const [image, setImage] = useState(slide?.image_url ?? images[0] ?? '');
  const [custom, setCustom] = useState(slide ? !images.includes(slide.image_url) : false);
  const [active, setActive] = useState(slide?.active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const { run, pending } = useAdminAction();

  const submit = () => {
    const v = { title, body, image_url: image, active };
    run(() => (slide ? updateTourSlide(slide.id, v) : createTourSlide(v)), {
      onDone: r => {
        if (r.ok) return onClose();
        const fe = r.fieldErrors ?? {};
        setErrors(fe);
        const first = Object.keys(fe)[0];
        if (first) requestAnimationFrame(() => document.getElementById(`slide-${first}`)?.focus());
      },
    });
  };
  const errProps = (k: string) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': `slide-${k}-err`, className: errors[k] ? s.invalid : undefined });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? 'Add slide' : 'Edit slide'}
      labelledBy="slide-sheet-title"
      footer={
        <div className={s.footRow}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="slide-form" className="btn accent" disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add slide' : 'Save'}</button>
        </div>
      }
    >
      <div className={s.tourCard} style={{ marginBottom: 18, maxWidth: 300 }} aria-label="Preview">
        {/* eslint-disable-next-line @next/next/no-img-element -- live preview of an arbitrary URL */}
        {image && <img src={image} alt="" />}
        <div className={s.tourText}>
          <h3>{title || 'Slide title'}</h3>
          <p>{body || 'A sentence on what this feature does for them.'}</p>
        </div>
      </div>

      <form id="slide-form" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
        <div className="field">
          <label htmlFor="slide-title">Title</label>
          <input id="slide-title" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} {...errProps('title')} />
          <p id="slide-title-err" className="error-text" style={{ marginTop: 6 }}>{errors.title ?? ''}</p>
        </div>
        <div className="field">
          <label htmlFor="slide-body">Body</label>
          <textarea id="slide-body" rows={3} maxLength={280} value={body} onChange={e => setBody(e.target.value)} {...errProps('body')} />
          <p className="field-help">{body.trim().length}/280</p>
          <p id="slide-body-err" className="error-text">{errors.body ?? ''}</p>
        </div>
        <div className="field">
          <span className="field-label" id="slide-img-label">Image</span>
          <div className={s.imgPick} role="group" aria-labelledby="slide-img-label">
            {images.map(src => (
              <button key={src} type="button" className={s.imgOpt} aria-pressed={!custom && image === src} aria-label={src.split('/').pop()} onClick={() => { setCustom(false); setImage(src); }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny local thumbnails */}
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
            <button type="button" className={s.imgOpt} aria-pressed={custom} onClick={() => { setCustom(true); if (images.includes(image)) setImage(''); }}>
              <span>Custom URL</span>
            </button>
          </div>
          {custom && (
            <>
              <label htmlFor="slide-image_url" className="sr-only">Custom image URL</label>
              <input id="slide-image_url" type="url" inputMode="url" placeholder="https://… or /img/your-file.webp" value={image} onChange={e => setImage(e.target.value)} {...errProps('image_url')} />
            </>
          )}
          <p id="slide-image_url-err" className="error-text" style={{ marginTop: 6 }}>{errors.image_url ?? ''}</p>
          <p className="field-help">Files in public/img appear here automatically. Portrait crops (4:5) look best.</p>
        </div>
        <div className="field">
          <Switch pressed={active} label={active ? 'Active: shows in the tour' : 'Hidden from the tour'} onChange={setActive} />
        </div>
      </form>
    </Sheet>
  );
}
