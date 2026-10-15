import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), profile: { id: 'member', disabled: false, onboarded_at: null as string | null, created_at: '2020-01-01T00:00:00Z' } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { exchangeCodeForSession: async () => ({ data: { user: { id: 'member' } }, error: null }), signOut: mocks.signOut },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile, error: null }) }) }) }),
}) }));
vi.mock('@/lib/data/queries', () => ({ getFeatureSettings: async () => ({ signups_open: false }) }));
import { GET } from './route';
beforeEach(() => { mocks.profile.onboarded_at = null; mocks.signOut.mockClear(); });
it('keeps an old rejected profile out while signups are closed', async () => {
  const response = await GET(new NextRequest('http://localhost/auth/callback?code=test'));
  expect(response.headers.get('location')).toBe('http://localhost/login?error=signups_closed');
  expect(mocks.signOut).toHaveBeenCalledOnce();
});
it('still admits existing onboarded members', async () => {
  mocks.profile.onboarded_at = '2020-01-02T00:00:00Z';
  const response = await GET(new NextRequest('http://localhost/auth/callback?code=test'));
  expect(response.headers.get('location')).toBe('http://localhost/app');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
