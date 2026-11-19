import { matchIngredients, getIngredient } from '../data/ingredients';
import type { Allergen, Cuisine, DietPattern, PantryItem, PlannedMeal, Profile, Recipe, SlotId, TrainingSession, Weekday } from '../types';
import { checkPractical, checkRecipeDiet, termMatchesRecipe } from './diet';
import { DAYS, type Boost } from './planner';

/**
 * Rule-based natural-language interpreter. It does NOT use an AI service: it recognises a fixed set
 * of request patterns and reports clearly when something wasn't understood.
 */

export interface RegenRequest {
  onlyDays?: number[];
  onlySlots?: SlotId[];
  replaceIf?: (meal: PlannedMeal, recipe: Recipe | undefined, day: number, slot: SlotId, p: Profile) => boolean;
  boost?: Boost;
}

export interface CommandResult {
  understood: boolean;
  patch: Partial<Profile>;
  regens: RegenRequest[];
  messages: string[];
}

export const NLP_EXAMPLES = [
  'Make my lunches easier to pack',
  'I have basketball practice tomorrow at 4pm',
  'Give me cheaper meals',
  "I don't like eggs",
  'Add more Indian food',
  'Make dinner take less than 20 minutes',
  'Use the rice and chicken in my pantry',
  'More protein please',
  "I'm vegetarian now",
  "I'm allergic to sesame",
];

const ALLERGEN_WORDS: [RegExp, Allergen][] = [
  [/peanut/, 'peanut'], [/tree ?nut|almond|walnut|cashew|pecan|hazelnut|pistachio|\bnuts?\b/, 'tree_nut'],
  [/lactose/, 'lactose'], [/dairy|milk/, 'dairy'], [/\beggs?\b/, 'egg'], [/\bsoy/, 'soy'], [/wheat/, 'wheat'],
  [/gluten/, 'gluten'], [/shellfish|shrimp|prawn|crab|lobster/, 'shellfish'], [/\bfish\b|salmon|tuna|cod/, 'fish'], [/sesame/, 'sesame'],
];

const CUISINE_WORDS: [RegExp, Cuisine][] = [
  [/indian/, 'Indian'], [/south asian|pakistani|sri lankan|bangladeshi|curry/, 'South Asian'], [/italian|pasta/, 'Italian'],
  [/mexican|tex-mex/, 'Mexican'], [/mediterranean|greek/, 'Mediterranean'], [/chinese|japanese|korean|thai|asian|east asian|vietnamese/, 'East Asian'],
  [/middle eastern|lebanese|arab|persian|turkish/, 'Middle Eastern'], [/african|nigerian|ghanaian|ethiopian/, 'African'],
  [/canadian/, 'Canadian'], [/american/, 'American'],
];

const DIET_WORDS: [RegExp, DietPattern][] = [
  [/vegan/, 'vegan'], [/vegetarian/, 'vegetarian'], [/pescatarian|pescetarian/, 'pescatarian'], [/gluten[- ]?free/, 'gluten-free'],
  [/dairy[- ]?free/, 'dairy-free'], [/halal/, 'halal'], [/kosher/, 'kosher'],
];

const SLOT_WORDS: [RegExp, SlotId[]][] = [
  [/breakfasts?/, ['breakfast']], [/lunch(es)?/, ['lunch']], [/dinners?|supper/, ['dinner']],
  [/snacks?/, ['amSnack', 'pmSnack', 'eveSnack']], [/meals?|everything|cooking/, ['breakfast', 'lunch', 'dinner']],
];

function parseDays(t: string, today: Weekday): number[] {
  const out = new Set<number>();
  if (/\btomorrow\b/.test(t)) out.add((today + 1) % 7);
  if (/\btoday\b|\btonight\b/.test(t)) out.add(today);
  DAYS.forEach((d, i) => { if (new RegExp(`\\b${d.toLowerCase()}s?\\b|\\b${d.slice(0, 3).toLowerCase()}\\b`).test(t)) out.add(i); });
  if (/\bweekdays?\b/.test(t)) [0, 1, 2, 3, 4].forEach((i) => out.add(i));
  if (/\bweekends?\b/.test(t)) [5, 6].forEach((i) => out.add(i));
  return [...out].sort();
}

