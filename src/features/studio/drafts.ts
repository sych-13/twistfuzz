import { validateDesign } from './design.ts';
import type { BouquetDesign } from './design.ts';

export const DRAFT_KEY = 'twistfuzz.preview-bouquet.v1';
export const MAX_DRAFT_LENGTH = 16_000;
export type SavedDraft = { version: 1; savedAt: string; design: BouquetDesign };
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const browserStorage: StorageAccess = () => window.localStorage;

export function parseDraft(raw: string): SavedDraft {
  if (raw.length > MAX_DRAFT_LENGTH) throw new Error('The saved draft is too large to reopen safely. Your current bouquet has not changed.');
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('The saved draft could not be read. Your current bouquet has not changed.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The saved draft format is invalid.');
  const data = value as Record<string, unknown>;
  if (data.version !== 1) throw new Error('This saved draft version is not supported. Your current bouquet has not changed.');
  if (typeof data.savedAt !== 'string' || !Number.isFinite(Date.parse(data.savedAt)) ||
      new Date(data.savedAt).toISOString() !== data.savedAt) throw new Error('The saved draft date is invalid.');
  return { version: 1, savedAt: data.savedAt, design: validateDesign(data.design) };
}

export function loadDraft(access: StorageAccess = browserStorage): Result<SavedDraft | null> {
  let raw: string | null;
  try { raw = access().getItem(DRAFT_KEY); }
  catch { return { ok: false, error: 'Browser storage is unavailable. You can keep designing, but local drafts cannot be reopened here.' }; }
  if (raw === null) return { ok: true, value: null };
  try { return { ok: true, value: parseDraft(raw) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'The saved draft is invalid.' }; }
}

export function saveDraft(design: BouquetDesign, access: StorageAccess = browserStorage): Result<SavedDraft> {
  let draft: SavedDraft;
  try { draft = { version: 1, savedAt: new Date().toISOString(), design: validateDesign(design) }; }
  catch { return { ok: false, error: 'This bouquet could not be saved. Please check its flowers and options.' }; }
  try { access().setItem(DRAFT_KEY, JSON.stringify(draft)); }
  catch { return { ok: false, error: 'Draft could not be saved. Browser storage may be full or blocked. Your current bouquet has not changed.' }; }
  return { ok: true, value: draft };
}

export function clearDraft(access: StorageAccess = browserStorage): Result<null> {
  try { access().removeItem(DRAFT_KEY); }
  catch { return { ok: false, error: 'The saved draft could not be removed. Browser storage is unavailable.' }; }
  return { ok: true, value: null };
}
