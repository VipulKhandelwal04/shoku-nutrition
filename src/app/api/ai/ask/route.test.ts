import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_FOODS } from '@/lib/seed-foods';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), reserve: vi.fn(), profile: { use_workouts: true, ask_workouts: true } }));
vi.mock('@/lib/ai/gemini', () => ({ generateJson: mocks.generate }));
vi.mock('@/lib/ai/guard', () => ({ recordUsage: vi.fn(), reserveAi: mocks.reserve, guardAi: async () => ({
  ok: true, user: { id: 'member' }, settings: { daily_quota: 25 },
  supabase: { from: (table: string) => {
    const rows = table === 'entries' ? [] : [{ label: 'Private run', kind: 'run', minutes: 30, kcal: 300 }];
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { ...mocks.profile, diet: 'veg', targets: { kcal: 2000, p: 100 }, restrictions: [] } }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    }; return query;
  } },
}) }));
vi.mock('@/lib/ai/member', () => ({ memberSuggestions: async () => ({
  set: { candidates: SEED_FOODS.map(food => ({ food, weight: 1 })), eligible: new Map(SEED_FOODS.map(f => [f.id, f])), preferred: [], recipes: [] },
  brief: {}, usedFeedback: false,
}) }));
import { POST } from './route';
beforeEach(() => { mocks.generate.mockReset().mockResolvedValue({ answer: 'Try a meal', ideas: [] }); mocks.profile.use_workouts = true; mocks.reserve.mockReset().mockResolvedValue({ ok: true, usageId: 1 }); });
describe('workout consent at the AI boundary', () => {
  it.each([undefined, false])('does not send workouts without explicit permission (%s)', async choice => {
    const response = await POST(new Request('http://localhost/api/ai/ask', { method: 'POST', body: JSON.stringify({ question: 'Dinner ideas', day: '2026-10-15', useWorkouts: choice }) }));
    expect(response.status).toBe(200);
    const brief = JSON.parse(mocks.generate.mock.calls[0][1].parts[0].text.replace('User\'s day: ', ''));
    expect(brief).not.toHaveProperty('workouts');
    expect((await response.json()).data.context.workoutsUse).toBe('skipped');
  });
  it('does not call the model when the atomic reservation is refused', async () => {
    mocks.reserve.mockResolvedValue({ ok: false, response: new Response('Limit reached', { status: 429 }) });
    const response = await POST(new Request('http://localhost/api/ai/ask', { method: 'POST', body: JSON.stringify({ question: 'Dinner ideas', day: '2026-10-15' }) }));
    expect(response.status).toBe(429);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('does not consume quota for invalid requests', async () => {
    const response = await POST(new Request('http://localhost/api/ai/ask', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it('sends workouts only after explicit permission', async () => {
    await POST(new Request('http://localhost/api/ai/ask', { method: 'POST', body: JSON.stringify({ question: 'Dinner ideas', day: '2026-10-15', useWorkouts: true }) }));
    expect(mocks.generate.mock.calls[0][1].parts[0].text).toContain('Private run');
  });
  it('respects the saved off switch even when the client says yes', async () => {
    mocks.profile.use_workouts = false;
    await POST(new Request('http://localhost/api/ai/ask', { method: 'POST', body: JSON.stringify({ question: 'Dinner ideas', day: '2026-10-15', useWorkouts: true }) }));
    expect(mocks.generate.mock.calls[0][1].parts[0].text).not.toContain('Private run');
  });
});
