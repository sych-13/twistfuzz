import { validateDesign } from './design.ts';
import type { BouquetDesign } from './design.ts';

export const DESIGN_PAGE_SIZE = 25;
export type SavedDesign = { id: string; name: string; configuration: BouquetDesign; revision: number; created_at: string; updated_at: string };
export type DesignCommand =
  | { action: 'list'; offset: number }
  | { action: 'get'; id: string }
  | { action: 'create'; name: string; configuration: BouquetDesign }
  | { action: 'update'; id: string; revision: number; name: string; configuration: BouquetDesign }
  | { action: 'delete'; id: string; revision: number };
export type DesignResult = { designs: SavedDesign[]; hasMore: boolean } | { design: SavedDesign } | { deleted: true };
export class DesignServiceError extends Error {
  status: number;
  constructor(status: number) {
    super(status === 409 ? 'The design changed or is unavailable. Refresh the list and reopen it before updating or deleting.' :
      status === 401 || status === 403 ? 'Customer access could not be verified. Sign in again through the Customer portal.' :
      status === 400 ? 'Use a name of 1–80 characters and supported bouquet options, up to 30 stems.' :
      'Saved designs are temporarily unavailable. Your current bouquet has been kept.');
    this.status = status;
  }
}
const invalid = () => new Error('The saved design request is invalid.');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function keys(data: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(data).some(key => !allowed.includes(key))) throw invalid();
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) throw invalid();
  return value.toLowerCase();
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw invalid();
  return value;
}
export function designName(value: unknown): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw invalid();
  const name = value.trim();
  if (!name || [...name].length > 80) throw invalid();
  return name;
}
export function accountConfiguration(value: unknown): BouquetDesign {
  const data = object(value);
  keys(data, ['flowers', 'wrapper', 'ribbon', 'messageCard']);
  if (Array.isArray(data.flowers)) for (const flower of data.flowers) keys(object(flower), ['kind', 'color', 'count']);
  return validateDesign(data);
}
export function parseDesignCommand(value: unknown): DesignCommand {
  const data = object(value);
  switch (data.action) {
    case 'list': {
      keys(data, ['action', 'offset']); const offset = data.offset === undefined ? 0 : data.offset;
      if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw invalid();
      return { action: 'list', offset };
    }
    case 'get': keys(data, ['action', 'id']); return { action: 'get', id: id(data.id) };
    case 'create': keys(data, ['action', 'name', 'configuration']); return { action: 'create', name: designName(data.name), configuration: accountConfiguration(data.configuration) };
    case 'update': keys(data, ['action', 'id', 'revision', 'name', 'configuration']); return { action: 'update', id: id(data.id), revision: revision(data.revision), name: designName(data.name), configuration: accountConfiguration(data.configuration) };
    case 'delete': keys(data, ['action', 'id', 'revision']); return { action: 'delete', id: id(data.id), revision: revision(data.revision) };
    default: throw invalid();
  }
}
export function parseSavedDesign(value: unknown): SavedDesign {
  const data = object(value);
  const timestamp = (input: unknown): string => {
    if (typeof input !== 'string' || input.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(input) || !Number.isFinite(Date.parse(input))) throw invalid();
    return input;
  };
  return { id: id(data.id), name: designName(data.name), revision: revision(data.revision),
    configuration: accountConfiguration(data.configuration), created_at: timestamp(data.created_at), updated_at: timestamp(data.updated_at) };
}
export function parseDesignResult(value: unknown, command: DesignCommand): DesignResult {
  const data = object(value);
  if (command.action === 'list') {
    if (!Array.isArray(data.designs) || data.designs.length > DESIGN_PAGE_SIZE || typeof data.hasMore !== 'boolean') throw invalid();
    return { designs: data.designs.map(parseSavedDesign), hasMore: data.hasMore };
  }
  if (command.action === 'delete') { if (data.deleted !== true) throw invalid(); return { deleted: true }; }
  const design = parseSavedDesign(data.design);
  if (command.action !== 'create' && design.id !== command.id) throw invalid();
  return { design };
}
