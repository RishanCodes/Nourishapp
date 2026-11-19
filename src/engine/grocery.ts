import { getIngredient } from '../data/ingredients';
import { getRecipe } from '../data/recipes';
import type { Aisle, Dimension, GroceryState, PantryItem, Profile, SlotId, WeekPlan } from '../types';
import { ingredientCost } from './cost';
import { checkRecipeDiet } from './diet';
import { DAYS_SHORT, SLOT_LABEL, SLOT_ORDER, leftoverServings } from './planner';
import { toIngredientBase } from './units';

export const AISLES: Aisle[] = [
  'Produce', 'Meat and poultry', 'Seafood', 'Dairy and alternatives', 'Bread and bakery', 'Rice, pasta and grains',
  'Canned and packaged foods', 'Frozen foods', 'Herbs and spices', 'Sauces and condiments', 'Snacks', 'Other',
];

export interface GrocerySource { day: number; slot: SlotId; label: string; qty: number }

export interface GroceryItem {
  key: string;
  ingredientId: string;
  name: string;
  aisle: Aisle;
  dim: Dimension;
  /** Total needed by the plan, in base units (g / ml / pc). */
  required: number;
  /** Covered by pantry, base units. */
  fromPantry: number;
  /** Amount to buy (after pantry and any manual override), base units. */
  toBuy: number;
  overridden: boolean;
  cost: number; // CAD
  sources: GrocerySource[];
  labelCheck: boolean;
  /** Purchase status relative to the amount currently needed. */
  status: 'todo' | 'done' | 'partial';
  boughtQty: number;
}

export const itemKey = (ingredientId: string, dim: Dimension) => `${ingredientId}|${dim}`;

/**
 * Aggregate all ingredient requirements from a plan.
 * - Scales each recipe by (planned servings + servings reserved for planned leftovers) / recipe servings.
 * - Leftover meals contribute nothing (their portions are cooked with the source meal).
 * - Optional ingredients that conflict with the profile are omitted.
 * - Quantities of the same ingredient are merged only when a reliable unit conversion exists.
 */
export function aggregatePlan(plan: WeekPlan, profile: Profile): Map<string, { ingredientId: string; dim: Dimension; qty: number; sources: GrocerySource[] }> {
  const map = new Map<string, { ingredientId: string; dim: Dimension; qty: number; sources: GrocerySource[] }>();
  const push = (id: string, dim: Dimension, qty: number, src: GrocerySource) => {
    const k = itemKey(id, dim);
    const e = map.get(k) ?? { ingredientId: id, dim, qty: 0, sources: [] };
    e.qty += qty;
    e.sources.push(src);
    map.set(k, e);
  };
  plan.days.forEach((day, di) => {
    for (const slot of SLOT_ORDER) {
      const m = day[slot];
      if (!m || m.leftoverOf) continue;
      const totalServings = m.servings + leftoverServings(plan, m.uid);
      if (m.custom) {
        for (const ri of m.custom.ingredients) {
          const b = toIngredientBase(getIngredient(ri.id), ri.qty * m.servings, ri.unit);
          push(ri.id, b.dim, b.qty, { day: di, slot, label: `${DAYS_SHORT[di]} ${SLOT_LABEL[slot]} · ${m.custom.name}`, qty: b.qty });
        }
        continue;
      }
      const r = getRecipe(m.recipeId);
      if (!r) continue;
      const omit = checkRecipeDiet(r, profile).omit;
      const factor = totalServings / r.servings;
      for (const ri of r.ingredients) {
        if (omit.includes(ri.id)) continue;
        const b = toIngredientBase(getIngredient(ri.id), ri.qty * factor, ri.unit);
        push(ri.id, b.dim, b.qty, { day: di, slot, label: `${DAYS_SHORT[di]} ${SLOT_LABEL[slot]} · ${r.name}`, qty: b.qty });
      }
    }
  });
  return map;
}

/** Pantry quantity of an ingredient expressed in the given dimension (only reliable conversions). */
export function pantryAmount(pantry: PantryItem[], ingredientId: string, dim: Dimension): number {
  let total = 0;
  for (const p of pantry) {
    if (p.ingredientId !== ingredientId || p.qty <= 0) continue;
    const b = toIngredientBase(getIngredient(ingredientId), p.qty, p.unit);
    if (b.dim === dim) total += b.qty;
  }
  return total;
}

const EPS = 1e-6;

export function buildGroceryList(plan: WeekPlan | null, profile: Profile, pantry: PantryItem[], state: GroceryState): GroceryItem[] {
  if (!plan) return [];
  const agg = aggregatePlan(plan, profile);
  const removed = new Set(state.removed);
  const items: GroceryItem[] = [];
  for (const [key, e] of agg) {
    if (removed.has(key)) continue;
    const ing = getIngredient(e.ingredientId);
    if (!ing) continue;
    const fromPantry = Math.min(e.qty, pantryAmount(pantry, e.ingredientId, e.dim));
    const need = Math.max(0, e.qty - fromPantry);
    const overridden = state.overrides[key] != null;
    const toBuy = overridden ? Math.max(0, state.overrides[key]) : need;
    const billable = e.dim === 'count' ? Math.ceil(toBuy - EPS) : toBuy;
    const bought = state.checked[key];
    let status: GroceryItem['status'] = 'todo';
    if (bought != null) status = bought + EPS >= toBuy ? 'done' : 'partial';
    items.push({
      key, ingredientId: e.ingredientId, name: ing.name, aisle: ing.aisle, dim: e.dim,
      required: e.qty, fromPantry, toBuy, overridden,
      cost: ingredientCost(ing, billable, e.dim), sources: e.sources,
      labelCheck: !!ing.labelCheck, status, boughtQty: bought ?? 0,
    });
  }
  return items.sort((a, b) => AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) || a.name.localeCompare(b.name));
}

export interface GrocerySummary {
  total: number; // CAD of items still needing purchase (toBuy > 0)
  byAisle: Record<string, number>;
  count: number;
  done: number;
  progress: number;
}

export function summarize(items: GroceryItem[], custom: GroceryState['custom']): GrocerySummary {
  const buy = items.filter((i) => i.toBuy > EPS);
  const byAisle: Record<string, number> = {};
  for (const i of buy) byAisle[i.aisle] = (byAisle[i.aisle] ?? 0) + i.cost;
  const total = buy.reduce((s, i) => s + i.cost, 0);
  const count = buy.length + custom.length;
  const done = buy.filter((i) => i.status === 'done').length + custom.filter((c) => c.checked).length;
  return { total, byAisle, count, done, progress: count ? done / count : 0 };
}
