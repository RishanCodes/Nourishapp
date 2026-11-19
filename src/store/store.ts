import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getRecipe } from '../data/recipes';
import { interpret, type CommandResult } from '../engine/nlp';
import { explainPlan, generatePlan, normalizeDays, uid, weekdayOf, type GenerateOptions } from '../engine/planner';
import { lifeStageFromAge } from '../engine/nutrition';
import type {
  Aisle, CustomMeal, GroceryState, PantryItem, PlannedMeal, Profile, SavedPlan, Settings, SlotId, WeekPlan,
} from '../types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, DEMO_PROFILE, EMPTY_GROCERY } from './defaults';

export const STORAGE_KEY = 'nourish:v1';
export const DATA_VERSION = 1;

export interface PersistedData {
  version: number;
  onboarded: boolean;
  isDemo: boolean;
  profile: Profile;
  plan: WeekPlan | null;
  savedPlans: SavedPlan[];
  favorites: string[];
  pantry: PantryItem[];
  grocery: GroceryState;
  settings: Settings;
}

export interface AppState extends PersistedData {
  lastCommand: { input: string; result: CommandResult } | null;
  completeOnboarding: (p: Profile) => void;
  loadDemo: () => void;
  updateProfile: (patch: Partial<Profile>, regenerate?: boolean) => void;
  generate: (opts?: GenerateOptions) => void;
  regenerateDay: (day: number) => void;
  setMeal: (day: number, slot: SlotId, recipeId: string) => void;
  addCustomMeal: (day: number, slot: SlotId, custom: CustomMeal, servings: number) => void;
  toggleLock: (day: number, slot: SlotId) => void;
  togglePrepared: (day: number, slot: SlotId) => void;
  setServings: (day: number, slot: SlotId, servings: number) => void;
  moveMeal: (from: { day: number; slot: SlotId }, to: { day: number; slot: SlotId }) => void;
  removeMeal: (day: number, slot: SlotId) => void;
  toggleFavorite: (recipeId: string) => void;
  savePlan: (name: string) => void;
  loadPlan: (id: string) => void;
  deletePlan: (id: string) => void;
  addPantry: (item: Omit<PantryItem, 'uid'>) => void;
  updatePantry: (uid: string, patch: Partial<PantryItem>) => void;
  removePantry: (uid: string) => void;
  setChecked: (key: string, qty: number | null) => void;
  setOverride: (key: string, qty: number | null) => void;
  removeGroceryItem: (key: string) => void;
  restoreGroceryItems: () => void;
  addCustomGrocery: (name: string, qty: string, aisle: Aisle) => void;
  toggleCustomGrocery: (uid: string) => void;
  removeCustomGrocery: (uid: string) => void;
  clearGroceryChecks: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  runCommand: (input: string) => CommandResult;
  dismissCommand: () => void;
  exportData: () => string;
  importData: (json: string) => { ok: boolean; error?: string };
  resetAll: () => void;
}

const initialData = (): PersistedData => ({
  version: DATA_VERSION,
  onboarded: false,
  isDemo: false,
  profile: { ...DEFAULT_PROFILE },
  plan: null,
  savedPlans: [],
  favorites: [],
  pantry: [],
  grocery: { ...EMPTY_GROCERY, custom: [] },
  settings: { ...DEFAULT_SETTINGS },
});

