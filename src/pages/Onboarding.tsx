import { ArrowLeft, ArrowRight, CalendarHeart, Leaf, PlayCircle, ShieldCheck, ShoppingBasket, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ALLERGEN_LABEL, DIET_LABEL } from '../engine/diet';
import { isMinor } from '../engine/nutrition';
import { SLOT_LABEL } from '../engine/planner';
import { Logo } from '../components/Layout';
import { AboutSection, ActivitySection, BudgetSection, CookingSection, DietSection, GOAL_LABEL, GoalsSection, NumbersSection, PreferencesSection } from '../components/ProfileSections';
import { cx } from '../components/ui';
import { DEFAULT_PROFILE } from '../store/defaults';
import { useStore } from '../store/store';
import type { Profile } from '../types';

const STEPS = [
  { key: 'about', title: 'About you', sub: 'A few basics so portions and guidance fit your life stage.' },
  { key: 'activity', title: 'Activity & training', sub: 'Your schedule shapes meal timing and snacks.' },
  { key: 'goals', title: 'Your priorities', sub: 'Pick as many as you like.' },
  { key: 'diet', title: 'Dietary needs', sub: 'Allergies are treated as strict exclusions.' },
  { key: 'prefs', title: 'Food preferences', sub: 'So your meals are ones you actually enjoy.' },
  { key: 'cooking', title: 'Cooking & meals', sub: 'Time, skills and kitchen equipment.' },
  { key: 'budget', title: 'Budget', sub: 'Optional — helps balance cost and variety.' },
  { key: 'review', title: 'Review', sub: 'You can change any of this later in My Profile.' },
] as const;

export default function Onboarding() {
  const { completeOnboarding, loadDemo, settings } = useStore();
  const [step, setStep] = useState(-1);
  const [p, setP] = useState<Profile>({ ...DEFAULT_PROFILE });
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const invalid = (p.age != null && (p.age < 1 || p.age > 120)) || (p.heightCm != null && (p.heightCm < 50 || p.heightCm > 260)) || (p.weightKg != null && (p.weightKg < 10 || p.weightKg > 350));

  if (step === -1) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10">
          <Logo />
          <div className="mt-10 grid items-center gap-10 md:grid-cols-[1.2fr,1fr]">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-ink-900 dark:text-sand-50 sm:text-5xl">Meals that fit your life — and a grocery list that writes itself.</h1>
              <p className="mt-4 max-w-lg text-base muted">NOURISH builds a seven-day plan around your age, activity, training schedule, dietary needs, tastes and budget, then turns it into an organised shopping list.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn-primary px-5 py-3 text-base" onClick={() => setStep(0)}>Personalise my plan <ArrowRight size={18} /></button>
                <button className="btn-secondary px-5 py-3 text-base" onClick={loadDemo}><PlayCircle size={18} /> Try the demo</button>
              </div>
              <p className="mt-3 text-xs muted">Takes about 3 minutes. Most questions are optional. Everything is stored only on this device.</p>
            </div>
            <ul className="grid gap-3">
              {[
                { icon: Sparkles, t: 'Truly personalised', d: 'Training days get pre-practice fuel and recovery meals; school days get packable lunches.' },
                { icon: ShieldCheck, t: 'Safe for your diet', d: 'Allergens and dietary rules are enforced on every recipe and grocery item.' },
                { icon: ShoppingBasket, t: 'Smart groceries', d: 'Quantities consolidated across the week, minus what’s in your pantry.' },
                { icon: CalendarHeart, t: 'Flexible', d: 'Swap, lock, move and resize meals — your list updates instantly.' },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="card flex gap-3.5 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-700 dark:bg-sage-500/15 dark:text-sage-300"><Icon size={19} /></span>
                  <span><span className="block text-sm font-semibold">{t}</span><span className="text-sm muted">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-100/90 backdrop-blur dark:border-white/5 dark:bg-ink-950/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-3">
          <Logo />
          <span className="text-xs muted">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-5 pb-3">
          {STEPS.map((x, i) => <button key={x.key} aria-label={`Go to ${x.title}`} onClick={() => i < step && setStep(i)} className={cx('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-sage-500' : 'bg-sand-300 dark:bg-white/10')} />)}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-32 pt-8">
        <div key={s.key} className="animate-in">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-sand-50 sm:text-3xl">{s.title}</h1>
          <p className="mb-7 mt-1 text-sm muted">{s.sub}</p>
          {s.key === 'about' && <AboutSection p={p} set={set} units={settings.units} />}
          {s.key === 'activity' && <ActivitySection p={p} set={set} />}
          {s.key === 'goals' && <GoalsSection p={p} set={set} />}
          {s.key === 'diet' && <DietSection p={p} set={set} />}
          {s.key === 'prefs' && <PreferencesSection p={p} set={set} />}
          {s.key === 'cooking' && <CookingSection p={p} set={set} />}
          {s.key === 'budget' && <div className="space-y-8"><BudgetSection p={p} set={set} /><NumbersSection p={p} set={set} /></div>}
          {s.key === 'review' && <Review p={p} />}
        </div>
      </main>
      <footer className="fixed inset-x-0 bottom-0 border-t border-sand-200 bg-white/95 backdrop-blur dark:border-white/5 dark:bg-ink-900/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-5 py-3">
          <button className="btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
          <div className="flex gap-2">
            {!last && s.key !== 'diet' && <button className="btn-ghost" onClick={() => setStep(step + 1)}>Skip</button>}
            {last
              ? <button className="btn-primary" onClick={() => completeOnboarding(p)}><Leaf size={16} /> Create my plan</button>
              : <button className="btn-primary" disabled={invalid} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} /></button>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Review({ p }: { p: Profile }) {
  const rows: [string, string][] = [
    ['Life stage', `${p.age ? `${p.age} years · ` : ''}${{ child: 'Child', teen: 'Growing teenager', adult: 'Adult', older: 'Older adult' }[p.lifeStage]}`],
    ['Household', `${p.householdSize} ${p.householdSize === 1 ? 'person' : 'people'}, ${p.eatersPerMeal} per meal`],
    ['Activity', `${p.activity}${p.isAthlete ? ` · ${p.primarySport || 'athlete'} · ${p.sessions.length} sessions/week` : ''}`],
    ['Goals', p.goals.map((g) => GOAL_LABEL[g]).join(', ') || '—'],
    ['Diet', p.diet.map((d) => DIET_LABEL[d]).join(', ')],
    ['Allergies', [...p.allergies.map((a) => ALLERGEN_LABEL[a]), ...p.customAllergies].join(', ') || 'None'],
    ['Cuisines', p.cuisines.join(', ') || 'A mix of everything'],
    ['Cooking', `Up to ${p.maxPrep} min prep · ${p.maxCook} min cooking · ${p.equipment.join(', ') || 'no equipment'}`],
    ['Meals', p.slots.map((s) => SLOT_LABEL[s]).join(', ')],
    ['Budget', p.weeklyBudget ? `$${p.weeklyBudget} CAD / week (${p.priority})` : `Not set (${p.priority})`],
  ];
  return (
    <div className="space-y-4">
      <dl className="card divide-y divide-sand-200 dark:divide-white/5">
        {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[7rem,1fr] gap-3 px-4 py-3 text-sm"><dt className="muted">{k}</dt><dd className="capitalize-first">{v}</dd></div>)}
      </dl>
      {isMinor(p) && <p className="text-sm muted">Your plan will focus on regular, satisfying meals and training fuel. There are no calorie targets, but you can see the nutrition numbers for every meal.</p>}
    </div>
  );
}
