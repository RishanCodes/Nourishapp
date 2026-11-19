import { getIngredient } from '../data/ingredients';
import { RECIPES, getRecipe } from '../data/recipes';
import type {
  Cuisine, DayPlan, PantryItem, PlannedMeal, Profile, Recipe, RecipeTag, SlotId, TrainingSession, WeekPlan, Weekday,
} from '../types';
import { recipeCostPerServing } from './cost';
import { checkRecipeDiet, diagnoseSlot, isEligible, profileConflicts, termMatchesRecipe } from './diet';
import { isMinor } from './nutrition';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SLOT_ORDER: SlotId[] = ['breakfast', 'amSnack', 'lunch', 'pmSnack', 'dinner', 'eveSnack'];
export const SLOT_LABEL: Record<SlotId, string> = {
  breakfast: 'Breakfast', amSnack: 'Morning snack', lunch: 'Lunch', pmSnack: 'Afternoon snack', dinner: 'Dinner', eveSnack: 'Evening snack',
};
export const SLOT_TIME: Record<SlotId, string> = {
  breakfast: '07:30', amSnack: '10:00', lunch: '12:15', pmSnack: '15:30', dinner: '18:30', eveSnack: '20:30',
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Monday-based weekday index for a JS date. */
export const weekdayOf = (d: Date): Weekday => (((d.getDay() + 6) % 7) as Weekday);

// ---------------------------------------------------------------- day context

export interface Role {
  label: string;
  want: RecipeTag[];
  require?: RecipeTag[];
  avoid?: RecipeTag[];
  quick?: boolean;
  /** Extra half-portion for an athlete on recovery meals. */
  extraPortion?: boolean;
}

export interface DayContext {
  day: Weekday;
  sessions: TrainingSession[];
  isTraining: boolean;
  isGame: boolean;
  isWeekday: boolean;
  slots: SlotId[];
  roles: Partial<Record<SlotId, Role>>;
}

export function dayContext(p: Profile, day: Weekday): DayContext {
  const sessions = p.isAthlete ? p.sessions.filter((s) => s.day === day).sort((a, b) => toMin(a.start) - toMin(b.start)) : [];
  const isGame = sessions.some((s) => s.kind === 'game');
  const isWeekday = day < 5 && p.schedule !== 'home';
  const slots = new Set<SlotId>(p.slots);
  const roles: Partial<Record<SlotId, Role>> = {};

  if (isWeekday && slots.has('lunch')) {
    roles.lunch = {
      label: p.schedule === 'work' ? 'Packed work lunch' : p.schedule === 'school' ? 'Packed school lunch' : 'Packed lunch',
      want: ['portable'],
      require: p.portableLunch ? ['portable'] : undefined,
    };
  }
  if (isWeekday && slots.has('breakfast')) roles.breakfast = { label: 'Quick weekday breakfast', want: ['quick'], quick: true };

  const game = (s: TrainingSession) => (s.kind === 'game' ? 'Game-day ' : '');
  for (const s of sessions) {
    const start = toMin(s.start);
    const end = start + s.duration;
    const preAvoid: RecipeTag[] = s.kind === 'game' ? ['high-fiber'] : [];
    if (start < 9 * 60) {
      roles.breakfast = { label: `Light ${game(s).toLowerCase()}pre-training breakfast`, want: ['pre-workout', 'quick'], avoid: preAvoid, quick: true };
      slots.add('amSnack');
      roles.amSnack = { label: 'Post-training recovery snack', want: ['recovery', 'high-protein', 'portable'] };
    } else if (start < 13 * 60) {
      slots.add('amSnack');
      roles.amSnack = { label: `${game(s)}Pre-training snack`, want: ['pre-workout', 'portable'], avoid: preAvoid };
      if (slots.has('lunch')) roles.lunch = { ...(roles.lunch ?? { want: [] }), label: 'Recovery lunch', want: ['recovery', 'high-protein', ...(roles.lunch?.want ?? [])], extraPortion: true };
    } else if (start < 19 * 60) {
      slots.add('pmSnack');
      roles.pmSnack = { label: `${game(s)}Pre-${s.kind === 'game' ? 'game' : 'practice'} fuel`, want: ['pre-workout', 'portable'], avoid: preAvoid };
      if (isGame && roles.lunch) roles.lunch = { ...roles.lunch, label: `Game-day ${roles.lunch.label.toLowerCase()}`, want: ['pre-workout', ...roles.lunch.want], avoid: ['high-fiber'] };
      roles.dinner = { label: end > 19.5 * 60 ? 'Late recovery dinner' : 'Recovery dinner', want: ['recovery', 'high-protein', 'athlete'], extraPortion: true };
      if (s.duration >= 120) {
        slots.add('eveSnack');
        roles.eveSnack = { label: 'Extra recovery snack (long session)', want: ['recovery', 'high-protein'] };
      }
    } else {
      roles.dinner = { label: 'Early pre-training dinner', want: ['pre-workout', 'quick'], avoid: preAvoid };
      slots.add('eveSnack');
      roles.eveSnack = { label: 'Post-training recovery snack', want: ['recovery', 'high-protein'] };
    }
  }
  return {
    day, sessions, isTraining: sessions.length > 0, isGame, isWeekday,
    slots: SLOT_ORDER.filter((s) => slots.has(s)), roles,
  };
}

// ---------------------------------------------------------------- scoring

export interface ScoreCtx {
  p: Profile;
  favorites: Set<string>;
  pantryIds: Set<string>;
  usedCounts: Map<string, number>;
  usedIngredients: Map<string, number>;
  dayRecipes: Set<string>;
  dayCuisines: Cuisine[];
  targetPerServing: number | null;
  boost?: Boost;
}

/** Temporary emphasis from a natural-language request (e.g. "more Indian food"). */
export interface Boost { cuisines?: Cuisine[]; tags?: RecipeTag[] }

const PERISHABLE = new Set(['Produce', 'Meat and poultry', 'Seafood', 'Dairy and alternatives', 'Bread and bakery']);
const FAMILIAR: Cuisine[] = ['American', 'Canadian', 'Italian', 'Mexican'];

export function scoreRecipe(r: Recipe, role: Role | undefined, ctx: ScoreCtx): { score: number; why: string[] } {
  const { p } = ctx;
  let s = 10;
  const why: string[] = [];
  const add = (n: number, reason?: string) => { s += n; if (reason && n > 0) why.push(reason); };

  if (p.cuisines.includes(r.cuisine)) add(6, `${r.cuisine} is a cuisine you like`);
  const likes = [...p.favoriteFoods, ...(p.preferredFruits ?? []), ...(p.preferredVegetables ?? []), ...(r.categories.includes('breakfast') ? p.preferredBreakfasts ?? [] : []), ...(r.categories.includes('snack') ? p.favoriteSnacks ?? [] : [])];
  for (const f of likes) if (termMatchesRecipe(f, r)) { add(5, `includes ${f}`); break; }
  for (const f of p.favoriteProteins) if (termMatchesRecipe(f, r)) { add(4, `features ${f}`); break; }
  for (const f of p.dislikedFoods) if (termMatchesRecipe(f, r)) add(-40);

  if (role) {
    const hits = role.want.filter((t) => r.tags.includes(t));
    if (hits.length) add(5 + 4 * hits.length, `fits “${role.label.toLowerCase()}”`);
    if (role.avoid?.some((t) => r.tags.includes(t))) add(-8);
    if (role.quick) add(r.prep + r.cook <= 15 ? 4 : r.prep + r.cook > 25 ? -6 : 0);
  }

  const g = new Set(p.goals);
  if ((g.has('high-protein') || g.has('muscle') || g.has('strength')) && r.tags.includes('high-protein')) add(4, 'higher in protein');
  if ((g.has('quick') || p.priority === 'convenience') && r.prep + r.cook <= 20) add(4, 'quick to make');
  if (p.priority === 'convenience' && (r.tags.includes('meal-prep') || r.tags.includes('make-ahead'))) add(2);
  if (g.has('family') && (r.tags.includes('family') || r.tags.includes('kid-friendly'))) add(3, 'family-friendly');
  if ((g.has('endurance') || g.has('youth-athlete') || g.has('competitive-athlete')) && r.tags.includes('athlete')) add(3, 'good training fuel');
  if (['athlete', 'heavy', 'very'].includes(p.activity) && r.tags.includes('athlete')) add(2);
  if (p.health.includes('diabetes')) { if (r.tags.includes('high-fiber')) add(3, 'higher in fibre'); if (r.tags.includes('sweet')) add(-5); }
  if (p.health.includes('digestive') && r.spice >= 2) add(-4);

  // budget
  if (ctx.targetPerServing) {
    const c = recipeCostPerServing(r, checkRecipeDiet(r, p).omit);
    const weight = p.priority === 'savings' || g.has('budget') ? 8 : 3;
    const ratio = c / ctx.targetPerServing;
    if (ratio < 0.8) add(weight * 0.6, 'budget-friendly');
    else if (ratio > 1.3) add(-weight * Math.min(2, ratio - 1));
  } else if (p.priority === 'savings' || g.has('budget')) {
    if (r.tags.includes('budget')) add(5, 'budget-friendly');
  }

  if (ctx.favorites.has(r.id)) add(6, 'one of your favourites');
  if (ctx.boost?.cuisines?.includes(r.cuisine)) add(14, `more ${r.cuisine} food, as requested`);
  if (ctx.boost?.tags?.some((t) => r.tags.includes(t))) add(12, 'matches your request');

  // reuse of perishable ingredients already on this week's list → less waste
  let reuse = 0; let pantryHits = 0;
  for (const ri of r.ingredients) {
    const ing = getIngredient(ri.id);
    if (!ing) continue;
    if (PERISHABLE.has(ing.aisle) && ctx.usedIngredients.has(ri.id)) reuse++;
    if (ctx.pantryIds.has(ri.id) || p.preferIngredients.includes(ri.id)) pantryHits++;
  }
  if (reuse) add(Math.min(6, reuse * 1.5), 'reuses ingredients from other meals');
  if (pantryHits) add(Math.min(10, pantryHits * 4), 'uses what’s in your pantry');

  // variety
  const used = ctx.usedCounts.get(r.id) ?? 0;
  if (used) add(-(p.priority === 'variety' || g.has('variety') ? 35 : 22) * used);
  if (ctx.dayCuisines.includes(r.cuisine)) add(-3);

  // spice and adventurousness
  if (r.spice > p.spiceTolerance) add(-6);
  if (p.adventurous === 1 && FAMILIAR.includes(r.cuisine)) add(2);
  if (p.adventurous === 3 && !FAMILIAR.includes(r.cuisine)) add(2, 'something new to try');

  return { score: s, why };
}

// ---------------------------------------------------------------- generation

export interface GenerateOptions {
  seed?: number;
  favorites?: string[];
  pantry?: PantryItem[];
  /** Existing plan to keep locked meals (and anything not being regenerated) from. */
  previous?: WeekPlan | null;
  /** Only regenerate these day indices. */
  onlyDays?: number[];
  /** Only regenerate these slots. */
  onlySlots?: SlotId[];
  /** Further restrict which unlocked meals get replaced. */
  replaceIf?: (meal: PlannedMeal, recipe: Recipe | undefined, day: number, slot: SlotId) => boolean;
  boost?: Boost;
}

export function budgetTargetPerServing(p: Profile): number | null {
  if (!p.weeklyBudget || p.weeklyBudget <= 0) return null;
  const meals = Math.max(1, p.slots.length) * 7;
  const snackShare = p.slots.filter((s) => s.includes('Snack')).length * 0.4;
  const weighted = (p.slots.length - p.slots.filter((s) => s.includes('Snack')).length + snackShare) * 7;
  return p.weeklyBudget / Math.max(1, (weighted || meals) * Math.max(1, p.eatersPerMeal));
}

export function makeScoreCtx(p: Profile, days: DayPlan[], opts: GenerateOptions): ScoreCtx {
  const usedCounts = new Map<string, number>();
  const usedIngredients = new Map<string, number>();
  for (const d of days) for (const m of Object.values(d)) {
    if (!m?.recipeId || m.leftoverOf) continue;
    usedCounts.set(m.recipeId, (usedCounts.get(m.recipeId) ?? 0) + 1);
    getRecipe(m.recipeId)?.ingredients.forEach((ri) => usedIngredients.set(ri.id, (usedIngredients.get(ri.id) ?? 0) + 1));
  }
  return {
    p,
    favorites: new Set(opts.favorites ?? []),
    pantryIds: new Set((opts.pantry ?? []).map((x) => x.ingredientId).filter(Boolean) as string[]),
    usedCounts, usedIngredients, dayRecipes: new Set(), dayCuisines: [],
    targetPerServing: budgetTargetPerServing(p),
    boost: opts.boost,
  };
}

export function candidatesFor(p: Profile, slot: SlotId, role?: Role): { list: Recipe[]; relaxed: boolean } {
  const base = RECIPES.filter((r) => isEligible(r, p, slot));
  if (role?.require?.length) {
    const req = base.filter((r) => role.require!.every((t) => r.tags.includes(t)));
    if (req.length) return { list: req, relaxed: false };
    return { list: base, relaxed: true };
  }
  return { list: base, relaxed: false };
}

function servingsFor(p: Profile, role?: Role): number {
  const eaters = Math.max(1, p.eatersPerMeal || 1);
  return eaters + (role?.extraPortion && (p.isAthlete || isMinor(p)) ? 0.5 : 0);
}

const slotIndex = (day: number, slot: SlotId) => day * 10 + SLOT_ORDER.indexOf(slot);

export function generatePlan(p: Profile, opts: GenerateOptions = {}): WeekPlan {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const prev = opts.previous;
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({ ...(prev?.days[i] ?? {}) }));
  const warnings = new Set<string>(profileConflicts(p));
  const contexts = Array.from({ length: 7 }, (_, i) => dayContext(p, i as Weekday));

  // 1. decide which meals are kept
  const replace = (d: number, slot: SlotId): boolean => {
    const m = days[d][slot];
    if (!m) return (!opts.onlyDays || opts.onlyDays.includes(d)) && (!opts.onlySlots || opts.onlySlots.includes(slot)) && !opts.replaceIf;
    if (m.locked) return false;
    if (opts.onlyDays && !opts.onlyDays.includes(d)) return false;
    if (opts.onlySlots && !opts.onlySlots.includes(slot)) return false;
    if (opts.replaceIf && !opts.replaceIf(m, getRecipe(m.recipeId), d, slot)) return false;
    return true;
  };
  const toFill: [number, SlotId][] = [];
  for (let d = 0; d < 7; d++) {
    const ctx = contexts[d];
    // drop meals in slots that are no longer part of the day (unless locked)
    for (const s of SLOT_ORDER) if (!ctx.slots.includes(s) && days[d][s] && !days[d][s]!.locked && replace(d, s)) delete days[d][s];
    for (const s of ctx.slots) if (replace(d, s)) { delete days[d][s]; toFill.push([d, s]); }
  }

  const score = makeScoreCtx(p, days, opts);
  const filled = new Set(toFill.map(([d, s]) => `${d}:${s}`));
  const leftoverBudget = p.leftovers === 'love' ? 4 : p.leftovers === 'ok' ? 2 : 0;
  let leftoversUsed = 0;
  const emptySlots = new Set<SlotId>();

  // 2. fill
  for (let d = 0; d < 7; d++) {
    const ctx = contexts[d];
    score.dayRecipes = new Set(Object.values(days[d]).map((m) => m?.recipeId).filter(Boolean) as string[]);
    score.dayCuisines = [...score.dayRecipes].map((id) => getRecipe(id)!.cuisine);
    for (const slot of ctx.slots) {
      if (!filled.has(`${d}:${slot}`) || days[d][slot]) continue;
      const role = ctx.roles[slot];
      const { list, relaxed } = candidatesFor(p, slot, role);
      if (relaxed && role?.require) warnings.add(`No recipes matched every requirement for “${role.label}”, so the closest fits were used.`);
      const pool = list.filter((r) => !score.dayRecipes.has(r.id));
      if (!pool.length) { emptySlots.add(slot); continue; }
      let best: Recipe | null = null; let bestScore = -Infinity;
      for (const r of pool) {
        const sc = scoreRecipe(r, role, score).score + rng() * (p.priority === 'variety' ? 10 : 7);
        if (sc > bestScore) { bestScore = sc; best = r; }
      }
      const r = best!;
      const meal: PlannedMeal = { uid: uid(), recipeId: r.id, servings: servingsFor(p, role), locked: false, prepared: false, role: role?.label };
      days[d][slot] = meal;
      score.dayRecipes.add(r.id);
      score.dayCuisines.push(r.cuisine);
      score.usedCounts.set(r.id, (score.usedCounts.get(r.id) ?? 0) + 1);
      r.ingredients.forEach((ri) => score.usedIngredients.set(ri.id, (score.usedIngredients.get(ri.id) ?? 0) + 1));

      // 3. planned leftovers: tonight's dinner → tomorrow's lunch
      if (slot === 'dinner' && leftoversUsed < leftoverBudget && r.leftoverFriendly && d < 6) {
        const nd = d + 1;
        const nctx = contexts[nd];
        const lunchRole = nctx.roles.lunch;
        const packable = !lunchRole?.require || r.tags.includes('portable') || r.tags.includes('meal-prep');
        if (nctx.slots.includes('lunch') && filled.has(`${nd}:lunch`) && !days[nd].lunch && packable) {
          days[nd].lunch = { uid: uid(), recipeId: r.id, servings: servingsFor(p, lunchRole), locked: false, prepared: false, leftoverOf: meal.uid, role: 'Leftovers from last night' };
          leftoversUsed++;
        }
      }
      // 4. batch breakfasts for meal-preppers
      if (slot === 'breakfast' && p.mealPrep && (r.tags.includes('meal-prep') || r.tags.includes('make-ahead')) && r.leftoverFriendly) {
        const capacity = Math.floor(r.servings / Math.max(1, p.eatersPerMeal)) - 1;
        for (let k = 1; k <= Math.min(2, capacity) && d + k < 7; k++) {
          const nd = d + k;
          if (!filled.has(`${nd}:breakfast`) || days[nd].breakfast || !contexts[nd].slots.includes('breakfast')) break;
          days[nd].breakfast = { uid: uid(), recipeId: r.id, servings: servingsFor(p), locked: false, prepared: false, leftoverOf: meal.uid, role: 'Batch-prepped earlier' };
        }
      }
    }
  }
  for (const slot of emptySlots) warnings.add(diagnoseSlot(RECIPES, p, slot).message);

  const plan: WeekPlan = {
    id: prev?.id ?? uid(), createdAt: new Date().toISOString(), seed,
    days: normalizeDays(days), explanation: [], warnings: [...warnings],
  };
  plan.explanation = explainPlan(p, plan, contexts);
  return plan;
}