/** Merge a possibly-partial or older profile with defaults and sanitise values. */
export function sanitizeProfile(p: Partial<Profile>): Profile {
  const merged = { ...DEFAULT_PROFILE, ...p } as Profile;
  const num = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  merged.age = num(merged.age, 1, 120);
  merged.heightCm = num(merged.heightCm, 50, 260);
  merged.weightKg = num(merged.weightKg, 10, 350);
  merged.householdSize = num(merged.householdSize, 1, 20) ?? 1;
  merged.eatersPerMeal = Math.min(merged.householdSize, num(merged.eatersPerMeal, 1, 20) ?? 1);
  merged.maxPrep = num(merged.maxPrep, 1, 240) ?? DEFAULT_PROFILE.maxPrep;
  merged.maxCook = num(merged.maxCook, 0, 600) ?? DEFAULT_PROFILE.maxCook;
  merged.weeklyBudget = num(merged.weeklyBudget, 1, 100000);
  for (const k of ['secondarySports', 'sessions', 'goals', 'diet', 'allergies', 'customAllergies', 'health', 'favoriteFoods', 'dislikedFoods', 'avoidIngredients', 'favoriteProteins', 'preferredFruits', 'preferredVegetables', 'preferredBreakfasts', 'favoriteSnacks', 'cuisines', 'equipment', 'slots', 'preferIngredients'] as const) {
    if (!Array.isArray(merged[k])) (merged as unknown as Record<string, unknown>)[k] = [...(DEFAULT_PROFILE[k] as unknown[])];
  }
  if (!merged.diet.length) merged.diet = ['omnivore'];
  if (merged.diet.length > 1) merged.diet = merged.diet.filter((d) => d !== 'omnivore');
  if (!merged.slots.length) merged.slots = ['breakfast', 'lunch', 'dinner'];
  if (p.age != null && !p.lifeStage) merged.lifeStage = lifeStageFromAge(merged.age);
  // Minors never get numeric targets.
  if ((merged.age != null && merged.age < 18) || merged.lifeStage === 'teen' || merged.lifeStage === 'child') merged.showNumbers = false;
  if (!merged.slotMaxTime || typeof merged.slotMaxTime !== 'object') merged.slotMaxTime = {};
  return merged;
}

function isPlan(x: unknown): x is WeekPlan {
  return !!x && typeof x === 'object' && Array.isArray((x as WeekPlan).days) && (x as WeekPlan).days.length === 7;
}

/** Validate and normalise imported / rehydrated data. Throws on structurally invalid data. */
export function validateData(raw: unknown): PersistedData {
  if (!raw || typeof raw !== 'object') throw new Error('File is not a NOURISH data export.');
  const r = raw as Partial<PersistedData> & { app?: string; data?: unknown };
  const d = (r.app === 'nourish' && r.data ? r.data : r) as Partial<PersistedData>;
  if (!d.profile || typeof d.profile !== 'object') throw new Error('Missing profile information.');
  if (d.plan != null && !isPlan(d.plan)) throw new Error('The meal plan in this file is malformed.');
  const base = initialData();
  return {
    version: DATA_VERSION,
    onboarded: d.onboarded ?? true,
    isDemo: !!d.isDemo,
    profile: sanitizeProfile(d.profile),
    plan: d.plan ? { ...d.plan, days: normalizeDays(d.plan.days) } : null,
    savedPlans: Array.isArray(d.savedPlans) ? d.savedPlans.filter((s) => s && isPlan(s.plan)) : [],
    favorites: Array.isArray(d.favorites) ? d.favorites.filter((f) => typeof f === 'string' && getRecipe(f)) : [],
    pantry: Array.isArray(d.pantry) ? d.pantry.filter((x) => x && typeof x.name === 'string' && Number.isFinite(x.qty)) : [],
    grocery: { ...base.grocery, ...(d.grocery ?? {}) },
    settings: { ...base.settings, ...(d.settings ?? {}) },
  };
}

