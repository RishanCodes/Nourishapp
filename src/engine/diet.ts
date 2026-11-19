import { getIngredient, INGREDIENT_MAP } from '../data/ingredients';
import type { Allergen, DietPattern, FoodFlag, Profile, Recipe, RecipeIngredient, SlotId } from '../types';

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  peanut: 'Peanuts', tree_nut: 'Tree nuts', dairy: 'Dairy', egg: 'Eggs', soy: 'Soy', wheat: 'Wheat',
  gluten: 'Gluten', fish: 'Fish', shellfish: 'Shellfish', sesame: 'Sesame', lactose: 'Lactose',
};

export const DIET_LABEL: Record<DietPattern, string> = {
  omnivore: 'Omnivore', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', halal: 'Halal',
  kosher: 'Kosher', 'dairy-free': 'Dairy-free', 'gluten-free': 'Gluten-free',
};

const MEAT: FoodFlag[] = ['poultry', 'beef', 'pork', 'lamb'];
const DIET_BANS: Partial<Record<DietPattern, FoodFlag[]>> = {
  vegan: ['poultry', 'beef', 'pork', 'lamb', 'fish', 'shellfish', 'dairy', 'egg', 'honey', 'gelatin'],
  vegetarian: ['poultry', 'beef', 'pork', 'lamb', 'fish', 'shellfish', 'gelatin'],
  pescatarian: ['poultry', 'beef', 'pork', 'lamb', 'gelatin'],
  halal: ['pork', 'alcohol', 'gelatin'],
  kosher: ['pork', 'shellfish', 'gelatin'],
  'dairy-free': ['dairy'],
};

const FLAG_LABEL: Record<FoodFlag, string> = {
  poultry: 'poultry', beef: 'beef', pork: 'pork', lamb: 'lamb', fish: 'fish', shellfish: 'shellfish',
  dairy: 'dairy', egg: 'eggs', honey: 'honey', gelatin: 'gelatin', alcohol: 'alcohol',
};

export function recipeAllergens(recipe: Recipe, includeOptional = true): Allergen[] {
  const s = new Set<Allergen>();
  for (const ri of recipe.ingredients) {
    if (!includeOptional && ri.optional) continue;
    getIngredient(ri.id)?.allergens?.forEach((a) => s.add(a));
  }
  return [...s];
}

export function recipeFlags(recipe: Recipe): FoodFlag[] {
  const s = new Set<FoodFlag>();
  for (const ri of recipe.ingredients) if (!ri.optional) getIngredient(ri.id)?.flags?.forEach((f) => s.add(f));
  return [...s];
}

/** Which dietary patterns a recipe is compatible with (ignoring optional ingredients). */
export function recipeDiets(recipe: Recipe): DietPattern[] {
  const flags = new Set(recipeFlags(recipe));
  const allergens = new Set(recipeAllergens(recipe, false));
  const out: DietPattern[] = [];
  (['vegan', 'vegetarian', 'pescatarian', 'dairy-free'] as DietPattern[]).forEach((d) => {
    if (!(DIET_BANS[d] ?? []).some((f) => flags.has(f))) out.push(d);
  });
  if (!allergens.has('gluten')) out.push('gluten-free');
  return out;
}

/** Normalised words for free-text matching ("eggs" → "egg"). */
function norm(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z\s]/g, '').replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
}

/** Does the free-text term refer to this ingredient? */
export function termMatchesIngredient(term: string, ingredientId: string): boolean {
  const ing = INGREDIENT_MAP[ingredientId];
  if (!ing) return false;
  const t = norm(term);
  if (!t) return false;
  const names = [ing.id.replace(/_/g, ' '), ing.name, ...(ing.aka ?? [])].map((n) => n.toLowerCase());
  return names.some((n) => {
    const words = n.split(/[\s(),/-]+/).map(norm);
    return norm(n) === t || words.includes(t) || (t.length >= 4 && n.includes(t));
  });
}

export function termMatchesRecipe(term: string, recipe: Recipe): boolean {
  const t = norm(term);
  if (!t) return false;
  return recipe.ingredients.some((ri) => !ri.optional && termMatchesIngredient(term, ri.id)) || norm(recipe.name).includes(t);
}