function parseTime(t: string): string | null {
  const m = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (!m[3] && h >= 1 && h <= 7) h += 12; // "at 4" → 4 pm is the common meaning for practice
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const uniq = <T,>(a: T[]) => [...new Set(a)];
const violates = (_m: PlannedMeal, r: Recipe | undefined, _d: number, s: SlotId, p: Profile) =>
  !!r && (!checkRecipeDiet(r, p).ok || !checkPractical(r, p, s).ok);

export function interpret(input: string, p: Profile, today: Weekday, pantry: PantryItem[] = []): CommandResult {
  const t = ' ' + input.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  const res: CommandResult = { understood: false, patch: {}, regens: [], messages: [] };
  const hit = () => { res.understood = true; };
  const patch = res.patch;

  // --- allergies
  const allergyM = t.match(/allerg(?:ic|y) to ([a-z ,]+?)(?:\.|,| and | now|$| )/) ?? t.match(/([a-z]+) allergy/);
  if (allergyM) {
    hit();
    const term = allergyM[1].trim();
    const known = ALLERGEN_WORDS.find(([re]) => re.test(term));
    if (known) {
      patch.allergies = uniq([...(p.allergies), known[1]]);
      res.messages.push(`Added ${known[1].replace('_', ' ')} as a strict allergy. Meals containing it will be replaced.`);
    } else {
      patch.customAllergies = uniq([...p.customAllergies, term]);
      const matches = matchIngredients(term);
      res.messages.push(matches.length
        ? `Added “${term}” as a custom allergy (matches ${matches.map((m) => getIngredient(m)!.name).join(', ')}).`
        : `Added “${term}” as a custom allergy. It doesn't match any ingredient in the recipe library, so please double-check labels yourself.`);
    }
    res.regens.push({ replaceIf: violates });
  }

  // --- dislikes / avoid
  const dislikeM = !allergyM && t.match(/(?:don'?t|do not|never) (?:like|eat|want)\s+(?:any\s+)?([a-z ]+?)(?:\.|,| anymore| any more| please| in | and |$)|(?:i hate|no more|without|stop (?:giving me|adding)|avoid)\s+([a-z ]+?)(?:\.|,| please| in | and |$)/);
  if (dislikeM) {
    const term = (dislikeM[1] ?? dislikeM[2] ?? '').trim().replace(/^(the|any|eating)\s+/, '');
    const strict = /avoid|never/.test(t);
    const matches = matchIngredients(term);
    if (term && matches.length) {
      hit();
      if (strict) patch.avoidIngredients = uniq([...p.avoidIngredients, term]);
      else patch.dislikedFoods = uniq([...p.dislikedFoods, term]);
      res.messages.push(`${strict ? 'Avoiding' : 'Noted that you don’t like'} ${term}. Meals with ${matches.map((m) => getIngredient(m)!.name.toLowerCase()).slice(0, 3).join(', ')} will be swapped out.`);
      res.regens.push({ replaceIf: (_m, r) => !!r && termMatchesRecipe(term, r) });
    } else if (term) {
      hit();
      res.messages.push(`I couldn't match “${term}” to an ingredient in the recipe library, so nothing was changed. Try a specific ingredient, e.g. “I don't like mushrooms”.`);
    }
  }

  // --- diet pattern
  const dietM = t.match(/(?:i'?m|i am|go|going|make (?:it|everything|my meals)|switch to|now|be)\s+(?:a\s+)?(vegan|vegetarian|pescatarian|pescetarian|gluten[- ]?free|dairy[- ]?free|halal|kosher)/);
  if (dietM) {
    const d = DIET_WORDS.find(([re]) => re.test(dietM[1]))![1];
    hit();
    patch.diet = uniq([...p.diet.filter((x) => x !== 'omnivore'), d]);
    res.messages.push(`Your dietary pattern now includes ${d}. Non-matching meals will be replaced.`);
    res.regens.push({ replaceIf: violates });
  }

  // --- portable lunches
  if (/\b(pack|packable|portable|lunch ?box|take to (school|work)|on the go|grab and go)\b/.test(t)) {
    hit();
    patch.portableLunch = true;
    res.messages.push('Weekday lunches will now always be portable and easy to pack.');
    res.regens.push({ onlySlots: ['lunch'], replaceIf: (_m, r, d) => d < 5 && !!r && !r.tags.includes('portable'), boost: { tags: ['portable'] } });
  }

  // --- training sessions
  const sportM = t.match(/\b(practice|training|train|game|match|tournament|workout|gym|lift|lifting|meet|race)\b/);
  const days = parseDays(t, today);
  if (sportM && days.length && !/\b(no|cancel|cancelled|don'?t have)\b/.test(t)) {
    hit();
    const kind: TrainingSession['kind'] = /game|match|tournament|meet|race/.test(sportM[1]) ? 'game' : /gym|lift/.test(sportM[1]) ? 'strength' : 'practice';
    const start = parseTime(t) ?? (kind === 'game' ? '18:00' : '16:00');
    const sportWord = (t.match(/\b(basketball|volleyball|soccer|football|swimming|swim|track|running|run|cycling|hockey|tennis|baseball|rugby|dance)\b/)?.[1]) ?? p.primarySport ?? 'Training';
    const sport = sportWord.charAt(0).toUpperCase() + sportWord.slice(1);
    const add: TrainingSession[] = days
      .filter((d) => !p.sessions.some((s) => s.day === d && s.start === start))
      .map((d) => ({ day: d as Weekday, kind, sport, start, duration: kind === 'game' ? 120 : 90, intensity: 'high' }));
    patch.isAthlete = true;
    patch.sessions = [...p.sessions, ...add];
    if (!p.primarySport) patch.primarySport = sport;
    res.messages.push(add.length
      ? `Added ${kind === 'game' ? 'a game' : kind === 'strength' ? 'a strength session' : 'practice'} on ${days.map((d) => DAYS[d]).join(', ')} at ${start}. That day now includes pre-session fuel and a recovery meal.`
      : `You already have a session at ${start} on ${days.map((d) => DAYS[d]).join(', ')}; that day's meals were refreshed around it.`);
    res.regens.push({ onlyDays: days });
  } else if (/\b(no|cancel+ed|cancel|don'?t have)\b.*\b(practice|training|game)\b/.test(t) && days.length) {
    hit();
    patch.sessions = p.sessions.filter((s) => !days.includes(s.day));
    res.messages.push(`Removed training on ${days.map((d) => DAYS[d]).join(', ')} and re-planned as a rest day.`);
    res.regens.push({ onlyDays: days });
  }

  // --- time limits
  const timeM = t.match(/(under|less than|within|in|max(?:imum)?|no more than|at most|below|quicker than|faster than)\s*(\d{1,3})\s*(?:min|mins|minutes)\b/);
  if (timeM) {
    hit();
    const minutes = Math.max(5, Number(timeM[2]));
    const slots = uniq(SLOT_WORDS.filter(([re]) => re.test(t)).flatMap(([, s]) => s));
    const targets: SlotId[] = slots.length ? slots : ['breakfast', 'lunch', 'dinner'];
    const map = { ...p.slotMaxTime };
    targets.forEach((s) => { map[s] = minutes; });
    patch.slotMaxTime = map;
    res.messages.push(`${targets.map((s) => (s.includes('Snack') ? 'snacks' : s)).filter((v, i, a) => a.indexOf(v) === i).join(', ')} will now take ${minutes} minutes or less (prep + cooking).`);
    res.regens.push({ onlySlots: targets, replaceIf: (_m, r, _d, s, pp) => !!r && !checkPractical(r, pp, s).ok });
  } else if (/\b(quicker|faster|quick|less time|easier) (meals|dinners|lunches|cooking|recipes)\b|\bless cooking\b/.test(t)) {
    hit();
    patch.goals = uniq([...p.goals, 'quick']);
    patch.priority = 'convenience';
    res.messages.push('Prioritising quick, convenient recipes.');
    res.regens.push({ replaceIf: (_m, r) => !!r && r.prep + r.cook > 20, boost: { tags: ['quick'] } });
  }

  // --- budget
  if (/\b(cheap|cheaper|budget|save money|saving money|less expensive|affordable|lower cost|spend less)\b/.test(t)) {
    hit();
    patch.priority = 'savings';
    patch.goals = uniq([...p.goals, 'budget']);
    res.messages.push('Prioritising budget-friendly recipes and ingredient reuse. Prices are estimates.');
    res.regens.push({ boost: { tags: ['budget'] } });
  }

  // --- cuisines
  const cuisineM = t.match(/\b(more|add|some|extra|try)\b/) ? CUISINE_WORDS.filter(([re]) => re.test(t)).map(([, c]) => c) : [];
  if (cuisineM.length && !dislikeM) {
    hit();
    patch.cuisines = uniq([...p.cuisines, ...cuisineM]);
    res.messages.push(`Adding more ${cuisineM.join(' and ')} dishes.`);
    res.regens.push({ onlySlots: ['lunch', 'dinner'], replaceIf: (_m, r) => !!r && !cuisineM.includes(r.cuisine), boost: { cuisines: cuisineM } });
  }

  // --- pantry / use up ingredients
  const useM = t.match(/\buse (?:up )?(?:the |my |some )?([a-z ,]+?)(?: (?:in|from|that'?s? in) (?:my |the )?(?:pantry|fridge|freezer|cupboard|kitchen)| i have| before|\.|$)/);
  if (useM && !/\buse less\b/.test(t)) {
    const terms = useM[1].split(/,| and /).map((x) => x.trim()).filter(Boolean);
    const ids = uniq(terms.flatMap((x) => matchIngredients(x).slice(0, 2)));
    if (ids.length) {
      hit();
      patch.preferIngredients = uniq([...p.preferIngredients, ...ids]);
      const inPantry = ids.filter((id) => pantry.some((x) => x.ingredientId === id));
      const missing = ids.filter((id) => !inPantry.includes(id));
      res.messages.push(`Prioritising recipes with ${ids.map((i) => getIngredient(i)!.name.toLowerCase()).join(', ')}.`);
      if (missing.length) res.messages.push(`${missing.map((i) => getIngredient(i)!.name).join(', ')} ${missing.length > 1 ? 'aren’t' : 'isn’t'} in your pantry yet — add ${missing.length > 1 ? 'them' : 'it'} on the Pantry page with a quantity so it's subtracted from your grocery list.`);
      res.regens.push({ onlySlots: ['lunch', 'dinner', 'breakfast'], replaceIf: (_m, r) => !!r && !r.ingredients.some((ri) => ids.includes(ri.id)) });
    }
  }

  // --- protein / variety / leftovers / regenerate
  if (/\b(more protein|high[- ]protein|protein)\b/.test(t)) {
    hit();
    patch.goals = uniq([...p.goals, 'high-protein']);
    res.messages.push('Favouring higher-protein recipes.');
    res.regens.push({ replaceIf: (_m, r) => !!r && !r.tags.includes('high-protein'), boost: { tags: ['high-protein'] } });
  }
  if (/\b(more variety|less repetit|too repetitive|same thing|mix it up)\b/.test(t)) {
    hit();
    patch.priority = 'variety';
    res.messages.push('Increasing weekly variety.');
    res.regens.push({});
  }
  if (/\b(no|fewer|less|stop) leftovers\b/.test(t)) { hit(); patch.leftovers = 'avoid'; res.messages.push('Planned leftovers turned off.'); res.regens.push({}); }
  else if (/\bmore leftovers|batch cook|meal prep\b/.test(t)) { hit(); patch.leftovers = 'love'; patch.mealPrep = true; res.messages.push('Planning more batch cooking and leftovers.'); res.regens.push({}); }
  if (!res.understood && /\b(new plan|regenerate|start over|shuffle|different meals)\b/.test(t)) {
    hit(); res.messages.push('Generated a fresh plan (locked meals kept).'); res.regens.push({});
  }

  if (!res.understood) {
    res.messages.push("Sorry — I couldn't interpret that request reliably, so nothing was changed. Here are things I can do:");
  }
  return res;
}
