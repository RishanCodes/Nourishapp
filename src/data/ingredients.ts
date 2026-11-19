import type { Aisle, Allergen, Dimension, FoodFlag, Ingredient } from '../types';

/**
 * Standardized ingredient catalog.
 *
 * Prices: rough Canadian supermarket averages (CAD, 2024–2025) per 1000 g, per 1000 ml or per piece.
 *   They are estimates only — the UI labels every cost as approximate.
 * Nutrition: rounded generic reference values (per 100 g / 100 ml / piece) of the kind published in
 *   USDA FoodData Central "SR Legacy" / "Foundation" entries for the raw or as-purchased food.
 *   Recipe nutrition is *calculated* from these values and always shown as an approximation.
 */
type N = [kcal: number, protein: number, carbs: number, fat: number, fiber?: number];
interface Opts {
  allergens?: Allergen[];
  flags?: FoodFlag[];
  labelCheck?: boolean;
  countLabel?: string;
  gPerPc?: number;
  gPerMl?: number;
  group?: Ingredient['group'];
  aka?: string[];
}

function ing(id: string, name: string, aisle: Aisle, dim: Dimension, price: number, n: N | null, o: Opts = {}): Ingredient {
  return {
    id, name, aisle, dim, price,
    n: n ? { kcal: n[0], p: n[1], c: n[2], f: n[3], fib: n[4] ?? 0 } : undefined,
    ...o,
  };
}

const DAIRY: Opts = { allergens: ['dairy', 'lactose'], flags: ['dairy'], group: 'dairy' };
const WHEAT: Allergen[] = ['wheat', 'gluten'];
const SPICE = (id: string, name: string, aka: string[] = []) =>
  ing(id, name, 'Herbs and spices', 'volume', 40, null, { group: 'seasoning', aka });

