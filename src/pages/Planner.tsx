import {
  ArrowRightLeft, Bookmark, CalendarRange, Check, ChevronDown, Dumbbell, FolderOpen, Heart, Lock, LockOpen, Minus,
  MoreHorizontal, PenLine, Plus, RefreshCw, Repeat, Rows3, Search, Sparkles, Trash2, TriangleAlert, Trophy, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { INGREDIENTS, getIngredient } from '../data/ingredients';
import { getRecipe } from '../data/recipes';
import { recipeCostPerServing } from '../engine/cost';
import { checkRecipeDiet } from '../engine/diet';
import { DAYS, DAYS_SHORT, SLOT_LABEL, SLOT_ORDER, alternatives, dayContext, leftoverServings, weekdayOf } from '../engine/planner';
import { UNITS } from '../engine/units';
import { CommandBar } from '../components/CommandBar';
import { DietBadges, RecipeDetail, RecipeVisual, tagLabel, timeLabel } from '../components/RecipeBits';
import { Dialog, Empty, Notice, PageHeader, Segmented, cx } from '../components/ui';
import { useMoney } from '../lib/hooks';
import { useStore } from '../store/store';
import type { PlannedMeal, Recipe, RecipeIngredient, SlotId, Unit, Weekday } from '../types';

type Target = { day: number; slot: SlotId };

export default function Planner() {
  const plan = useStore((s) => s.plan);
  const profile = useStore((s) => s.profile);
  const generate = useStore((s) => s.generate);
  const regenerateDay = useStore((s) => s.regenerateDay);
  const [view, setView] = useState<'day' | 'week'>(() => (typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'week' : 'day'));
  const [day, setDay] = useState<number>(() => weekdayOf(new Date()));
  const [swap, setSwap] = useState<Target | null>(null);
  const [move, setMove] = useState<Target | null>(null);
  const [custom, setCustom] = useState<Target | null>(null);
  const [detail, setDetail] = useState<{ recipe: Recipe; servings: number } | null>(null);
  const [plans, setPlans] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [why, setWhy] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  const lockedCount = plan ? plan.days.reduce((n, d) => n + Object.values(d).filter((m) => m?.locked).length, 0) : 0;

  if (!plan) {
    return (
      <>
        <PageHeader title="Weekly Planner" />
        <Empty icon={<CalendarRange />} title="No plan yet" action={<button className="btn-primary" onClick={() => generate()}><Sparkles size={16} /> Generate my week</button>}>
          Create a personalised seven-day plan from your profile.
        </Empty>
      </>
    );
  }

  const handlers = { onSwap: setSwap, onMove: setMove, onCustom: setCustom, onOpen: (r: Recipe, s: number) => setDetail({ recipe: r, servings: s }) };

  return (
    <>
      <PageHeader title="Weekly Planner" subtitle={`Monday – Sunday · ${lockedCount} locked meal${lockedCount === 1 ? '' : 's'}`}
        actions={<>
          <button className="btn-secondary" onClick={() => setPlans(true)}><FolderOpen size={16} /> Saved plans</button>
          <button className="btn-secondary" onClick={() => setSlotsOpen(true)}><Rows3 size={16} /> Meal slots</button>
          <button className="btn-primary" onClick={() => generate()} title="Locked meals stay unchanged"><RefreshCw size={16} /> New week</button>
        </>} />

      <div className="space-y-4">
        <CommandBar />
        <div className="card p-4">
          <button className="flex w-full items-center justify-between text-left" onClick={() => setWhy(!why)} aria-expanded={why}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-sage-600" /> Why this plan</span>
            <ChevronDown size={16} className={cx('transition', why && 'rotate-180')} />
          </button>
          {why && (
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
              {plan.explanation.map((e) => <li key={e} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage-400" />{e}</li>)}
            </ul>
          )}
          {plan.warnings.length > 0 && <div className="mt-3 space-y-2">{plan.warnings.map((w) => <Notice key={w} tone="warn" icon={<TriangleAlert size={16} />}>{w}</Notice>)}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented options={['day', 'week'] as const} value={view} onChange={setView} labels={{ day: 'Day view', week: 'Week view' }} size="sm" />
          {view === 'day' && <button className="btn-ghost btn-sm" onClick={() => regenerateDay(day)}><RefreshCw size={14} /> Regenerate {DAYS[day]}</button>}
        </div>

        {view === 'day' ? (
          <>
            <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Day">
              {DAYS_SHORT.map((d, i) => {
                const ctx = dayContext(profile, i as Weekday);
                return (
                  <button key={d} role="tab" aria-selected={day === i} onClick={() => setDay(i)}
                    className={cx('relative rounded-xl py-2.5 text-center text-xs font-semibold transition sm:text-sm', day === i ? 'bg-sage-600 text-white dark:bg-sage-500 dark:text-ink-950' : 'bg-white text-ink-700 hover:bg-sand-50 dark:bg-white/5 dark:text-sand-200')}>
                    {d}
                    {i === weekdayOf(new Date()) && <span className="block text-[10px] font-normal opacity-80">Today</span>}
                    {ctx.isTraining && <span className={cx('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', ctx.isGame ? 'bg-clay-500' : 'bg-sage-400', day === i && 'bg-white')} />}
                  </button>
                );
              })}
            </div>
            <DayColumn day={day} {...handlers} />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DAYS.map((_, i) => (
              <div key={i} className="card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <DayTitle day={i} compact />
                  <button className="icon-btn h-8 w-8" aria-label={`Regenerate ${DAYS[i]}`} title="Regenerate day" onClick={() => regenerateDay(i)}><RefreshCw size={14} /></button>
                </div>
                <div className="space-y-1.5">
                  {dayContext(profile, i as Weekday).slots.map((s) => <CompactMeal key={s} day={i} slot={s} {...handlers} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {swap && <SwapDialog target={swap} onClose={() => setSwap(null)} onCustom={() => { setCustom(swap); setSwap(null); }} />}
      {move && <MoveDialog target={move} onClose={() => setMove(null)} />}
      {custom && <CustomMealDialog target={custom} onClose={() => setCustom(null)} />}
      {detail && <RecipeDetail recipe={detail.recipe} servings={detail.servings} onClose={() => setDetail(null)} />}
      {plans && <SavedPlansDialog onClose={() => setPlans(false)} />}
      {slotsOpen && <SlotsDialog onClose={() => setSlotsOpen(false)} />}
    </>
  );
}

interface Handlers { onSwap: (t: Target) => void; onMove: (t: Target) => void; onCustom: (t: Target) => void; onOpen: (r: Recipe, servings: number) => void }

function DayTitle({ day, compact }: { day: number; compact?: boolean }) {
  const profile = useStore((s) => s.profile);
  const ctx = dayContext(profile, day as Weekday);
  return (
    <div className="min-w-0">
      <h3 className={cx('font-display font-semibold', compact ? 'text-base' : 'text-xl')}>{DAYS[day]}</h3>
      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {ctx.sessions.map((s, i) => (
          <span key={i} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', s.kind === 'game' ? 'bg-clay-100 text-clay-600 dark:bg-clay-500/15 dark:text-clay-300' : 'bg-sage-100 text-sage-800 dark:bg-sage-500/15 dark:text-sage-200')}>
            {s.kind === 'game' ? <Trophy size={11} /> : <Dumbbell size={11} />}{s.sport}{s.kind === 'strength' || s.sport.toLowerCase().includes(s.kind) ? '' : ` ${s.kind}`} · {s.start}
          </span>
        ))}
        {!ctx.isTraining && profile.isAthlete && <span className="text-[11px] muted">Rest day</span>}
      </div>
    </div>
  );
}

function DayColumn({ day, ...h }: { day: number } & Handlers) {
  const profile = useStore((s) => s.profile);
  const ctx = dayContext(profile, day as Weekday);
  return (
    <div className="space-y-3">
      <DayTitle day={day} />
      <div className="grid gap-3 md:grid-cols-2">
        {ctx.slots.map((s) => <MealCard key={s} day={day} slot={s} {...h} />)}
      </div>
    </div>
  );
}

function useMealInfo(day: number, slot: SlotId) {
  const plan = useStore((s) => s.plan)!;
  const profile = useStore((s) => s.profile);
  const meal = plan.days[day][slot];
  const recipe = getRecipe(meal?.recipeId);
  const extra = meal ? leftoverServings(plan, meal.uid) : 0;
  const source = meal?.leftoverOf ? plan.days.flatMap((d, di) => SLOT_ORDER.filter((s) => d[s]?.uid === meal.leftoverOf).map((s) => `${DAYS_SHORT[di]} ${SLOT_LABEL[s].toLowerCase()}`))[0] : null;
  const cost = recipe ? recipeCostPerServing(recipe, checkRecipeDiet(recipe, profile).omit) * (meal!.servings) : 0;
  return { meal, recipe, extra, source, cost };
}

function MealCard({ day, slot, onSwap, onMove, onCustom, onOpen }: { day: number; slot: SlotId } & Handlers) {
  const { meal, recipe, extra, source, cost } = useMealInfo(day, slot);
  const { toggleLock, togglePrepared, setServings, removeMeal, toggleFavorite, favorites } = useStore();
  const fmt = useMoney();
  const [menu, setMenu] = useState(false);
  const t = { day, slot };

  if (!meal) {
    return (
      <div className="flex min-h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sand-300 p-4 text-center dark:border-white/10">
        <p className="text-sm font-medium">{SLOT_LABEL[slot]}</p>
        <p className="hint mb-3">Nothing planned</p>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => onSwap(t)}><Search size={14} /> Choose recipe</button>
          <button className="btn-ghost btn-sm" onClick={() => onCustom(t)}><PenLine size={14} /> Custom</button>
        </div>
      </div>
    );
  }
  const name = recipe?.name ?? meal.custom?.name ?? 'Meal';
  const fav = recipe && favorites.includes(recipe.id);

  return (
    <article className={cx('card relative flex flex-col p-4 transition', meal.prepared && 'opacity-70')}>
      <div className="flex gap-3.5">
        {recipe ? <button onClick={() => onOpen(recipe, meal.servings + extra)} aria-label={`Open ${recipe.name}`}><RecipeVisual recipe={recipe} /></button>
          : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sand-200 text-2xl dark:bg-white/10">🍽️</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-sage-700 dark:text-sage-300">
            {SLOT_LABEL[slot]}
            {meal.locked && <Lock size={11} className="text-clay-500" aria-label="Locked" />}
          </div>
          {recipe ? (
            <button className="block text-left font-medium leading-snug hover:text-sage-700 dark:hover:text-sage-300" onClick={() => onOpen(recipe, meal.servings + extra)}>{name}</button>
          ) : <p className="font-medium leading-snug">{name}</p>}
          {meal.role && <p className="mt-0.5 text-xs text-clay-600 dark:text-clay-300">{meal.role}</p>}
          {source && <p className="mt-0.5 flex items-center gap-1 text-xs muted"><Repeat size={11} /> Leftovers from {source} — no extra groceries</p>}
          {meal.custom?.notes && <p className="mt-0.5 text-xs muted">{meal.custom.notes}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs muted">
        {recipe && <span>{timeLabel(recipe)}</span>}
        {recipe && !meal.leftoverOf && <span>≈ {fmt(cost)}</span>}
        {recipe && <DietBadges recipe={recipe} max={2} />}
        {recipe?.tags.slice(0, 2).map((x) => <span key={x} className="tag">{tagLabel(x)}</span>)}
      </div>
      {extra > 0 && <p className="mt-2 rounded-lg bg-sand-50 px-2.5 py-1.5 text-xs dark:bg-white/5">Cook {meal.servings + extra} servings — {extra} saved for leftovers.</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-sand-200 pt-3 dark:border-white/5">
        <div className="flex items-center rounded-lg border border-sand-200 dark:border-white/10" aria-label="Servings">
          <button className="icon-btn h-8 w-8" aria-label="Decrease servings" onClick={() => setServings(day, slot, meal.servings - (meal.servings > 1 ? 1 : 0.5))}><Minus size={14} /></button>
          <span className="flex min-w-[3rem] items-center justify-center gap-1 text-xs font-medium tabular-nums"><Users size={12} />{meal.servings}</span>
          <button className="icon-btn h-8 w-8" aria-label="Increase servings" onClick={() => setServings(day, slot, meal.servings + 1)}><Plus size={14} /></button>
        </div>
        <div className="flex items-center gap-0.5">
          <button className={cx('icon-btn', meal.prepared && 'text-sage-600')} aria-pressed={meal.prepared} aria-label={meal.prepared ? 'Mark not prepared' : 'Mark prepared'} title="Prepared" onClick={() => togglePrepared(day, slot)}><Check size={17} /></button>
          <button className={cx('icon-btn', meal.locked && 'text-clay-500')} aria-pressed={meal.locked} aria-label={meal.locked ? 'Unlock meal' : 'Lock meal'} title={meal.locked ? 'Unlock' : 'Lock (keeps this meal when regenerating)'} onClick={() => toggleLock(day, slot)}>{meal.locked ? <Lock size={16} /> : <LockOpen size={16} />}</button>
          <button className="icon-btn" aria-label="Swap meal" title="Swap" onClick={() => onSwap(t)}><ArrowRightLeft size={16} /></button>
          <div className="relative">
            <button className="icon-btn" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={17} /></button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="animate-in absolute bottom-10 right-0 z-20 w-48 rounded-xl border border-sand-200 bg-white p-1 text-sm shadow-xl dark:border-white/10 dark:bg-ink-800">
                  <MenuItem icon={<CalendarRange size={15} />} onClick={() => { setMenu(false); onMove(t); }}>Move to…</MenuItem>
                  {recipe && <MenuItem icon={<Heart size={15} className={fav ? 'fill-clay-500 text-clay-500' : ''} />} onClick={() => { toggleFavorite(recipe.id); setMenu(false); }}>{fav ? 'Remove favourite' : 'Save favourite'}</MenuItem>}
                  <MenuItem icon={<PenLine size={15} />} onClick={() => { setMenu(false); onCustom(t); }}>Replace with custom</MenuItem>
                  <MenuItem icon={<Trash2 size={15} />} danger onClick={() => { setMenu(false); removeMeal(day, slot); }}>Remove</MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-sand-100 dark:hover:bg-white/5', danger && 'text-red-600 dark:text-red-400')}>{icon}{children}</button>;
}

function CompactMeal({ day, slot, onSwap, onOpen, onCustom }: { day: number; slot: SlotId } & Handlers) {
  const { meal, recipe, source } = useMealInfo(day, slot);
  const toggleLock = useStore((s) => s.toggleLock);
  if (!meal) {
    return <button onClick={() => onSwap({ day, slot })} className="w-full rounded-xl border border-dashed border-sand-300 px-3 py-2 text-left text-xs muted hover:border-sage-500 dark:border-white/10">+ {SLOT_LABEL[slot]}</button>;
  }
  return (
    <div className={cx('group flex items-center gap-2 rounded-xl bg-sand-50 p-2 dark:bg-white/5', meal.prepared && 'opacity-60')}>
      {recipe ? <RecipeVisual recipe={recipe} size="sm" className="!h-9 !w-9 !text-lg !rounded-lg" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand-200 dark:bg-white/10">🍽️</span>}
      <button className="min-w-0 flex-1 text-left" onClick={() => (recipe ? onOpen(recipe, meal.servings) : onCustom({ day, slot }))}>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-sage-700 dark:text-sage-300">{SLOT_LABEL[slot]}{source && ' · leftovers'}</span>
        <span className="line-clamp-2 block text-xs font-medium leading-snug">{recipe?.name ?? meal.custom?.name}</span>
      </button>
      <button className={cx('icon-btn h-7 w-7 shrink-0', meal.locked ? 'text-clay-500' : 'opacity-50 group-hover:opacity-100')} aria-label={meal.locked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(day, slot)}>{meal.locked ? <Lock size={13} /> : <LockOpen size={13} />}</button>
      <button className="icon-btn h-7 w-7 shrink-0 opacity-50 group-hover:opacity-100" aria-label="Swap" onClick={() => onSwap({ day, slot })}><ArrowRightLeft size={13} /></button>
    </div>
  );
}

// ---------------------------------------------------------------- dialogs

function SwapDialog({ target, onClose, onCustom }: { target: Target; onClose: () => void; onCustom: () => void }) {
  const { profile, plan, favorites, pantry, setMeal } = useStore();
  const fmt = useMoney();
  const [q, setQ] = useState('');
  const alts = useMemo(() => alternatives(profile, plan!, target.day, target.slot, { favorites, pantry, query: q }), [profile, plan, target, favorites, pantry, q]);
  const current = getRecipe(plan!.days[target.day][target.slot]?.recipeId);
  return (
    <Dialog open onClose={onClose} title={`${current ? 'Swap' : 'Choose'} ${DAYS[target.day]} ${SLOT_LABEL[target.slot].toLowerCase()}`} wide
      footer={<button className="btn-ghost" onClick={onCustom}><PenLine size={15} /> Add a custom meal instead</button>}>
      {current && <p className="mb-3 text-sm muted">Currently: <span className="font-medium text-ink-800 dark:text-sand-100">{current.name}</span></p>}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
        <input className="input pl-9" placeholder="Search suitable recipes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search alternatives" />
      </div>
      {alts.length === 0 ? (
        <Notice tone="warn">No other recipes fit this slot with your current restrictions and limits. Try a custom meal, or relax time or equipment limits in My Profile.</Notice>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {alts.map(({ recipe: r, why }) => (
            <li key={r.id}>
              <button onClick={() => { setMeal(target.day, target.slot, r.id); onClose(); }} className="flex w-full gap-3 rounded-2xl border border-sand-200 p-3 text-left transition hover:border-sage-400 hover:bg-sage-50/50 dark:border-white/10 dark:hover:bg-white/5">
                <RecipeVisual recipe={r} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{r.name}</span>
                  <span className="block text-xs muted">{timeLabel(r)} · {r.cuisine} · ≈ {fmt(recipeCostPerServing(r))}/serving</span>
                  {why.length > 0 && <span className="mt-1 block text-xs text-sage-700 dark:text-sage-300">{why.slice(0, 2).join(' · ')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint mt-4">Only recipes that respect your allergies, diet, time limits and equipment are shown.</p>
    </Dialog>
  );
}

function MoveDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const moveMeal = useStore((s) => s.moveMeal);
  const plan = useStore((s) => s.plan)!;
  const [day, setDay] = useState(target.day);
  const [slot, setSlot] = useState<SlotId>(target.slot);
  const occupant = plan.days[day][slot];
  const occName = getRecipe(occupant?.recipeId)?.name ?? occupant?.custom?.name;
  return (
    <Dialog open onClose={onClose} title="Move meal"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={day === target.day && slot === target.slot} onClick={() => { moveMeal(target, { day, slot }); onClose(); }}>{occupant ? 'Swap meals' : 'Move'}</button></>}>
      <div className="space-y-4">
        <div><p className="label">Day</p><div className="flex flex-wrap gap-2">{DAYS_SHORT.map((d, i) => <button key={d} className={day === i ? 'chip-on' : 'chip-off'} onClick={() => setDay(i)}>{d}</button>)}</div></div>
        <div><p className="label">Meal slot</p><div className="flex flex-wrap gap-2">{SLOT_ORDER.map((s) => <button key={s} className={slot === s ? 'chip-on' : 'chip-off'} onClick={() => setSlot(s)}>{SLOT_LABEL[s]}</button>)}</div></div>
        {occupant && !(day === target.day && slot === target.slot) && <p className="hint">{occName} is already planned there — the two meals will swap places.</p>}
      </div>
    </Dialog>
  );
}

function CustomMealDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const addCustomMeal = useStore((s) => s.addCustomMeal);
  const eaters = useStore((s) => s.profile.eatersPerMeal);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [servings, setServings] = useState(eaters);
  const [items, setItems] = useState<RecipeIngredient[]>([]);
  const [pick, setPick] = useState('');
  const [qty, setQty] = useState(100);
  const [unit, setUnit] = useState<Unit>('g');
  const addItem = () => {
    if (!pick || !(qty > 0)) return;
    setItems([...items, { id: pick, qty, unit }]);
    setPick('');
  };
  return (
    <Dialog open onClose={onClose} title={`Custom ${SLOT_LABEL[target.slot].toLowerCase()} · ${DAYS[target.day]}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!name.trim()} onClick={() => { addCustomMeal(target.day, target.slot, { name: name.trim(), notes: notes.trim() || undefined, ingredients: items }, servings); onClose(); }}>Add meal</button></>}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="cm-name">Meal name</label><input id="cm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grandma's lasagna, team dinner, eating out" /></div>
        <div><label className="label" htmlFor="cm-notes">Notes (optional)</label><input id="cm-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex items-center gap-3"><span className="label !mb-0">Servings</span>
          <input type="number" min={0.5} max={20} step={0.5} className="input w-24" value={servings} onChange={(e) => setServings(Math.max(0.5, Number(e.target.value) || 1))} aria-label="Servings" /></div>
        <div>
          <p className="label">Ingredients to add to the grocery list <span className="font-normal muted">(per serving, optional)</span></p>
          <div className="grid grid-cols-[1fr,5rem,5rem,auto] gap-2">
            <select className="input" value={pick} onChange={(e) => { setPick(e.target.value); const ing = getIngredient(e.target.value); if (ing) setUnit(ing.dim === 'count' ? 'pc' : ing.dim === 'volume' ? 'ml' : 'g'); }} aria-label="Ingredient">
              <option value="">Choose ingredient…</option>
              {[...INGREDIENTS].sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input type="number" className="input" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Quantity" />
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <button className="btn-secondary px-3" onClick={addItem} disabled={!pick} aria-label="Add ingredient"><Plus size={16} /></button>
          </div>
          {items.length > 0 && (
            <ul className="mt-2 divide-y divide-sand-200 text-sm dark:divide-white/5">
              {items.map((it, i) => <li key={i} className="flex justify-between py-1.5"><span>{getIngredient(it.id)?.name}</span><span className="flex items-center gap-2">{it.qty} {it.unit}<button className="icon-btn h-7 w-7" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={13} /></button></span></li>)}
            </ul>
          )}
        </div>
        <p className="hint">Custom meals are locked automatically so regeneration won't replace them. They are not checked against your allergy list — review ingredients yourself.</p>
      </div>
    </Dialog>
  );
}

function SavedPlansDialog({ onClose }: { onClose: () => void }) {
  const { savedPlans, savePlan, loadPlan, deletePlan } = useStore();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <Dialog open onClose={onClose} title="Saved plans">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); savePlan(name); setName(''); setMsg('Current plan saved.'); }}>
        <input className="input" placeholder="Name this week (e.g. Playoffs week)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" />
        <button className="btn-primary shrink-0"><Bookmark size={15} /> Save</button>
      </form>
      {msg && <p className="mt-2 text-xs text-sage-700 dark:text-sage-300" role="status">{msg}</p>}
      <div className="mt-5">
        {savedPlans.length === 0 ? <p className="text-sm muted">No saved plans yet. Saved plans are stored on this device.</p> : (
          <ul className="divide-y divide-sand-200 dark:divide-white/5">
            {savedPlans.map((s) => {
              const count = s.plan.days.reduce((n, d) => n + Object.keys(d).length, 0);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{s.name}</p><p className="text-xs muted">{new Date(s.savedAt).toLocaleString()} · {count} meals</p></div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-secondary btn-sm" onClick={() => { loadPlan(s.id); onClose(); }}>Load</button>
                    <button className="icon-btn" aria-label={`Delete ${s.name}`} onClick={() => deletePlan(s.id)}><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function SlotsDialog({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile, generate, plan, removeMeal } = useStore();
  const [slots, setSlots] = useState<SlotId[]>(profile.slots);
  const apply = () => {
    const added = slots.filter((s) => !profile.slots.includes(s));
    const removed = profile.slots.filter((s) => !slots.includes(s));
    updateProfile({ slots });
    if (plan) for (let d = 0; d < 7; d++) for (const s of removed) if (plan.days[d][s] && !plan.days[d][s]!.locked) removeMeal(d, s);
    if (added.length) generate({ onlySlots: added });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Meal slots" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!slots.length} onClick={apply}>Apply</button></>}>
      <p className="mb-3 text-sm muted">Choose which meals appear each day. New slots are filled automatically; removed slots are cleared (locked meals are kept).</p>
      <div className="flex flex-wrap gap-2">
        {SLOT_ORDER.map((s) => <button key={s} className={slots.includes(s) ? 'chip-on' : 'chip-off'} onClick={() => setSlots(slots.includes(s) ? slots.filter((x) => x !== s) : [...slots, s])}>{SLOT_LABEL[s]}</button>)}
      </div>
      {profile.isAthlete && <p className="hint mt-3">On training days, a pre-practice snack and recovery snack are added automatically even if those slots are off.</p>}
    </Dialog>
  );
}

export type { PlannedMeal };
