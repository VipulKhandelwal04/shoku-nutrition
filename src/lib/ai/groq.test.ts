import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));
// Gemini is always overloaded in these tests, so the Groq backup has to answer.
vi.mock('@google/genai', () => {
  class ApiError extends Error { constructor(public status: number, message = 'UNAVAILABLE high demand') { super(message); } }
  class GoogleGenAI {
    models = { generateContent: async () => { throw new ApiError(503); } };
  }
  return { ApiError, GoogleGenAI, ThinkingLevel: { LOW: 'LOW' } };
});

const { groqReason, groqRequest } = await import('./groq');
const { generateJson, textOnly, AiUpstream } = await import('./gemini');

const schema = z.object({ line: z.string() });
const groqAnswer = (content: string) => vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('groqRequest', () => {
  it('asks for a JSON object and carries the schema in the instructions', () => {
    const body = groqRequest({ system: 'Be brief.', text: 'Hi', jsonSchema: { type: 'object' }, temperature: 0.3, model: 'm' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.model).toBe('m');
    expect(body.messages[0].content).toContain('Be brief.');
    expect(body.messages[0].content).toContain('{"type":"object"}');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });
  it('masks anything shaped like a Groq key in error reasons', () => {
    expect(groqReason('{"error":{"message":"Invalid API Key gsk_abcdefghij1234567890"}}')).toBe('Invalid API Key [key]');
  });
});

describe('textOnly', () => {
  it('joins text parts and refuses requests that carry a photo', () => {
    expect(textOnly([{ text: 'a' }, { text: 'b' }])).toBe('a\n\nb');
    expect(textOnly([{ text: 'a' }, { inlineData: { mimeType: 'image/jpeg', data: 'x' } }])).toBeNull();
  });
});

describe('generateJson with the Groq backup', () => {
  it('answers from Groq when every Gemini model is overloaded', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test');
    vi.stubEnv('GROQ_API_KEY', 'test');
    const fetchMock = groqAnswer('{"line":"Dal and rice fit your day."}');
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateJson(schema, { system: 's', parts: [{ text: 'q' }] })).resolves.toEqual({ line: 'Dal and rice fit your day.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not call Groq without a key, or for a photo', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test');
    const fetchMock = groqAnswer('{"line":"x"}');
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateJson(schema, { system: 's', parts: [{ text: 'q' }] })).rejects.toBeInstanceOf(AiUpstream);
    vi.stubEnv('GROQ_API_KEY', 'test');
    await expect(generateJson(schema, { system: 's', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'x' } }] })).rejects.toBeInstanceOf(AiUpstream);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps the Gemini error when Groq answers with something unusable', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test');
    vi.stubEnv('GROQ_API_KEY', 'test');
    vi.stubGlobal('fetch', groqAnswer('not json'));
    await expect(generateJson(schema, { system: 's', parts: [{ text: 'q' }] })).rejects.toBeInstanceOf(AiUpstream);
  });
});
