import { AlertTriangle, Clock, Heart, Minus, Plus, Snowflake, Users, Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getIngredient } from '../data/ingredients';
import { ALLERGEN_LABEL, DIET_LABEL, checkPractical, checkRecipeDiet, recipeAllergens, recipeDiets } from '../engine/diet';
import { recipeCostPerServing } from '../engine/cost';
import { foodGroups, recipeNutrition } from '../engine/nutrition';
import { DAYS, SLOT_LABEL, SLOT_ORDER } from '../engine/planner';
import { formatRecipeQty } from '../engine/units';
import { useMoney } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Recipe, SlotId } from '../types';
import { Dialog, Notice, cx } from './ui';

export function RecipeVisual({ recipe, size = 'md', className }: { recipe: Pick<Recipe, 'emoji' | 'hue' | 'name'>; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'h-12 w-12 text-2xl rounded-xl' : size === 'lg' ? 'h-40 w-full text-6xl rounded-2xl' : 'h-16 w-16 text-3xl rounded-2xl';
  return (
    <div role="img" aria-label={recipe.name} className={cx('flex shrink-0 items-center justify-center', dims, className)}
      style={{ background: `linear-gradient(135deg, hsl(${recipe.hue} 55% 88%), hsl(${(recipe.hue + 30) % 360} 45% 78%))` }}>
      <span className="drop-shadow-sm">{recipe.emoji}</span>
    </div>
  );
}

export const totalTime = (r: Recipe) => r.prep + (r.equipment.includes('slow cooker') ? 0 : r.cook);
export const timeLabel = (r: Recipe) => r.equipment.includes('slow cooker') ? `${r.prep} min + ${Math.round(r.cook / 60)} h slow cook` : `${r.prep + r.cook} min`;

const TAG_LABEL: Record<string, string> = {
  'pre-workout': 'Pre-training', 'meal-prep': 'Meal prep', 'make-ahead': 'Make ahead', 'high-protein': 'Protein-rich',
  'kid-friendly': 'Kid-friendly', 'high-fiber': 'Fibre-rich', recovery: 'Recovery', portable: 'Portable', athlete: 'Athlete fuel',
  budget: 'Budget', quick: 'Quick', family: 'Family', sweet: 'Sweet',
};
export const tagLabel = (t: string) => TAG_LABEL[t] ?? t;

export function DietBadges({ recipe, max = 3 }: { recipe: Recipe; max?: number }) {
  const diets = recipeDiets(recipe).filter((d) => d !== 'pescatarian' || !recipeDiets(recipe).includes('vegetarian'));
  return (
    <>
      {diets.slice(0, max).map((d) => (
        <span key={d} className="tag bg-sage-50 text-sage-800 dark:bg-sage-500/15 dark:text-sage-200">{DIET_LABEL[d]}</span>
      ))}
    </>
  );
}

export function RecipeDetail({ recipe, onClose, servings: initialServings, onAddToPlan }: { recipe: Recipe | null; onClose: () => void; servings?: number; onAddToPlan?: (r: Recipe) => void }) {
  const profile = useStore((s) => s.profile);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const fmt = useMoney();
  const [servings, setServings] = useState<number | null>(null);
  const s = servings ?? initialServings ?? recipe?.servings ?? 1;
  const info = useMemo(() => {
    if (!recipe) return null;
    const diet = checkRecipeDiet(recipe, profile);
    return {
      diet, practical: checkPractical(recipe, profile), allergens: recipeAllergens(recipe, false),
      nutrition: recipeNutrition(recipe, diet.omit), groups: foodGroups(recipe), cost: recipeCostPerServing(recipe, diet.omit),
    };
  }, [recipe, profile]);
  if (!recipe || !info) return null;
  const factor = s / recipe.servings;
  const fav = favorites.includes(recipe.id);
  const close = () => { setServings(null); onClose(); };

  return (
    <Dialog open onClose={close} title={recipe.name} wide
      footer={<>
        <button className="btn-secondary" onClick={() => toggleFavorite(recipe.id)} aria-pressed={fav}>
          <Heart size={16} className={fav ? 'fill-clay-500 text-clay-500' : ''} /> {fav ? 'Saved' : 'Save favourite'}
        </button>
        {onAddToPlan && <button className="btn-primary" onClick={() => onAddToPlan(recipe)}>Add to plan</button>}
      </>}>
      <div className="grid gap-5 md:grid-cols-[220px,1fr]">
        <div className="space-y-3">
          <RecipeVisual recipe={recipe} size="lg" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Meta icon={<Clock size={14} />} label="Prep" value={`${recipe.prep} min`} />
            <Meta icon={<Utensils size={14} />} label="Cook" value={recipe.equipment.includes('slow cooker') ? `${Math.round(recipe.cook / 60)} h (hands-off)` : `${recipe.cook} min`} />
            <Meta label="Cuisine" value={recipe.cuisine} />
            <Meta label="Est. cost" value={`${fmt(info.cost)}/serving`} />
          </div>
          <div className="text-xs muted">Equipment: {recipe.equipment.filter((e) => e !== 'none').join(', ') || 'none'} · Skill: {['', 'Beginner', 'Intermediate', 'Advanced'][recipe.skill]}</div>
        </div>
        <div className="min-w-0 space-y-4">
          <p className="text-sm leading-relaxed">{recipe.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <DietBadges recipe={recipe} max={5} />
            {recipe.tags.slice(0, 6).map((t) => <span key={t} className="tag">{tagLabel(t)}</span>)}
          </div>
          {info.allergens.length > 0 && (
            <p className="text-xs"><span className="font-semibold">Contains:</span> {info.allergens.filter((a) => a !== 'lactose' || !info.allergens.includes('dairy')).map((a) => ALLERGEN_LABEL[a]).join(', ')}</p>
          )}
          {!info.diet.ok && <Notice tone="warn" icon={<AlertTriangle size={16} />}>Not suitable for your profile: {info.diet.reasons.join('; ')}.</Notice>}
          {info.diet.ok && !info.practical.ok && <Notice tone="warn" icon={<AlertTriangle size={16} />}>Outside your cooking settings: {info.practical.reasons.join('; ')}.</Notice>}
          {info.diet.omit.length > 0 && <Notice tone="info">Leave out {info.diet.omit.map((i) => getIngredient(i)?.name.toLowerCase()).join(', ')} for your diet — it's optional and excluded from your grocery list.</Notice>}
          {info.diet.warnings.length > 0 && <Notice tone="info" icon={<AlertTriangle size={16} />}><ul className="list-disc space-y-0.5 pl-4">{info.diet.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Notice>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr,1.3fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">Ingredients</h3>
            <div className="flex items-center gap-1 rounded-xl border border-sand-200 p-1 dark:border-white/10">
              <button className="icon-btn h-7 w-7" aria-label="Fewer servings" onClick={() => setServings(Math.max(0.5, s - (s > 1 ? 1 : 0.5)))}><Minus size={14} /></button>
              <span className="flex min-w-[5.5rem] items-center justify-center gap-1 text-xs font-medium"><Users size={13} />{s} serving{s === 1 ? '' : 's'}</span>
              <button className="icon-btn h-7 w-7" aria-label="More servings" onClick={() => setServings(Math.min(20, s + 1))}><Plus size={14} /></button>
            </div>
          </div>
          <ul className="divide-y divide-sand-200 text-sm dark:divide-white/5">
            {recipe.ingredients.map((ri) => {
              const ing = getIngredient(ri.id);
              const omitted = info.diet.omit.includes(ri.id);
              return (
                <li key={ri.id} className={cx('flex justify-between gap-3 py-2', omitted && 'line-through opacity-50')}>
                  <span>{ing?.name ?? ri.id}{ri.note && <span className="muted"> · {ri.note}</span>}{ri.optional && <span className="muted"> (optional)</span>}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatRecipeQty(ri.qty * factor, ri.unit, ing)}</span>
                </li>
              );
            })}
          </ul>
          {recipe.substitutions && recipe.substitutions.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold">Substitutions</h4>
              <ul className="space-y-1 text-sm">
                {recipe.substitutions.map((x) => <li key={x.from}><span className="font-medium">{x.from}</span> → {x.to}{x.note && <span className="muted"> ({x.note})</span>}</li>)}
              </ul>
            </div>
          )}
        </section>
        <section>
          <h3 className="section-title mb-3">Method</h3>
          <ol className="space-y-3 text-sm leading-relaxed">
            {recipe.steps.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xs font-semibold text-sage-800 dark:bg-sage-500/20 dark:text-sage-200">{i + 1}</span>
                <span className="pt-0.5">{st}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 space-y-2 rounded-xl bg-sand-50 p-3.5 text-sm dark:bg-white/5">
            <p className="flex gap-2"><Snowflake size={15} className="mt-0.5 shrink-0 text-sage-600" /><span><span className="font-medium">Storage:</span> {recipe.storage}</span></p>
            <p className="pl-6"><span className="font-medium">Leftovers:</span> {recipe.leftovers}</p>
          </div>
          <div className="mt-5">
            <h4 className="mb-2 text-sm font-semibold">Nutrition</h4>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {info.groups.map((g) => <span key={g} className="tag capitalize">{g}</span>)}
            </div>
            {profile.showNumbers ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {([['≈ kcal', info.nutrition.kcal], ['Protein', `${info.nutrition.protein} g`], ['Carbs', `${info.nutrition.carbs} g`], ['Fat', `${info.nutrition.fat} g`]] as const).map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-sand-50 py-2 dark:bg-white/5"><div className="font-semibold tabular-nums">{v}</div><div className="text-[11px] muted">{l}</div></div>
                  ))}
                </div>
                <p className="hint mt-2">Approximate, per serving ({info.nutrition.fiber} g fibre). Calculated from generic USDA-style reference values for each ingredient; brands and portions vary.</p>
              </>
            ) : (
              <p className="hint">Turn on nutrition numbers in My Profile to see calories, protein, carbs and fat.</p>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

function Meta({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand-50 px-3 py-2 dark:bg-white/5">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide muted">{icon}{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export function AddToPlanDialog({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const setMeal = useStore((s) => s.setMeal);
  const plan = useStore((s) => s.plan);
  const generate = useStore((s) => s.generate);
  const [day, setDay] = useState(0);
  const slots = SLOT_ORDER.filter((sl) => {
    const cat = sl === 'breakfast' ? 'breakfast' : sl === 'lunch' ? 'lunch' : sl === 'dinner' ? 'dinner' : 'snack';
    return recipe?.categories.includes(cat);
  });
  const [slot, setSlot] = useState<SlotId | null>(null);
  if (!recipe) return null;
  const chosen = slot ?? slots[0] ?? 'dinner';
  const existing = plan?.days[day][chosen];
  return (
    <Dialog open onClose={onClose} title={`Add ${recipe.name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { if (!plan) generate(); setMeal(day, chosen, recipe.id); onClose(); }}>Add to {DAYS[day]}</button></>}>
      <div className="space-y-4">
        <div>
          <p className="label">Day</p>
          <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <button key={d} className={day === i ? 'chip-on' : 'chip-off'} onClick={() => setDay(i)}>{d.slice(0, 3)}</button>)}</div>
        </div>
        <div>
          <p className="label">Meal</p>
          <div className="flex flex-wrap gap-2">{(slots.length ? slots : SLOT_ORDER).map((sl) => <button key={sl} className={chosen === sl ? 'chip-on' : 'chip-off'} onClick={() => setSlot(sl)}>{SLOT_LABEL[sl]}</button>)}</div>
        </div>
        {existing && <p className="hint">This replaces the {SLOT_LABEL[chosen].toLowerCase()} currently planned for {DAYS[day]}{existing.locked ? ' (it is locked, but a manual change overrides the lock)' : ''}.</p>}
      </div>
    </Dialog>
  );
}
