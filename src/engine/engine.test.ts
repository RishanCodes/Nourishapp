import { describe, expect, it } from 'vitest';
import { INGREDIENT_MAP } from '../data/ingredients';
import { RECIPES, getRecipe } from '../data/recipes';
import { DEFAULT_PROFILE, DEMO_PROFILE, EMPTY_GROCERY } from '../store/defaults';
import type { PlannedMeal, Profile, WeekPlan } from '../types';
import { checkRecipeDiet, diagnoseSlot, recipeAllergens, recipeFlags } from './diet';
import { aggregatePlan, buildGroceryList, itemKey } from './grocery';
import { interpret } from './nlp';
import { adultEstimate, recipeNutrition } from './nutrition';
import { SLOT_ORDER, dayContext, generatePlan, leftoverServings } from './planner';
import { formatShopping, toIngredientBase } from './units';

const P = (patch: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, ...patch });
const meals = (plan: WeekPlan) => plan.days.flatMap((d) => SLOT_ORDER.map((s) => d[s]).filter(Boolean) as PlannedMeal[]);
const recipesIn = (plan: WeekPlan) => meals(plan).map((m) => getRecipe(m.recipeId)!).filter(Boolean);
const emptyPlan = (): WeekPlan => ({ id: 'x', createdAt: '', seed: 1, days: Array.from({ length: 7 }, () => ({})), explanation: [], warnings: [] });

