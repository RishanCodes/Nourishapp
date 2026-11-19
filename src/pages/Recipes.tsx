import { Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RECIPES } from '../data/recipes';
import { recipeCostPerServing } from '../engine/cost';
import { DIET_LABEL, checkPractical, checkRecipeDiet, recipeDiets } from '../engine/diet';
import { AddToPlanDialog, DietBadges, RecipeDetail, RecipeVisual, tagLabel, timeLabel, totalTime } from '../components/RecipeBits';
import { Chip, Empty, PageHeader, Toggle, cx } from '../components/ui';
import { useMoney } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Cuisine, DietPattern, MealCategory, Recipe } from '../types';

const CATS: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const CUISINES = [...new Set(RECIPES.map((r) => r.cuisine))].sort() as Cuisine[];
const DIETS: DietPattern[] = ['vegetarian', 'vegan', 'pescatarian', 'dairy-free', 'gluten-free'];
const TIMES = [15, 30, 45] as const;
const SPECIAL = ['portable', 'athlete', 'budget', 'meal-prep', 'quick'] as const;

export default function Recipes() {
  const { profile, favorites, toggleFavorite } = useStore();
  const fmt = useMoney();
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<MealCategory[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [diets, setDiets] = useState<DietPattern[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [fits, setFits] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState<Recipe | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RECIPES.filter((r) => {
      if (t && !(r.name.toLowerCase().includes(t) || r.description.toLowerCase().includes(t) || r.cuisine.toLowerCase().includes(t) || r.ingredients.some((i) => i.id.replace(/_/g, ' ').includes(t)))) return false;
      if (cats.length && !cats.some((c) => r.categories.includes(c))) return false;
      if (cuisines.length && !cuisines.includes(r.cuisine)) return false;
      if (diets.length && !diets.every((d) => recipeDiets(r).includes(d))) return false;
      if (tags.length && !tags.every((x) => r.tags.includes(x as Recipe['tags'][number]))) return false;
      if (maxTime && totalTime(r) > maxTime) return false;
      if (favOnly && !favorites.includes(r.id)) return false;
      if (fits && !(checkRecipeDiet(r, profile).ok && checkPractical(r, profile).ok)) return false;
      return true;
    });
  }, [q, cats, cuisines, diets, tags, maxTime, favOnly, fits, favorites, profile]);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const active = cats.length + cuisines.length + diets.length + tags.length + (maxTime ? 1 : 0) + (favOnly ? 1 : 0) + (fits ? 1 : 0);
  const clear = () => { setCats([]); setCuisines([]); setDiets([]); setTags([]); setMaxTime(null); setFavOnly(false); setFits(false); };

  return (
    <>
      <PageHeader title="Recipes" subtitle={`${RECIPES.length} recipes · ${list.length} shown`} />
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
            <input className="input pl-9" placeholder="Search recipes, ingredients or cuisines" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
          </div>
          <button className={cx('btn-secondary relative', showFilters && 'border-sage-500')} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
            <SlidersHorizontal size={16} /> <span className="hidden sm:inline">Filters</span>
            {active > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-sage-600 text-[10px] text-white">{active}</span>}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => <Chip key={c} on={cats.includes(c)} onClick={() => toggle(cats, c, setCats)}><span className="capitalize">{c === 'snack' ? 'Snacks' : c}</span></Chip>)}
          <Chip on={favOnly} onClick={() => setFavOnly(!favOnly)}><Heart size={13} /> Favourites</Chip>
        </div>
        {showFilters && (
          <div className="card animate-in grid gap-5 p-5 md:grid-cols-2">
            <div><p className="label">Cuisine</p><div className="flex flex-wrap gap-2">{CUISINES.map((c) => <Chip key={c} on={cuisines.includes(c)} onClick={() => toggle(cuisines, c, setCuisines)}>{c}</Chip>)}</div></div>
            <div><p className="label">Dietary</p><div className="flex flex-wrap gap-2">{DIETS.map((d) => <Chip key={d} on={diets.includes(d)} onClick={() => toggle(diets, d, setDiets)}>{DIET_LABEL[d]}</Chip>)}</div></div>
            <div><p className="label">Total time</p><div className="flex flex-wrap gap-2">{TIMES.map((t) => <Chip key={t} on={maxTime === t} onClick={() => setMaxTime(maxTime === t ? null : t)}>≤ {t} min</Chip>)}</div></div>
            <div><p className="label">Good for</p><div className="flex flex-wrap gap-2">{SPECIAL.map((t) => <Chip key={t} on={tags.includes(t)} onClick={() => toggle(tags, t, setTags)}>{tagLabel(t)}</Chip>)}</div></div>
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4 dark:border-white/5">
              <div className="min-w-[16rem] flex-1"><Toggle checked={fits} onChange={setFits} label="Only recipes that fit my profile" hint="Allergies, diet, time limits and equipment" /></div>
              {active > 0 && <button className="btn-ghost btn-sm" onClick={clear}><X size={13} /> Clear filters</button>}
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <Empty icon={<Search />} title="No recipes match" action={<button className="btn-secondary" onClick={() => { clear(); setQ(''); }}>Reset search</button>}>Try removing a filter or searching for a different ingredient.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => {
              const fav = favorites.includes(r.id);
              const ok = checkRecipeDiet(r, profile).ok;
              return (
                <li key={r.id} className="card group flex flex-col p-4">
                  <div className="flex gap-3.5">
                    <button onClick={() => setOpen(r)} aria-label={`Open ${r.name}`}><RecipeVisual recipe={r} /></button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-700 dark:text-sage-300">{r.categories.join(' · ')}</p>
                      <button className="text-left font-medium leading-snug hover:text-sage-700 dark:hover:text-sage-300" onClick={() => setOpen(r)}>{r.name}</button>
                      <p className="mt-0.5 text-xs muted">{timeLabel(r)} · {r.cuisine} · ≈ {fmt(recipeCostPerServing(r))}/serving</p>
                    </div>
                    <button className="icon-btn -mr-1 -mt-1 shrink-0" aria-pressed={fav} aria-label={fav ? `Remove ${r.name} from favourites` : `Save ${r.name} to favourites`} onClick={() => toggleFavorite(r.id)}>
                      <Heart size={17} className={fav ? 'fill-clay-500 text-clay-500' : ''} />
                    </button>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm muted">{r.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    <DietBadges recipe={r} max={2} />
                    {r.tags.slice(0, 2).map((t) => <span key={t} className="tag">{tagLabel(t)}</span>)}
                    {!ok && <span className="tag bg-clay-50 text-clay-600 dark:bg-clay-500/10 dark:text-clay-300">Not for your diet</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {open && <RecipeDetail recipe={open} onClose={() => setOpen(null)} onAddToPlan={(r) => { setOpen(null); setAdding(r); }} />}
      {adding && <AddToPlanDialog recipe={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
