import { AlertTriangle, Package, Plus, Repeat, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { INGREDIENTS, getIngredient } from '../data/ingredients';
import { getRecipe } from '../data/recipes';
import { DAYS_SHORT, SLOT_LABEL, SLOT_ORDER, leftoverServings } from '../engine/planner';
import { UNITS } from '../engine/units';
import { Empty, Notice, PageHeader, cx } from '../components/ui';
import { useGrocery } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Unit } from '../types';

const daysUntil = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
};

export default function Pantry() {
  const { pantry, addPantry, updatePantry, removePantry, plan } = useStore();
  const { items } = useGrocery();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');

  const byName = useMemo(() => new Map(INGREDIENTS.map((i) => [i.name.toLowerCase(), i])), []);
  const usedIds = new Set(items.map((i) => i.ingredientId));

  const submit = () => {
    const n = Number(qty);
    if (!name.trim()) return setError('Enter an ingredient.');
    if (!Number.isFinite(n) || n <= 0) return setError('Enter a quantity greater than zero.');
    const ing = byName.get(name.trim().toLowerCase());
    addPantry({ ingredientId: ing?.id ?? null, name: ing?.name ?? name.trim(), qty: n, unit, expires: expires || undefined });
    setName(''); setQty(''); setExpires(''); setError('');
  };

  const leftovers = plan ? plan.days.flatMap((d, di) => SLOT_ORDER.filter((s) => d[s] && leftoverServings(plan, d[s]!.uid) > 0).map((s) => ({ di, s, m: d[s]! }))) : [];
  const sorted = [...pantry].sort((a, b) => (daysUntil(a.expires) ?? 999) - (daysUntil(b.expires) ?? 999));

  return (
    <>
      <PageHeader title="Pantry" subtitle="Ingredients you already have are subtracted from your grocery list." />
      <div className="grid gap-5 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          <form className="card grid gap-2 p-4 sm:grid-cols-[1fr,6rem,6rem,10rem,auto]" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div>
              <input list="pantry-ingredients" className="input" placeholder="Ingredient (e.g. Basmati / long-grain rice)" value={name}
                onChange={(e) => { setName(e.target.value); const ing = byName.get(e.target.value.toLowerCase()); if (ing) setUnit(ing.dim === 'count' ? 'pc' : ing.dim === 'volume' ? 'ml' : 'g'); }} aria-label="Ingredient" />
              <datalist id="pantry-ingredients">{INGREDIENTS.map((i) => <option key={i.id} value={i.name} />)}</datalist>
            </div>
            <input type="number" min={0} step="any" className="input" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <input type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} aria-label="Expiry date (optional)" title="Expiry date (optional)" />
            <button className="btn-primary"><Plus size={16} /> Add</button>
            {error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-5" role="alert">{error}</p>}
            <p className="hint sm:col-span-5">Pick a suggested ingredient so NOURISH can match it to recipes. Free-text items are stored but can't be subtracted automatically.</p>
          </form>

          {sorted.length === 0 ? (
            <Empty icon={<Package />} title="Your pantry is empty">NOURISH never assumes you own an ingredient. Add what you have — like rice, oats or spices — to shrink your grocery list.</Empty>
          ) : (
            <ul className="card divide-y divide-sand-200 dark:divide-white/5">
              {sorted.map((p) => {
                const ing = p.ingredientId ? getIngredient(p.ingredientId) : undefined;
                const dleft = daysUntil(p.expires);
                const inPlan = p.ingredientId && usedIds.has(p.ingredientId);
                return (
                  <li key={p.uid} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs muted">
                        {ing ? ing.aisle : 'Not matched to recipes'}
                        {inPlan && <span className="text-sage-700 dark:text-sage-300"> · used this week</span>}
                        {dleft != null && <span className={cx(dleft <= 2 && 'font-medium text-clay-600 dark:text-clay-300')}> · {dleft < 0 ? `expired ${-dleft}d ago` : dleft === 0 ? 'expires today' : `expires in ${dleft}d`}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={0} step="any" className="input w-24 py-1.5 text-right" value={p.qty} aria-label={`${p.name} quantity`}
                        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) updatePantry(p.uid, { qty: n }); }} />
                      <select className="input w-20 py-1.5" value={p.unit} onChange={(e) => updatePantry(p.uid, { unit: e.target.value as Unit })} aria-label={`${p.name} unit`}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                      <button className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => removePantry(p.uid)}><Trash2 size={15} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {sorted.some((p) => (daysUntil(p.expires) ?? 99) <= 2) && <Notice tone="warn" icon={<AlertTriangle size={16} />}>Some items expire soon. Try “Use the … in my pantry” on the planner to prioritise recipes with them.</Notice>}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title flex items-center gap-2"><Repeat size={17} className="text-sage-600" /> Batch cooking &amp; leftovers</h2>
            {leftovers.length === 0 ? <p className="mt-2 text-sm muted">No planned leftovers this week. Turn on leftovers or meal prep in My Profile.</p> : (
              <ul className="mt-3 space-y-3 text-sm">
                {leftovers.map(({ di, s, m }) => {
                  const r = getRecipe(m.recipeId)!;
                  return (
                    <li key={m.uid} className="rounded-xl bg-sand-50 p-3 dark:bg-white/5">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs muted">Cook on {DAYS_SHORT[di]} ({SLOT_LABEL[s].toLowerCase()}): {m.servings + leftoverServings(plan!, m.uid)} servings, {leftoverServings(plan!, m.uid)} saved.</p>
                      <p className="mt-1 text-xs">{r.storage}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="hint mt-3">Leftover portions are cooked with the original meal, so their ingredients are counted only once on your grocery list.</p>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="section-title mb-2">Food safety basics</h2>
            <ul className="list-disc space-y-1 pl-4 muted">
              <li>Refrigerate cooked food within 2 hours.</li>
              <li>Most cooked leftovers keep 3–4 days in the fridge.</li>
              <li>Reheat leftovers until steaming hot (74 °C / 165 °F).</li>
              <li>Freeze portions you won't eat within 3 days.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
