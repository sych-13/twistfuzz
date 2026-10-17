export const flowerPalette = {
  Tulip: { Pink: '#f3a2bf', Red: '#c64765', White: '#fff5e8', Yellow: '#ffd75c', Purple: '#ab79dc' },
  Daisy: { White: '#fff8ef', Pink: '#f5a5bf', Yellow: '#ffe081', Purple: '#b489da' },
  Sunflower: { Yellow: '#f2ce38', Orange: '#ef9b24' },
  Gerbera: { Pink: '#f6aac1', Red: '#cb3855', Orange: '#e99332', Yellow: '#ebd44d', White: '#fff7ed', Purple: '#a78bd6' },
  Rose: { Red: '#c74b64', Pink: '#f6a2bd', White: '#fff4ea', Purple: '#9d72c7', Blue: '#467cc4' },
  Lily: { White: '#fff7ec', Pink: '#f4a0be', Yellow: '#f7db75', Orange: '#ee953e' },
} as const;

export type FlowerKind = keyof typeof flowerPalette;
export type FlowerSpec = { kind: FlowerKind; color: string; count: number };
export const flowerKinds = Object.keys(flowerPalette) as FlowerKind[];
export const wrappers = ['Kraft Brown', 'Pastel Pink', 'White', 'Lavender', 'Elegant Black'] as const;
export const ribbons = ['Standard Satin', 'Personalized Printed', 'No Ribbon'] as const;
export const MAX_STEMS = 30;
export type BouquetDesign = {
  flowers: FlowerSpec[];
  wrapper: typeof wrappers[number];
  ribbon: typeof ribbons[number];
  messageCard: boolean;
};

export function defaultDesign(): BouquetDesign {
  return {
    flowers: [
      { kind: 'Tulip', color: flowerPalette.Tulip.Pink, count: 3 },
      { kind: 'Daisy', color: flowerPalette.Daisy.White, count: 2 },
    ],
    wrapper: 'Pastel Pink', ribbon: 'Standard Satin', messageCard: false,
  };
}

export function colorName(kind: FlowerKind, color: string): string {
  return Object.entries(flowerPalette[kind]).find(([, hex]) => hex === color)?.[0] ?? color;
}

export function totalStems(flowers: FlowerSpec[]): number {
  return flowers.reduce((total, flower) => total + flower.count, 0);
}

// Validate untrusted storage against today's preview options. Prices, inventory and
// role information never enter this schema. Real orders must be revalidated server-side.
export function validateDesign(value: unknown): BouquetDesign {
  const invalid = () => new Error('This draft is invalid or uses unsupported options. Your current bouquet has not changed.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.flowers) || data.flowers.length > MAX_STEMS) throw invalid();
  if (!wrappers.includes(data.wrapper as BouquetDesign['wrapper']) ||
      !ribbons.includes(data.ribbon as BouquetDesign['ribbon']) || typeof data.messageCard !== 'boolean') throw invalid();
  const flowers: FlowerSpec[] = [];
  let total = 0;
  for (const item of data.flowers) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const { kind, color, count } = item as Record<string, unknown>;
    if (typeof kind !== 'string' || !Object.hasOwn(flowerPalette, kind)) throw invalid();
    if (typeof color !== 'string' || !(Object.values(flowerPalette[kind as FlowerKind]) as string[]).includes(color)) throw invalid();
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) throw invalid();
    total += count;
    if (total > MAX_STEMS) throw new Error('A saved bouquet cannot contain more than 30 stems. Your current bouquet has not changed.');
    const duplicate = flowers.find(f => f.kind === kind && f.color === color);
    if (duplicate) duplicate.count += count;
    else flowers.push({ kind: kind as FlowerKind, color, count });
  }
  return { flowers, wrapper: data.wrapper as BouquetDesign['wrapper'], ribbon: data.ribbon as BouquetDesign['ribbon'], messageCard: data.messageCard };
}

export function changeStem(design: BouquetDesign, kind: FlowerKind, color: string, delta: 1 | -1): BouquetDesign {
  if (delta === 1 && totalStems(design.flowers) >= MAX_STEMS) return design;
  const index = design.flowers.findIndex(f => f.kind === kind && f.color === color);
  if (index < 0) return delta === -1 ? design : { ...design, flowers: [...design.flowers, { kind, color, count: 1 }] };
  return { ...design, flowers: design.flowers.map((flower, i) => i === index ? { ...flower, count: flower.count + delta } : flower).filter(f => f.count > 0) };
}