/** Fix leftover links after edits: a leftover must point at an earlier meal of the same recipe. */
export function normalizeDays(days: DayPlan[]): DayPlan[] {
  const index = new Map<string, { pos: number; recipeId: string | null }>();
  days.forEach((d, di) => SLOT_ORDER.forEach((s) => { const m = d[s]; if (m) index.set(m.uid, { pos: slotIndex(di, s), recipeId: m.recipeId }); }));
  return days.map((d, di) => {
    const out: DayPlan = {};
    for (const s of SLOT_ORDER) {
      const m = d[s];
      if (!m) continue;
      if (m.leftoverOf) {
        const src = index.get(m.leftoverOf);
        if (!src || src.recipeId !== m.recipeId || src.pos >= slotIndex(di, s)) {
          const { leftoverOf: _drop, ...rest } = m;
          void _drop;
          out[s] = { ...rest, role: m.role?.startsWith('Leftovers') || m.role?.startsWith('Batch') ? undefined : m.role };
          continue;
        }
      }
      out[s] = m;
    }
    return out;
  });
}

export function leftoverServings(plan: WeekPlan, sourceUid: string): number {
  let n = 0;
  for (const d of plan.days) for (const m of Object.values(d)) if (m?.leftoverOf === sourceUid) n += m.servings;
  return n;
}

