import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { upstreamReason, jsonSchemaFor } = await import('./gemini');
const { weekOutput } = await import('./contracts');

describe('jsonSchemaFor(weekOutput)', () => {
  // Checked against the live API (Oct 2026): days.maxItems 7 over the per-meal maxItems 8 is rejected with a bare
  // 400 INVALID_ARGUMENT by both Flash and Flash-Lite; either limit alone is accepted.
  it('keeps no limit on the number of days, only on foods per meal', () => {
    const days = (jsonSchemaFor(weekOutput) as { properties: { days: { maxItems?: number; items: { properties: { Lunch: { maxItems?: number } } } } } }).properties.days;
    expect(days.maxItems).toBeUndefined();
    expect(days.items.properties.Lunch.maxItems).toBe(8);
  });
});

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
