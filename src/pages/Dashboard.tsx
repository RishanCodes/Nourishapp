import { ArrowRight, Check, ChefHat, Clock, Droplets, Dumbbell, Heart, Lightbulb, ShoppingBasket, Sparkles, Trophy } from 'lucide-react';
import { useState } from 'react';
import { getRecipe } from '../data/recipes';
import { toCad } from '../engine/cost';
import { adultEstimate, guidance } from '../engine/nutrition';
import { DAYS, DAYS_SHORT, SLOT_LABEL, SLOT_ORDER, SLOT_TIME, dayContext, leftoverServings, toMin, weekdayOf } from '../engine/planner';
import { CommandBar } from '../components/CommandBar';
import { RecipeDetail, RecipeVisual, timeLabel } from '../components/RecipeBits';
import { Empty, Progress, cx } from '../components/ui';
import { useGrocery, useMoney } from '../lib/hooks';
import { navigate } from '../lib/router';
import { useStore } from '../store/store';
import type { Recipe, SlotId, Weekday } from '../types';

export default function Dashboard() {
  const { plan, profile, favorites, togglePrepared, generate } = useStore();
  const { summary } = useGrocery();
  const fmt = useMoney();
  const [open, setOpen] = useState<{ r: Recipe; s: number } | null>(null);
  const now = new Date();
  const today = weekdayOf(now);
  const ctx = dayContext(profile, today);
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (!plan) {
    return <Empty icon={<Sparkles />} title="Let's plan your week" action={<button className="btn-primary" onClick={() => generate()}>Generate my plan</button>}>Your dashboard fills in once you have a meal plan.</Empty>;
  }

  const todays = ctx.slots.map((s) => ({ s, m: plan.days[today][s] })).filter((x) => x.m);
  const slotTime = (s: SlotId) => {
    const sess = ctx.sessions[0];
    if (sess && plan.days[today][s]?.role?.match(/pre-/i)) return `${String(Math.floor((toMin(sess.start) - 75) / 60)).padStart(2, '0')}:${String((toMin(sess.start) - 75) % 60).padStart(2, '0')}`;
    return SLOT_TIME[s];
  };
  const upcoming = todays.find((x) => !x.m!.prepared && toMin(slotTime(x.s)) + 45 >= minutes) ?? null;
  const upRecipe = upcoming ? getRecipe(upcoming.m!.recipeId) : undefined;
  const budget = profile.weeklyBudget ? toCad(profile.weeklyBudget, profile.currency) : null;
  const estimate = adultEstimate(profile);
  const tips = guidance(profile);
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.name.replace(/\s*\(demo\)/, '').split(' ')[0];

  // Meal-prep suggestions for the next three days
  const prep: string[] = [];
  for (let k = 0; k < 3; k++) {
    const d = (today + k) % 7;
    for (const s of SLOT_ORDER) {
      const m = plan.days[d][s];
      const r = getRecipe(m?.recipeId);
      if (!m || !r || m.leftoverOf || m.prepared) continue;
      const extra = leftoverServings(plan, m.uid);
      if (extra > 0) prep.push(`${DAYS_SHORT[d]}: cook ${m.servings + extra} servings of ${r.name} — ${extra} for later.`);
      else if (r.tags.includes('make-ahead') && k > 0) prep.push(`${DAYS_SHORT[(d + 6) % 7]} evening: make ${r.name} ahead for ${DAYS_SHORT[d]} ${SLOT_LABEL[s].toLowerCase()}.`);
    }
  }
  if (plan.days[(today + 1) % 7].lunch && dayContext(profile, ((today + 1) % 7) as Weekday).isWeekday) prep.push(`Tonight: pack tomorrow's lunch so it's ready to grab.`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm muted">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-sand-50 sm:text-3xl">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
      </div>

      <CommandBar />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Up next */}
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="section-title">Up next</h2>
            <button className="btn-ghost btn-sm" onClick={() => navigate('planner')}>Planner <ArrowRight size={14} /></button>
          </div>
          {upcoming && upRecipe ? (
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <RecipeVisual recipe={upRecipe} size="lg" className="sm:!h-32 sm:!w-40" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-sage-300">{SLOT_LABEL[upcoming.s]} · around {slotTime(upcoming.s)}</p>
                <h3 className="mt-1 font-display text-xl font-semibold">{upRecipe.name}</h3>
                {upcoming.m!.role && <p className="text-sm text-clay-600 dark:text-clay-300">{upcoming.m!.role}</p>}
                <p className="mt-1 line-clamp-2 text-sm muted">{upRecipe.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary btn-sm" onClick={() => setOpen({ r: upRecipe, s: upcoming.m!.servings + leftoverServings(plan, upcoming.m!.uid) })}><ChefHat size={14} /> View recipe</button>
                  <button className="btn-secondary btn-sm" onClick={() => togglePrepared(today, upcoming.s)}><Check size={14} /> Mark prepared</button>
                </div>
              </div>
            </div>
          ) : upcoming?.m?.custom ? (
            <p className="p-5 text-sm">{SLOT_LABEL[upcoming.s]}: <span className="font-medium">{upcoming.m.custom.name}</span></p>
          ) : (
            <p className="p-5 text-sm muted">You're done for today. Tomorrow starts with {getRecipe(plan.days[(today + 1) % 7].breakfast?.recipeId)?.name ?? 'a fresh plan'}.</p>
          )}
          <ul className="divide-y divide-sand-200 border-t border-sand-200 dark:divide-white/5 dark:border-white/5">
            {todays.map(({ s, m }) => {
              const r = getRecipe(m!.recipeId);
              return (
                <li key={s} className="flex items-center gap-3 px-5 py-2.5">
                  <button role="checkbox" aria-checked={m!.prepared} aria-label={`Mark ${SLOT_LABEL[s]} prepared`} onClick={() => togglePrepared(today, s)}
                    className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', m!.prepared ? 'border-sage-600 bg-sage-600 text-white dark:bg-sage-500' : 'border-sand-300 dark:border-white/20')}>{m!.prepared && <Check size={13} strokeWidth={3} />}</button>
                  <span className="w-24 shrink-0 text-xs muted sm:w-32">{SLOT_LABEL[s]}</span>
                  <button className={cx('min-w-0 flex-1 truncate text-left text-sm font-medium', m!.prepared && 'line-through opacity-60')} onClick={() => r && setOpen({ r, s: m!.servings })}>{r?.name ?? m!.custom?.name}</button>
                  {r && <span className="hidden shrink-0 text-xs muted sm:inline"><Clock size={11} className="mr-1 inline" />{timeLabel(r)}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Today's activity */}
        <section className="card p-5">
          <h2 className="section-title">Today's schedule</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {profile.schedule !== 'home' && ctx.isWeekday && (
              <li className="flex items-center gap-3"><span className="w-12 text-xs muted tabular-nums">{profile.scheduleStart}</span><span>{profile.schedule === 'school' ? 'School' : profile.schedule === 'work' ? 'Work' : 'School / work'} until {profile.scheduleEnd}</span></li>
            )}
            {ctx.sessions.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-12 text-xs muted tabular-nums">{s.start}</span>
                <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', s.kind === 'game' ? 'bg-clay-100 text-clay-600 dark:bg-clay-500/15' : 'bg-sage-100 text-sage-700 dark:bg-sage-500/15 dark:text-sage-300')}>{s.kind === 'game' ? <Trophy size={14} /> : <Dumbbell size={14} />}</span>
                <span>{s.sport}{s.kind === 'strength' || s.sport.toLowerCase().includes(s.kind) ? '' : ` ${s.kind}`} · {s.duration} min</span>
              </li>
            ))}
            {!ctx.sessions.length && <li className="muted">{profile.isAthlete ? 'Rest day — recovery and regular meals.' : 'No training scheduled.'}</li>}
          </ul>
          {ctx.isTraining && (
            <p className="mt-4 flex gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-400/10 dark:text-sky-100"><Droplets size={15} className="shrink-0" />Bring a water bottle to practice and sip regularly; drink more on hot days or long sessions.</p>
          )}
          <div className="mt-5 border-t border-sand-200 pt-4 dark:border-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide muted">This week</p>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {DAYS_SHORT.map((d, i) => {
                const c = dayContext(profile, i as Weekday);
                const n = Object.keys(plan.days[i]).length;
                const done = Object.values(plan.days[i]).filter((m) => m?.prepared).length;
                return (
                  <button key={d} onClick={() => navigate('planner')} title={`${DAYS[i]}: ${n} meals${c.isTraining ? ', training' : ''}`}
                    className={cx('flex flex-col items-center rounded-lg py-1.5 text-[11px]', i === today ? 'bg-sage-600 text-white dark:bg-sage-500 dark:text-ink-950' : 'bg-sand-50 dark:bg-white/5')}>
                    {d[0]}
                    <span className={cx('mt-1 h-1.5 w-1.5 rounded-full', c.isGame ? 'bg-clay-500' : c.isTraining ? (i === today ? 'bg-white' : 'bg-sage-500') : 'bg-transparent')} />
                    <span className="mt-0.5 tabular-nums opacity-70">{done}/{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="section-title">Groceries</h2><ShoppingBasket size={18} className="text-sage-600" /></div>
          <p className="mt-3 text-sm"><span className="font-display text-2xl font-semibold">{summary.done}</span><span className="muted"> of {summary.count} items purchased</span></p>
          <div className="mt-2"><Progress value={summary.progress} label="Shopping progress" /></div>
          <div className="mt-4 flex justify-between text-sm"><span className="muted">Estimated spend</span><span className="font-semibold">{fmt(summary.total)}{budget ? <span className="font-normal muted"> / {fmt(budget)}</span> : null}</span></div>
          {budget && <div className="mt-2"><Progress value={summary.total / budget} label="Budget used" /></div>}
          <button className="btn-secondary btn-sm mt-4 w-full" onClick={() => navigate('grocery')}>Open grocery list</button>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="section-title">Meal prep</h2><ChefHat size={18} className="text-sage-600" /></div>
          {prep.length ? <ul className="mt-3 space-y-2 text-sm">{prep.slice(0, 4).map((p) => <li key={p} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-400" />{p}</li>)}</ul>
            : <p className="mt-3 text-sm muted">Nothing to prep ahead in the next few days.</p>}
        </section>

        <section className="card p-5 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between"><h2 className="section-title">Favourites</h2><Heart size={18} className="text-clay-500" /></div>
          {favorites.length ? (
            <ul className="mt-3 space-y-2">
              {favorites.slice(0, 4).map((id) => { const r = getRecipe(id); if (!r) return null; return (
                <li key={id}><button onClick={() => setOpen({ r, s: r.servings })} className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-sand-50 dark:hover:bg-white/5"><RecipeVisual recipe={r} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{r.name}</span><span className="text-xs muted">{timeLabel(r)} · {r.cuisine}</span></span></button></li>
              ); })}
            </ul>
          ) : <p className="mt-3 text-sm muted">Tap the heart on any recipe to save it here. Favourites are suggested more often.</p>}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="section-title flex items-center gap-2"><Lightbulb size={18} className="text-clay-500" /> Personal insights</h2>
        <div className="mt-3 grid gap-x-8 gap-y-2 text-sm leading-relaxed md:grid-cols-2">
          {[...plan.explanation.slice(0, 2), ...tips.slice(0, 3)].map((t) => <p key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage-400" />{t}</p>)}
        </div>
        {estimate && (
          <div className="mt-4 rounded-xl bg-sand-50 p-4 text-sm dark:bg-white/5">
            <p className="font-medium">Approximate daily needs (optional estimate)</p>
            <p className="mt-1">≈ {estimate.kcalLow.toLocaleString()}–{estimate.kcalHigh.toLocaleString()} kcal · {estimate.proteinLow}–{estimate.proteinHigh} g protein</p>
            <p className="hint mt-1">{estimate.method}</p>
          </div>
        )}
      </section>
      {open && <RecipeDetail recipe={open.r} servings={open.s} onClose={() => setOpen(null)} />}
    </div>
  );
}
