import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ disabled: true, signOut: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (values: unknown[]) => void } }) => ({
  auth: {
    getClaims: async () => ({ data: { claims: { sub: 'member' } } }),
    signOut: async () => { mocks.signOut(); opts.cookies.setAll([{ name: 'sb-session', value: '', options: { maxAge: 0 } }]); },
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { disabled: mocks.disabled }, error: null }) }) }) }),
}) }));
import { proxy } from './proxy';
beforeEach(() => {
  mocks.disabled = true; mocks.signOut.mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
});
afterEach(() => vi.unstubAllEnvs());
it('clears a suspended session on the redirect response', async () => {
  const response = await proxy(new NextRequest('http://localhost/app'));
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(response.headers.get('location')).toContain('/login');
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});
it('does not bounce a suspended login visit back to the app', async () => {
  const response = await proxy(new NextRequest('http://localhost/login?error=disabled'));
  expect(response.headers.get('location')).toBeNull();
});
it('still sends an active member from login to the app', async () => {
  mocks.disabled = false;
  const response = await proxy(new NextRequest('http://localhost/login'));
  expect(response.headers.get('location')).toBe('http://localhost/app');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
