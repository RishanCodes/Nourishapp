import { Info, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ALLERGEN_LABEL, DIET_LABEL } from '../engine/diet';
import { isMinor, lifeStageFromAge } from '../engine/nutrition';
import { DAYS, DAYS_SHORT, SLOT_LABEL, SLOT_ORDER } from '../engine/planner';
import type {
  ActivityLevel, Allergen, Cuisine, DietPattern, Equipment, Goal, HealthFlag, LifeStage, Profile, SlotId, TrainingSession, Weekday,
} from '../types';
import { Chip, ChipGroup, Field, Notice, NumberInput, Segmented, TagInput, Toggle, cx } from './ui';

export type SectionProps = { p: Profile; set: (patch: Partial<Profile>) => void };

const LIFE: Record<LifeStage, string> = { child: 'Child', teen: 'Growing teenager', adult: 'Adult', older: 'Older adult' };
const ACTIVITY: { v: ActivityLevel; label: string; hint: string }[] = [
  { v: 'sedentary', label: 'Sedentary', hint: 'Mostly sitting, little exercise' },
  { v: 'light', label: 'Lightly active', hint: 'Walks or light exercise 1–3×/week' },
  { v: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5×/week' },
  { v: 'very', label: 'Very active', hint: 'Hard exercise most days' },
  { v: 'athlete', label: 'Competitive athlete', hint: 'Team or competitive training' },
  { v: 'heavy', label: 'Heavy training schedule', hint: 'Twice-daily or long sessions' },
];
const SPORTS = ['Basketball', 'Volleyball', 'Soccer', 'Football', 'Swimming', 'Track and field', 'Running', 'Cycling', 'Hockey', 'Tennis'];
export const GOAL_LABEL: Record<Goal, string> = {
  healthy: 'General healthy eating', balanced: 'Balanced nutrition', 'growing-teen': 'Growing teenager', 'youth-athlete': 'Youth athlete',
  'competitive-athlete': 'Competitive athlete', muscle: 'Supporting muscle development', strength: 'Supporting strength',
  endurance: 'Endurance & recovery', energy: 'Everyday energy', family: 'Family meal planning', budget: 'Budget-friendly eating',
  quick: 'Quick & convenient meals', variety: 'Greater dietary variety', 'high-protein': 'Higher-protein foods',
};
const DIETS: DietPattern[] = ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'dairy-free', 'gluten-free'];
const ALLERGENS: Allergen[] = ['peanut', 'tree_nut', 'dairy', 'egg', 'soy', 'wheat', 'fish', 'shellfish', 'sesame', 'lactose'];
const ALLERGY_LABEL = { ...ALLERGEN_LABEL, lactose: 'Lactose intolerance' };
const HEALTH: Record<HealthFlag, string> = { celiac: 'Celiac disease', diabetes: 'Diabetes', clinician: 'Clinician-prescribed restrictions', digestive: 'Digestive sensitivities', other: 'Other medical considerations' };
const CUISINES: Cuisine[] = ['American', 'Canadian', 'Italian', 'Mediterranean', 'Mexican', 'Indian', 'South Asian', 'East Asian', 'Middle Eastern', 'African', 'International'];
const EQUIPMENT: Equipment[] = ['stovetop', 'oven', 'microwave', 'blender', 'air fryer', 'slow cooker', 'rice cooker', 'toaster', 'grill'];
const PROTEINS = ['chicken', 'turkey', 'beef', 'pork', 'salmon', 'tuna', 'shrimp', 'eggs', 'tofu', 'lentils', 'chickpeas', 'beans', 'greek yogurt', 'paneer'];

