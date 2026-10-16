'use client';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import s from './Welcome.module.css';

export function SlideToStart() {
  const router = useRouter();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; travel: number; start: number } | null>(null);
  const completed = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    setDone(true);
    setProgress(100);
    router.push('/login');
  };
  const reset = () => { drag.current = null; setDragging(false); if (!completed.current) setProgress(0); };
  const position = (x: number) => {
    const d = drag.current;
    return d ? Math.max(0, Math.min(100, d.start + (x - d.x) / d.travel * 100)) : 0;
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (completed.current || drag.current || !event.isPrimary || event.button !== 0) return;
    const width = track.current!.clientWidth - 12 - event.currentTarget.offsetWidth;
    if (width <= 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, travel: width, start: progress };
    setDragging(true);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const value = position(event.clientX);
    // Only a complete drag to the checkmark counts. Taps and partial drags reset.
    drag.current = null; setDragging(false);
    if (value >= 100) finish(); else setProgress(0);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (completed.current || drag.current) return;
    let value = progress;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') value = Math.min(100, progress + 10);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') value = Math.max(0, progress - 10);
    else if (event.key === 'End') value = 100;
    else if (event.key === 'Home' || event.key === 'Escape') value = 0;
    else return;
    event.preventDefault();
    if (value === 100) finish(); else setProgress(value);
  };
  return (
    <>
      <div ref={track} className={s.start} data-dragging={dragging || undefined} data-complete={done || undefined} style={{ '--slide-progress': progress / 100 } as CSSProperties}>
        <span className={s.slideLabel} aria-hidden="true">{done ? 'Opening Shoku…' : 'Slide to get started'}</span>
        <span className={`${s.circle} ${s.end}`} aria-hidden="true"><Icon name="check" /></span>
        <div className={`${s.circle} ${s.handle}`} role="slider" tabIndex={0} aria-label="Slide to get started"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={progress === 100 ? 'Complete. Opening the tour.' : `${Math.round(progress)} percent. Slide right to the checkmark.`}
          aria-orientation="horizontal" aria-describedby="slide-instructions"
          onPointerDown={down} onPointerMove={event => { if (drag.current?.id === event.pointerId) setProgress(position(event.clientX)); }}
          onPointerUp={up} onPointerCancel={reset} onLostPointerCapture={() => { if (drag.current) reset(); }}
          onKeyDown={keyDown} onBlur={() => { if (!drag.current) reset(); }}>
          <Icon name={done ? 'check' : 'arrow'} />
        </div>
      </div>
      <p id="slide-instructions" className="sr-only">Drag the arrow all the way to the checkmark and release. With a keyboard, use Right Arrow to advance or End to complete.</p>
      <noscript><p className={s.noScript}>Enable JavaScript to slide, or use Sign in above.</p></noscript>
    </>
  );
}
