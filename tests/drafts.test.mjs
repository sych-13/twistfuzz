import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeStem, defaultDesign, flowerKinds, flowerPalette, ribbons, totalStems, validateDesign, wrappers } from '../src/features/studio/design.ts';
import { clearDraft, DRAFT_KEY, loadDraft, MAX_DRAFT_LENGTH, parseDraft, saveDraft } from '../src/features/studio/drafts.ts';

const stamp = '2026-10-16T13:00:00.000Z';
const serialized = (design = defaultDesign(), extra = {}) => JSON.stringify({ version: 1, savedAt: stamp, design, ...extra });
function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[DRAFT_KEY, initial]]);
  return { values, access: () => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }) };
}

test('every confirmed flower/color, wrapper and ribbon survives a save/load round trip', () => {
  for (const kind of flowerKinds) for (const color of Object.values(flowerPalette[kind])) {
    for (const wrapper of wrappers) for (const ribbon of ribbons) {
      const storage = memoryStorage();
      const design = { flowers: [{ kind, color, count: 30 }], wrapper, ribbon, messageCard: true };
      const saved = saveDraft(design, storage.access);
      assert.equal(saved.ok, true);
      const loaded = loadDraft(storage.access);
      assert.equal(loaded.ok, true);
      assert.deepEqual(loaded.value.design, design);
    }
  }
});

test('empty bouquets are valid preview drafts', () => {
  assert.deepEqual(parseDraft(serialized({ ...defaultDesign(), flowers: [] })).design.flowers, []);
});

test('duplicate flower/color rows normalize without mutating the input', () => {
  const design = defaultDesign();
  design.flowers.push({ ...design.flowers[0], count: 1 });
  const clean = validateDesign(design);
  assert.equal(clean.flowers[0].count, 4);
  assert.equal(design.flowers[0].count, 3);
});

test('30-stem cap applies to all rows combined, including duplicates', () => {
  assert.throws(() => parseDraft(serialized({ ...defaultDesign(), flowers: [
    { kind: 'Tulip', color: flowerPalette.Tulip.Pink, count: 20 },
    { kind: 'Tulip', color: flowerPalette.Tulip.Pink, count: 11 },
  ] })), /more than 30/);
});

test('rejects malformed JSON, nulls, arrays, wrong versions, invalid timestamps and oversized payloads', () => {
  for (const raw of ['', '{', 'null', '[]', 'true', '3', serialized(undefined, { version: 2 }),
    serialized(undefined, { savedAt: 'yesterday' }), serialized(undefined, { savedAt: null }),
    serialized(undefined, { savedAt: '2026-02-30T00:00:00.000Z' }), ' '.repeat(MAX_DRAFT_LENGTH + 1)]) {
    assert.throws(() => parseDraft(raw));
  }
});

test('rejects non-integer, non-numeric, zero, negative, unsafe and excessive stem quantities', () => {
  for (const count of [0, -1, 1.1, '3', null, undefined, Infinity, Number.MAX_SAFE_INTEGER, 31]) {
    assert.throws(() => validateDesign({ ...defaultDesign(), flowers: [{ kind: 'Tulip', color: flowerPalette.Tulip.Pink, count }] }));
  }
});

test('rejects invalid shape, unsupported flowers, per-flower colors and prototype property names', () => {
  for (const flowers of [null, {}, [null], [[]], [{ kind: 'Orchid', color: '#fff', count: 1 }],
    [{ kind: '__proto__', color: '#fff', count: 1 }], [{ kind: 'constructor', color: '#fff', count: 1 }],
    [{ kind: 'Tulip', color: flowerPalette.Rose.Blue, count: 1 }],
    Array.from({ length: 31 }, () => ({ kind: 'Tulip', color: flowerPalette.Tulip.Pink, count: 1 }))]) {
    assert.throws(() => validateDesign({ ...defaultDesign(), flowers }));
  }
  for (const value of [null, [], 3, {}, { ...defaultDesign(), wrapper: 'Unapproved' },
    { ...defaultDesign(), ribbon: 'Fairy Lights' }, { ...defaultDesign(), messageCard: 'yes' }]) {
    assert.throws(() => validateDesign(value));
  }
});

test('untrusted metadata including prices and roles is stripped from restored drafts', () => {
  const draft = parseDraft(serialized({ ...defaultDesign(), price: 1, role: 'admin' }, { owner: 'other', role: 'admin' }));
  assert.deepEqual(Object.keys(draft), ['version', 'savedAt', 'design']);
  assert.deepEqual(draft.design, defaultDesign());
});

test('storage access, read, write and removal failures return actionable errors without throwing', () => {
  const denied = () => { throw new Error('SecurityError'); };
  const broken = () => ({ getItem: denied, setItem: denied, removeItem: denied });
  for (const access of [denied, broken]) {
    assert.equal(loadDraft(access).ok, false);
    assert.equal(saveDraft(defaultDesign(), access).ok, false);
    assert.equal(clearDraft(access).ok, false);
  }
});

test('corrupt drafts remain stored for explicit removal; invalid saves do not replace them', () => {
  const storage = memoryStorage('broken');
  assert.equal(loadDraft(storage.access).ok, false);
  assert.equal(storage.values.get(DRAFT_KEY), 'broken');
  assert.equal(saveDraft({ ...defaultDesign(), wrapper: 'Unknown' }, storage.access).ok, false);
  assert.equal(storage.values.get(DRAFT_KEY), 'broken');
  assert.equal(clearDraft(storage.access).ok, true);
  assert.deepEqual(loadDraft(storage.access), { ok: true, value: null });
});

test('a failed quota write preserves the previous draft', () => {
  const storage = memoryStorage(serialized());
  const access = () => ({ ...storage.access(), setItem() { throw new Error('QuotaExceededError'); } });
  assert.equal(saveDraft({ ...defaultDesign(), messageCard: true }, access).ok, false);
  assert.equal(loadDraft(storage.access).value.design.messageCard, false);
});

test('rapid sequential stem changes enforce the cap and never create negative counts', () => {
  let design = defaultDesign();
  for (let i = 0; i < 100; i++) design = changeStem(design, 'Tulip', flowerPalette.Tulip.Pink, 1);
  assert.equal(totalStems(design.flowers), 30);
  for (let i = 0; i < 100; i++) design = changeStem(design, 'Tulip', flowerPalette.Tulip.Pink, -1);
  assert.equal(totalStems(design.flowers), 2);
  for (let i = 0; i < 100; i++) design = changeStem(design, 'Daisy', flowerPalette.Daisy.White, -1);
  assert.equal(totalStems(design.flowers), 0);
});
