import { getIngredient } from '../data/ingredients';
import type { ActivityLevel, Profile, Recipe } from '../types';
import { toIngredientBase } from './units';

export interface Nutrition { kcal: number; protein: number; carbs: number; fat: number; fiber: number }

/** Approximate per-serving nutrition, calculated from the generic per-100 g reference values in the catalog. */
export function recipeNutrition(recipe: Recipe, omit: string[] = []): Nutrition {
  const t: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const ri of recipe.ingredients) {
    if (ri.optional || omit.includes(ri.id)) continue;
    const ing = getIngredient(ri.id);
    if (!ing?.n) continue;
    const b = toIngredientBase(ing, ri.qty, ri.unit);
    if (b.dim !== ing.dim) continue; // no reliable conversion → skip rather than guess
    const factor = ing.dim === 'count' ? b.qty : b.qty / 100;
    t.kcal += ing.n.kcal * factor;
    t.protein += ing.n.p * factor;
    t.carbs += ing.n.c * factor;
    t.fat += ing.n.f * factor;
    t.fiber += (ing.n.fib ?? 0) * factor;
  }
  const s = recipe.servings;
  return {
    kcal: Math.round(t.kcal / s / 10) * 10,
    protein: Math.round(t.protein / s),
    carbs: Math.round(t.carbs / s),
    fat: Math.round(t.fat / s),
    fiber: Math.round(t.fiber / s),
  };
}

export type FoodGroup = 'protein' | 'vegetable' | 'fruit' | 'grain' | 'dairy';
export function foodGroups(recipe: Recipe): FoodGroup[] {
  const s = new Set<FoodGroup>();
  for (const ri of recipe.ingredients) {
    const g = getIngredient(ri.id)?.group;
    if (g === 'protein' || g === 'vegetable' || g === 'fruit' || g === 'grain' || g === 'dairy') s.add(g);
  }
  return [...s];
}

export function isMinor(p: Profile): boolean {
  if (p.age != null) return p.age < 18;
  return p.lifeStage === 'child' || p.lifeStage === 'teen';
}

export function lifeStageFromAge(age: number | null): Profile['lifeStage'] {
  if (age == null) return 'adult';
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  if (age >= 65) return 'older';
  return 'adult';
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, athlete: 1.8, heavy: 1.9,
};

export interface Estimate {
  kcalLow: number; kcalHigh: number;
  proteinLow: number; proteinHigh: number;
  method: string;
}

/**
 * Optional adult-only estimate. Mifflin–St Jeor resting energy × a standard activity factor,
 * shown as a ±10 % range. Protein range uses commonly cited g/kg ranges (0.8 general; 1.2–2.0 for
 * regular training). Returns null for minors, missing data, or when the user hasn't opted in.
 */
export function adultEstimate(p: Profile): Estimate | null {
  if (isMinor(p) || !p.showNumbers) return null;
  if (!p.age || !p.heightCm || !p.weightKg || p.sex === 'unspecified') return null;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[p.activity];
  const training = ['very', 'athlete', 'heavy'].includes(p.activity) || p.goals.some((g) => ['muscle', 'strength', 'endurance', 'competitive-athlete'].includes(g));
  const [pl, ph] = training ? [1.2, 1.8] : [0.8, 1.2];
  return {
    kcalLow: Math.round((tdee * 0.9) / 50) * 50,
    kcalHigh: Math.round((tdee * 1.1) / 50) * 50,
    proteinLow: Math.round(p.weightKg * pl),
    proteinHigh: Math.round(p.weightKg * ph),
    method: 'Mifflin–St Jeor equation × activity factor; protein from g/kg ranges. Rough estimate only — individual needs vary.',
  };
}

/** Non-numerical guidance for growing users and anyone who hasn't opted into numbers. */
export function guidance(p: Profile): string[] {
  const out: string[] = [];
  const minor = isMinor(p);
  const athlete = p.isAthlete || ['athlete', 'heavy', 'very'].includes(p.activity);
  if (minor) {
    out.push('Growing bodies need regular meals and snacks — aim to eat every 3–4 hours and let hunger guide portion size.');
    out.push('Build most meals with a protein, a grain or starchy food, and fruit or vegetables.');
  } else {
    out.push('Build balanced plates: a protein source, whole grains or starchy vegetables, and plenty of produce.');
  }
  if (athlete) {
    out.push('On training days, have a carbohydrate-rich snack 1–2 hours before practice and a meal or snack with protein and carbs within about an hour afterwards.');
    out.push('Larger or second portions on hard training days are normal — eat to appetite.');
    out.push('Hydration: drink water through the day and during practice; for long or very sweaty sessions, ask your coach or a sports dietitian about electrolytes.');
  } else {
    out.push('Keep water handy through the day; thirst and pale-yellow urine are useful guides.');
  }
  if (p.health.includes('diabetes')) out.push('You indicated diabetes: NOURISH favours higher-fibre meals, but follow the carbohydrate guidance from your diabetes care team.');
  if (p.health.includes('celiac')) out.push('Celiac disease: recipes exclude gluten ingredients, but always verify packaged foods are certified gluten-free.');
  if (p.health.includes('clinician') || p.health.includes('other') || p.health.includes('digestive'))
    out.push('NOURISH supports restrictions you enter, but it does not provide medical nutrition therapy — follow your clinician’s plan where it differs.');
  return out;
}
