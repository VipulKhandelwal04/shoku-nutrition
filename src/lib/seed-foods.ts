import type { Food } from './nutrition';

// Starter catalogue. Values are per serving and illustrative, not a verified nutrition database.
// Admins edit the live copy in the `foods` table; this file only seeds it (see scripts/gen-food-seed.mjs).
type Row = [id: string, name: string, category: string, unit: string, grams: number, kcal: number, p: number, c: number, f: number, fibre: number, diet: Food['diet'], icon: string, aliases: string, groups: Food['groups']];

const rows: Row[] = [
  ['oats', 'Oats, cooked', 'Breakfast', 'bowl', 180, 154, 5, 27, 3, 4, 'veg', 'bowl', 'porridge oatmeal', { cer: 40 }],
  ['banana', 'Banana', 'Fruit', 'medium', 118, 105, 1.3, 27, 0.4, 3.1, 'veg', 'fruit', 'kela', { fruit: 118 }],
  ['milk', 'Milk, toned', 'Dairy', 'glass', 200, 120, 6.4, 9.6, 6, 0, 'veg', 'glass', 'doodh', { milk: 200 }],
  ['egg', 'Egg, boiled', 'Protein', 'egg', 50, 78, 6.3, 0.6, 5.3, 0, 'egg', 'egg', 'anda', { pul: 25 }],
  ['idli', 'Idli', 'Breakfast', 'piece', 40, 58, 2, 12, 0.4, 0.5, 'veg', 'plate', 'rice idly', { cer: 12, pul: 4 }],
  ['sambar', 'Sambar', 'Indian meals', 'katori', 150, 100, 4, 15, 3, 4, 'veg', 'bowl', 'sambhar dal lentil', { pul: 20, veg: 50, oil: 3 }],
  ['poha', 'Vegetable poha', 'Breakfast', 'bowl', 180, 250, 5, 43, 7, 3, 'veg', 'plate', 'flattened rice', { cer: 50, veg: 40, oil: 7 }],
  ['upma', 'Vegetable upma', 'Breakfast', 'bowl', 180, 230, 6, 35, 7, 3, 'veg', 'bowl', 'rava sooji', { cer: 45, veg: 40, oil: 7 }],
  ['dosa', 'Plain dosa', 'Breakfast', 'medium', 100, 168, 4, 30, 4, 1.2, 'veg', 'plate', 'dosai', { cer: 30, pul: 10, oil: 4 }],
  ['chapati', 'Whole wheat roti', 'Indian meals', 'roti', 40, 104, 3.5, 21, 0.5, 3, 'veg', 'roti', 'chapati phulka chappati', { cer: 30 }],
  ['rice', 'Rice, cooked', 'Indian meals', 'katori', 150, 195, 4, 42, 0.5, 0.6, 'veg', 'bowl', 'chawal white basmati', { cer: 50 }],
  ['brown-rice', 'Brown rice, cooked', 'Indian meals', 'katori', 150, 167, 3.9, 34.5, 1.4, 2.7, 'veg', 'bowl', 'chawal', { cer: 50 }],
  ['dal', 'Yellow dal', 'Indian meals', 'katori', 150, 180, 9, 27, 4, 5, 'veg', 'bowl', 'lentil moong toor tadka', { pul: 30, oil: 4 }],
  ['rajma', 'Rajma curry', 'Indian meals', 'katori', 150, 210, 10, 30, 6, 8, 'veg', 'bowl', 'kidney bean', { pul: 35, veg: 30, oil: 6 }],
  ['chole', 'Chole', 'Indian meals', 'katori', 150, 220, 10, 32, 6, 8, 'veg', 'bowl', 'chana chickpea', { pul: 35, veg: 30, oil: 6 }],
  ['paneer', 'Paneer, plain', 'Protein', 'portion', 100, 265, 18, 3, 21, 0, 'veg', 'cube', 'cottage cheese', { milk: 400 }],
  ['paneer-bhurji', 'Paneer bhurji', 'Indian meals', 'katori', 150, 295, 18, 9, 21, 2, 'veg', 'plate', 'cottage cheese scramble', { milk: 300, veg: 40, oil: 8 }],
  ['tofu', 'Tofu, firm', 'Protein', 'portion', 100, 144, 17, 3, 9, 2, 'veg', 'cube', 'soya soy', { pul: 50 }],
  ['chicken', 'Chicken breast, grilled', 'Protein', 'portion', 100, 165, 31, 0, 3.6, 0, 'nonveg', 'plate', 'murgh', { pul: 60 }],
  ['fish', 'Fish, grilled', 'Protein', 'portion', 100, 160, 26, 0, 6, 0, 'nonveg', 'plate', 'machli', { pul: 60 }],
  ['curd', 'Curd, plain', 'Dairy', 'katori', 150, 92, 5.3, 7, 5, 0, 'veg', 'bowl', 'dahi yogurt', { milk: 150 }],
  ['greek-yogurt', 'Greek yogurt, plain', 'Dairy', 'cup', 150, 100, 15, 6, 1.5, 0, 'veg', 'bowl', 'yoghurt hung curd', { milk: 300 }],
  ['whey', 'Whey protein', 'Protein', 'scoop', 30, 120, 24, 3, 2, 0, 'veg', 'glass', 'protein shake powder', {}],
  ['sprouts', 'Moong sprouts salad', 'Snacks', 'bowl', 150, 110, 8, 18, 1, 5, 'veg', 'leaf', 'mung bean', { pul: 50, veg: 50 }],
  ['salad', 'Cucumber & tomato salad', 'Vegetables', 'bowl', 150, 35, 1.5, 7, 0.3, 2, 'veg', 'leaf', 'kheera tamatar', { veg: 150 }],
  ['sabzi', 'Mixed vegetable sabzi', 'Vegetables', 'katori', 150, 120, 3, 15, 6, 4, 'veg', 'leaf', 'sabji vegetables curry', { veg: 130, oil: 6 }],
  ['apple', 'Apple', 'Fruit', 'medium', 180, 95, 0.5, 25, 0.3, 4.4, 'veg', 'fruit', 'seb', { fruit: 180 }],
  ['orange', 'Orange', 'Fruit', 'medium', 130, 62, 1.2, 15, 0.2, 3, 'veg', 'fruit', 'santra', { fruit: 130 }],
  ['almonds', 'Almonds', 'Snacks', 'handful', 20, 116, 4.2, 4.3, 10, 2.5, 'veg', 'nuts', 'badam nuts', { nuts: 20 }],
  ['peanuts', 'Roasted peanuts', 'Snacks', 'handful', 30, 176, 7.5, 6, 15, 2.5, 'veg', 'nuts', 'mungfali groundnut', { nuts: 30 }],
  ['makhana', 'Roasted makhana', 'Snacks', 'bowl', 25, 90, 2.4, 18, 1, 2, 'veg', 'nuts', 'fox nuts lotus', { nuts: 25 }],
  ['chai', 'Milk chai, sweetened', 'Drinks', 'cup', 150, 90, 3, 12, 3, 0, 'veg', 'glass', 'tea', { milk: 75 }],
  ['coffee', 'Black coffee', 'Drinks', 'cup', 200, 2, 0.3, 0, 0, 0, 'veg', 'glass', 'americano', {}],
  ['buttermilk', 'Buttermilk', 'Drinks', 'glass', 200, 60, 3, 6, 2.5, 0, 'veg', 'glass', 'chaas chhach', { milk: 100 }],
  ['bread', 'Whole wheat bread', 'Breakfast', 'slice', 30, 75, 3, 13, 1, 2, 'veg', 'roti', 'toast', { cer: 25 }],
  ['peanut-butter', 'Peanut butter', 'Snacks', 'tablespoon', 16, 94, 3.6, 3.2, 8, 1, 'veg', 'nuts', 'spread', { nuts: 16 }],
  ['biryani', 'Chicken biryani', 'Indian meals', 'plate', 300, 490, 23, 62, 17, 3, 'nonveg', 'plate', 'briyani rice', { cer: 60, pul: 40, oil: 10 }],
  ['khichdi', 'Moong dal khichdi', 'Indian meals', 'bowl', 200, 235, 9, 39, 5, 4, 'veg', 'bowl', 'kichdi rice lentils', { cer: 35, pul: 20, oil: 4 }],
  ['paratha', 'Aloo paratha', 'Breakfast', 'medium', 100, 260, 6, 39, 9, 4, 'veg', 'roti', 'potato parantha', { cer: 50, veg: 40, oil: 8 }],
  ['oil', 'Cooking oil', 'Cooking', 'teaspoon', 5, 45, 0, 0, 5, 0, 'veg', 'glass', 'ghee olive sunflower mustard', { oil: 5 }],
];

export const SEED_FOODS: Food[] = rows.map(([id, name, category, unit, grams, kcal, p, c, f, fibre, diet, icon, aliases, groups]) => ({
  id, name, category, unit, grams, kcal, p, c, f, fibre, diet, icon, aliases, groups,
}));
