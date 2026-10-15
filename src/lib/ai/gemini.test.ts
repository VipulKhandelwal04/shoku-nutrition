import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { upstreamReason } = await import('./gemini');

describe('upstreamReason', () => {
  it('pulls Gemini’s status and message out of the error JSON', () => {
    const err = new Error('got status: 400 Bad Request. {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}');
    expect(upstreamReason(err)).toBe('INVALID_ARGUMENT API key not valid. Please pass a valid API key.');
  });
  it('keeps a plain message and masks anything shaped like a key', () => {
    expect(upstreamReason(new Error('bad key AIzaSyA1234567890abcdefghijklmnop used'))).toBe('bad key [key] used');
  });
  it('caps the length', () => {
    expect(upstreamReason(new Error('x'.repeat(500))).length).toBe(240);
  });
});
