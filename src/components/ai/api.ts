'use client';
// Browser helpers for AI Assist: calling /api/ai/* and shrinking photos before upload.
import type { AiApiResult } from '@/lib/ai/contracts';

export type CallResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** Statuses where trying again right away will not help (turned off, quota, not configured, signed out). */
export const FINAL_STATUSES = new Set([401, 403, 409, 429, 503]);

export async function callAi<T>(url: string, body: FormData | Record<string, unknown>, signal?: AbortSignal): Promise<CallResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { ok: false, status: 0, error: 'Couldn’t reach AI Assist. Check your connection and try again.' };
  }
  let json: AiApiResult<T> | null = null;
  try {
    json = (await res.json()) as AiApiResult<T>;
  } catch {
    /* non-JSON (e.g. a platform timeout page) */
  }
  if (json?.ok) return { ok: true, data: json.data };
  if (res.status === 504) return { ok: false, status: 504, error: json && !json.ok ? json.error : 'AI Assist took too long. Try again in a moment.' };
  return { ok: false, status: res.status, error: json && !json.ok ? json.error : 'Something went wrong with AI Assist. Try again.' };
}

/** Downscales to at most `max` px on the long edge and re-encodes as JPEG, honouring EXIF orientation. */
export async function downscaleImage(file: File, max = 1024, quality = 0.8): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  let width: number, height: number;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bmp; width = bmp.width; height = bmp.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      source = img; width = img.naturalWidth; height = img.naturalHeight;
    } catch {
      throw new Error('This photo couldn’t be opened. Try a JPG or PNG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t prepare the photo. Try another browser.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('This photo couldn’t be prepared. Try another one.');
  return blob;
}

/** 1.5 → "1.5", 0.25 → "0.25", 2 → "2". */
export { qty as fmtQ } from '@/lib/format';

/** Bigger steps above one serving, quarter steps below. */
export function stepQ(q: number, dir: 1 | -1): number {
  const step = dir > 0 ? (q >= 1 ? 0.5 : 0.25) : (q > 1 ? 0.5 : 0.25);
  return Math.min(20, Math.max(0.25, Math.round((q + dir * step) * 4) / 4));
}
