'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Accessible bottom sheet / modal on the native <dialog>.
 * Focus moves into the sheet on open and returns to the element that opened it on close.
 * Render <Toaster/> output inside a sheet is not needed: the toast lives in the top layer via ToastProvider.
 */
export function Sheet({ open, onClose, title, children, footer, onBack, labelledBy = 'sheet-title' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      onClose={() => {
        onClose();
        const el = returnTo.current;
        if (el && document.contains(el)) requestAnimationFrame(() => el.focus({ preventScroll: true }));
      }}
      onClick={e => {
        // Click on the backdrop (outside the dialog box) closes it.
        if (e.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) ref.current.close();
      }}
    >
      {open && (
        <>
          <div className="sheet-head">
            {onBack && <button type="button" className="btn-icon" onClick={onBack} aria-label="Back"><Icon name="back" /></button>}
            <h2 id={labelledBy}>{title}</h2>
            <button type="button" className="btn-icon" onClick={() => ref.current?.close()} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
