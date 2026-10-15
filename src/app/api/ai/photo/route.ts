import { DAY, IMAGE_TYPES, MAX_IMAGE_BYTES, MEAL } from '@/lib/ai/contracts';
import { guardAi } from '@/lib/ai/guard';
import { fail } from '@/lib/ai/http';
import { PHOTO_SYSTEM } from '@/lib/ai/prompts';
import { suggestFoods } from '@/lib/ai/suggest';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST multipart/form-data { image: File (jpeg|png|webp, ≤ 4 MB), meal, day }
 * → { ok: true, data: SuggestResponse }. The image is sent to Gemini inline and is not stored here.
 */
export async function POST(request: Request) {
  const guard = await guardAi('photo');
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Send the photo as a form upload.');
  }
  const image = form.get('image');
  const meal = MEAL.safeParse(form.get('meal'));
  const day = DAY.safeParse(form.get('day'));
  if (!meal.success || !day.success) return fail(400, 'Pick a meal and a day first.');
  if (!(image instanceof File) || image.size === 0) return fail(400, 'Choose a photo of your plate.');
  if (!(IMAGE_TYPES as readonly string[]).includes(image.type)) return fail(415, 'Use a JPG, PNG or WebP photo.');
  if (image.size > MAX_IMAGE_BYTES) return fail(413, 'That photo is over 4 MB. Try a smaller one.');

  const data = Buffer.from(await image.arrayBuffer()).toString('base64');
  return suggestFoods({
    feature: 'photo',
    supabase: guard.supabase,
    system: PHOTO_SYSTEM,
    input: { inlineData: { mimeType: image.type, data } },
    meal: meal.data,
    day: day.data,
    signal: request.signal,
  });
}
