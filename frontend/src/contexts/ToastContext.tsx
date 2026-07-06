'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';

/* ── types ──────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastCtx {
  success: (message: string) => void;
  error:   (message: string) => void;
  warn:    (message: string) => void;
  info:    (message: string) => void;
}

/* ── context ─────────────────────────────────────────────────── */

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ── styling maps ────────────────────────────────────────────── */

const VARIANT_STYLE: Record<ToastVariant, { container: string; icon: ReactNode }> = {
  success: {
    container: 'bg-[var(--low-bg)] border-[var(--success)]',
    icon: <CheckCircle size={18} className="shrink-0" style={{ color: 'var(--success)' }} />,
  },
  error: {
    container: 'bg-[var(--high-bg)] border-[var(--danger)]',
    icon: <XCircle size={18} className="shrink-0" style={{ color: 'var(--danger)' }} />,
  },
  warn: {
    container: 'bg-[var(--med-bg)] border-[var(--warn)]',
    icon: <AlertTriangle size={18} className="shrink-0" style={{ color: 'var(--warn)' }} />,
  },
  info: {
    container: 'bg-[var(--bg-sand)] border-[var(--border)]',
    icon: <Info size={18} className="shrink-0" style={{ color: 'var(--ink)' }} />,
  },
};

/* ── single toast item ───────────────────────────────────────── */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { container, icon } = VARIANT_STYLE[toast.variant];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'pointer-events-auto flex items-start gap-3 px-4 py-3',
        'rounded-xl border shadow-[var(--shadow-md)]',
        'animate-[toast-in_200ms_ease]',
        container,
      ].join(' ')}
      style={{ minWidth: '260px', maxWidth: '360px' }}
    >
      {icon}
      <p className="flex-1 text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ── toaster (rendered in layout) ───────────────────────────── */

export function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/* ── provider ────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const baseId = useId();
  let counter = 0;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = `${baseId}-${++counter}`;
      setToasts((prev) => {
        const next = [{ id, variant, message }, ...prev].slice(0, 4); // max 4
        return next;
      });
      setTimeout(() => dismiss(id), 4000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dismiss, baseId],
  );

  const ctx: ToastCtx = {
    success: (m) => push('success', m),
    error:   (m) => push('error',   m),
    warn:    (m) => push('warn',    m),
    info:    (m) => push('info',    m),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </Ctx.Provider>
  );
}
