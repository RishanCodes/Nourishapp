import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" aria-pressed={on} title={title} onClick={onClick} className={on ? 'chip-on' : 'chip-off'}>
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, multi = true, labels }: {
  options: readonly T[]; value: T[]; onChange: (v: T[]) => void; multi?: boolean; labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} on={value.includes(o)} onClick={() => {
          if (!multi) return onChange([o]);
          onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
        }}>{labels?.[o] ?? o}</Chip>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, labels, size = 'md' }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<string, string>>; size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-xl border border-sand-300 bg-sand-50 p-1 dark:border-white/10 dark:bg-white/5">
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cx('rounded-lg font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-sand-50' : 'text-ink-700/70 hover:text-ink-900 dark:text-sand-200/60 dark:hover:text-sand-50')}>
          {labels?.[String(o)] ?? String(o)}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="hint mt-0.5 block">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block h-6 w-11 rounded-full bg-sand-300 transition peer-checked:bg-sage-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sage-500/50 dark:bg-white/15 dark:peer-checked:bg-sage-500" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="hint mt-1.5">{hint}</p>}
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, placeholder, id, suffix, ariaLabel }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string; id?: string; suffix?: string; ariaLabel?: string;
}) {
  const invalid = value != null && ((min != null && value < min) || (max != null && value > max));
  return (
    <div className="relative">
      <input id={id} aria-label={ariaLabel} type="number" inputMode="decimal" className={cx('input', suffix && 'pr-12', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/20')}
        value={value ?? ''} min={min} max={max} step={step} placeholder={placeholder} aria-invalid={invalid}
        onChange={(e) => { const v = e.target.value; onChange(v === '' ? null : Number(v)); }} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs muted">{suffix}</span>}
      {invalid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enter a value between {min} and {max}.</p>}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const parts = raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
  };
  return (
    <div>
      <div className="input flex min-h-[44px] flex-wrap items-center gap-1.5 py-1.5" onClick={() => ref.current?.focus()}>
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-sage-100 px-2 py-1 text-xs font-medium text-sage-800 dark:bg-sage-500/20 dark:text-sage-200">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="opacity-60 hover:opacity-100"><X size={12} /></button>
          </span>
        ))}
        <input ref={ref} className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none" placeholder={value.length ? '' : placeholder}
          onKeyDown={(e) => {
            const t = e.currentTarget;
            if ((e.key === 'Enter' || e.key === ',') && t.value.trim()) { e.preventDefault(); add(t.value); t.value = ''; }
            if (e.key === 'Backspace' && !t.value && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={(e) => { if (e.target.value.trim()) { add(e.target.value); e.target.value = ''; } }} />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !value.includes(s)).slice(0, 10).map((s) => (
            <button key={s} type="button" onClick={() => onChange([...value, s])} className="rounded-lg border border-dashed border-sand-300 px-2 py-0.5 text-xs muted hover:border-sage-500 hover:text-sage-700 dark:border-white/10">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Accessible dialog that becomes a bottom sheet on small screens. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={cx('animate-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-ink-900 sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between gap-3 border-b border-sand-200 px-5 py-4 dark:border-white/5">
          <div className="mx-auto h-1 w-10 rounded-full bg-sand-300 sm:hidden absolute left-1/2 top-2 -translate-x-1/2 dark:bg-white/10" />
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-sand-200 px-5 py-3 dark:border-white/5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage-700 dark:bg-sage-500/15 dark:text-sage-300">{icon}</div>
      <h3 className="section-title">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-sand-200 dark:bg-white/10">
      <div className="h-full rounded-full bg-sage-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode; icon?: ReactNode }) {
  const cls = tone === 'warn'
    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100'
    : tone === 'ok'
      ? 'border-sage-200 bg-sage-50 text-sage-900 dark:border-sage-400/20 dark:bg-sage-400/10 dark:text-sage-100'
      : 'border-sand-200 bg-sand-50 text-ink-800 dark:border-white/10 dark:bg-white/5 dark:text-sand-100';
  return <div className={cx('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', cls)}>{icon && <span className="mt-0.5 shrink-0">{icon}</span>}<div className="min-w-0">{children}</div></div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-sand-50 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