describe('recipe database', () => {
  it('has at least 60 complete, distinct recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(RECIPES.map((r) => r.name)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      expect(r.steps.length, r.id).toBeGreaterThan(0);
      expect(r.ingredients.length, r.id).toBeGreaterThan(0);
      expect(r.storage, r.id).toBeTruthy();
      for (const ri of r.ingredients) expect(INGREDIENT_MAP[ri.id], `${r.id} → ${ri.id}`).toBeDefined();
    }
  });
  it('every ingredient used in a recipe converts into its priced dimension', () => {
    for (const r of RECIPES) for (const ri of r.ingredients) {
      const ing = INGREDIENT_MAP[ri.id];
      expect(toIngredientBase(ing, ri.qty, ri.unit).dim, `${r.id}: ${ri.id} ${ri.unit}`).toBe(ing.dim);
    }
  });
  it('covers every meal category with vegan options', () => {
    const vegan = P({ diet: ['vegan'] });
    for (const cat of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      expect(RECIPES.filter((r) => r.categories.includes(cat) && checkRecipeDiet(r, vegan).ok).length, cat).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('dietary constraints', () => {
  it('excludes confirmed allergens across a whole plan', () => {
    for (const allergen of ['peanut', 'dairy', 'egg', 'wheat', 'sesame', 'soy', 'fish', 'shellfish', 'tree_nut'] as const) {
      const p = P({ allergies: [allergen], maxCook: 60, maxPrep: 30, equipment: ['stovetop', 'oven', 'microwave', 'blender', 'toaster'] });
      const plan = generatePlan(p, { seed: 7 });
      for (const r of recipesIn(plan)) {
        const omit = checkRecipeDiet(r, p).omit;
        const used = r.ingredients.filter((ri) => !omit.includes(ri.id));
        for (const ri of used) expect(INGREDIENT_MAP[ri.id].allergens ?? [], `${allergen} in ${r.id}`).not.toContain(allergen);
      }
      // grocery list must not contain it either
      const items = buildGroceryList(plan, p, [], EMPTY_GROCERY);
      for (const i of items) expect(INGREDIENT_MAP[i.ingredientId].allergens ?? []).not.toContain(allergen);
    }
  });
  it('vegan plans contain no animal-derived ingredients (including honey)', () => {
    const p = P({ diet: ['vegan'], maxCook: 60, equipment: ['stovetop', 'oven', 'blender', 'microwave', 'toaster'] });
    for (const seed of [1, 2, 3]) {
      const plan = generatePlan(p, { seed });
      const items = buildGroceryList(plan, p, [], EMPTY_GROCERY);
      expect(items.length).toBeGreaterThan(5);
      for (const i of items) expect(INGREDIENT_MAP[i.ingredientId].flags ?? [], i.name).toEqual([]);
    }
  });
  it('celiac implies gluten-free and warns about oats', () => {
    const p = P({ health: ['celiac'] });
    const oats = getRecipe('b-overnight-oats')!;
    const c = checkRecipeDiet(oats, p);
    expect(c.ok).toBe(true);
    expect(c.warnings.join(' ')).toMatch(/certified gluten-free/);
    expect(checkRecipeDiet(getRecipe('d-turkey-bolognese')!, p).ok).toBe(false);
  });
  it('kosher rejects meat with dairy, halal rejects pork', () => {
    expect(checkRecipeDiet(getRecipe('d-butter-chicken')!, P({ diet: ['kosher'] })).ok).toBe(false);
    expect(checkRecipeDiet(getRecipe('d-maple-pork')!, P({ diet: ['halal'] })).ok).toBe(false);
    expect(checkRecipeDiet(getRecipe('d-sheet-pan-chicken')!, P({ diet: ['halal'] })).warnings.join(' ')).toMatch(/halal-certified/);
  });
  it('optional conflicting ingredients are omitted rather than rejecting the recipe', () => {
    const p = P({ allergies: ['dairy'] });
    const c = checkRecipeDiet(getRecipe('b-shakshuka')!, p);
    expect(c.ok).toBe(true);
    expect(c.omit).toContain('feta');
  });
  it('custom allergies and avoided ingredients are strict', () => {
    const p = P({ customAllergies: ['mushroom'], avoidIngredients: ['cilantro'] });
    expect(checkRecipeDiet(getRecipe('l-pita-pizzas')!, p).ok).toBe(false);
    expect(checkRecipeDiet(getRecipe('d-chana-masala')!, p).ok).toBe(false);
  });
  it('explains impossible combinations', () => {
    const p = P({ diet: ['vegan'], allergies: ['soy', 'peanut', 'tree_nut', 'sesame'], health: ['celiac'], maxPrep: 5, maxCook: 5, equipment: [] });
    const d = diagnoseSlot(RECIPES, p, 'dinner');
    expect(d.eligible).toBe(0);
    expect(d.message).toMatch(/No dinner recipes fit/);
    const plan = generatePlan(p, { seed: 1 });
    expect(plan.warnings.some((w) => /No dinner recipes fit/.test(w))).toBe(true);
  });
  it('derives allergens and flags from ingredients', () => {
    expect(recipeAllergens(getRecipe('s-energy-bites')!)).toContain('peanut');
    expect(recipeFlags(getRecipe('d-honey-garlic-salmon')!)).toEqual(expect.arrayContaining(['fish', 'honey']));
  });
});

describe('personalisation', () => {
  it('different profiles produce meaningfully different plans', () => {
    const a = generatePlan(DEMO_PROFILE, { seed: 42 });
    const b = generatePlan(P({ diet: ['vegan'], cuisines: ['Indian', 'Middle Eastern'], maxCook: 45, equipment: ['stovetop', 'oven'] }), { seed: 42 });
    const ra = new Set(recipesIn(a).map((r) => r.id));
    const rb = new Set(recipesIn(b).map((r) => r.id));
    const overlap = [...ra].filter((x) => rb.has(x)).length;
    expect(overlap / Math.max(ra.size, rb.size)).toBeLessThan(0.35);
  });
  it('athletic schedule adds pre-practice snacks and recovery dinners', () => {
    const ctx = dayContext(DEMO_PROFILE, 0);
    expect(ctx.isTraining).toBe(true);
    expect(ctx.roles.pmSnack?.label).toMatch(/Pre-practice/);
    expect(ctx.roles.dinner?.label).toMatch(/Recovery/);
    const rest = dayContext(DEMO_PROFILE, 6);
    expect(rest.isTraining).toBe(false);
    const plan = generatePlan(DEMO_PROFILE, { seed: 3 });
    const mon = plan.days[0];
    expect(getRecipe(mon.pmSnack!.recipeId)!.tags).toContain('pre-workout');
    expect(getRecipe(mon.dinner!.recipeId)!.tags.some((t) => ['recovery', 'high-protein', 'athlete'].includes(t))).toBe(true);
    // early morning conditioning on Wednesday → recovery morning snack
    expect(plan.days[2].amSnack).toBeDefined();
  });
  it('weekday school lunches are portable when required', () => {
    const plan = generatePlan(DEMO_PROFILE, { seed: 5 });
    for (let d = 0; d < 5; d++) {
      const m = plan.days[d].lunch!;
      const r = getRecipe(m.recipeId)!;
      expect(m.leftoverOf ? r.tags.some((t) => t === 'portable' || t === 'meal-prep') : r.tags.includes('portable'), `${d} ${r.id}`).toBe(true);
    }
  });
  it('respects cooking-time limits', () => {
    const p = P({ maxPrep: 10, maxCook: 15 });
    const plan = generatePlan(p, { seed: 11 });
    for (const r of recipesIn(plan)) { expect(r.prep).toBeLessThanOrEqual(10); expect(r.cook).toBeLessThanOrEqual(15); }
  });
  it('youth profiles never receive numeric calorie targets', () => {
    expect(adultEstimate({ ...DEMO_PROFILE, showNumbers: true })).toBeNull();
    const adult = P({ age: 30, sex: 'female', heightCm: 165, weightKg: 60, showNumbers: true, activity: 'moderate' });
    const est = adultEstimate(adult)!;
    expect(est.kcalLow).toBeGreaterThan(1500);
    expect(est.kcalHigh).toBeLessThan(2700);
  });
  it('explanation is specific to the profile', () => {
    const plan = generatePlan(DEMO_PROFILE, { seed: 9 });
    const text = plan.explanation.join(' ');
    expect(text).toMatch(/basketball/i);
    expect(text).toMatch(/portable/);
    expect(text).toMatch(/growing/);
  });
});

describe('planner interactions', () => {
  it('locked meals survive regeneration', () => {
    const first = generatePlan(DEMO_PROFILE, { seed: 1 });
    const locked = { ...first.days[1].dinner!, locked: true };
    first.days[1].dinner = locked;
    for (const seed of [2, 3, 4, 5]) {
      const next = generatePlan(DEMO_PROFILE, { seed, previous: first });
      expect(next.days[1].dinner).toEqual(locked);
    }
  });
  it('regenerating a day only changes that day', () => {
    const first = generatePlan(DEMO_PROFILE, { seed: 1 });
    const next = generatePlan(DEMO_PROFILE, { seed: 99, previous: first, onlyDays: [3] });
    for (const d of [0, 1, 2, 4, 5, 6]) expect(next.days[d]).toEqual(first.days[d]);
  });
  it('avoids repeating a recipe on the same day and limits weekly repeats', () => {
    const plan = generatePlan(P(), { seed: 4 });
    for (const d of plan.days) {
      const ids = Object.values(d).filter((m) => !m!.leftoverOf).map((m) => m!.recipeId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('grocery aggregation', () => {
  const withMeals = (...m: [number, keyof WeekPlan['days'][number], Partial<PlannedMeal>][]) => {
    const plan = emptyPlan();
    m.forEach(([d, s, meal], i) => { plan.days[d][s] = { uid: `m${i}`, recipeId: null, servings: 1, locked: false, prepared: false, ...meal }; });
    return plan;
  };
  it('consolidates the same ingredient across days', () => {
    // wrap: 300 g chicken breast / 2 servings; bento: 450 g / 3 servings.
    const plan = withMeals([0, 'lunch', { recipeId: 'l-chicken-hummus-wrap', servings: 2 }], [2, 'lunch', { recipeId: 'l-soy-ginger-bento', servings: 3 }]);
    const agg = aggregatePlan(plan, P());
    expect(agg.get(itemKey('chicken_breast', 'mass'))!.qty).toBeCloseTo(750);
    expect(agg.get(itemKey('chicken_breast', 'mass'))!.sources).toHaveLength(2);
  });
  it('scales ingredients with servings', () => {
    const one = aggregatePlan(withMeals([0, 'dinner', { recipeId: 'd-chana-masala', servings: 2 }]), P());
    const four = aggregatePlan(withMeals([0, 'dinner', { recipeId: 'd-chana-masala', servings: 8 }]), P());
    expect(four.get(itemKey('chickpeas_can', 'count'))!.qty).toBeCloseTo(one.get(itemKey('chickpeas_can', 'count'))!.qty * 4);
  });
  it('normalises compatible units (tsp + tbsp → ml) and converts spoons of mass ingredients', () => {
    // energy bites: 1 tbsp chia (12 g) ; overnight oats: 1 tbsp chia
    const plan = withMeals([0, 'breakfast', { recipeId: 'b-overnight-oats', servings: 2 }], [0, 'pmSnack', { recipeId: 's-energy-bites', servings: 8 }]);
    const chia = aggregatePlan(plan, P()).get(itemKey('chia_seeds', 'mass'))!;
    expect(chia.qty).toBeCloseTo(24);
    expect(formatShopping(7.5, 'volume', undefined)).toBe('1 ½ tsp');
    expect(formatShopping(45, 'volume', undefined)).toBe('3 tbsp');
  });
  it('does not double-count planned leftovers', () => {
    const plan = withMeals(
      [0, 'dinner', { uid: 'src', recipeId: 'd-chana-masala', servings: 1 }],
      [1, 'lunch', { recipeId: 'd-chana-masala', servings: 1, leftoverOf: 'src' }],
    );
    plan.days[0].dinner!.uid = 'src';
    expect(leftoverServings(plan, 'src')).toBe(1);
    const agg = aggregatePlan(plan, P());
    // 2 servings of a 4-serving recipe with 2 cans chickpeas → 1 can
    expect(agg.get(itemKey('chickpeas_can', 'count'))!.qty).toBeCloseTo(1);
    expect(agg.get(itemKey('chickpeas_can', 'count'))!.sources).toHaveLength(1);
  });
  it('subtracts pantry quantities', () => {
    const plan = withMeals([0, 'dinner', { recipeId: 'd-chana-masala', servings: 4 }]);
    const pantry = [{ uid: 'p1', ingredientId: 'basmati_rice', name: 'Rice', qty: 0.2, unit: 'kg' as const }];
    const items = buildGroceryList(plan, P(), pantry, EMPTY_GROCERY);
    const rice = items.find((i) => i.ingredientId === 'basmati_rice')!;
    expect(rice.required).toBeCloseTo(250);
    expect(rice.fromPantry).toBeCloseTo(200);
    expect(rice.toBuy).toBeCloseTo(50);
  });
  it('purchase checks are not carried over when more is needed later', () => {
    const plan = withMeals([0, 'dinner', { recipeId: 'd-chana-masala', servings: 4 }]);
    const key = itemKey('basmati_rice', 'mass');
    const state = { ...EMPTY_GROCERY, checked: { [key]: 250 } };
    expect(buildGroceryList(plan, P(), [], state).find((i) => i.key === key)!.status).toBe('done');
    plan.days[0].dinner!.servings = 8;
    const after = buildGroceryList(plan, P(), [], state).find((i) => i.key === key)!;
    expect(after.status).toBe('partial');
    expect(after.toBuy).toBeCloseTo(500);
  });
  it('grocery list updates when a meal changes', () => {
    const plan = withMeals([0, 'dinner', { recipeId: 'd-chana-masala', servings: 2 }]);
    const before = buildGroceryList(plan, P(), [], EMPTY_GROCERY).map((i) => i.ingredientId);
    plan.days[0].dinner!.recipeId = 'd-beef-broccoli';
    const after = buildGroceryList(plan, P(), [], EMPTY_GROCERY).map((i) => i.ingredientId);
    expect(before).toContain('chickpeas_can');
    expect(after).not.toContain('chickpeas_can');
    expect(after).toContain('beef_sirloin');
  });
});

describe('nutrition calculation', () => {
  it('produces plausible per-serving values', () => {
    const n = recipeNutrition(getRecipe('l-chicken-burrito-bowl')!);
    expect(n.kcal).toBeGreaterThan(400);
    expect(n.kcal).toBeLessThan(900);
    expect(n.protein).toBeGreaterThan(25);
  });
});

describe('natural-language commands', () => {
  it('interprets the documented examples', () => {
    const p = { ...DEMO_PROFILE };
    expect(interpret('Make my lunches easier to pack', p, 0).patch.portableLunch).toBe(true);
    const practice = interpret('I have basketball practice tomorrow', P(), 2);
    expect(practice.patch.sessions?.some((s) => s.day === 3)).toBe(true);
    expect(practice.regens[0].onlyDays).toEqual([3]);
    expect(interpret('Give me cheaper meals', p, 0).patch.priority).toBe('savings');
    expect(interpret("I don't like eggs", p, 0).patch.dislikedFoods).toContain('eggs');
    expect(interpret('Add more Indian food', P(), 0).patch.cuisines).toContain('Indian');
    expect(interpret('Make dinner take less than 20 minutes', p, 0).patch.slotMaxTime?.dinner).toBe(20);
    const use = interpret('Use the rice and chicken in my pantry', p, 0, []);
    expect(use.patch.preferIngredients).toEqual(expect.arrayContaining(['basmati_rice', 'chicken_breast']));
    expect(use.messages.join(' ')).toMatch(/isn’t in your pantry|aren’t in your pantry/);
  });
  it('reports unsupported requests honestly', () => {
    const r = interpret('Plan a trip to Paris', P(), 0);
    expect(r.understood).toBe(false);
    expect(r.regens).toHaveLength(0);
  });
  it('dislike command removes the food from regenerated meals', () => {
    const p = DEMO_PROFILE;
    let plan = generatePlan(p, { seed: 8 });
    const r = interpret("I don't like eggs", p, 0);
    const np = { ...p, ...r.patch };
    for (const rq of r.regens) plan = generatePlan(np, { seed: 9, previous: plan, replaceIf: (m, rec, d, s) => rq.replaceIf!(m, rec, d, s, np) });
    for (const rec of recipesIn(plan)) expect(rec.ingredients.some((i) => i.id === 'egg'), rec.id).toBe(false);
  });
});
