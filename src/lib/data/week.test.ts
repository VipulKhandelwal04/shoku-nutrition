import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FLAGS } from '../flags';
import { MEALS, type Plan } from '../nutrition';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), flags: vi.fn(), eligible: new Map([['allowed', {}]]) }));
vi.mock('../auth', () => ({ SESSION_ENDED: 'Sign in again', actionUser: async () => ({
  user: { id: 'member' }, supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { diet: 'veg' } }) }) }) }) },
}) }));
vi.mock('./queries', () => ({ getFlags: mocks.flags }));
vi.mock('../ai/member', () => ({ memberSuggestions: async () => ({ set: { eligible: mocks.eligible } }) }));
import { restoreWeekPlans } from './week';
const plan = Object.fromEntries(MEALS.map(m => [m, [{ foodId: 'allowed', q: 1, flex: false }]])) as Plan;
beforeEach(() => { mocks.rpc.mockReset().mockResolvedValue({ error: null }); mocks.flags.mockResolvedValue(DEFAULT_FLAGS); });
describe('week Undo authorization and validation', () => {
  it('refuses a nonempty restore when the week feature is off', async () => {
    mocks.flags.mockResolvedValue({ ...DEFAULT_FLAGS, week: { ...DEFAULT_FLAGS.week, on: false } });
    expect(await restoreWeekPlans([{ weekday: 1, plan }])).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('permits delete-only Undo while the feature is off', async () => {
    mocks.flags.mockResolvedValue({ ...DEFAULT_FLAGS, week: { ...DEFAULT_FLAGS.week, on: false } });
    expect(await restoreWeekPlans([])).toMatchObject({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('restore_week_plans', { p_days: [] });
  });
  it('rejects malformed and duplicate weekdays before writing', async () => {
    expect(await restoreWeekPlans([{ weekday: 1, plan: {} as Plan }])).toMatchObject({ ok: false });
    expect(await restoreWeekPlans([{ weekday: 1, plan }, { weekday: 1, plan }])).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuses foods that no longer fit current restrictions', async () => {
    const previous = { ...plan, Breakfast: [{ foodId: 'restricted', q: 1, flex: false }] };
    expect(await restoreWeekPlans([{ weekday: 1, plan: previous }])).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('restores valid quantities without fitting the previous plan again', async () => {
    const previous = [{ weekday: 1, plan }];
    expect(await restoreWeekPlans(previous)).toMatchObject({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('restore_week_plans', { p_days: previous });
  });
});
