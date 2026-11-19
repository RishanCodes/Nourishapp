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

/** All prices in NOURISH are Canadian dollars. */
export function money(cad: number): string {
  return `$${cad >= 100 ? Math.round(cad) : cad.toFixed(2)}`;
}
