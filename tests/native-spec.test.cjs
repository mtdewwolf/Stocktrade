const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSpec } = require('../native/tools/extract-spec.cjs');

test('native spec contains the full deterministic market and content set', () => {
  const { manifest, files } = buildSpec();
  const content = JSON.parse(files.get('content.json').toString('utf8'));
  const market = files.get('market.f32');
  const series = files.get('series.f64');

  assert.equal(manifest.counts.assets, 98);
  assert.equal(manifest.counts.days, 12110);
  assert.equal(content.assets.length, 98);
  assert.equal(content.calendar.dates.length, 12110);
  assert.equal(content.calendar.dates[0].iso, '1980-01-02');
  assert.equal(content.calendar.dates.at(-1).iso, '2026-10-23');
  assert.equal(market.length, 98 * 12110 * 4);
  assert.equal(series.length, 12110 * 16);
  assert.equal(series.readDoubleLE(0), 14);
  assert.equal(series.readDoubleLE((12110 - 1) * 16), 3.75);
});