export function findMeal(plan: WeekPlan, mealUid: string): { day: number; slot: SlotId; meal: PlannedMeal } | null {
  for (let d = 0; d < 7; d++) for (const s of SLOT_ORDER) { const m = plan.days[d][s]; if (m?.uid === mealUid) return { day: d, slot: s, meal: m }; }
  return null;
}

// ---------------------------------------------------------------- alternatives

export interface Alternative { recipe: Recipe; score: number; why: string[] }

export function alternatives(p: Profile, plan: WeekPlan, day: number, slot: SlotId, opts: { favorites?: string[]; pantry?: PantryItem[]; query?: string } = {}): Alternative[] {
  const ctx = dayContext(p, day as Weekday);
  const role = ctx.roles[slot];
  const current = plan.days[day][slot]?.recipeId;
  const others = plan.days.map((d, i) => (i === day ? Object.fromEntries(Object.entries(d).filter(([s]) => s !== slot)) : d)) as DayPlan[];
  const sc = makeScoreCtx(p, others, opts);
  sc.dayRecipes = new Set(Object.entries(plan.days[day]).filter(([s]) => s !== slot).map(([, m]) => m?.recipeId).filter(Boolean) as string[]);
  sc.dayCuisines = [...sc.dayRecipes].map((id) => getRecipe(id)!.cuisine);
  const q = opts.query?.trim().toLowerCase();
  return candidatesFor(p, slot, role).list
    .filter((r) => r.id !== current && !sc.dayRecipes.has(r.id))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.ingredients.some((i) => i.id.includes(q)))
    .map((r) => ({ recipe: r, ...scoreRecipe(r, role, sc) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

// ---------------------------------------------------------------- explanation

export function explainPlan(p: Profile, plan: WeekPlan, contexts = Array.from({ length: 7 }, (_, i) => dayContext(p, i as Weekday))): string[] {
  const out: string[] = [];
  const meals = plan.days.flatMap((d, di) => SLOT_ORDER.filter((s) => d[s]).map((s) => ({ di, s, m: d[s]! })));
  const training = contexts.filter((c) => c.isTraining);
  const games = contexts.filter((c) => c.isGame).length;
  const sport = p.primarySport || 'training';
  if (training.length) {
    const pre = meals.filter((x) => x.m.role && /pre-|fuel/i.test(x.m.role)).length;
    const rec = meals.filter((x) => x.m.role && /recovery/i.test(x.m.role)).length;
    out.push(`Your ${training.length} ${sport.toLowerCase()} day${training.length > 1 ? 's' : ''}${games ? ` (including ${games} game day${games > 1 ? 's' : ''})` : ''} get ${pre} pre-session snack${pre === 1 ? '' : 's'} timed before practice and ${rec} recovery meal${rec === 1 ? '' : 's'} with carbohydrates and protein afterwards.`);
  } else if (p.isAthlete) {
    out.push('Add your training sessions on the Profile page so meals and snacks can be timed around practice.');
  }
  const packed = meals.filter((x) => x.m.role?.startsWith('Packed') || x.m.role?.includes('packed')).length;
  if (packed) out.push(`${packed} weekday lunches are portable so they travel well to ${p.schedule === 'work' ? 'work' : 'school'}.`);
  const left = meals.filter((x) => x.m.leftoverOf).length;
  if (left) out.push(`${left} meal${left > 1 ? 's are' : ' is'} planned leftovers or batch-prepped, so you cook less and ingredients aren't double-counted.`);
  // reused perishables
  const counts = new Map<string, number>();
  for (const x of meals) if (x.m.recipeId && !x.m.leftoverOf) getRecipe(x.m.recipeId)!.ingredients.forEach((ri) => {
    const ing = getIngredient(ri.id);
    if (ing && PERISHABLE.has(ing.aisle) && ing.group !== 'seasoning') counts.set(ing.name, (counts.get(ing.name) ?? 0) + 1);
  });
  const reused = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n.toLowerCase());
  if (reused.length) out.push(`Fresh ingredients such as ${reused.join(', ')} are reused across several meals to cut waste and keep grocery costs down.`);
  if (p.cuisines.length) {
    const hit = new Set(meals.map((x) => getRecipe(x.m.recipeId)?.cuisine).filter((c) => c && p.cuisines.includes(c)));
    if (hit.size) out.push(`Includes ${[...hit].join(', ')} dishes based on your cuisine preferences.`);
  }
  const strict = [...p.allergies.map((a) => a.replace('_', ' ')), ...p.customAllergies];
  if (strict.length || p.diet.some((d) => d !== 'omnivore')) {
    out.push(`Every recipe was checked against your ${[...p.diet.filter((d) => d !== 'omnivore'), ...(strict.length ? [`allergy list (${strict.join(', ')})`] : [])].join(' and ')} — no excluded ingredients are included.`);
  }
  out.push(`Recipes fit within ${p.maxPrep} min prep and ${p.maxCook} min cooking with the equipment you have.`);
  if (isMinor(p)) out.push('As a growing person, your plan focuses on regular, satisfying meals and snacks rather than calorie targets.');
  return out;
}
