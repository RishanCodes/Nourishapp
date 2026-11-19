import type { Dimension, Ingredient, Unit } from '../types';

export const UNIT_INFO: Record<Unit, { dim: Dimension; toBase: number; label: string }> = {
  g: { dim: 'mass', toBase: 1, label: 'g' },
  kg: { dim: 'mass', toBase: 1000, label: 'kg' },
  ml: { dim: 'volume', toBase: 1, label: 'ml' },
  l: { dim: 'volume', toBase: 1000, label: 'L' },
  tsp: { dim: 'volume', toBase: 5, label: 'tsp' },
  tbsp: { dim: 'volume', toBase: 15, label: 'tbsp' },
  cup: { dim: 'volume', toBase: 250, label: 'cup' },
  pc: { dim: 'count', toBase: 1, label: 'pc' },
};

export const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pc'];

export interface BaseQty { dim: Dimension; qty: number }

/** Convert to the unit's own base (g, ml or pc). */
export function toBase(qty: number, unit: Unit): BaseQty {
  const u = UNIT_INFO[unit];
  return { dim: u.dim, qty: qty * u.toBase };
}

/**
 * Convert a quantity into the ingredient's canonical dimension, using only reliable
 * conversions defined on the ingredient (grams per ml / grams per piece).
 * If no reliable conversion exists, the quantity stays in its own dimension.
 */
export function toIngredientBase(ing: Ingredient | undefined, qty: number, unit: Unit): BaseQty {
  const b = toBase(qty, unit);
  if (!ing || b.dim === ing.dim) return b;
  // volume → mass
  if (b.dim === 'volume' && ing.dim === 'mass' && ing.gPerMl) return { dim: 'mass', qty: b.qty * ing.gPerMl };
  // mass → volume
  if (b.dim === 'mass' && ing.dim === 'volume' && ing.gPerMl) return { dim: 'volume', qty: b.qty / ing.gPerMl };
  // count ↔ mass
  if (b.dim === 'count' && ing.dim === 'mass' && ing.gPerPc) return { dim: 'mass', qty: b.qty * ing.gPerPc };
  if (b.dim === 'mass' && ing.dim === 'count' && ing.gPerPc) return { dim: 'count', qty: b.qty / ing.gPerPc };
  return b;
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const trim = (n: number) => {
  const s = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

const FRACTIONS: [number, string][] = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
export function prettyNumber(n: number): string {
  if (n <= 0) return '0';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.06) return String(whole);
  if (frac > 0.94) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (Math.abs(best[0] - frac) < 0.07) return (whole ? `${whole} ` : '') + best[1];
  return trim(n);
}

/** Format a recipe-style quantity in its authored unit. */
export function formatRecipeQty(qty: number, unit: Unit, ing?: Ingredient): string {
  if (unit === 'pc') {
    const label = ing?.countLabel ?? '';
    const n = prettyNumber(qty);
    return label ? `${n} ${plural(label, qty)}` : n;
  }
  if (unit === 'g' && qty >= 1000) return `${trim(qty / 1000)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${trim(qty / 1000)} L`;
  if (unit === 'g' || unit === 'ml') return `${Math.round(qty)} ${UNIT_INFO[unit].label}`;
  return `${prettyNumber(qty)} ${UNIT_INFO[unit].label}`;
}

export function plural(label: string, qty: number): string {
  if (qty <= 1 || label.includes('(')) return qty > 1 && label.includes('(') ? label.replace(/^(\w+)/, '$1s') : label;
  if (label.endsWith('ch')) return label + 'es';
  if (label === 'tomato') return 'tomatoes';
  return label + 's';
}

/** Format a base quantity for shopping, respecting the metric/imperial preference. */
export function formatShopping(qty: number, dim: Dimension, ing: Ingredient | undefined, system: 'metric' | 'imperial' = 'metric'): string {
  if (dim === 'count') {
    const n = Math.max(1, Math.ceil(qty - 1e-6));
    const label = ing?.countLabel ?? 'item';
    return `${n} ${plural(label, n)}`;
  }
  if (dim === 'mass') {
    if (system === 'imperial') {
      const oz = qty / 28.3495;
      if (oz >= 16) return `${trim(round(oz / 16, 0.05))} lb`;
      return `${trim(Math.max(0.5, round(oz, 0.5)))} oz`;
    }
    if (qty >= 1000) return `${trim(round(qty / 1000, 0.05))} kg`;
    return `${Math.max(5, round(qty, qty < 100 ? 5 : 10))} g`;
  }
  // volume
  if (qty < 15) return `${prettyNumber(Math.max(0.25, Math.ceil(qty / 5 * 4 - 1e-6) / 4))} tsp`;
  if (qty < 60) return `${prettyNumber(Math.ceil(qty / 15 * 4 - 1e-6) / 4)} tbsp`;
  if (system === 'imperial') return `${prettyNumber(round(qty / 236.6, 0.25))} cups`;
  if (qty >= 1000) return `${trim(round(qty / 1000, 0.05))} L`;
  return `${round(qty, 10)} ml`;
}

/** Convert a base quantity back into the given display unit. */
export function fromBase(qty: number, unit: Unit): number {
  return qty / UNIT_INFO[unit].toBase;
}
