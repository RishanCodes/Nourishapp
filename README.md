# NOURISH — Personalized Meal & Grocery Planner

NOURISH builds a personalized seven-day meal plan from a person's age, life stage, activity level, training schedule, diet, allergies, tastes, cooking constraints and budget. It then turns the plan into a consolidated grocery list.

Everything runs in the browser. There's no account and no backend, and nothing is sent to a server.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 39 unit tests (engine + persistence)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run build:artifact   # single self-contained HTML page (dist-artifact/nourish.html) for hosting as an artifact
```

The first time it opens, NOURISH shows onboarding. Use **Try the demo** to load the sample 17-year-old basketball player (6'1", 170 lb, five practices plus a game, CAD budget).

## Architecture

```
src/
  types.ts                 Domain model (Profile, Recipe, WeekPlan, Pantry, Grocery…)
  data/ingredients.ts      ~118 standardized ingredients: aisle, unit dimension, price estimate,
                           allergens, animal/religious flags, reference nutrition, conversions
  data/recipes.ts          76 structured recipes (by primary category: 16 breakfasts, 17 lunches, 26 dinners, 17 snacks)
  engine/
    units.ts               Unit normalization; only converts between dimensions when a reliable conversion exists
    diet.ts                Strict allergen/diet validation, kosher/halal rules, practical limits,
                           diagnosis of impossible combinations
    nutrition.ts           Calculated (approximate) recipe nutrition, adult-only estimates, youth guidance
    planner.ts             Day context (school/training/game), scoring, generation, leftovers,
                           alternatives, explanations
    grocery.ts             Aggregation, serving scaling, leftover de-duplication, pantry subtraction
    nlp.ts                 Rule-based natural-language commands
    cost.ts                Cost estimates (Canadian dollars only)
    mealNutrition.ts       Per-person meal and daily nutrition totals
  store/                   Zustand store persisted to localStorage, import/export validation
  components/, pages/      React + Tailwind UI (Dashboard, Planner, Recipes, Grocery, Pantry, Profile, Settings, Onboarding)
```

### How plans are personalized

1. **Hard filters.** These apply to every slot: allergens (celiac implies gluten), dietary patterns, custom allergies, avoided ingredients, prep and cook limits, owned equipment, cooking skill and spice ceiling. If an optional ingredient conflicts (for example feta on shakshuka), it's left out instead of rejecting the whole recipe.
2. **Day context.** Weekday school or work lunches must be portable. Training days add timed roles: pre-practice fuel, recovery dinner, an extra recovery snack after long sessions, and a light breakfast plus recovery snack for early-morning sessions. Game days avoid high-fibre pre-game foods.
3. **Scoring.** Recipes are scored on cuisine and food preferences, favourites, goals, budget per serving, reuse of perishable ingredients, pantry items, variety penalties, spice and adventurousness. A small seeded random factor makes each "New week" different.
4. **Leftovers and batch cooking.** Some dinners carry over to the next day's lunch, and batch breakfasts cover several days. Leftover meals add no grocery quantities; the source meal is cooked with the extra servings instead.
5. **Explanation.** Each plan comes with explanation text generated from the actual plan and profile.

Locked meals are never changed by a regeneration or a natural-language command.

### Safety choices

* Anyone, including under-18s, can turn on **nutrition numbers**: calories, protein, carbs, fat and fibre for every meal, plus each day's planned totals for your own portion. These describe what's planned; they aren't targets. The demo teen has them on.
* No restrictive targets for minors. The app doesn't offer weight-loss goals, and the optional *daily energy range* (Mifflin–St Jeor × activity factor) stays adults-only because that equation isn't designed for people who are still growing.
* Packaged items that may hide allergens are flagged "label" on recipes and on the grocery list.
* Health conditions add guidance and constraints but never medical nutrition therapy.

## Testing

`npm test` runs Vitest suites that cover:

* allergen exclusion across whole plans and grocery lists
* vegan plans containing no animal products (including honey)
* celiac, kosher and halal rules
* impossible-combination diagnosis
* different profiles producing different plans
* athletic timing and portable lunches
* time limits
* no numeric targets for minors
* locked meals surviving regeneration and single-day regeneration
* grocery consolidation, serving scaling, unit normalization, leftover de-duplication and pantry subtraction
* purchase checks not carrying over when more of an item is needed
* the natural-language examples
* persistence across a simulated reload, export/import, and input sanitising

The UI was also driven end to end with Playwright (desktop and a 390 px mobile viewport): onboarding, demo, lock/regenerate, swap, servings, grocery checks persisting after reload, recipe filters, pantry deduction, natural-language commands, dark mode, mobile navigation, and a check for horizontal overflow on every page.

## Known limitations

* **Prices** are in Canadian dollars only, using rough Canadian averages. The grocery list shows two figures: food used this week (proportional) and a checkout estimate in typical whole-package sizes. The checkout figure counts staples you may already own unless you add them to the pantry.
* **Nutrition** is calculated from generic per-100 g reference values (USDA-style) for each ingredient. It's approximate and ignores brand differences.
* **Natural-language box** is rule-based. It understands a fixed set of request types (see the examples in the app) and says so when it can't interpret something. It doesn't use an AI service.
* **Custom meals:** ingredients you pick are checked against your allergies and diet; free text in the name or notes isn't.
* **Storage:** data lives in this browser's `localStorage`. It isn't encrypted or synced between devices. Use Settings → Export to make a backup.
