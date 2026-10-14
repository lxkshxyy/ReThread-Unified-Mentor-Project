import { Calculator } from 'lucide-react';
import { formatINR } from '@/lib/utils';

/** Live output of the Swap Value Calculator (shared by listing form + calculator page). */
export default function ValuePanel({ est, value, onValue, editable = true }) {
  if (!est) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
        <Calculator className="mx-auto mb-2 h-6 w-6 text-moss" />
        Choose a category, brand and condition to see the estimated swap value.
      </div>
    );
  }
  const current = value ?? est.value;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Estimated swap value</p>
      <p className="mt-1 font-display text-5xl text-moss">{formatINR(est.value)}</p>
      <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        {est.breakdown.map((b) => (
          <li key={b.label} className="flex justify-between gap-4"><span className="text-muted">{b.label}</span><span className="font-medium">{b.value}</span></li>
        ))}
      </ul>
      {editable && onValue && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="swapValue" className="font-medium">Your swap value</label>
            <span className="font-display text-2xl">{formatINR(current)}</span>
          </div>
          <input id="swapValue" type="range" min={est.min} max={est.max} step={10} value={Math.min(est.max, Math.max(est.min, current))} onChange={(e) => onValue(Number(e.target.value))} className="mt-3 w-full accent-[rgb(var(--moss))]" />
          <div className="flex justify-between text-[11px] text-muted"><span>{formatINR(est.min)}</span><span>{formatINR(est.max)}</span></div>
          <p className="help">You can adjust ±25% (e.g. for a rare print or a small flaw). Values outside this range aren’t allowed, to keep swaps fair.</p>
        </div>
      )}
    </div>
  );
}
