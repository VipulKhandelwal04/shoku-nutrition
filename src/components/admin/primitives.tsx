'use client';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { ActionResult } from '@/lib/admin/schemas';
import s from './admin.module.css';

/** On/off control: a button with aria-pressed. The visible label names the setting; the text shows state. */
export function Switch({ pressed, onChange, label, hideLabel, disabled, describedBy }: {
  pressed: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button type="button" className={s.switch} aria-pressed={pressed} onClick={() => onChange(!pressed)} disabled={disabled} aria-describedby={describedBy}>
      <span className={s.track} aria-hidden="true" />
      {hideLabel ? (
        <>
          <span className="sr-only">{label}</span>
          <span className={s.switchText} aria-hidden="true">{pressed ? 'On' : 'Off'}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

/**
 * Runs a server action with a pending flag and toast feedback. Returns the result so callers can read
 * field errors. `undo` adds an Undo button to the success toast.
 */
export function useAdminAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<ActionResult>, opts: { success?: string; undo?: () => Promise<ActionResult>; onDone?: (r: ActionResult) => void } = {}) => {
      start(async () => {
        let r: ActionResult;
        try {
          r = await fn();
        } catch {
          r = { ok: false, error: 'Something went wrong on the server. Try again.' };
        }
        if (r.ok) {
          const undo = opts.undo;
          toast(r.message ?? opts.success ?? 'Saved.', undo ? { undo: async () => { const u = await undo(); return u; } } : undefined);
        } else {
          toast(r.error);
        }
        opts.onDone?.(r);
      });
    },
    [toast],
  );
  return { run, pending };
}

/**
 * Confirmation for destructive actions on the native <dialog> (alertdialog semantics). Focus starts on
 * Cancel so Enter never destroys by accident; focus returns to the opener on close.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, tone = 'danger' }: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'default';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      confirmed.current = false;
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={s.confirm}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onClose={() => {
        if (!confirmed.current) onCancel();
        const el = returnTo.current;
        if (el && document.contains(el)) requestAnimationFrame(() => el.focus({ preventScroll: true }));
      }}
    >
      {open && (
        <>
          <div className={s.confirmBody}>
            <h2 id="confirm-title">{title}</h2>
            <div id="confirm-desc">{children}</div>
          </div>
          <div className={s.confirmFoot}>
            <button ref={cancelRef} type="button" className="btn-secondary" onClick={() => ref.current?.close()}>Cancel</button>
            <button
              type="button"
              className={`btn-secondary ${tone === 'danger' ? s.dangerSolid : ''}`}
              onClick={() => { confirmed.current = true; ref.current?.close(); onConfirm(); }}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

/** State helper for a single pending confirmation. */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, ask: setTarget, close: () => setTarget(null) };
}
