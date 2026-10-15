// First recipes (#14), built only from the starter catalogue (src/lib/seed-foods.ts), so their nutrition comes from
// the same values members log with. Quantities are for the whole recipe, in each food's own serving unit.
// Admins edit the live rows in Admin → Recipes; this file only seeds them (scripts/gen-recipe-seed.ts).
import type { RecipeIngredient } from './nutrition';

export type SeedRecipe = { name: string; cuisine: string; servings: number; ingredients: RecipeIngredient[]; steps: string[] };

const i = (...pairs: [string, number][]): RecipeIngredient[] => pairs.map(([foodId, q]) => ({ foodId, q }));

export const SEED_RECIPES: SeedRecipe[] = [
  // ---------- Indian ----------
  {
    name: 'Dal chawal with salad', cuisine: 'Indian', servings: 2,
    ingredients: i(['dal', 2], ['rice', 2], ['salad', 1], ['oil', 1]),
    steps: [
      'Rinse the dal and pressure-cook it with turmeric and salt until soft.',
      'Cook the rice separately until fluffy.',
      'Heat the oil, splutter cumin, add garlic and a pinch of chilli, then pour it over the dal.',
      'Serve the dal over rice with the cucumber and tomato salad.',
    ],
  },
  {
    name: 'Rajma chawal', cuisine: 'Indian', servings: 2,
    ingredients: i(['rajma', 2], ['rice', 2], ['salad', 1]),
    steps: [
      'Warm the rajma curry, adding a splash of water if it has thickened.',
      'Cook the rice until fluffy.',
      'Serve the rajma over the rice with a side of salad and a squeeze of lemon.',
    ],
  },
  {
    name: 'Chole with roti', cuisine: 'Indian', servings: 2,
    ingredients: i(['chole', 2], ['chapati', 4], ['salad', 1]),
    steps: [
      'Simmer the chole for a few minutes so the gravy coats the chickpeas.',
      'Roll and cook the rotis on a hot tawa until they puff.',
      'Serve with sliced onion, tomato and cucumber salad.',
    ],
  },
  {
    name: 'Idli sambar', cuisine: 'Indian', servings: 2,
    ingredients: i(['idli', 8], ['sambar', 2]),
    steps: [
      'Steam the idli batter in greased moulds for 10 to 12 minutes.',
      'Bring the sambar to a simmer while the idlis steam.',
      'Rest the idlis for a minute, unmould and serve with hot sambar.',
    ],
  },
  {
    name: 'Dosa with sambar', cuisine: 'Indian', servings: 2,
    ingredients: i(['dosa', 4], ['sambar', 2]),
    steps: [
      'Heat a tawa and wipe it with a little water.',
      'Spread a ladle of batter thinly in circles and cook until golden and crisp.',
      'Fold and serve straight away with hot sambar.',
    ],
  },
  {
    name: 'Paneer bhurji with roti', cuisine: 'Indian', servings: 2,
    ingredients: i(['paneer-bhurji', 2], ['chapati', 4], ['salad', 1]),
    steps: [
      'Sauté onion, tomato and green chilli until soft.',
      'Crumble in the paneer, add turmeric and salt and cook for 3 minutes.',
      'Finish with coriander and serve with hot rotis and salad.',
    ],
  },
  {
    name: 'Moong khichdi with curd', cuisine: 'Indian', servings: 2,
    ingredients: i(['khichdi', 2], ['curd', 2]),
    steps: [
      'Rinse rice and moong dal together and pressure-cook with turmeric, salt and water.',
      'Temper cumin and a pinch of hing in a little oil and stir it in.',
      'Serve warm with a katori of curd.',
    ],
  },
  {
    name: 'Vegetable poha with peanuts', cuisine: 'Indian', servings: 2,
    ingredients: i(['poha', 2], ['peanuts', 0.5]),
    steps: [
      'Rinse the poha in a sieve and let it soften for 5 minutes.',
      'Toast the peanuts, then sauté mustard seeds, curry leaves, onion and peas.',
      'Add turmeric, salt and the poha, toss gently and finish with lemon and coriander.',
    ],
  },
  {
    name: 'Upma with sprouts', cuisine: 'Indian', servings: 2,
    ingredients: i(['upma', 2], ['sprouts', 1]),
    steps: [
      'Dry-roast the rava until fragrant.',
      'Temper mustard seeds and curry leaves, add vegetables and hot water, then stir in the rava.',
      'Cover and cook for 3 minutes. Serve with the moong sprouts salad.',
    ],
  },
  {
    name: 'Everyday veg thali', cuisine: 'Indian', servings: 2,
    ingredients: i(['dal', 2], ['sabzi', 2], ['chapati', 4], ['curd', 2], ['salad', 1]),
    steps: [
      'Cook the dal with turmeric and finish with a cumin tadka.',
      'Cook the mixed vegetable sabzi with ginger, tomato and garam masala.',
      'Make the rotis on a hot tawa.',
      'Plate dal, sabzi, rotis, curd and salad together.',
    ],
  },
  {
    name: 'Egg curry with rice', cuisine: 'Indian', servings: 2,
    ingredients: i(['egg', 4], ['rice', 2], ['sabzi', 1], ['oil', 2]),
    steps: [
      'Boil the eggs for 10 minutes, cool and peel.',
      'Make an onion-tomato masala in the oil with ginger, garlic and spices.',
      'Add water to make a gravy, slip in the halved eggs and simmer for 5 minutes.',
      'Serve with rice and a side of sabzi.',
    ],
  },
  {
    name: 'Chicken curry with rice', cuisine: 'Indian', servings: 2,
    ingredients: i(['chicken', 2], ['rice', 2], ['sabzi', 1], ['oil', 2]),
    steps: [
      'Brown onions in the oil, then add ginger-garlic paste and tomatoes.',
      'Add the chicken pieces and spices and sear for a few minutes.',
      'Add water, cover and simmer until the chicken is cooked through.',
      'Serve with rice and sabzi.',
    ],
  },
  {
    name: 'Kerala-style fish curry with rice', cuisine: 'Indian', servings: 2,
    ingredients: i(['fish', 2], ['rice', 2], ['oil', 2]),
    steps: [
      'Sauté mustard seeds, curry leaves, shallots and ginger in the oil.',
      'Add chilli, turmeric and tamarind water and bring to a simmer.',
      'Slide in the fish and cook gently for 6 to 8 minutes.',
      'Serve with hot rice.',
    ],
  },
  {
    name: 'Curd rice', cuisine: 'Indian', servings: 2,
    ingredients: i(['rice', 2], ['curd', 2], ['oil', 0.5]),
    steps: [
      'Mash the cooked rice lightly while it is still warm and let it cool.',
      'Stir in the curd and salt.',
      'Temper mustard seeds, curry leaves and green chilli in the oil and pour it over.',
    ],
  },
  {
    name: 'Sprouts chaat', cuisine: 'Indian', servings: 2,
    ingredients: i(['sprouts', 2], ['salad', 1]),
    steps: [
      'Steam the moong sprouts for 3 minutes so they stay crunchy.',
      'Toss with chopped cucumber, tomato and onion.',
      'Season with chaat masala, lemon and coriander.',
    ],
  },
  {
    name: 'Aloo paratha with curd', cuisine: 'Indian', servings: 2,
    ingredients: i(['paratha', 2], ['curd', 2]),
    steps: [
      'Mash boiled potatoes with green chilli, coriander and ajwain.',
      'Stuff the dough, roll it out gently and cook on a hot tawa with a little oil.',
      'Serve hot with a katori of curd.',
    ],
  },
  {
    name: 'Chicken biryani with raita', cuisine: 'Indian', servings: 2,
    ingredients: i(['biryani', 2], ['curd', 1], ['salad', 1]),
    steps: [
      'Warm the biryani covered so the rice steams through.',
      'Whisk the curd with cucumber, roasted cumin and salt for the raita.',
      'Serve the biryani with raita and sliced onion salad.',
    ],
  },

  // ---------- Chinese ----------
  {
    name: 'Egg fried rice', cuisine: 'Chinese', servings: 2,
    ingredients: i(['rice', 3], ['egg', 4], ['sabzi', 1], ['oil', 2]),
    steps: [
      'Use cold cooked rice so the grains stay separate.',
      'Scramble the eggs in half the oil on high heat and set them aside.',
      'Stir-fry chopped vegetables in the rest of the oil, add the rice and toss well.',
      'Fold the egg back in and season with soy sauce, pepper and spring onion.',
    ],
  },
  {
    name: 'Tofu and vegetable stir-fry with brown rice', cuisine: 'Chinese', servings: 2,
    ingredients: i(['tofu', 2], ['sabzi', 2], ['brown-rice', 2], ['oil', 2]),
    steps: [
      'Press the tofu dry and cut it into cubes.',
      'Sear the tofu in the oil until golden, then push it to the side.',
      'Stir-fry the vegetables with garlic and ginger, then toss everything with soy sauce.',
      'Serve over brown rice.',
    ],
  },
  {
    name: 'Chilli paneer with rice', cuisine: 'Chinese', servings: 2,
    ingredients: i(['paneer', 2], ['sabzi', 1], ['rice', 2], ['oil', 2]),
    steps: [
      'Cube the paneer and sear it in the oil until lightly golden.',
      'Stir-fry onion, capsicum, garlic and green chilli on high heat.',
      'Add soy sauce, a little vinegar and the paneer, and toss until coated.',
      'Serve with rice.',
    ],
  },
  {
    name: 'Chicken stir-fry with brown rice', cuisine: 'Chinese', servings: 2,
    ingredients: i(['chicken', 2], ['sabzi', 2], ['brown-rice', 2], ['oil', 2]),
    steps: [
      'Slice the chicken thinly and season with soy sauce and pepper.',
      'Stir-fry it in the oil on high heat until just cooked, then set aside.',
      'Stir-fry the vegetables with garlic, return the chicken and toss together.',
      'Serve over brown rice.',
    ],
  },

  // ---------- Mediterranean ----------
  {
    name: 'Greek yogurt bowl with fruit and almonds', cuisine: 'Mediterranean', servings: 2,
    ingredients: i(['greek-yogurt', 2], ['banana', 1], ['apple', 1], ['almonds', 1]),
    steps: [
      'Spoon the Greek yogurt into two bowls.',
      'Top with sliced banana and chopped apple.',
      'Scatter the almonds over and add a drizzle of honey if you like.',
    ],
  },
  {
    name: 'Grilled fish with salad', cuisine: 'Mediterranean', servings: 2,
    ingredients: i(['fish', 2], ['salad', 2], ['oil', 2]),
    steps: [
      'Rub the fish with half the oil, lemon, garlic, salt and pepper.',
      'Grill or pan-sear for 3 to 4 minutes a side.',
      'Toss the salad with the rest of the oil and lemon, and serve with the fish.',
    ],
  },
  {
    name: 'Grilled chicken salad', cuisine: 'Mediterranean', servings: 2,
    ingredients: i(['chicken', 2], ['salad', 2], ['oil', 1]),
    steps: [
      'Season the chicken with oregano, garlic, lemon, salt and pepper.',
      'Grill until cooked through, rest for 5 minutes and slice.',
      'Toss the salad with oil and lemon and top with the chicken.',
    ],
  },

  // ---------- Continental ----------
  {
    name: 'Overnight oats with banana and peanut butter', cuisine: 'Continental', servings: 2,
    ingredients: i(['oats', 2], ['milk', 1], ['banana', 1], ['peanut-butter', 1]),
    steps: [
      'Mix the oats with the milk in a jar and refrigerate overnight.',
      'In the morning, stir and loosen with a splash of milk if needed.',
      'Top with sliced banana and the peanut butter.',
    ],
  },
  {
    name: 'Scrambled eggs on toast', cuisine: 'Continental', servings: 2,
    ingredients: i(['egg', 4], ['bread', 4], ['oil', 1]),
    steps: [
      'Whisk the eggs with salt and pepper.',
      'Cook them slowly in the oil, stirring, until just set.',
      'Toast the bread and pile the eggs on top.',
    ],
  },
  {
    name: 'Peanut butter banana toast', cuisine: 'Continental', servings: 2,
    ingredients: i(['bread', 4], ['peanut-butter', 2], ['banana', 1]),
    steps: [
      'Toast the bread.',
      'Spread the peanut butter evenly.',
      'Top with banana slices and a pinch of cinnamon.',
    ],
  },
];
