import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const hashes = JSON.parse(read('tests/asset-hashes.json'));
for (const [file, expected] of Object.entries(hashes)) {
  const data = read(`public/${file}`);
  assert.equal(createHash('sha256').update(data).digest('hex'), expected, `${file}: original asset changed`);
  if (file.endsWith('.webp')) {
    assert.equal(data.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(data.toString('ascii', 8, 12), 'WEBP', file);
    assert.equal(data.readUInt32LE(4) + 8, data.length, `${file}: truncated WebP`);
  } else {
    assert.equal(data.readUInt16BE(0), 0xffd8, `${file}: invalid JPEG`);
  }
}
assert.equal(readdirSync(new URL('public/campaign/', root)).length, 4);
assert.equal(readdirSync(new URL('public/reference-flyers/', root)).length, 15);
const manifest = JSON.parse(read('docs/PRODUCT_ASSETS_MANIFEST.json'));
assert.equal(manifest.length, 15);
for (const item of manifest) {
  assert.ok(hashes[item.file.slice(1)], `Missing manifest asset: ${item.file}`);
  assert.equal(item.price_status, 'unverified');
}
console.log(`PASS: ${Object.keys(hashes).length} original assets unchanged; image containers and 15 reference entries valid. Browser tests additionally decode every image.`);
