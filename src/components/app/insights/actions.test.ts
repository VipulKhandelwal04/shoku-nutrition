import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ profile: { goal: 'fit', sex: 'male', age: 35, height_cm: 180, weight_kg: 110, activity: 'moderate' } as Record<string, unknown>, update: vi.fn(), signedIn: true }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({ actionUser: async () => state.signedIn ? ({ user: { id: 'member' }, supabase: { from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: state.profile, error: null }) }) }),
  update: (input: unknown) => { state.update(input); return { eq: async () => ({ error: null }) }; },
}) } }) : null }));
import { setGoal } from './actions';
import { recommend } from '@/lib/nutrition';
import { pickTargets } from './insights';
beforeEach(() => { state.update.mockClear(); state.signedIn = true; state.profile.height_cm = 180; });
it('saves goal and its new recommended targets together', async () => {
  const result = await setGoal('lose');
  const targets = pickTargets(recommend({ goal: 'lose', sex: 'male', age: 35, height: 180, weight: 110, activity: 'moderate' }));
  expect(result.ok).toBe(true);
  expect(state.update).toHaveBeenCalledExactlyOnceWith({ goal: 'lose', targets });
});
it('does not change a goal when profile inputs are incomplete', async () => {
  state.profile.height_cm = null;
  expect((await setGoal('lose')).ok).toBe(false);
  expect(state.update).not.toHaveBeenCalled();
});
it('rejects signed-out and invalid goal changes without writes', async () => {
  state.signedIn = false;
  expect((await setGoal('lose')).ok).toBe(false);
  expect((await setGoal('invalid')).ok).toBe(false);
  expect(state.update).not.toHaveBeenCalled();
});
