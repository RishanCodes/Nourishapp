import { getIngredient } from '../data/ingredients';
import type { Dimension, Ingredient, Recipe } from '../types';
import { toIngredientBase } from './units';

/** Approximate cost for a base quantity (g/ml/pc) of an ingredient, in CAD. */
export function ingredientCost(ing: Ingredient, qty: number, dim: Dimension): number {
  if (dim !== ing.dim) {
    // No reliable conversion back to the priced dimension — estimate nothing rather than guess.
    return 0;
  }
  return ing.dim === 'count' ? qty * ing.price : (qty / 1000) * ing.price;
}

/** Proportional (used-amount) cost per serving, CAD. */
export function recipeCostPerServing(recipe: Recipe, omit: string[] = []): number {
  let total = 0;
  for (const ri of recipe.ingredients) {
    if (ri.optional || omit.includes(ri.id)) continue;
    const ing = getIngredient(ri.id);
    if (!ing) continue;
    const b = toIngredientBase(ing, ri.qty, ri.unit);
    total += ingredientCost(ing, b.qty, b.dim);
  }
  return total / recipe.servings;
}

/** Rough display conversion from CAD reference prices. Approximate only. */
export const CURRENCY_RATE: Record<string, number> = { CAD: 1, USD: 0.73, EUR: 0.67, GBP: 0.57, AUD: 1.1, INR: 61, MXN: 13.5 };
export const CURRENCY_SYMBOL: Record<string, string> = { CAD: 'CA$', USD: 'US$', EUR: '€', GBP: '£', AUD: 'A$', INR: '₹', MXN: 'MX$' };

export function money(cad: number, currency: string): string {
  const rate = CURRENCY_RATE[currency] ?? 1;
  const v = cad * rate;
  const sym = CURRENCY_SYMBOL[currency] ?? currency + ' ';
  return `${sym}${v >= 100 ? Math.round(v) : v.toFixed(2)}`;
}

/** Convert a user-entered budget in their currency into CAD for comparison. */
export function toCad(amount: number, currency: string): number {
  return amount / (CURRENCY_RATE[currency] ?? 1);
}
