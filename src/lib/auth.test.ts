import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn() }));
vi.mock('./supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
}) }));
import { actionUser } from './auth';
beforeEach(() => { mocks.getUser.mockResolvedValue({ data: { user: { id: 'member' } } }); mocks.profile.mockReset(); });
describe('active account authorization', () => {
  it('rejects an existing session after suspension', async () => {
    mocks.profile.mockResolvedValue({ data: { disabled: true }, error: null });
    expect(await actionUser()).toBeNull();
  });
  it('fails closed when the profile cannot be verified', async () => {
    mocks.profile.mockResolvedValue({ data: null, error: { message: 'offline' } });
    expect(await actionUser()).toBeNull();
  });
  it('permits an active member', async () => {
    mocks.profile.mockResolvedValue({ data: { disabled: false }, error: null });
    expect(await actionUser()).toMatchObject({ user: { id: 'member' } });
  });
});
