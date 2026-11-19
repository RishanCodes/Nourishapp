/**
 * Typical Canadian retail package sizes, in the ingredient's base unit (g, ml or pieces).
 * Used to estimate how many packages to buy and the checkout cost if nothing is already at home.
 * Loose produce sold by weight or by the piece has no entry (you buy exactly what you need).
 */
export const PACK_SIZE: Record<string, number> = {
  chicken_breast: 900, chicken_thigh: 900, ground_beef: 450, ground_turkey: 450, beef_sirloin: 500, pork_tenderloin: 500,
  deli_turkey: 175, salmon: 450, cod: 400, shrimp: 340,
  egg: 12, milk: 2000, greek_yogurt: 750, cottage_cheese: 500, cheddar: 400, mozzarella: 340, parmesan: 200, feta: 200,
  paneer: 350, butter: 454, soy_milk: 1890, oat_milk: 1750, tofu: 350, hummus: 227,
  bread: 20, tortilla: 10, corn_tortilla: 30, pita: 6, bagel: 6, naan: 4, rice_cake: 14,
  rolled_oats: 1000, basmati_rice: 2000, brown_rice: 900, quinoa: 750, pasta: 900, rice_noodles: 400, flour: 2500,
  red_lentils: 900, green_lentils: 900, granola: 500,
  spinach: 142, strawberries: 454, blueberries: 170, cherry_tomatoes: 283, mushrooms: 227, romaine: 600, carrot: 907,
  sweet_potato: 1360, potato: 2270, ginger: 100, green_onion: 6, dates: 20,
  frozen_berries: 600, frozen_mango: 600, edamame: 500, frozen_peas: 750, frozen_corn: 750,
  tomato_paste: 156, marinara: 650, coconut_milk: 400, veg_broth: 900, chicken_broth: 900, peanut_butter: 500, tahini: 400,
  jam: 500, baking_powder: 225, almonds: 400, walnuts: 300, raisins: 500, pretzels: 400, chia_seeds: 340, choc_chips: 300,
  cocoa: 227, olive_oil: 1000, veg_oil: 946, sesame_oil: 250, soy_sauce: 500, rice_vinegar: 355, hot_sauce: 150, salsa: 650,
  pesto: 190, honey: 500, maple_syrup: 540, dijon: 250, salt: 1000,
  black_pepper: 100, cumin: 100, paprika: 100, chili_powder: 100, garam_masala: 100, turmeric: 100, curry_powder: 100,
  cinnamon: 100, oregano: 50, italian_seasoning: 50, red_pepper_flakes: 50, garlic_powder: 100,
};
