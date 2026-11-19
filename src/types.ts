// ---------- Core domain types for NOURISH ----------

export type Allergen =
  | 'peanut' | 'tree_nut' | 'dairy' | 'egg' | 'soy' | 'wheat' | 'gluten'
  | 'fish' | 'shellfish' | 'sesame' | 'lactose';

/** Animal-origin / religious-relevance flags on an ingredient. */
export type FoodFlag =
  | 'poultry' | 'beef' | 'pork' | 'lamb' | 'fish' | 'shellfish'
  | 'dairy' | 'egg' | 'honey' | 'gelatin' | 'alcohol';

export type Aisle =
  | 'Produce' | 'Meat and poultry' | 'Seafood' | 'Dairy and alternatives'
  | 'Bread and bakery' | 'Rice, pasta and grains' | 'Canned and packaged foods'
  | 'Frozen foods' | 'Herbs and spices' | 'Sauces and condiments' | 'Snacks' | 'Other';

export type Dimension = 'mass' | 'volume' | 'count';
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'pc';

export interface Ingredient {
  id: string;
  name: string;
  aisle: Aisle;
  /** The dimension prices and nutrition are expressed in. */
  dim: Dimension;
  /** Label for count units, e.g. "egg", "tortilla", "can". */
  countLabel?: string;
  /** Approximate price in CAD per 1000 g, per 1000 ml or per 1 piece. */
  price: number;
  allergens?: Allergen[];
  flags?: FoodFlag[];
  /** Packaged item that may contain hidden allergens / cross-contact → verify labels. */
  labelCheck?: boolean;
  /** Optional cross-dimension conversions. grams per piece, grams per ml. */
  gPerPc?: number;
  gPerMl?: number;
  /** Approximate nutrition per 100 g (mass), per 100 ml (volume) or per piece (count). */
  n?: { kcal: number; p: number; c: number; f: number; fib?: number };
  /** Grouping used for food-group balance and preference matching. */
  group?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'dairy' | 'fat' | 'seasoning' | 'other';
  /** Search synonyms for natural-language matching. */
  aka?: string[];
}

export interface RecipeIngredient {
  id: string;
  qty: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Equipment =
  | 'stovetop' | 'oven' | 'microwave' | 'blender' | 'air fryer' | 'slow cooker'
  | 'rice cooker' | 'toaster' | 'grill' | 'none';

export type RecipeTag =
  | 'portable' | 'athlete' | 'pre-workout' | 'recovery' | 'budget' | 'quick'
  | 'meal-prep' | 'family' | 'high-protein' | 'kid-friendly' | 'make-ahead' | 'sweet' | 'high-fiber';

export type Cuisine =
  | 'American' | 'Canadian' | 'Italian' | 'Mediterranean' | 'Mexican' | 'Indian'
  | 'South Asian' | 'East Asian' | 'Middle Eastern' | 'African' | 'International';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  categories: MealCategory[];
  cuisine: Cuisine;
  servings: number;
  prep: number; // minutes
  cook: number; // minutes
  equipment: Equipment[];
  skill: 1 | 2 | 3; // 1 beginner, 2 intermediate, 3 advanced
  spice: 0 | 1 | 2 | 3;
  tags: RecipeTag[];
  ingredients: RecipeIngredient[];
  steps: string[];
  storage: string;
  leftovers: string;
  /** true when the dish keeps well and can be planned as leftovers. */
  leftoverFriendly?: boolean;
  substitutions?: { from: string; to: string; note?: string }[];
  emoji: string;
  hue: number; // background hue for the visual tile
}

// ---------- Profile ----------

export type LifeStage = 'child' | 'teen' | 'adult' | 'older';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete' | 'heavy';
export type DietPattern =
  | 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'halal' | 'kosher'
  | 'dairy-free' | 'gluten-free';
export type Goal =
  | 'healthy' | 'balanced' | 'growing-teen' | 'youth-athlete' | 'competitive-athlete'
  | 'muscle' | 'strength' | 'endurance' | 'energy' | 'family' | 'budget' | 'quick'
  | 'variety' | 'high-protein';
