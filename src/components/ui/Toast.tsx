'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; tone?: 'win'; undo?: () => void | Promise<void> };
type Ctx = { show: (message: string, opts?: { tone?: 'win'; undo?: () => void | Promise<void> }) => void };

const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.show;
}

/**
 * Announces via role=status. Rendered with popover="manual" and re-raised on every show, so it sits in the
 * top layer above any open modal sheet and its Undo button stays clickable.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Ctx['show']>((message, opts) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone: opts?.tone, undo: opts?.undo });
    timer.current = setTimeout(() => setToast(null), opts?.undo ? 6000 : 3300);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !toast) return;
    // If a modal sheet is open, host the toast inside it so it isn't made inert by the modal.
    const openDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const host = openDialog ?? document.body;
    const raise = () => {
      try {
        if (el.matches(':popover-open')) el.hidePopover();
        el.showPopover();
      } catch {
        /* popover unsupported: fixed positioning still works outside modals */
      }
    };
    if (el.parentElement !== host) host.appendChild(el);
    raise();
    if (!openDialog) return;
    // When the sheet closes, bring the toast back to <body> so its Undo stays visible.
    const onClose = () => {
      document.body.appendChild(el);
      raise();
    };
    openDialog.addEventListener('close', onClose, { once: true });
    return () => openDialog.removeEventListener('close', onClose);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div ref={ref} popover="manual" role="status" aria-live="polite" style={{ border: 0, padding: 0, margin: 0, background: 'transparent', inset: 'auto', overflow: 'visible' }}>
        {toast && (
          <div key={toast.id} className={`toast ${toast.tone === 'win' ? 'win' : ''}`}>
            <span>{toast.message}</span>
            {toast.undo && (
              <button type="button" onClick={async () => { const u = toast.undo; setToast(null); await u?.(); show('Undone.'); }}>Undo</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
