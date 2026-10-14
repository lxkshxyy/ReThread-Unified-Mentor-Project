import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X, Star } from 'lucide-react';
import clsx from 'clsx';
import { initials, swapStatus } from '@/lib/utils';
import { fairnessLabel } from '@shared/catalog.js';
import { formatINR } from '@/lib/utils';

export function Logo({ className = '', light = false }) {
  return (
    <Link to="/" className={clsx('flex items-center gap-2', className)} aria-label="ReThread home">
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#2E5E4E" />
        <path d="M20 38c0-9 6-16 14-16 5 0 9 3 10 7" fill="none" stroke="#F7F4EE" strokeWidth="5" strokeLinecap="round" />
        <path d="M44 26c0 9-6 16-14 16-5 0-9-3-10-7" fill="none" stroke="#E7A07E" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 22l5 7-8 1" fill="none" stroke="#F7F4EE" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 42l-5-7 8-1" fill="none" stroke="#E7A07E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={clsx('font-display text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>ReThread</span>
    </Link>
  );
}

export function Avatar({ user, size = 36, className = '' }) {
  return (
    <span
      className={clsx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: user?.avatarColor || '#2E5E4E', fontSize: Math.max(11, size * 0.38) }}
      aria-hidden="true"
    >
      {initials(user?.name || '?')}
    </span>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-moss', className)} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner className="h-7 w-7" />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-moss-soft text-moss">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h3 className="font-display text-xl">{title}</h3>
      {children && <p className="mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = swapStatus(status);
  return <span className={clsx('badge', `tone-${s.tone}`)}>{s.label}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-lift sm:rounded-3xl sm:p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-sand" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Stars({ value = 0, size = 14, className = '' }) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-line'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} role="radio" aria-checked={value === i} onClick={() => onChange(i)} className="p-0.5">
          <Star className={clsx('h-7 w-7 transition', i <= value ? 'fill-amber-400 text-amber-400' : 'text-line hover:text-amber-300')} />
        </button>
      ))}
    </div>
  );
}

/** Two-sided value comparison used on swap screens. */
export function FairnessMeter({ left, right, leftLabel = 'You give', rightLabel = 'You get', compact = false }) {
  const a = Number(left) || 0;
  const b = Number(right) || 0;
  const score = a && b ? Math.round((Math.min(a, b) / Math.max(a, b)) * 100) : 0;
  const f = fairnessLabel(score);
  const pct = a + b ? (a / (a + b)) * 100 : 50;
  const diff = Math.abs(a - b);
  return (
    <div className={clsx('rounded-2xl border border-line bg-paper/60', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-end justify-between gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">{leftLabel}</p>
          <p className="font-display text-xl">{formatINR(a)}</p>
        </div>
        <span className={clsx('badge', `tone-${f.tone}`)}>{a && b ? `${score}% · ${f.label}` : 'Pick items'}</span>
        <div className="text-right">
          <p className="text-xs text-muted">{rightLabel}</p>
          <p className="font-display text-xl">{formatINR(b)}</p>
        </div>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
        <div className="h-full bg-moss transition-all duration-500" style={{ width: `${pct}%` }} />
        <div className="h-full w-0.5 bg-surface" />
        <div className="h-full flex-1 bg-clay transition-all duration-500" />
      </div>
      {!compact && a > 0 && b > 0 && score < 90 && (
        <p className="mt-2 text-xs text-muted">
          {a < b ? `Add about ${formatINR(diff)} more on your side for a balanced swap.` : `You're offering ${formatINR(diff)} more — you could ask for an extra item.`}
        </p>
      )}
    </div>
  );
}

export function Section({ eyebrow, title, action, children, className = '' }) {
  return (
    <section className={clsx('py-10 sm:py-14', className)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h2 className="text-3xl sm:text-4xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, error, help, children, htmlFor, optional }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label} {optional && <span className="font-normal text-muted">(optional)</span>}
        </label>
      )}
      {children}
      {error ? <p className="error-text" role="alert">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={clsx('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition', value === t.key ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
        >
          {t.label}
          {t.count > 0 && <span className={clsx('rounded-full px-1.5 text-[11px]', value === t.key ? 'bg-white/20' : 'bg-clay text-white')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