export type HealthFlag = 'celiac' | 'diabetes' | 'clinician' | 'digestive' | 'other';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday
export type SlotId = 'breakfast' | 'amSnack' | 'lunch' | 'pmSnack' | 'dinner' | 'eveSnack';

export interface TrainingSession {
  day: Weekday;
  kind: 'practice' | 'game' | 'strength' | 'conditioning';
  sport: string;
  start: string; // "HH:MM"
  duration: number; // minutes
  intensity: 'low' | 'moderate' | 'high';
}

export interface Profile {
  name: string;
  age: number | null;
  lifeStage: LifeStage;
  sex: 'female' | 'male' | 'unspecified';
  heightCm: number | null;
  weightKg: number | null;
  householdSize: number;
  eatersPerMeal: number;
  activity: ActivityLevel;
  isAthlete: boolean;
  primarySport: string;
  secondarySports: string[];
  sessions: TrainingSession[];
  schedule: 'school' | 'work' | 'home' | 'mixed';
  scheduleStart: string; // "08:30"
  scheduleEnd: string; // "15:30"
  goals: Goal[];
  diet: DietPattern[];
  allergies: Allergen[];
  customAllergies: string[];
  health: HealthFlag[];
  healthNotes: string;
  favoriteFoods: string[];
  dislikedFoods: string[];
  avoidIngredients: string[];
  favoriteProteins: string[];
  preferredFruits: string[];
  preferredVegetables: string[];
  preferredBreakfasts: string[];
  favoriteSnacks: string[];
  cuisines: Cuisine[];
  spiceTolerance: 0 | 1 | 2 | 3;
  adventurous: 1 | 2 | 3;
  skill: 1 | 2 | 3;
  maxPrep: number;
  maxCook: number;
  equipment: Equipment[];
  mealPrep: boolean;
  leftovers: 'love' | 'ok' | 'avoid';
  slots: SlotId[];
  weeklyBudget: number | null;
  currency: string;
  stores: string;
  priority: 'savings' | 'convenience' | 'variety';
  portableLunch: boolean;
  /** Adults only: show approximate calorie/macro estimates. */
  showNumbers: boolean;
  /** Per-slot time ceiling set via natural-language commands. */
  slotMaxTime: Partial<Record<SlotId, number>>;
  /** Ingredient IDs to prefer (e.g. "use my rice and chicken"). */
  preferIngredients: string[];
}

// ---------- Plan ----------

export interface CustomMeal {
  name: string;
  notes?: string;
  ingredients: RecipeIngredient[];
}

export interface PlannedMeal {
  uid: string;
  recipeId: string | null; // null when custom
  custom?: CustomMeal;
  servings: number;
  locked: boolean;
  prepared: boolean;
  /** When set, this meal is leftovers of another planned meal (uid) and adds no groceries. */
  leftoverOf?: string;
  /** Planner notes, e.g. "Pre-practice fuel". */
  role?: string;
}

export type DayPlan = Partial<Record<SlotId, PlannedMeal>>;

export interface WeekPlan {
  id: string;
  createdAt: string;
  seed: number;
  days: DayPlan[]; // length 7, Monday..Sunday
  explanation: string[];
  warnings: string[];
}

export interface SavedPlan {
  id: string;
  name: string;
  savedAt: string;
  plan: WeekPlan;
}

// ---------- Pantry & grocery ----------

export interface PantryItem {
  uid: string;
  ingredientId: string | null;
  name: string;
  qty: number;
  unit: Unit;
  expires?: string;
}

export interface GroceryState {
  /** key → quantity (in base unit) at the time it was checked. */
  checked: Record<string, number>;
  /** key → user-edited quantity in base unit. */
  overrides: Record<string, number>;
  removed: string[];
  custom: { uid: string; name: string; qty: string; aisle: Aisle; checked: boolean }[];
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  units: 'metric' | 'imperial';
  currency: string;
  notifications: boolean;
}
