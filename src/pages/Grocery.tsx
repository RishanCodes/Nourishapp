import { Check, ChevronDown, ClipboardCopy, Download, Info, Package, Pencil, Plus, Printer, RotateCcw, ShoppingBasket, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getIngredient } from '../data/ingredients';
import { AISLES, type GroceryItem } from '../engine/grocery';
import { formatShopping } from '../engine/units';
import { Empty, Notice, PageHeader, Progress, Segmented, cx } from '../components/ui';
import { useGrocery, useMoney } from '../lib/hooks';
import { navigate } from '../lib/router';
import { IS_ARTIFACT, copyText } from '../lib/env';
import { useStore } from '../store/store';
import type { Aisle } from '../types';

export default function Grocery() {
  const { items, summary } = useGrocery();
  const { plan, profile, grocery, settings, addCustomGrocery, toggleCustomGrocery, removeCustomGrocery, restoreGroceryItems, clearGroceryChecks } = useStore();
  const fmt = useMoney();
  const [group, setGroup] = useState<'aisle' | 'az'>('aisle');
  const [hideDone, setHideDone] = useState(false);
  const [toast, setToast] = useState('');
  const [cName, setCName] = useState('');
  const [cQty, setCQty] = useState('');
  const [cAisle, setCAisle] = useState<Aisle>('Other');

  const toBuy = items.filter((i) => i.toBuy > 1e-6);
  const covered = items.filter((i) => i.toBuy <= 1e-6 && i.fromPantry > 0);
  const visible = toBuy.filter((i) => !hideDone || i.status !== 'done');
  const groups = useMemo(() => {
    if (group === 'az') return [['All items', [...visible].sort((a, b) => a.name.localeCompare(b.name))] as const];
    return AISLES.map((a) => [a, visible.filter((i) => i.aisle === a)] as const).filter(([, l]) => l.length);
  }, [visible, group]);

  const budgetCad = profile.weeklyBudget ? profile.weeklyBudget : null;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const asText = () => {
    const lines: string[] = ['NOURISH grocery list', ''];
    for (const a of AISLES) {
      const l = toBuy.filter((i) => i.aisle === a);
      const c = grocery.custom.filter((x) => x.aisle === a);
      if (!l.length && !c.length) continue;
      lines.push(a.toUpperCase());
      l.forEach((i) => lines.push(`${i.status === 'done' ? '[x]' : '[ ]'} ${i.name} — ${formatShopping(i.toBuy, i.dim, getIngredient(i.ingredientId), settings.units)}`));
      c.forEach((i) => lines.push(`${i.checked ? '[x]' : '[ ]'} ${i.name}${i.qty ? ` — ${i.qty}` : ''}`));
      lines.push('');
    }
    lines.push(`Food used: ${fmt(summary.total)} · Checkout in whole packages: ${fmt(summary.checkout)} (CAD estimates)`);
    return lines.join('\n');
  };
  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const csv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [['Category', 'Item', 'Quantity', 'Estimated cost (CAD, whole packages)', 'Purchased', 'Used in'].map(esc).join(',')];
    toBuy.forEach((i) => rows.push([i.aisle, i.name, formatShopping(i.toBuy, i.dim, getIngredient(i.ingredientId), settings.units), fmt(i.packCost), i.status === 'done' ? 'yes' : 'no', i.sources.map((s) => s.label).join('; ')].map(esc).join(',')));
    grocery.custom.forEach((i) => rows.push([i.aisle, i.name, i.qty, '', i.checked ? 'yes' : 'no', 'custom'].map(esc).join(',')));
    return rows.join('\n');
  };

  if (!plan) {
    return (<><PageHeader title="Grocery List" /><Empty icon={<ShoppingBasket />} title="No meal plan yet" action={<button className="btn-primary" onClick={() => navigate('planner')}>Go to planner</button>}>Your grocery list is calculated automatically from your weekly plan.</Empty></>);
  }

  return (
    <>
      <PageHeader title="Grocery List" subtitle="Calculated from this week's meal plan · updates automatically"
        actions={<>
          <button className="btn-secondary" onClick={async () => {
            if (await copyText(asText())) return flash('Grocery list copied');
            if (IS_ARTIFACT) return flash('Copying was blocked by your browser');
            download('nourish-grocery-list.txt', asText(), 'text/plain'); flash('Clipboard unavailable, so the list was downloaded');
          }}><ClipboardCopy size={16} /> Copy list</button>
          {IS_ARTIFACT ? (
            <button className="btn-secondary" onClick={async () => flash((await copyText(csv())) ? 'CSV copied. Paste it into a spreadsheet.' : 'Copying was blocked by your browser')}><Download size={16} /> Copy as CSV</button>
          ) : (<>
            <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
            <button className="btn-secondary" onClick={() => { download('nourish-grocery-list.csv', csv(), 'text/csv'); flash('Exported CSV'); }}><Download size={16} /> Export CSV</button>
          </>)}
        </>} />

      {toast && <div role="status" className="no-print animate-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-sand-100 dark:text-ink-900 lg:bottom-8">{toast}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
        <div className="order-2 space-y-5 lg:order-1">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <Segmented options={['aisle', 'az'] as const} value={group} onChange={setGroup} labels={{ aisle: 'By category', az: 'A–Z' }} size="sm" />
            <div className="flex gap-1">
              <button className={cx('btn-ghost btn-sm', hideDone && 'bg-sand-200/70 dark:bg-white/10')} onClick={() => setHideDone(!hideDone)}>{hideDone ? 'Show purchased' : 'Hide purchased'}</button>
              <button className="btn-ghost btn-sm" onClick={clearGroceryChecks}><RotateCcw size={13} /> Uncheck all</button>
            </div>
          </div>

          {groups.length === 0 && <Notice tone="ok" icon={<Check size={16} />}>{toBuy.length ? 'Everything is purchased — nice work!' : 'Nothing to buy — your pantry covers this plan.'}</Notice>}
          {groups.map(([name, list]) => (
            <section key={name} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-sand-200 bg-sand-50/60 px-4 py-2.5 dark:border-white/5 dark:bg-white/[.02]">
                <h2 className="text-sm font-semibold">{name}</h2>
                <span className="text-xs muted">{list.length} item{list.length === 1 ? '' : 's'} · ≈ {fmt(list.reduce((s, i) => s + i.cost, 0))}</span>
              </header>
              <ul className="divide-y divide-sand-200 dark:divide-white/5">
                {list.map((i) => <GroceryRow key={i.key} item={i} />)}
                {group === 'aisle' && grocery.custom.filter((c) => c.aisle === name).map((c) => (
                  <CustomRow key={c.uid} c={c} onToggle={() => toggleCustomGrocery(c.uid)} onRemove={() => removeCustomGrocery(c.uid)} />
                ))}
              </ul>
            </section>
          ))}
          {(group === 'az' ? grocery.custom : grocery.custom.filter((c) => !groups.some(([n]) => n === c.aisle))).length > 0 && (
            <section className="card overflow-hidden">
              <header className="border-b border-sand-200 px-4 py-2.5 text-sm font-semibold dark:border-white/5">Your extra items</header>
              <ul className="divide-y divide-sand-200 dark:divide-white/5">
                {(group === 'az' ? grocery.custom : grocery.custom.filter((c) => !groups.some(([n]) => n === c.aisle))).map((c) => <CustomRow key={c.uid} c={c} onToggle={() => toggleCustomGrocery(c.uid)} onRemove={() => removeCustomGrocery(c.uid)} />)}
              </ul>
            </section>
          )}

          <form className="no-print card grid gap-2 p-4 sm:grid-cols-[1fr,7rem,11rem,auto]" onSubmit={(e) => { e.preventDefault(); addCustomGrocery(cName, cQty, cAisle); setCName(''); setCQty(''); }}>
            <input className="input" placeholder="Add an item (e.g. paper towels)" value={cName} onChange={(e) => setCName(e.target.value)} aria-label="Custom item name" />
            <input className="input" placeholder="Qty" value={cQty} onChange={(e) => setCQty(e.target.value)} aria-label="Custom item quantity" />
            <select className="input" value={cAisle} onChange={(e) => setCAisle(e.target.value as Aisle)} aria-label="Category">{AISLES.map((a) => <option key={a}>{a}</option>)}</select>
            <button className="btn-primary" disabled={!cName.trim()}><Plus size={16} /> Add</button>
          </form>

          {covered.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Package size={15} className="text-sage-600" /> Covered by your pantry</h2>
              <ul className="flex flex-wrap gap-1.5">{covered.map((i) => <li key={i.key} className="tag">{i.name} · {formatShopping(i.required, i.dim, getIngredient(i.ingredientId), settings.units)}</li>)}</ul>
            </section>
          )}
          {grocery.removed.length > 0 && <button className="no-print btn-ghost btn-sm" onClick={restoreGroceryItems}><RotateCcw size={13} /> Restore {grocery.removed.length} removed item{grocery.removed.length === 1 ? '' : 's'}</button>}
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <div className="card p-5 lg:sticky lg:top-8">
            <p className="text-xs font-semibold uppercase tracking-wide muted">Shopping progress</p>
            <p className="mt-1 font-display text-3xl font-semibold">{summary.done}<span className="text-lg muted"> / {summary.count}</span></p>
            <div className="mt-3"><Progress value={summary.progress} label="Shopping progress" /></div>
            <div className="mt-5 flex items-baseline justify-between">
              <span className="text-sm">Food used this week</span>
              <span className="font-display text-xl font-semibold">{fmt(summary.total)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="muted" title="If you buy every remaining item new, in typical package sizes">Checkout, whole packages</span>
              <span className="tabular-nums">{fmt(summary.checkout)}</span>
            </div>
            {budgetCad != null && (
              <>
                <div className="mt-2 flex items-baseline justify-between text-sm"><span className="muted">Weekly budget</span><span>{fmt(budgetCad)}</span></div>
                <div className="mt-2"><Progress value={summary.total / budgetCad} label="Budget used" /></div>
                <p className={cx('mt-2 text-xs', summary.total > budgetCad ? 'text-clay-600 dark:text-clay-300' : 'text-sage-700 dark:text-sage-300')}>
                  {summary.total > budgetCad ? `About ${fmt(summary.total - budgetCad)} over budget — try “Give me cheaper meals” on the planner.` : `About ${fmt(budgetCad - summary.total)} under budget.`}
                </p>
              </>
            )}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer select-none text-xs font-medium muted">Cost by category</summary>
              <ul className="mt-2 space-y-1">{Object.entries(summary.byAisle).sort((a, b) => b[1] - a[1]).map(([a, v]) => <li key={a} className="flex justify-between text-xs"><span>{a}</span><span className="tabular-nums">{fmt(v)}</span></li>)}</ul>
            </details>
            <p className="hint mt-4 flex gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />All prices are rough estimates in Canadian dollars. “Food used” counts only what this week's recipes use; the checkout figure assumes you buy every item new in typical package sizes, so staples you already own (spices, oils) make it look higher. Add those to your pantry to remove them.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function GroceryRow({ item: i }: { item: GroceryItem }) {
  const { setChecked, setOverride, removeGroceryItem, settings } = useStore();
  const fmt = useMoney();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const ing = getIngredient(i.ingredientId);
  const baseUnit = i.dim === 'mass' ? 'g' : i.dim === 'volume' ? 'ml' : ing?.countLabel ?? 'pc';
  const [val, setVal] = useState(String(Math.round(i.toBuy * 10) / 10));
  const done = i.status === 'done';
  return (
    <li className={cx('px-3 py-2.5 sm:px-4', done && 'bg-sand-50/50 dark:bg-white/[.02]')}>
      <div className="flex items-center gap-3">
        <button role="checkbox" aria-checked={done} aria-label={`${done ? 'Unmark' : 'Mark'} ${i.name} as purchased`} onClick={() => setChecked(i.key, done ? null : i.toBuy)}
          className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition', done ? 'border-sage-600 bg-sage-600 text-white dark:border-sage-500 dark:bg-sage-500 dark:text-ink-950' : i.status === 'partial' ? 'border-clay-400' : 'border-sand-300 hover:border-sage-500 dark:border-white/20')}>
          {done && <Check size={16} strokeWidth={3} />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={cx('block text-sm font-medium', done && 'line-through opacity-60')}>{i.name}{i.labelCheck && <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-clay-500" title="Check the label for allergens">label</span>}</span>
          <span className="block text-xs muted">
            {i.status === 'partial' ? `Bought ${formatShopping(i.boughtQty, i.dim, ing, settings.units)} · need ${formatShopping(i.toBuy - i.boughtQty, i.dim, ing, settings.units)} more` : `${i.sources.length} meal${i.sources.length === 1 ? '' : 's'}`}
            {i.fromPantry > 0 && ` · ${formatShopping(i.fromPantry, i.dim, ing, settings.units)} from pantry`}
            {i.overridden && ' · edited'}
          </span>
        </button>
        {editing ? (
          <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const n = Number(val); setOverride(i.key, Number.isFinite(n) && n >= 0 ? n : null); setEditing(false); }}>
            <input autoFocus type="number" min={0} step="any" className="input w-20 px-2 py-1.5 text-right" value={val} onChange={(e) => setVal(e.target.value)} aria-label={`Quantity of ${i.name} in ${baseUnit}`} />
            <span className="text-xs muted">{baseUnit}</span>
            <button className="icon-btn h-8 w-8" aria-label="Save quantity"><Check size={15} /></button>
            <button type="button" className="icon-btn h-8 w-8" aria-label="Cancel" onClick={() => setEditing(false)}><X size={15} /></button>
          </form>
        ) : (
          <div className="text-right">
            <span className="block text-sm font-semibold tabular-nums">{formatShopping(i.toBuy, i.dim, ing, settings.units)}</span>
            <span className="block text-[11px] muted tabular-nums">{i.packSize ? `${i.packs} × ${formatShopping(i.packSize, i.dim, ing, settings.units)} pack${i.packs > 1 ? 's' : ''} · ≈ ${fmt(i.packCost)}` : `≈ ${fmt(i.cost)}`}</span>
          </div>
        )}
        <ChevronDown size={15} className={cx('no-print hidden shrink-0 transition sm:block muted', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="no-print animate-in ml-10 mt-2 space-y-2 rounded-xl bg-sand-50 p-3 text-xs dark:bg-white/5">
          <p className="font-medium">Needed for</p>
          <ul className="space-y-0.5">{i.sources.map((s, k) => <li key={k} className="flex justify-between gap-2"><span>{s.label}</span><span className="tabular-nums muted">{formatShopping(s.qty, i.dim, ing, settings.units)}</span></li>)}</ul>
          <p className="muted">Total needed {formatShopping(i.required, i.dim, ing, settings.units)}{i.fromPantry > 0 && `, minus ${formatShopping(i.fromPantry, i.dim, ing, settings.units)} in pantry`}.</p>
          {i.labelCheck && <p className="text-clay-600 dark:text-clay-300">Packaged item — check the label for allergens and cross-contact warnings.</p>}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button className="btn-secondary btn-sm" onClick={() => { setVal(String(Math.round(i.toBuy * 10) / 10)); setEditing(true); }}><Pencil size={12} /> Edit quantity</button>
            {i.overridden && <button className="btn-ghost btn-sm" onClick={() => setOverride(i.key, null)}><RotateCcw size={12} /> Use calculated</button>}
            <button className="btn-ghost btn-sm text-red-600 dark:text-red-400" onClick={() => removeGroceryItem(i.key)}><Trash2 size={12} /> Remove</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CustomRow({ c, onToggle, onRemove }: { c: { uid: string; name: string; qty: string; checked: boolean }; onToggle: () => void; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <button role="checkbox" aria-checked={c.checked} aria-label={`Mark ${c.name} as purchased`} onClick={onToggle}
        className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2', c.checked ? 'border-sage-600 bg-sage-600 text-white dark:bg-sage-500 dark:text-ink-950' : 'border-sand-300 dark:border-white/20')}>
        {c.checked && <Check size={16} strokeWidth={3} />}
      </button>
      <span className={cx('flex-1 text-sm font-medium', c.checked && 'line-through opacity-60')}>{c.name}<span className="ml-2 text-xs font-normal muted">custom</span></span>
      <span className="text-sm">{c.qty}</span>
      <button className="no-print icon-btn h-8 w-8" aria-label={`Remove ${c.name}`} onClick={onRemove}><Trash2 size={14} /></button>
    </li>
  );
}