const dataOf = (s: AppState): PersistedData => ({
  version: s.version, onboarded: s.onboarded, isDemo: s.isDemo, profile: s.profile, plan: s.plan,
  savedPlans: s.savedPlans, favorites: s.favorites, pantry: s.pantry, grocery: s.grocery, settings: s.settings,
});

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const withPlan = (fn: (plan: WeekPlan) => WeekPlan | void) => {
        const plan = get().plan;
        if (!plan) return;
        const copy: WeekPlan = { ...plan, days: plan.days.map((d) => ({ ...d })) };
        const out = fn(copy) ?? copy;
        out.days = normalizeDays(out.days);
        out.explanation = explainPlan(get().profile, out);
        set({ plan: out });
      };
      const patchMeal = (day: number, slot: SlotId, patch: Partial<PlannedMeal>) =>
        withPlan((p) => { const m = p.days[day][slot]; if (m) p.days[day][slot] = { ...m, ...patch }; });
      const gen = (opts: GenerateOptions = {}) => {
        const s = get();
        return generatePlan(s.profile, { favorites: s.favorites, pantry: s.pantry, previous: s.plan, ...opts });
      };

      return {
        ...initialData(),
        lastCommand: null,

        completeOnboarding: (p) => {
          const profile = sanitizeProfile(p);
          set({ profile, onboarded: true, isDemo: false, grocery: { ...EMPTY_GROCERY, custom: [] }, settings: { ...get().settings, currency: profile.currency } });
          set({ plan: generatePlan(profile, { favorites: get().favorites, pantry: get().pantry }) });
        },
        loadDemo: () => {
          const profile = sanitizeProfile(DEMO_PROFILE);
          const favorites = ['s-energy-bites', 'l-chicken-burrito-bowl', 'd-turkey-bolognese'];
          set({ ...initialData(), profile, onboarded: true, isDemo: true, favorites, settings: { ...get().settings, currency: 'CAD' } });
          set({ plan: generatePlan(profile, { seed: 20261119, favorites }) });
        },
        updateProfile: (patch, regenerate = false) => {
          const profile = sanitizeProfile({ ...get().profile, ...patch });
          set({ profile });
          if (patch.currency) set({ settings: { ...get().settings, currency: patch.currency } });
          if (regenerate) set({ plan: gen() });
          else if (get().plan) withPlan(() => undefined);
        },
        generate: (opts) => set({ plan: gen(opts) }),
        regenerateDay: (day) => set({ plan: gen({ onlyDays: [day] }) }),
        setMeal: (day, slot, recipeId) => withPlan((p) => {
          const old = p.days[day][slot];
          p.days[day][slot] = { uid: uid(), recipeId, servings: old?.servings ?? get().profile.eatersPerMeal, locked: false, prepared: false, role: old?.role?.startsWith('Leftovers') || old?.role?.startsWith('Batch') ? undefined : old?.role };
        }),
        addCustomMeal: (day, slot, custom, servings) => withPlan((p) => {
          p.days[day][slot] = { uid: uid(), recipeId: null, custom, servings: Math.max(0.5, servings), locked: true, prepared: false };
        }),
        toggleLock: (day, slot) => { const m = get().plan?.days[day][slot]; if (m) patchMeal(day, slot, { locked: !m.locked }); },
        togglePrepared: (day, slot) => { const m = get().plan?.days[day][slot]; if (m) patchMeal(day, slot, { prepared: !m.prepared }); },
        setServings: (day, slot, servings) => {
          if (!Number.isFinite(servings)) return;
          patchMeal(day, slot, { servings: Math.min(20, Math.max(0.5, Math.round(servings * 2) / 2)) });
        },
        moveMeal: (from, to) => withPlan((p) => {
          if (from.day === to.day && from.slot === to.slot) return;
          const a = p.days[from.day][from.slot];
          const b = p.days[to.day][to.slot];
          if (!a) return;
          p.days[to.day][to.slot] = a;
          if (b) p.days[from.day][from.slot] = b; else delete p.days[from.day][from.slot];
        }),
        removeMeal: (day, slot) => withPlan((p) => { delete p.days[day][slot]; }),
        toggleFavorite: (id) => {
          const f = get().favorites;
          set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
        },
        savePlan: (name) => {
          const plan = get().plan;
          if (!plan) return;
          const entry: SavedPlan = { id: uid(), name: name.trim() || `Plan from ${new Date().toLocaleDateString()}`, savedAt: new Date().toISOString(), plan: JSON.parse(JSON.stringify(plan)) };
          set({ savedPlans: [entry, ...get().savedPlans].slice(0, 30) });
        },
        loadPlan: (id) => {
          const s = get().savedPlans.find((x) => x.id === id);
          if (s) set({ plan: { ...JSON.parse(JSON.stringify(s.plan)), id: uid() } });
        },
        deletePlan: (id) => set({ savedPlans: get().savedPlans.filter((x) => x.id !== id) }),

        addPantry: (item) => set({ pantry: [...get().pantry, { ...item, uid: uid(), qty: Math.max(0, item.qty) }] }),
        updatePantry: (id, patch) => set({ pantry: get().pantry.map((x) => (x.uid === id ? { ...x, ...patch } : x)) }),
        removePantry: (id) => set({ pantry: get().pantry.filter((x) => x.uid !== id) }),

        setChecked: (key, qty) => {
          const checked = { ...get().grocery.checked };
          if (qty == null) delete checked[key]; else checked[key] = qty;
          set({ grocery: { ...get().grocery, checked } });
        },
        setOverride: (key, qty) => {
          const overrides = { ...get().grocery.overrides };
          if (qty == null || !Number.isFinite(qty)) delete overrides[key]; else overrides[key] = Math.max(0, qty);
          set({ grocery: { ...get().grocery, overrides } });
        },
        removeGroceryItem: (key) => set({ grocery: { ...get().grocery, removed: [...new Set([...get().grocery.removed, key])] } }),
        restoreGroceryItems: () => set({ grocery: { ...get().grocery, removed: [] } }),
        addCustomGrocery: (name, qty, aisle) => {
          if (!name.trim()) return;
          set({ grocery: { ...get().grocery, custom: [...get().grocery.custom, { uid: uid(), name: name.trim(), qty: qty.trim(), aisle, checked: false }] } });
        },
        toggleCustomGrocery: (id) => set({ grocery: { ...get().grocery, custom: get().grocery.custom.map((c) => (c.uid === id ? { ...c, checked: !c.checked } : c)) } }),
        removeCustomGrocery: (id) => set({ grocery: { ...get().grocery, custom: get().grocery.custom.filter((c) => c.uid !== id) } }),
        clearGroceryChecks: () => set({ grocery: { ...get().grocery, checked: {}, custom: get().grocery.custom.map((c) => ({ ...c, checked: false })) } }),

        updateSettings: (patch) => {
          set({ settings: { ...get().settings, ...patch } });
          if (patch.currency) set({ profile: { ...get().profile, currency: patch.currency } });
        },

        runCommand: (input) => {
          const s = get();
          const result = interpret(input, s.profile, weekdayOf(new Date()), s.pantry);
          if (result.understood) {
            const profile = sanitizeProfile({ ...s.profile, ...result.patch });
            set({ profile });
            let plan = get().plan;
            for (const rq of result.regens) {
              plan = generatePlan(profile, {
                favorites: s.favorites, pantry: s.pantry, previous: plan,
                onlyDays: rq.onlyDays, onlySlots: rq.onlySlots, boost: rq.boost,
                replaceIf: rq.replaceIf ? (m, r, d, sl) => rq.replaceIf!(m, r, d, sl, profile) : undefined,
              });
            }
            set({ plan });
          }
          set({ lastCommand: { input, result } });
          return result;
        },
        dismissCommand: () => set({ lastCommand: null }),

        exportData: () => JSON.stringify({ app: 'nourish', exportedAt: new Date().toISOString(), data: dataOf(get()) }, null, 2),
        importData: (json) => {
          try {
            const data = validateData(JSON.parse(json));
            set({ ...data });
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e instanceof SyntaxError ? 'That file is not valid JSON.' : (e as Error).message };
          }
        },
        resetAll: () => {
          set({ ...initialData(), lastCommand: null });
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => dataOf(s),
      merge: (persisted, current) => {
        try {
          if (!persisted) return current;
          return { ...current, ...validateData(persisted) };
        } catch {
          return current;
        }
      },
    },
  ),
);
