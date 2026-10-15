'use client';
import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type UndoResult = { ok: true } | { ok: false; error: string };
type Toast = { id: number; message: string; tone?: 'win'; undo?: () => Promise<UndoResult> };
type Ctx = { show: (message: string, opts?: Omit<Toast, 'id' | 'message'>) => void };
const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.show;
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(toast.message);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const running = useRef(false);
  // Recovery actions never expire and survive subsequent notifications.
  useEffect(() => {
    if (toast.undo || paused) return;
    const timer = setTimeout(() => dismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.undo, paused, dismiss]);

  async function undo() {
    if (!toast.undo || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await toast.undo();
      setMessage(result.ok ? 'Undone.' : result.error);
      setFinished(result.ok);
    } catch {
      setMessage('Couldn’t undo that. Check your connection and try again.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={`toast ${toast.tone === 'win' && !finished ? 'win' : ''}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
      <span role="status" aria-live="polite" aria-atomic="true">{message}</span>
      {toast.undo && !finished && <button type="button" onClick={undo} disabled={busy} aria-busy={busy}>{busy ? 'Undoing…' : 'Undo'}</button>}
      <button type="button" disabled={busy} aria-label={`Dismiss notification: ${toast.message}`} onClick={() => dismiss(toast.id)}>Dismiss</button>
    </div>
  );
}

/** Persistent recovery notifications in the top layer, including inside modal sheets. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = useCallback<Ctx['show']>((message, opts) => {
    const id = ++nextId.current;
    setToasts(items => [...items, { id, message, ...opts }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(items => items.filter(t => t.id !== id)), []);

  useEffect(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    // The external portal host must be created after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortal(container);
    return () => container.remove();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !portal) return;
    if (!toasts.length) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    const openDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const host = openDialog ?? document.body;
    const raise = () => {
      try {
        if (el.matches(':popover-open')) el.hidePopover();
        el.showPopover();
      } catch { /* Fixed positioning remains available without popover support. */ }
    };
    if (portal.parentElement !== host) host.appendChild(portal);
    raise();
    if (!openDialog) return;
    const onClose = () => { document.body.appendChild(portal); raise(); };
    openDialog.addEventListener('close', onClose, { once: true });
    return () => openDialog.removeEventListener('close', onClose);
  }, [toasts, portal]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {portal && createPortal(<div ref={ref} popover="manual" style={{ border: 0, padding: 0, margin: 0, background: 'transparent', inset: 'auto', overflow: 'visible' }}>
        <div className="toast-stack" aria-label="Notifications">
          {toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
        </div>
      </div>, portal)}
    </ToastContext.Provider>
  );
}