/** Effective allergen set — celiac implies gluten; lactose intolerance maps to lactose. */
export function effectiveAllergens(p: Profile): Set<Allergen> {
  const s = new Set<Allergen>(p.allergies);
  if (p.health.includes('celiac') || p.diet.includes('gluten-free')) s.add('gluten');
  if (p.diet.includes('dairy-free') || p.diet.includes('vegan')) s.add('dairy');
  return s;
}

export interface IngredientCheck { ok: boolean; reason?: string }

/** Strict check of one recipe ingredient against the profile. */
export function checkIngredient(ri: RecipeIngredient, p: Profile): IngredientCheck {
  const ing = getIngredient(ri.id);
  if (!ing) return { ok: true };
  const allergens = effectiveAllergens(p);
  const hit = (ing.allergens ?? []).find((a) => allergens.has(a));
  if (hit) return { ok: false, reason: `contains ${ALLERGEN_LABEL[hit].toLowerCase()} (${ing.name})` };
  for (const d of p.diet) {
    const bans = DIET_BANS[d] ?? [];
    const f = (ing.flags ?? []).find((x) => bans.includes(x));
    if (f) return { ok: false, reason: `${FLAG_LABEL[f]} isn't ${DIET_LABEL[d].toLowerCase()} (${ing.name})` };
  }
  for (const c of p.customAllergies) if (termMatchesIngredient(c, ri.id)) return { ok: false, reason: `custom allergy: ${c} (${ing.name})` };
  for (const c of p.avoidIngredients) if (termMatchesIngredient(c, ri.id)) return { ok: false, reason: `avoided ingredient: ${c} (${ing.name})` };
  return { ok: true };
}

export interface RecipeCheck {
  ok: boolean;
  reasons: string[];
  /** Optional ingredients that must be left out for this profile. */
  omit: string[];
  /** Label-verification and certification notes. */
  warnings: string[];
}

export function checkRecipeDiet(recipe: Recipe, p: Profile): RecipeCheck {
  const reasons: string[] = [];
  const omit: string[] = [];
  const warnings = new Set<string>();
  const allergens = effectiveAllergens(p);
  for (const ri of recipe.ingredients) {
    const c = checkIngredient(ri, p);
    if (!c.ok) {
      if (ri.optional) omit.push(ri.id);
      else reasons.push(c.reason!);
      continue;
    }
    const ing = getIngredient(ri.id);
    if (!ing) continue;
    if (ing.labelCheck && (allergens.size > 0 || p.customAllergies.length > 0)) {
      warnings.add(`Check the label on ${ing.name.toLowerCase()} for hidden allergens and cross-contact.`);
    }
    if (ri.id === 'rolled_oats' && allergens.has('gluten')) warnings.add('Use oats labelled certified gluten-free (regular oats are often cross-contaminated).');
    if (ri.id === 'corn_tortilla' && allergens.has('gluten')) warnings.add('Choose corn tortillas labelled gluten-free.');
  }
  const flags = new Set(recipeFlags(recipe));
  if (p.diet.includes('halal') && MEAT.some((m) => flags.has(m))) warnings.add('Choose halal-certified meat and poultry.');
  if (p.diet.includes('kosher')) {
    const hasMeat = MEAT.some((m) => flags.has(m));
    const hasDairy = recipe.ingredients.some((ri) => !omit.includes(ri.id) && getIngredient(ri.id)?.flags?.includes('dairy'));
    if (hasMeat && hasDairy) reasons.push('combines meat and dairy (not kosher)');
    if (hasMeat) warnings.add('Choose kosher-certified meat and poultry.');
  }
  return { ok: reasons.length === 0, reasons, omit, warnings: [...warnings] };
}

export const SLOT_CATEGORY: Record<SlotId, Recipe['categories'][number]> = {
  breakfast: 'breakfast', amSnack: 'snack', lunch: 'lunch', pmSnack: 'snack', dinner: 'dinner', eveSnack: 'snack',
};

export interface FitCheck { ok: boolean; reasons: string[] }