export function AboutSection({ p, set, units }: SectionProps & { units: 'metric' | 'imperial' }) {
  const [sys, setSys] = useState(units);
  const ft = p.heightCm ? Math.floor(p.heightCm / 2.54 / 12) : null;
  const inch = p.heightCm ? Math.round(p.heightCm / 2.54 - (ft ?? 0) * 12) : null;
  const setFtIn = (f: number | null, i: number | null) => set({ heightCm: f == null && i == null ? null : Math.round(((f ?? 0) * 12 + (i ?? 0)) * 2.54 * 10) / 10 });
  return (
    <div className="space-y-5">
      <Field label="First name or nickname" hint="Optional — only used to greet you. Stored on this device only.">
        <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sam" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Age" htmlFor="age">
          <NumberInput id="age" value={p.age} min={1} max={120} onChange={(v) => set({ age: v, ...(v != null && v >= 1 && v <= 120 ? { lifeStage: lifeStageFromAge(v) } : {}) })} placeholder="e.g. 17" />
        </Field>
        <Field label="Life stage">
          <select className="input" value={p.lifeStage} onChange={(e) => set({ lifeStage: e.target.value as LifeStage })}>
            {Object.entries(LIFE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="rounded-2xl border border-sand-200 p-4 dark:border-white/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Height & weight <span className="font-normal muted">(optional)</span></p>
          <Segmented size="sm" options={['metric', 'imperial'] as const} value={sys} onChange={setSys} labels={{ metric: 'cm / kg', imperial: 'ft / lb' }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {sys === 'metric' ? (
            <NumberInput ariaLabel="Height in centimetres" value={p.heightCm} min={50} max={260} suffix="cm" onChange={(v) => set({ heightCm: v })} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <NumberInput ariaLabel="Height feet" value={ft} min={1} max={8} suffix="ft" onChange={(v) => setFtIn(v, inch)} />
              <NumberInput ariaLabel="Height inches" value={inch} min={0} max={11} suffix="in" onChange={(v) => setFtIn(ft, v)} />
            </div>
          )}
          {sys === 'metric' ? (
            <NumberInput ariaLabel="Weight in kilograms" value={p.weightKg} min={10} max={350} step={0.1} suffix="kg" onChange={(v) => set({ weightKg: v })} />
          ) : (
            <NumberInput ariaLabel="Weight in pounds" value={p.weightKg ? Math.round(p.weightKg * 2.20462) : null} min={20} max={770} suffix="lb" onChange={(v) => set({ weightKg: v == null ? null : Math.round((v / 2.20462) * 10) / 10 })} />
          )}
        </div>
        <p className="hint mt-2">Not required for meal plans. Used only for optional adult estimates — never to set weight targets.</p>
      </div>
      <Field label="Sex" hint="Optional. Only affects optional adult energy estimates.">
        <Segmented options={['unspecified', 'female', 'male'] as const} value={p.sex} onChange={(v) => set({ sex: v })} labels={{ unspecified: 'Prefer not to say', female: 'Female', male: 'Male' }} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Household size"><NumberInput value={p.householdSize} min={1} max={20} onChange={(v) => set({ householdSize: v ?? 1, eatersPerMeal: Math.min(p.eatersPerMeal, v ?? 1) })} /></Field>
        <Field label="People eating each meal" hint="Sets default servings."><NumberInput value={p.eatersPerMeal} min={1} max={Math.max(1, p.householdSize)} onChange={(v) => set({ eatersPerMeal: v ?? 1 })} /></Field>
      </div>
    </div>
  );
}

export function ActivitySection({ p, set }: SectionProps) {
  const [custom, setCustom] = useState('');
  const athleteLevel = p.activity === 'athlete' || p.activity === 'heavy';
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {ACTIVITY.map((a) => (
          <button key={a.v} type="button" aria-pressed={p.activity === a.v} onClick={() => set({ activity: a.v, ...(a.v === 'athlete' || a.v === 'heavy' ? { isAthlete: true } : {}) })}
            className={cx('rounded-2xl border p-3.5 text-left transition', p.activity === a.v ? 'border-sage-500 bg-sage-50 dark:border-sage-400 dark:bg-sage-500/10' : 'border-sand-200 hover:border-sage-300 dark:border-white/10')}>
            <span className="block text-sm font-medium">{a.label}</span><span className="hint">{a.hint}</span>
          </button>
        ))}
      </div>
      <Toggle checked={p.isAthlete} onChange={(v) => set({ isAthlete: v })} label="I play a sport or train regularly" hint="Plan meals and snacks around practices, games and strength sessions." />
      {(p.isAthlete || athleteLevel) && (
        <div className="space-y-5 rounded-2xl border border-sand-200 p-4 dark:border-white/10">
          <Field label="Primary sport">
            <div className="flex flex-wrap gap-2">
              {[...SPORTS, ...(p.primarySport && !SPORTS.includes(p.primarySport) ? [p.primarySport] : [])].map((s) => <Chip key={s} on={p.primarySport === s} onClick={() => set({ primarySport: s })}>{s}</Chip>)}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="Other sport" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button type="button" className="btn-secondary" disabled={!custom.trim()} onClick={() => { set({ primarySport: custom.trim() }); setCustom(''); }}>Set</button>
            </div>
          </Field>
          <Field label="Secondary sports"><TagInput value={p.secondarySports} onChange={(v) => set({ secondarySports: v })} placeholder="Type and press Enter" suggestions={SPORTS.map((s) => s.toLowerCase()).filter((s) => s !== p.primarySport.toLowerCase())} /></Field>
          <SessionsEditor p={p} set={set} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Weekday schedule">
          <select className="input" value={p.schedule} onChange={(e) => set({ schedule: e.target.value as Profile['schedule'] })}>
            <option value="school">School</option><option value="work">Work</option><option value="mixed">School & work</option><option value="home">Mostly at home</option>
          </select>
        </Field>
        {p.schedule !== 'home' && <>
          <Field label="Starts"><input type="time" className="input" value={p.scheduleStart} onChange={(e) => set({ scheduleStart: e.target.value })} /></Field>
          <Field label="Ends"><input type="time" className="input" value={p.scheduleEnd} onChange={(e) => set({ scheduleEnd: e.target.value })} /></Field>
        </>}
      </div>
    </div>
  );
}

function SessionsEditor({ p, set }: SectionProps) {
  const sport = p.primarySport || 'Training';
  const update = (i: number, patch: Partial<TrainingSession>) => set({ sessions: p.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const add = (day: Weekday) => set({ sessions: [...p.sessions, { day, kind: 'practice', sport, start: '16:00', duration: 90, intensity: 'moderate' }] });
  const weekdays = () => set({ sessions: [...p.sessions.filter((s) => s.day > 4), ...[0, 1, 2, 3, 4].map((d) => ({ day: d as Weekday, kind: 'practice' as const, sport, start: '16:00', duration: 90, intensity: 'high' as const }))] });
  const rest = DAYS.filter((_, i) => !p.sessions.some((s) => s.day === i));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="label !mb-0">Training schedule</p>
        <button type="button" className="btn-ghost btn-sm" onClick={weekdays}>Practice Mon–Fri at 4 pm</button>
      </div>
      {p.sessions.length === 0 && <p className="mb-2 text-sm muted">No sessions yet. Add practices, games and strength sessions so meals can be timed around them.</p>}
      <ul className="space-y-2">
        {[...p.sessions.map((s, i) => ({ s, i }))].sort((a, b) => a.s.day - b.s.day || a.s.start.localeCompare(b.s.start)).map(({ s, i }) => (
          <li key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-sand-50 p-2.5 dark:bg-white/5 sm:grid-cols-[5.5rem,8rem,6.5rem,6rem,7rem,auto]">
            <select className="input py-2" value={s.day} onChange={(e) => update(i, { day: Number(e.target.value) as Weekday })} aria-label="Day">{DAYS_SHORT.map((d, k) => <option key={d} value={k}>{d}</option>)}</select>
            <select className="input py-2" value={s.kind} onChange={(e) => update(i, { kind: e.target.value as TrainingSession['kind'], sport: e.target.value === 'strength' ? 'Strength training' : sport })} aria-label="Session type">
              <option value="practice">Practice</option><option value="game">Game / competition</option><option value="strength">Strength</option><option value="conditioning">Conditioning</option>
            </select>
            <input type="time" className="input py-2" value={s.start} onChange={(e) => update(i, { start: e.target.value || '16:00' })} aria-label="Start time" />
            <div className="relative"><input type="number" min={15} max={480} className="input py-2 pr-9" value={s.duration} onChange={(e) => update(i, { duration: Math.max(15, Math.min(480, Number(e.target.value) || 60)) })} aria-label="Duration in minutes" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] muted">min</span></div>
            <select className="input py-2" value={s.intensity} onChange={(e) => update(i, { intensity: e.target.value as TrainingSession['intensity'] })} aria-label="Intensity"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select>
            <button type="button" className="icon-btn justify-self-end" aria-label="Remove session" onClick={() => set({ sessions: p.sessions.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DAYS_SHORT.map((d, k) => <button key={d} type="button" className="btn-secondary btn-sm" onClick={() => add(k as Weekday)}><Plus size={12} /> {d}</button>)}
      </div>
      <p className="hint mt-2">Rest days: {rest.length ? rest.join(', ') : 'none — consider at least one rest day each week.'}</p>
    </div>
  );
}

export function GoalsSection({ p, set }: SectionProps) {
  const minor = isMinor(p);
  return (
    <div className="space-y-4">
      <ChipGroup options={Object.keys(GOAL_LABEL) as Goal[]} labels={GOAL_LABEL} value={p.goals} onChange={(v) => set({ goals: v })} />
      {minor && <Notice tone="ok" icon={<Info size={16} />}>For growing users, NOURISH focuses on enough food, balanced meals, training fuel and recovery. It never sets calorie deficits or weight-loss targets. You can still see the calories and macros in every meal (My Profile → Nutrition numbers).</Notice>}
    </div>
  );
}

export function DietSection({ p, set }: SectionProps) {
  const toggleDiet = (d: DietPattern) => {
    if (d === 'omnivore') return set({ diet: ['omnivore'] });
    const cur = p.diet.filter((x) => x !== 'omnivore');
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    set({ diet: next.length ? next : ['omnivore'] });
  };
  return (
    <div className="space-y-6">
      <Field label="Dietary pattern" hint="Combine patterns if needed, e.g. Halal + Dairy-free.">
        <div className="flex flex-wrap gap-2">{DIETS.map((d) => <Chip key={d} on={p.diet.includes(d)} onClick={() => toggleDiet(d)}>{DIET_LABEL[d]}</Chip>)}</div>
      </Field>
      <Field label={<span className="flex items-center gap-1.5"><ShieldAlert size={15} className="text-clay-500" /> Allergies & intolerances</span>} hint="Treated as strict exclusions — recipes containing these are never suggested.">
        <ChipGroup options={ALLERGENS} labels={ALLERGY_LABEL} value={p.allergies} onChange={(v) => set({ allergies: v })} />
      </Field>
      <Field label="Other allergies" hint="Matched against ingredient names (e.g. “mustard”, “mushroom”, “kiwi”).">
        <TagInput value={p.customAllergies} onChange={(v) => set({ customAllergies: v })} placeholder="Type an allergen and press Enter" />
      </Field>
      {(p.allergies.length > 0 || p.customAllergies.length > 0) && (
        <Notice tone="warn" icon={<ShieldAlert size={16} />}>Always read labels on packaged foods (breads, sauces, broths, snacks) for hidden allergens and “may contain” cross-contact warnings. NOURISH flags these items on recipes and your grocery list.</Notice>
      )}
      <Field label="Health considerations" hint="Optional. NOURISH does not diagnose conditions or provide medical nutrition therapy.">
        <ChipGroup options={Object.keys(HEALTH) as HealthFlag[]} labels={HEALTH} value={p.health} onChange={(v) => set({ health: v })} />
      </Field>
      {p.health.length > 0 && (
        <>
          <Field label="Notes from your clinician" hint="For your reference. Add any specific ingredients to avoid below under Food preferences → Ingredients to avoid.">
            <textarea className="input min-h-[80px]" value={p.healthNotes} onChange={(e) => set({ healthNotes: e.target.value })} placeholder="e.g. limit added sugars; low-FODMAP trial" />
          </Field>
          <Notice tone="info" icon={<Info size={16} />}>
            {p.health.includes('celiac') && 'Celiac disease: all gluten ingredients are excluded automatically. '}
            {p.health.includes('diabetes') && 'Diabetes: plans favour higher-fibre recipes, but carbohydrate amounts should follow your diabetes care team’s advice. '}
            Conditions that need individual guidance should be managed with a registered dietitian or physician — NOURISH helps you apply restrictions they give you.
          </Notice>
        </>
      )}
    </div>
  );
}

export function PreferencesSection({ p, set }: SectionProps) {
  return (
    <div className="space-y-5">
      <Field label="Preferred cuisines" hint="Leave empty for a mix of everything."><ChipGroup options={CUISINES} value={p.cuisines} onChange={(v) => set({ cuisines: v })} /></Field>
      <Field label="Favourite protein sources"><ChipGroup options={PROTEINS} value={p.favoriteProteins} onChange={(v) => set({ favoriteProteins: v })} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Favourite foods"><TagInput value={p.favoriteFoods} onChange={(v) => set({ favoriteFoods: v })} placeholder="e.g. pasta, tacos" /></Field>
        <Field label="Preferred fruits"><TagInput value={p.preferredFruits} onChange={(v) => set({ preferredFruits: v })} placeholder="e.g. banana, berries" suggestions={['banana', 'berries', 'apple', 'mango', 'orange']} /></Field>
        <Field label="Preferred vegetables"><TagInput value={p.preferredVegetables} onChange={(v) => set({ preferredVegetables: v })} placeholder="e.g. broccoli, peppers" suggestions={['broccoli', 'spinach', 'peppers', 'carrots', 'sweet potato']} /></Field>
        <Field label="Preferred breakfast foods"><TagInput value={p.preferredBreakfasts} onChange={(v) => set({ preferredBreakfasts: v })} placeholder="e.g. oats, eggs" suggestions={['oats', 'eggs', 'yogurt', 'smoothie', 'bagel']} /></Field>
        <Field label="Favourite snacks"><TagInput value={p.favoriteSnacks} onChange={(v) => set({ favoriteSnacks: v })} placeholder="e.g. peanut butter, fruit" /></Field>
        <Field label="Disliked foods" hint="Strongly avoided."><TagInput value={p.dislikedFoods} onChange={(v) => set({ dislikedFoods: v })} placeholder="e.g. mushrooms" /></Field>
      </div>
      <Field label="Ingredients to avoid" hint="Strict exclusion, like an allergy — use for clinician-advised restrictions too.">
        <TagInput value={p.avoidIngredients} onChange={(v) => set({ avoidIngredients: v })} placeholder="e.g. pork, cilantro" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Spice tolerance"><Segmented options={[0, 1, 2, 3] as const} value={p.spiceTolerance} onChange={(v) => set({ spiceTolerance: v })} labels={{ 0: 'None', 1: 'Mild', 2: 'Medium', 3: 'Hot' }} /></Field>
        <Field label="Trying new recipes"><Segmented options={[1, 2, 3] as const} value={p.adventurous} onChange={(v) => set({ adventurous: v })} labels={{ 1: 'Keep it familiar', 2: 'Sometimes', 3: 'Love new things' }} /></Field>
      </div>
    </div>
  );
}

export function CookingSection({ p, set }: SectionProps) {
  return (
    <div className="space-y-5">
      <Field label="Cooking skill"><Segmented options={[1, 2, 3] as const} value={p.skill} onChange={(v) => set({ skill: v })} labels={{ 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' }} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={`Maximum prep time: ${p.maxPrep} min`}><input type="range" min={5} max={60} step={5} value={p.maxPrep} onChange={(e) => set({ maxPrep: Number(e.target.value) })} className="w-full accent-sage-600" aria-label="Maximum prep time" /></Field>
        <Field label={`Maximum cooking time: ${p.maxCook} min`} hint="Slow-cooker recipes count as hands-off."><input type="range" min={0} max={90} step={5} value={p.maxCook} onChange={(e) => set({ maxCook: Number(e.target.value) })} className="w-full accent-sage-600" aria-label="Maximum cooking time" /></Field>
      </div>
      <Field label="Kitchen equipment" hint="No-cook recipes are always available."><ChipGroup options={EQUIPMENT} value={p.equipment} onChange={(v) => set({ equipment: v })} /></Field>
      <Field label="Meals and snacks each day">
        <div className="flex flex-wrap gap-2">{SLOT_ORDER.map((s) => <Chip key={s} on={p.slots.includes(s)} onClick={() => { const next = p.slots.includes(s) ? p.slots.filter((x) => x !== s) : [...p.slots, s]; if (next.length) set({ slots: SLOT_ORDER.filter((x) => next.includes(x)) as SlotId[] }); }}>{SLOT_LABEL[s]}</Chip>)}</div>
      </Field>
      <Toggle checked={p.mealPrep} onChange={(v) => set({ mealPrep: v })} label="I like to meal prep" hint="Batch breakfasts and make-ahead snacks for several days." />
      <Field label="Leftovers"><Segmented options={['love', 'ok', 'avoid'] as const} value={p.leftovers} onChange={(v) => set({ leftovers: v })} labels={{ love: 'Love them', ok: 'A few are fine', avoid: 'Avoid' }} /></Field>
    </div>
  );
}

export function BudgetSection({ p, set }: SectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <Field label="Weekly grocery budget (CAD)" hint="Optional. Used to favour cheaper recipes and compare estimates.">
          <NumberInput value={p.weeklyBudget} min={1} max={100000} onChange={(v) => set({ weeklyBudget: v })} placeholder="e.g. 120" suffix="CAD" />
        </Field>
      </div>
      <Field label="Preferred grocery stores" hint="Optional, for your own reference."><input className="input" value={p.stores} onChange={(e) => set({ stores: e.target.value })} placeholder="e.g. No Frills, local market" /></Field>
      <Field label="What matters most?"><Segmented options={['savings', 'convenience', 'variety'] as const} value={p.priority} onChange={(v) => set({ priority: v })} labels={{ savings: 'Savings', convenience: 'Convenience', variety: 'Variety' }} /></Field>
      <Toggle checked={p.portableLunch} onChange={(v) => set({ portableLunch: v })} label="Weekday lunches must be portable" hint="For school or work lunches packed in a container." />
    </div>
  );
}

export function NumbersSection({ p, set }: SectionProps) {
  const minor = isMinor(p);
  return (
    <div className="space-y-3">
      <Toggle checked={p.showNumbers} onChange={(v) => set({ showNumbers: v })} label="Show nutrition numbers"
        hint={minor
          ? 'Shows calories, protein, carbs, fat and fibre for every meal, plus the totals of what’s planned each day.'
          : 'Shows calories and macros for every meal, the totals of what’s planned each day, and an approximate daily energy range on the dashboard.'} />
      {p.showNumbers && minor && <p className="hint">Numbers describe what’s in your meals — they aren’t targets. The daily energy-range estimate stays adults-only because the standard adult equation isn’t designed for bodies that are still growing.</p>}
      {p.showNumbers && !minor && (!p.age || !p.heightCm || !p.weightKg || p.sex === 'unspecified') && <p className="hint">The daily range also needs age, height, weight and sex (in About you). Meal numbers still appear.</p>}
    </div>
  );
}
