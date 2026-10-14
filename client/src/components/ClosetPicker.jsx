import clsx from 'clsx';
import { Check } from 'lucide-react';
import { formatINR, condShort } from '@/lib/utils';

/** Selectable grid of items (max N) used for offers and counter-offers. */
export default function ClosetPicker({ items, selected, onChange, max = 3, emptyText = 'No items available' }) {
  if (!items?.length) return <p className="rounded-xl bg-sand/60 p-4 text-sm text-muted">{emptyText}</p>;
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => {
        const on = selected.includes(it._id);
        const disabled = !on && selected.length >= max;
        return (
          <button
            type="button"
            key={it._id}
            onClick={() => toggle(it._id)}
            disabled={disabled}
            aria-pressed={on}
            className={clsx('relative overflow-hidden rounded-xl border-2 bg-surface text-left transition', on ? 'border-moss shadow-card' : 'border-transparent hover:border-line', disabled && 'opacity-40')}
          >
            <div className="aspect-[4/5] bg-sand">
              <img src={it.images?.[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <span className={clsx('absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2', on ? 'border-moss bg-moss text-white' : 'border-white bg-white/80')}>
              {on && <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="p-2">
              <p className="truncate text-xs font-medium">{it.title}</p>
              <p className="text-[11px] text-muted">{it.size ? `${it.size} · ` : ''}{it.condition ? condShort(it.condition) : ''}</p>
              <p className="text-xs font-semibold text-moss">{formatINR(it.swapValue)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