export const INGREDIENTS: Ingredient[] = [
  // ---- Meat & poultry
  ing('chicken_breast', 'Chicken breast (boneless)', 'Meat and poultry', 'mass', 15, [120, 22.5, 0, 2.6], { flags: ['poultry'], group: 'protein', aka: ['chicken'] }),
  ing('chicken_thigh', 'Chicken thighs (boneless)', 'Meat and poultry', 'mass', 12, [121, 19.7, 0, 4.1], { flags: ['poultry'], group: 'protein', aka: ['chicken'] }),
  ing('ground_beef', 'Lean ground beef', 'Meat and poultry', 'mass', 11, [215, 18.6, 0, 15], { flags: ['beef'], group: 'protein', aka: ['beef', 'mince', 'hamburger'] }),
  ing('ground_turkey', 'Lean ground turkey', 'Meat and poultry', 'mass', 13, [150, 18.7, 0, 8.3], { flags: ['poultry'], group: 'protein', aka: ['turkey'] }),
  ing('beef_sirloin', 'Beef sirloin', 'Meat and poultry', 'mass', 22, [158, 21, 0, 8], { flags: ['beef'], group: 'protein', aka: ['beef', 'steak'] }),
  ing('pork_tenderloin', 'Pork tenderloin', 'Meat and poultry', 'mass', 13, [120, 21, 0, 3.5], { flags: ['pork'], group: 'protein', aka: ['pork'] }),
  ing('deli_turkey', 'Sliced turkey breast (deli)', 'Meat and poultry', 'mass', 25, [104, 17, 4, 1.7], { flags: ['poultry'], labelCheck: true, group: 'protein', aka: ['turkey', 'deli meat'] }),

  // ---- Seafood
  ing('salmon', 'Salmon fillet', 'Seafood', 'mass', 28, [208, 20, 0, 13], { flags: ['fish'], allergens: ['fish'], group: 'protein', aka: ['fish'] }),
  ing('cod', 'Cod fillet', 'Seafood', 'mass', 22, [82, 18, 0, 0.7], { flags: ['fish'], allergens: ['fish'], group: 'protein', aka: ['fish', 'white fish'] }),
  ing('shrimp', 'Shrimp (peeled, frozen)', 'Seafood', 'mass', 22, [85, 20, 0, 0.5], { flags: ['shellfish'], allergens: ['shellfish'], group: 'protein', aka: ['prawns'] }),
  ing('tuna_can', 'Canned tuna in water', 'Canned and packaged foods', 'count', 2.2, [140, 30, 0, 1], { flags: ['fish'], allergens: ['fish'], countLabel: 'can (170 g)', group: 'protein', aka: ['tuna', 'fish'] }),

  // ---- Eggs & dairy
  ing('egg', 'Eggs', 'Dairy and alternatives', 'count', 0.45, [72, 6.3, 0.4, 4.8], { flags: ['egg'], allergens: ['egg'], countLabel: 'egg', gPerPc: 50, group: 'protein', aka: ['eggs'] }),
  ing('milk', 'Milk (2%)', 'Dairy and alternatives', 'volume', 2.2, [50, 3.4, 4.8, 2], { ...DAIRY, aka: ['dairy'] }),
  ing('greek_yogurt', 'Plain Greek yogurt', 'Dairy and alternatives', 'mass', 7, [73, 9.9, 3.9, 1.9], { ...DAIRY, gPerMl: 1.05, aka: ['yogurt', 'yoghurt'] }),
  ing('cottage_cheese', 'Cottage cheese', 'Dairy and alternatives', 'mass', 7, [81, 10.5, 4.8, 2.3], { ...DAIRY, gPerMl: 0.95, aka: ['cheese'] }),
  ing('cheddar', 'Cheddar cheese', 'Dairy and alternatives', 'mass', 18, [403, 25, 1.3, 33], { ...DAIRY, aka: ['cheese'] }),
  ing('mozzarella', 'Mozzarella cheese', 'Dairy and alternatives', 'mass', 15, [254, 24, 3, 16], { ...DAIRY, aka: ['cheese'] }),
  ing('parmesan', 'Parmesan cheese', 'Dairy and alternatives', 'mass', 35, [400, 35, 3, 27], { ...DAIRY, gPerMl: 0.4, aka: ['cheese', 'parmigiano'] }),
  ing('feta', 'Feta cheese', 'Dairy and alternatives', 'mass', 22, [264, 14, 4, 21], { ...DAIRY, aka: ['cheese'] }),
  ing('paneer', 'Paneer', 'Dairy and alternatives', 'mass', 20, [296, 21, 3.6, 22], { ...DAIRY, aka: ['cheese'] }),
  ing('butter', 'Butter', 'Dairy and alternatives', 'mass', 12, [717, 0.9, 0.1, 81], { ...DAIRY, group: 'fat', gPerMl: 0.96 }),
  ing('soy_milk', 'Soy milk (unsweetened)', 'Dairy and alternatives', 'volume', 3.2, [40, 3.3, 2, 1.8], { allergens: ['soy'], group: 'dairy', aka: ['soymilk', 'plant milk'] }),
  ing('oat_milk', 'Oat milk', 'Dairy and alternatives', 'volume', 4, [48, 1, 7, 1.5], { labelCheck: true, group: 'dairy', aka: ['plant milk'] }),
  ing('tofu', 'Extra-firm tofu', 'Dairy and alternatives', 'mass', 6, [144, 17.3, 2.8, 8.7, 2.3], { allergens: ['soy'], group: 'protein', aka: ['bean curd'] }),
  ing('hummus', 'Hummus', 'Dairy and alternatives', 'mass', 12, [166, 7.9, 14.3, 9.6, 6], { allergens: ['sesame'], labelCheck: true, gPerMl: 1.0, group: 'protein' }),

  // ---- Bread & bakery
  ing('bread', 'Whole-grain bread', 'Bread and bakery', 'count', 0.2, [80, 4, 14, 1, 2], { allergens: WHEAT, labelCheck: true, countLabel: 'slice', group: 'grain', aka: ['toast'] }),
  ing('tortilla', 'Large flour tortillas', 'Bread and bakery', 'count', 0.55, [200, 5, 33, 5, 2], { allergens: WHEAT, labelCheck: true, countLabel: 'tortilla', group: 'grain', aka: ['wrap', 'wraps'] }),
  ing('corn_tortilla', 'Corn tortillas', 'Bread and bakery', 'count', 0.15, [52, 1.4, 11, 0.7, 1.5], { labelCheck: true, countLabel: 'tortilla', group: 'grain' }),
  ing('pita', 'Whole-wheat pita', 'Bread and bakery', 'count', 0.6, [165, 5.5, 33, 0.7, 4.5], { allergens: WHEAT, labelCheck: true, countLabel: 'pita', group: 'grain' }),
  ing('bagel', 'Whole-grain bagels', 'Bread and bakery', 'count', 0.9, [250, 10, 49, 1.5, 4], { allergens: WHEAT, labelCheck: true, countLabel: 'bagel', group: 'grain' }),
  ing('naan', 'Naan bread', 'Bread and bakery', 'count', 1.2, [260, 8.7, 45, 5, 2], { allergens: [...WHEAT, 'dairy', 'lactose'], flags: ['dairy'], labelCheck: true, countLabel: 'naan', group: 'grain' }),
  ing('rice_cake', 'Plain rice cakes', 'Snacks', 'count', 0.15, [35, 0.7, 7.3, 0.3, 0.4], { countLabel: 'cake', group: 'grain' }),

  // ---- Rice, pasta & grains
  ing('rolled_oats', 'Rolled oats', 'Rice, pasta and grains', 'mass', 3, [379, 13, 68, 6.5, 10], { labelCheck: true, gPerMl: 0.38, group: 'grain', aka: ['oats', 'oatmeal'] }),
  ing('basmati_rice', 'Basmati / long-grain rice', 'Rice, pasta and grains', 'mass', 4, [360, 7, 79, 0.6, 1.3], { gPerMl: 0.8, group: 'grain', aka: ['rice'] }),
  ing('brown_rice', 'Brown rice', 'Rice, pasta and grains', 'mass', 4, [367, 7.5, 76, 2.7, 3.5], { gPerMl: 0.8, group: 'grain', aka: ['rice'] }),
  ing('quinoa', 'Quinoa', 'Rice, pasta and grains', 'mass', 10, [368, 14, 64, 6, 7], { gPerMl: 0.75, group: 'grain' }),
  ing('pasta', 'Pasta (dry)', 'Rice, pasta and grains', 'mass', 3.5, [371, 13, 75, 1.5, 3.2], { allergens: WHEAT, group: 'grain', aka: ['spaghetti', 'penne', 'noodles'] }),
  ing('rice_noodles', 'Rice noodles', 'Rice, pasta and grains', 'mass', 8, [364, 6, 80, 0.6, 1.6], { labelCheck: true, group: 'grain', aka: ['noodles'] }),
  ing('flour', 'All-purpose flour', 'Rice, pasta and grains', 'mass', 3, [364, 10, 76, 1, 2.7], { allergens: WHEAT, gPerMl: 0.53, group: 'grain' }),
  ing('red_lentils', 'Red lentils (dry)', 'Rice, pasta and grains', 'mass', 4, [352, 24.6, 63, 1.1, 10.7], { gPerMl: 0.8, group: 'protein', aka: ['lentils', 'dal', 'masoor'] }),
  ing('green_lentils', 'Green or brown lentils (dry)', 'Rice, pasta and grains', 'mass', 4, [352, 24.6, 63, 1.1, 10.7], { gPerMl: 0.8, group: 'protein', aka: ['lentils'] }),
  ing('granola', 'Granola', 'Rice, pasta and grains', 'mass', 12, [470, 10, 64, 20, 7], { allergens: ['gluten'], labelCheck: true, gPerMl: 0.45, group: 'grain' }),

  // ---- Produce
  ing('banana', 'Bananas', 'Produce', 'count', 0.3, [105, 1.3, 27, 0.4, 3.1], { countLabel: 'banana', gPerPc: 118, group: 'fruit' }),
  ing('apple', 'Apples', 'Produce', 'count', 0.9, [95, 0.5, 25, 0.3, 4.4], { countLabel: 'apple', group: 'fruit' }),
  ing('orange', 'Oranges', 'Produce', 'count', 0.9, [62, 1.2, 15.4, 0.2, 3.1], { countLabel: 'orange', group: 'fruit' }),
  ing('lemon', 'Lemons', 'Produce', 'count', 0.8, [17, 0.6, 5.4, 0.2, 1.6], { countLabel: 'lemon', group: 'fruit' }),
  ing('lime', 'Limes', 'Produce', 'count', 0.6, [20, 0.5, 7, 0.1, 1.9], { countLabel: 'lime', group: 'fruit' }),
  ing('avocado', 'Avocados', 'Produce', 'count', 1.8, [240, 3, 13, 22, 10], { countLabel: 'avocado', group: 'fat' }),
  ing('strawberries', 'Strawberries', 'Produce', 'mass', 8, [32, 0.7, 7.7, 0.3, 2], { gPerMl: 0.6, group: 'fruit', aka: ['berries', 'strawberry'] }),
  ing('blueberries', 'Blueberries', 'Produce', 'mass', 12, [57, 0.7, 14.5, 0.3, 2.4], { gPerMl: 0.6, group: 'fruit', aka: ['berries', 'blueberry'] }),
  ing('spinach', 'Baby spinach', 'Produce', 'mass', 10, [23, 2.9, 3.6, 0.4, 2.2], { gPerMl: 0.13, group: 'vegetable', aka: ['greens'] }),
  ing('broccoli', 'Broccoli', 'Produce', 'mass', 5.5, [34, 2.8, 6.6, 0.4, 2.6], { group: 'vegetable' }),
  ing('bell_pepper', 'Bell peppers', 'Produce', 'count', 1.5, [46, 1.5, 9, 0.5, 3], { countLabel: 'pepper', gPerPc: 150, group: 'vegetable', aka: ['peppers', 'capsicum'] }),
  ing('onion', 'Yellow onions', 'Produce', 'count', 0.6, [60, 1.6, 14, 0.2, 2.5], { countLabel: 'onion', gPerPc: 150, group: 'vegetable', aka: ['onions'] }),
  ing('garlic', 'Garlic', 'Produce', 'count', 0.1, [4.5, 0.2, 1, 0], { countLabel: 'clove', gPerPc: 3, group: 'seasoning' }),
  ing('ginger', 'Fresh ginger', 'Produce', 'mass', 10, [80, 1.8, 18, 0.8, 2], { gPerMl: 1, group: 'seasoning' }),
  ing('tomato', 'Tomatoes', 'Produce', 'count', 0.8, [22, 1, 4.8, 0.2, 1.5], { countLabel: 'tomato', gPerPc: 120, group: 'vegetable', aka: ['tomatoes'] }),
  ing('cherry_tomatoes', 'Cherry tomatoes', 'Produce', 'mass', 9, [18, 0.9, 3.9, 0.2, 1.2], { gPerMl: 0.6, group: 'vegetable', aka: ['tomatoes'] }),
  ing('cucumber', 'English cucumber', 'Produce', 'count', 1.5, [45, 2, 11, 0.3, 1.5], { countLabel: 'cucumber', gPerPc: 300, group: 'vegetable' }),
  ing('carrot', 'Carrots', 'Produce', 'mass', 2.5, [41, 0.9, 9.6, 0.2, 2.8], { group: 'vegetable', aka: ['carrots'] }),
  ing('sweet_potato', 'Sweet potatoes', 'Produce', 'mass', 4, [86, 1.6, 20, 0.1, 3], { group: 'vegetable', aka: ['yam'] }),
  ing('potato', 'Potatoes', 'Produce', 'mass', 2.5, [77, 2, 17, 0.1, 2.2], { group: 'vegetable', aka: ['potatoes'] }),
  ing('zucchini', 'Zucchini', 'Produce', 'mass', 5, [17, 1.2, 3.1, 0.3, 1], { group: 'vegetable', aka: ['courgette'] }),
  ing('mushrooms', 'Mushrooms', 'Produce', 'mass', 9, [22, 3.1, 3.3, 0.3, 1], { group: 'vegetable', aka: ['mushroom'] }),
  ing('romaine', 'Romaine lettuce', 'Produce', 'mass', 6, [17, 1.2, 3.3, 0.3, 2.1], { gPerMl: 0.2, group: 'vegetable', aka: ['lettuce', 'salad'] }),
  ing('cabbage', 'Green cabbage', 'Produce', 'mass', 2.5, [25, 1.3, 5.8, 0.1, 2.5], { gPerMl: 0.3, group: 'vegetable', aka: ['slaw'] }),
  ing('cauliflower', 'Cauliflower', 'Produce', 'mass', 5, [25, 1.9, 5, 0.3, 2], { group: 'vegetable' }),
  ing('green_onion', 'Green onions', 'Produce', 'count', 0.25, [5, 0.3, 1.1, 0], { countLabel: 'stalk', group: 'vegetable', aka: ['scallion', 'spring onion'] }),
  ing('cilantro', 'Fresh cilantro', 'Produce', 'count', 1.5, [10, 1, 1.5, 0.2], { countLabel: 'bunch', group: 'seasoning', aka: ['coriander'] }),
  ing('dates', 'Medjool dates', 'Produce', 'count', 0.5, [66, 0.4, 18, 0, 1.6], { countLabel: 'date', group: 'fruit' }),

  // ---- Frozen
  ing('frozen_berries', 'Frozen mixed berries', 'Frozen foods', 'mass', 9, [50, 0.7, 12, 0.3, 3], { gPerMl: 0.6, group: 'fruit', aka: ['berries'] }),
  ing('frozen_mango', 'Frozen mango chunks', 'Frozen foods', 'mass', 8, [60, 0.8, 15, 0.4, 1.6], { gPerMl: 0.65, group: 'fruit', aka: ['mango'] }),
  ing('edamame', 'Shelled edamame (frozen)', 'Frozen foods', 'mass', 10, [121, 11.9, 8.9, 5.2, 5.2], { allergens: ['soy'], gPerMl: 0.65, group: 'protein', aka: ['soybeans'] }),
  ing('frozen_peas', 'Frozen peas', 'Frozen foods', 'mass', 5, [77, 5, 13.6, 0.4, 4.5], { gPerMl: 0.6, group: 'vegetable', aka: ['peas'] }),
  ing('frozen_corn', 'Frozen corn', 'Frozen foods', 'mass', 5, [88, 3.3, 19, 1.2, 2.4], { gPerMl: 0.6, group: 'vegetable', aka: ['corn'] }),

  // ---- Canned & packaged
  ing('chickpeas_can', 'Canned chickpeas', 'Canned and packaged foods', 'count', 1.5, [348, 18, 55, 6, 15], { countLabel: 'can (540 ml)', group: 'protein', aka: ['chickpeas', 'garbanzo', 'chana'] }),
  ing('black_beans_can', 'Canned black beans', 'Canned and packaged foods', 'count', 1.5, [330, 22, 59, 1.3, 22], { countLabel: 'can (540 ml)', group: 'protein', aka: ['black beans', 'beans'] }),
  ing('kidney_beans_can', 'Canned kidney beans', 'Canned and packaged foods', 'count', 1.5, [318, 21, 57, 1, 16], { countLabel: 'can (540 ml)', group: 'protein', aka: ['kidney beans', 'beans', 'rajma'] }),
  ing('diced_tomatoes', 'Canned diced tomatoes', 'Canned and packaged foods', 'count', 2, [144, 7, 32, 1.6, 14], { countLabel: 'can (796 ml)', group: 'vegetable', aka: ['tomatoes'] }),
  ing('tomato_paste', 'Tomato paste', 'Canned and packaged foods', 'mass', 8, [82, 4.3, 19, 0.5, 4], { gPerMl: 1.1, group: 'vegetable' }),
  ing('marinara', 'Marinara / pasta sauce', 'Sauces and condiments', 'volume', 6, [50, 1.5, 8, 1.5, 2], { labelCheck: true, group: 'vegetable', aka: ['tomato sauce', 'pasta sauce'] }),
  ing('coconut_milk', 'Canned coconut milk', 'Canned and packaged foods', 'volume', 7, [197, 2, 2.8, 21], { group: 'fat' }),
  ing('veg_broth', 'Vegetable broth (low sodium)', 'Canned and packaged foods', 'volume', 3, [6, 0.2, 1, 0.1], { labelCheck: true, group: 'other', aka: ['stock', 'broth'] }),
  ing('chicken_broth', 'Chicken broth (low sodium)', 'Canned and packaged foods', 'volume', 3, [5, 0.6, 0.3, 0.2], { flags: ['poultry'], labelCheck: true, group: 'other', aka: ['stock', 'broth'] }),
  ing('peanut_butter', 'Natural peanut butter', 'Canned and packaged foods', 'mass', 9, [588, 25, 20, 50, 6], { allergens: ['peanut'], gPerMl: 1.07, group: 'protein', aka: ['peanut', 'peanuts', 'pb'] }),
  ing('tahini', 'Tahini', 'Canned and packaged foods', 'mass', 15, [595, 17, 21, 54, 9], { allergens: ['sesame'], gPerMl: 1.0, group: 'fat', aka: ['sesame paste'] }),
  ing('jam', 'Strawberry jam', 'Canned and packaged foods', 'mass', 8, [250, 0.4, 65, 0.1], { gPerMl: 1.3, group: 'other', aka: ['jelly'] }),
  ing('baking_powder', 'Baking powder', 'Canned and packaged foods', 'mass', 10, null, { labelCheck: true, gPerMl: 0.9, group: 'other' }),

  // ---- Snacks / nuts & seeds
  ing('almonds', 'Almonds', 'Snacks', 'mass', 25, [579, 21, 22, 50, 12.5], { allergens: ['tree_nut'], gPerMl: 0.6, group: 'fat', aka: ['nuts', 'almond'] }),
  ing('walnuts', 'Walnuts', 'Snacks', 'mass', 30, [654, 15, 14, 65, 6.7], { allergens: ['tree_nut'], gPerMl: 0.45, group: 'fat', aka: ['nuts', 'walnut'] }),
  ing('raisins', 'Raisins', 'Snacks', 'mass', 10, [299, 3, 79, 0.5, 3.7], { gPerMl: 0.65, group: 'fruit' }),
  ing('pretzels', 'Pretzels', 'Snacks', 'mass', 10, [380, 10, 80, 3, 3], { allergens: WHEAT, labelCheck: true, gPerMl: 0.25, group: 'grain' }),
  ing('chia_seeds', 'Chia seeds', 'Snacks', 'mass', 20, [486, 17, 42, 31, 34], { gPerMl: 0.8, group: 'fat', aka: ['chia'] }),
  ing('choc_chips', 'Dark chocolate chips', 'Snacks', 'mass', 15, [500, 5, 60, 30, 6], { allergens: ['soy'], labelCheck: true, gPerMl: 0.7, group: 'other', aka: ['chocolate'] }),
  ing('cocoa', 'Unsweetened cocoa powder', 'Snacks', 'mass', 20, [228, 20, 58, 14, 37], { gPerMl: 0.42, group: 'other', aka: ['chocolate'] }),

  // ---- Sauces, oils & sweeteners
  ing('olive_oil', 'Olive oil', 'Sauces and condiments', 'volume', 15, [813, 0, 0, 92], { group: 'fat' }),
  ing('veg_oil', 'Vegetable or canola oil', 'Sauces and condiments', 'volume', 6, [813, 0, 0, 92], { group: 'fat', aka: ['oil'] }),
  ing('sesame_oil', 'Toasted sesame oil', 'Sauces and condiments', 'volume', 20, [813, 0, 0, 92], { allergens: ['sesame'], group: 'fat' }),
  ing('soy_sauce', 'Soy sauce', 'Sauces and condiments', 'volume', 6, [53, 8, 5, 0.1], { allergens: ['soy', 'wheat', 'gluten'], labelCheck: true, group: 'seasoning' }),
  ing('rice_vinegar', 'Rice vinegar', 'Sauces and condiments', 'volume', 6, [18, 0, 0.5, 0], { group: 'seasoning', aka: ['vinegar'] }),
  ing('hot_sauce', 'Hot sauce', 'Sauces and condiments', 'volume', 10, [11, 0.5, 1.8, 0.4], { group: 'seasoning', aka: ['sriracha'] }),
  ing('salsa', 'Tomato salsa', 'Sauces and condiments', 'volume', 8, [36, 1.5, 7, 0.2, 1.8], { labelCheck: true, group: 'vegetable' }),
  ing('pesto', 'Basil pesto', 'Sauces and condiments', 'mass', 25, [430, 5, 6, 44, 1], { allergens: ['dairy', 'lactose', 'tree_nut'], flags: ['dairy'], labelCheck: true, gPerMl: 1.0, group: 'fat' }),
  ing('honey', 'Honey', 'Sauces and condiments', 'mass', 15, [304, 0.3, 82, 0], { flags: ['honey'], gPerMl: 1.42, group: 'other' }),
  ing('maple_syrup', 'Maple syrup', 'Sauces and condiments', 'volume', 30, [343, 0, 88, 0.1], { group: 'other', aka: ['maple'] }),
  ing('dijon', 'Dijon mustard', 'Sauces and condiments', 'volume', 10, [66, 4, 5, 4], { group: 'seasoning', aka: ['mustard'] }),

  // ---- Herbs & spices
  ing('salt', 'Salt', 'Herbs and spices', 'volume', 3, null, { group: 'seasoning' }),
  SPICE('black_pepper', 'Black pepper', ['pepper']),
  SPICE('cumin', 'Ground cumin'),
  SPICE('paprika', 'Paprika (sweet or smoked)'),
  SPICE('chili_powder', 'Chili powder', ['chili', 'chilli']),
  SPICE('garam_masala', 'Garam masala'),
  SPICE('turmeric', 'Ground turmeric'),
  SPICE('curry_powder', 'Curry powder', ['curry']),
  SPICE('cinnamon', 'Ground cinnamon'),
  SPICE('oregano', 'Dried oregano'),
  SPICE('italian_seasoning', 'Italian seasoning', ['herbs']),
  SPICE('red_pepper_flakes', 'Red pepper flakes', ['chili flakes']),
  SPICE('garlic_powder', 'Garlic powder'),
];

export const INGREDIENT_MAP: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENT_MAP[id];
}

/** Fuzzy-match free text (e.g. "eggs", "chicken") to catalog ingredient IDs. */
export function matchIngredients(text: string): string[] {
  const t = text.trim().toLowerCase().replace(/[^a-z\s-]/g, '');
  if (!t) return [];
  const singular = t.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
  const hits = INGREDIENTS.filter((i) => {
    const names = [i.id.replace(/_/g, ' '), i.name.toLowerCase(), ...(i.aka ?? [])];
    return names.some((n) => {
      if (n === t || n === singular) return true;
      const words = n.split(/[\s(),/-]+/);
      return words.includes(t) || words.includes(singular) || (t.length > 3 && n.includes(t));
    });
  });
  return hits.map((h) => h.id);
}