/** Practical constraints: time, equipment, skill, spice. */
export function checkPractical(recipe: Recipe, p: Profile, slot?: SlotId): FitCheck {
  const reasons: string[] = [];
  const handsOff = recipe.equipment.includes('slow cooker');
  if (recipe.prep > p.maxPrep) reasons.push(`prep ${recipe.prep} min exceeds ${p.maxPrep} min`);
  if (!handsOff && recipe.cook > p.maxCook) reasons.push(`cook time ${recipe.cook} min exceeds ${p.maxCook} min`);
  const slotMax = slot ? p.slotMaxTime[slot] : undefined;
  if (slotMax && recipe.prep + (handsOff ? 0 : recipe.cook) > slotMax) reasons.push(`over your ${slotMax}-minute limit`);
  const owned = new Set([...p.equipment, 'none']);
  const missing = recipe.equipment.filter((e) => !owned.has(e));
  if (missing.length) reasons.push(`needs ${missing.join(', ')}`);
  if (recipe.skill > p.skill) reasons.push('above selected cooking skill');
  if (recipe.spice > p.spiceTolerance + 1) reasons.push('too spicy for your preference');
  return { ok: reasons.length === 0, reasons };
}

export function isEligible(recipe: Recipe, p: Profile, slot: SlotId): boolean {
  if (!recipe.categories.includes(SLOT_CATEGORY[slot])) return false;
  return checkRecipeDiet(recipe, p).ok && checkPractical(recipe, p, slot).ok;
}

export interface Diagnosis {
  slot: SlotId;
  total: number;
  eligible: number;
  /** Constraint → how many recipes it alone eliminates. */
  blockers: { label: string; count: number }[];
  message: string;
}

/** Explain why a slot has few/no eligible recipes. */
export function diagnoseSlot(recipes: Recipe[], p: Profile, slot: SlotId): Diagnosis {
  const cat = SLOT_CATEGORY[slot];
  const pool = recipes.filter((r) => r.categories.includes(cat));
  const tally = new Map<string, number>();
  let eligible = 0;
  for (const r of pool) {
    const d = checkRecipeDiet(r, p);
    const pr = checkPractical(r, p, slot);
    if (d.ok && pr.ok) { eligible++; continue; }
    const keys = new Set<string>();
    d.reasons.forEach((x) => keys.add(categorizeReason(x)));
    pr.reasons.forEach((x) => keys.add(categorizeReason(x)));
    keys.forEach((k) => tally.set(k, (tally.get(k) ?? 0) + 1));
  }
  const blockers = [...tally.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const name = cat === 'snack' ? 'snack' : cat;
  const message = eligible === 0
    ? `No ${name} recipes fit all of your settings. The biggest limits are: ${blockers.slice(0, 3).map((b) => `${b.label} (rules out ${b.count})`).join('; ')}. Try relaxing one of these on your profile, or add a custom meal.`
    : `${eligible} of ${pool.length} ${name} recipes fit your settings.`;
  return { slot, total: pool.length, eligible, blockers, message };
}

function categorizeReason(r: string): string {
  if (r.startsWith('contains')) return 'allergies';
  if (r.includes("isn't") || r.includes('kosher')) return 'dietary pattern';
  if (r.startsWith('custom allergy')) return 'custom allergies';
  if (r.startsWith('avoided')) return 'avoided ingredients';
  if (r.startsWith('prep') || r.startsWith('cook') || r.includes('limit')) return 'time limits';
  if (r.startsWith('needs')) return 'kitchen equipment';
  if (r.includes('skill')) return 'cooking skill';
  if (r.includes('spicy')) return 'spice tolerance';
  return r;
}

/** Profile-level conflicts that make planning impossible or very limited. */
export function profileConflicts(p: Profile): string[] {
  const out: string[] = [];
  const has = (d: DietPattern) => p.diet.includes(d);
  if (has('vegan') && has('pescatarian')) out.push('Vegan and pescatarian conflict — vegan excludes fish, so the plan will follow vegan rules.');
  if (has('vegan') && p.allergies.includes('soy') && (p.allergies.includes('peanut') || p.allergies.includes('tree_nut')) && effectiveAllergens(p).has('gluten'))
    out.push('Vegan + soy-free + nut-free + gluten-free removes most plant proteins; expect a smaller set of recipes built on beans, lentils and chickpeas.');
  if (p.equipment.length === 0) out.push('No cooking equipment selected — only no-cook recipes can be suggested.');
  if (p.maxPrep < 5) out.push('A prep-time limit under 5 minutes leaves very few options.');
  return out;
}
