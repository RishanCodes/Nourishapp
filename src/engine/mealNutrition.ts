import { getRecipe } from '../data/recipes';
import type { DayPlan, PlannedMeal, Profile } from '../types';
import { checkRecipeDiet } from './diet';
import { addNutrition, ingredientsNutrition, recipeNutrition, scaleNutrition, type Nutrition } from './nutrition';

const ZERO: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Portions one person eats from this meal (e.g. 1.5 when an athlete gets an extra half portion). */
export function personalPortions(meal: PlannedMeal, p: Profile): number {
  return meal.servings / Math.max(1, p.eatersPerMeal);
}

/** Approximate nutrition one person gets from a planned meal. Null when it can't be calculated. */
export function mealNutrition(meal: PlannedMeal, p: Profile): Nutrition | null {
  if (meal.custom) {
    if (!meal.custom.ingredients.length) return null;
    return ingredientsNutrition(meal.custom.ingredients); // custom quantities are per serving
  }
  const r = getRecipe(meal.recipeId);
  if (!r) return null;
  return scaleNutrition(recipeNutrition(r, checkRecipeDiet(r, p).omit), personalPortions(meal, p));
}

/** Totals for one person across a day's planned meals. `missing` counts meals without data. */
export function dayNutrition(day: DayPlan, p: Profile): { total: Nutrition; missing: number } {
  let total = ZERO;
  let missing = 0;
  for (const m of Object.values(day)) {
    if (!m) continue;
    const n = mealNutrition(m, p);
    if (n) total = addNutrition(total, n); else missing++;
  }
  return { total, missing };
}

export const fmtKcal = (n: number) => `${Math.round(n / 10) * 10}`;
