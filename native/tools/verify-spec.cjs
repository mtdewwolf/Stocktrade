#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_DIR = path.join(ROOT, 'native', 'spec', 'build');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function readJson(name) {
  const filePath = path.join(SPEC_DIR, name);
  if (!fs.existsSync(filePath)) fail(`Missing ${name}. Run npm run native:spec.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readCheckedFile(name, expected) {
  const filePath = path.join(SPEC_DIR, name);
  if (!fs.existsSync(filePath)) fail(`Missing ${name}. Run npm run native:spec.`);
  const buffer = fs.readFileSync(filePath);
  if (buffer.length !== expected.bytes) {
    fail(`${name}: expected ${expected.bytes} bytes, found ${buffer.length}`);
  }
  if (sha256(buffer) !== expected.sha256) fail(`${name}: checksum mismatch`);
  return buffer;
}

function main() {
  const manifest = readJson('manifest.json');
  const content = readJson('content.json');

  if (manifest.schemaVersion !== 1) fail('Unsupported manifest schema');
  if (content.schemaVersion !== 1) fail('Unsupported content schema');

  const source = fs.readFileSync(path.join(ROOT, 'src', 'data.js'));
  if (sha256(source) !== manifest.source.sha256) {
    fail('Spec was generated from a different version of src/data.js');
  }

  const market = readCheckedFile(manifest.files.market.path, manifest.files.market);
  const series = readCheckedFile(manifest.files.series.path, manifest.files.series);
  readCheckedFile(manifest.files.content.path, manifest.files.content);

  const { assets, calendar } = content;
  const { counts } = manifest;

  if (assets.length !== counts.assets) fail('Asset count does not match manifest');
  if (calendar.totalDays !== counts.days) fail('Day count does not match manifest');
  if (calendar.dates.length !== counts.days) fail('Calendar length does not match totalDays');
  if (market.length !== counts.assets * counts.days * 4) fail('Market buffer has the wrong length');
  if (series.length !== counts.days * 16) fail('Series buffer has the wrong length');
  if (new Set(assets.map(asset => asset.symbol)).size !== assets.length) fail('Duplicate asset symbols');

  if (calendar.dates[0].iso !== '1980-01-02') fail('Unexpected first trading date');
  if (calendar.dates[calendar.dates.length - 1].iso !== '2026-10-23') fail('Unexpected last trading date');
  for (let i = 0; i < calendar.dates.length; i++) {
    const date = calendar.dates[i];
    if (date.iso === undefined || date.pretty === undefined || date.era === undefined) {
      fail(`Calendar entry ${i} is incomplete`);
    }
    if (i > 0 && calendar.dates[i - 1].iso >= date.iso) fail('Calendar is not strictly increasing');
  }

  const bySymbol = new Map(assets.map(asset => [asset.symbol, asset]));
  const price = (symbol, day) => {
    const asset = bySymbol.get(symbol);
    if (!asset) fail(`Unknown asset ${symbol}`);
    if (day < 0 || day >= counts.days) fail(`Invalid day ${day} for ${symbol}`);
    const offset = asset.priceOffset * 4 + day * 4;
    return market.readFloatLE(offset);
  };
  const approx = (actual, expected) => Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * 1e-6);

  const spx = bySymbol.get('SPX');
  if (!spx || spx.ipoIdx !== 0 || spx.delistIdx !== null) fail('SPX metadata is invalid');
  if (!approx(price('SPX', 0), 105.76)) fail(`Unexpected SPX first price: ${price('SPX', 0)}`);
  if (!approx(price('SPX', counts.days - 1), 6420)) {
    fail(`Unexpected SPX final price: ${price('SPX', counts.days - 1)}`);
  }

  const aapl = bySymbol.get('AAPL');
  if (!aapl || aapl.ipoIdx <= 0) fail('AAPL IPO metadata is invalid');
  if (price('AAPL', aapl.ipoIdx - 1) !== 0) fail('AAPL should be locked before its IPO');
  if (!approx(price('AAPL', aapl.ipoIdx), 0.5)) {
    fail(`Unexpected AAPL IPO price: ${price('AAPL', aapl.ipoIdx)}`);
  }

  const btc = bySymbol.get('BTC');
  if (!btc || !approx(price('BTC', btc.ipoIdx), 0.3)) fail('BTC IPO price is invalid');

  const leh = bySymbol.get('LEH');
  if (!leh || leh.delistIdx === null) fail('LEH delisting metadata is invalid');
  if (price('LEH', leh.delistIdx) !== 0) fail('LEH should be zero on its delisting day');
  if (!(price('LEH', leh.delistIdx - 1) > 0)) fail('LEH should trade above zero before delisting');

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.priceOffset !== i * counts.days) fail(`${asset.symbol} has an invalid priceOffset`);
    if (asset.ipoIdx < 0 || asset.ipoIdx >= counts.days) fail(`${asset.symbol} has an invalid ipoIdx`);
    if (asset.delistIdx !== null && (asset.delistIdx < asset.ipoIdx || asset.delistIdx >= counts.days)) {
      fail(`${asset.symbol} has an invalid delistIdx`);
    }
    if (!asset.mystery || !asset.mystery.code) fail(`${asset.symbol} is missing mystery metadata`);
  }

  const fedFirst = series.readDoubleLE(0);
  const cpiFirst = series.readDoubleLE(8);
  const fedLast = series.readDoubleLE((counts.days - 1) * 16);
  const cpiLast = series.readDoubleLE((counts.days - 1) * 16 + 8);
  if (fedFirst !== 14) fail(`Unexpected first Fed rate: ${fedFirst}`);
  if (fedLast !== 3.75) fail(`Unexpected final Fed rate: ${fedLast}`);
  if (cpiFirst !== 1) fail(`Unexpected first CPI deflator: ${cpiFirst}`);
  if (!(cpiLast > cpiFirst)) fail('CPI deflator should increase over time');

  for (const [key, length] of Object.entries({
    events: content.events.length,
    dilemmas: content.dilemmas.length,
    scenarios: content.scenarios.length,
    achievements: content.achievements.length,
    lifestyle: content.lifestyle.length
  })) {
    if (length !== counts[key]) fail(`${key} count does not match manifest`);
  }

  console.log('Native spec verification passed.');
  console.log(`  ${counts.assets} assets, ${counts.days} trading days`);
  console.log(`  ${counts.events} events, ${counts.dilemmas} dilemmas, ${counts.scenarios} scenarios`);
  console.log(`  ${manifest.files.market.bytes.toLocaleString()} bytes of market data`);
}

try {
  main();
} catch (error) {
  console.error(`Native spec verification failed: ${error.message}`);
  process.exitCode = 1;
}
