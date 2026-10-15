// Profile restrictions (Jain, lactose-free, …): the one rule set every suggestion surface uses, through the
// meal-candidates module. Pure; safe to import from client or server.
import { DIET_RANK, type Diet, type Food } from './nutrition';

export const RESTRICTIONS = [
  { slug: 'jain', label: 'Jain' },
  { slug: 'no-onion-garlic', label: 'No onion-garlic' },
  { slug: 'lactose-free', label: 'Lactose-free' },
  { slug: 'nut-allergy', label: 'Nut allergy' },
  { slug: 'gluten-free', label: 'Gluten-free' },
  { slug: 'diabetic-friendly', label: 'Diabetic-friendly' },
] as const;
export type Restriction = (typeof RESTRICTIONS)[number]['slug'];
export const RESTRICTION_SLUGS = RESTRICTIONS.map(r => r.slug) as [Restriction, ...Restriction[]];


// Keyword screens. A best-effort filter for suggestions, never a guarantee: recipes vary from kitchen to kitchen.
const KEYWORDS: Record<Restriction, string[]> = {
  jain: ['onion', 'garlic', 'potato', 'aloo', 'carrot', 'beet', 'radish', 'mooli', 'ginger', 'adrak', 'pyaz', 'lehsun', 'sweet potato', 'shakarkandi'],
  'no-onion-garlic': ['onion', 'garlic', 'pyaz', 'lehsun'],
  'lactose-free': ['milk', 'doodh', 'paneer', 'curd', 'dahi', 'yogurt', 'whey', 'chai', 'buttermilk', 'chaas', 'lassi', 'ghee', 'cheese', 'kheer', 'raita'],
  'nut-allergy': ['almond', 'badam', 'peanut', 'moongphali', 'cashew', 'kaju', 'walnut', 'akhrot', 'pista', 'nut'],
  'gluten-free': ['wheat', 'atta', 'roti', 'chapati', 'paratha', 'bread', 'naan', 'poori', 'puri', 'rava', 'sooji', 'semolina', 'upma', 'maida', 'dalia', 'oats', 'pasta', 'biscuit', 'barley'],
  'diabetic-friendly': ['sweetened', 'sugar', 'sweet', 'jalebi', 'ladoo', 'laddu', 'halwa', 'gulab', 'juice', 'soda', 'cola', 'kheer', 'mithai', 'barfi', 'honey', 'jaggery'],
};

/** Whether a food suits the user's diet and restrictions, for suggestions only. */
export function foodFits(food: Pick<Food, 'name' | 'aliases' | 'diet' | 'groups'>, diet: Diet, restrictions: readonly string[]): boolean {
  const jain = restrictions.includes('jain');
  if (DIET_RANK[food.diet] > (jain ? 0 : DIET_RANK[diet])) return false;
  const text = `${food.name} ${food.aliases ?? ''}`.toLowerCase();
  for (const r of restrictions) {
    const words = KEYWORDS[r as Restriction];
    if (words?.some(w => new RegExp(`\\b${w}`).test(text))) return false;
  }
  if (restrictions.includes('lactose-free') && (food.groups?.milk ?? 0) > 0) return false;
  if (restrictions.includes('nut-allergy') && (food.groups?.nuts ?? 0) > 0) return false;
  return true;
}
