#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_PATH = path.join(ROOT, 'src', 'data.js');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const OUTPUT_DIR = path.join(ROOT, 'native', 'spec', 'build');

const EXPORT_NAMES = [
  'ASSETS_CONFIG',
  'ASSET_MAP',
  'TRADING_DATES',
  'TOTAL_DAYS',
  'HISTORICAL_EVENTS',
  'HISTORICAL_DILEMMAS',
  'SCENARIO_MISSIONS',
  'LIFESTYLE_UPGRADES',
  'ACHIEVEMENTS_LIST',
  'WALL_ST_LEGENDS',
  'MYSTERY_CODE_MAP',
  'FEATURE_TOUR_ITEMS',
  'PRO_HOT_TIPS',
  'WALKTHROUGH_STEPS',
  'FED_RATE_WAYPOINTS',
  'getEraNameForYear',
  'getFedRateAtDay',
  'getCpiDeflatorAtDay'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadGameData() {
  const source = fs.readFileSync(DATA_PATH, 'utf8');
  const exportLine = `\n;module.exports.__SPEC__ = { ${EXPORT_NAMES.join(', ')} };\n`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console
  };
  vm.runInNewContext(source + exportLine, sandbox, { filename: DATA_PATH });
  return sandbox.module.exports.__SPEC__;
}

function buildSpec() {
  const data = loadGameData();
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const {
    ASSETS_CONFIG,
    ASSET_MAP,
    TRADING_DATES,
    TOTAL_DAYS,
    HISTORICAL_EVENTS,
    HISTORICAL_DILEMMAS,
    SCENARIO_MISSIONS,
    LIFESTYLE_UPGRADES,
    ACHIEVEMENTS_LIST,
    WALL_ST_LEGENDS,
    MYSTERY_CODE_MAP,
    FEATURE_TOUR_ITEMS,
    PRO_HOT_TIPS,
    WALKTHROUGH_STEPS,
    getEraNameForYear,
    getFedRateAtDay,
    getCpiDeflatorAtDay
  } = data;

  if (TOTAL_DAYS !== TRADING_DATES.length) {
    throw new Error(`Trading calendar mismatch: ${TOTAL_DAYS} != ${TRADING_DATES.length}`);
  }

  const assetOrder = ASSETS_CONFIG.map(cfg => cfg.symbol);
  if (new Set(assetOrder).size !== assetOrder.length) {
    throw new Error('Duplicate asset symbols in ASSETS_CONFIG');
  }

  const assets = ASSETS_CONFIG.map((cfg, index) => {
    const asset = ASSET_MAP[cfg.symbol];
    if (!asset) throw new Error(`Missing generated asset ${cfg.symbol}`);
    if (!ArrayBuffer.isView(asset.prices) || asset.prices.constructor.name !== 'Float32Array'
      || asset.prices.length !== TOTAL_DAYS) {
      throw new Error(`Invalid price series for ${cfg.symbol}`);
    }
    return {
      symbol: cfg.symbol,
      name: cfg.name,
      sector: cfg.sector,
      divYield: cfg.divYield,
      ipoDate: cfg.ipoDate,
      delistDate: cfg.delistDate,
      volatility: cfg.volatility,
      bio: cfg.bio,
      ipoIdx: asset.ipoIdx,
      delistIdx: asset.delistIdx,
      priceOffset: index * TOTAL_DAYS,
      mystery: MYSTERY_CODE_MAP[cfg.symbol] || null
    };
  });

  const market = Buffer.alloc(assetOrder.length * TOTAL_DAYS * 4);
  let marketOffset = 0;
  for (const symbol of assetOrder) {
    const prices = ASSET_MAP[symbol].prices;
    for (let day = 0; day < TOTAL_DAYS; day++) {
      market.writeFloatLE(prices[day], marketOffset);
      marketOffset += 4;
    }
  }
  if (marketOffset !== market.length) throw new Error('Market buffer size mismatch');

  const series = Buffer.alloc(TOTAL_DAYS * 16);
  for (let day = 0; day < TOTAL_DAYS; day++) {
    series.writeDoubleLE(getFedRateAtDay(day), day * 16);
    series.writeDoubleLE(getCpiDeflatorAtDay(day), day * 16 + 8);
  }

  const calendar = TRADING_DATES.map(date => ({
    iso: date.iso,
    year: date.year,
    month: date.month,
    day: date.day,
    pretty: date.pretty,
    era: getEraNameForYear(date.year)
  }));

  const content = {
    schemaVersion: 1,
    contentVersion: pkg.version,
    calendar: {
      startIso: calendar[0].iso,
      endIso: calendar[calendar.length - 1].iso,
      totalDays: TOTAL_DAYS,
      dates: calendar
    },
    assets,
    events: HISTORICAL_EVENTS,
    dilemmas: HISTORICAL_DILEMMAS,
    scenarios: SCENARIO_MISSIONS,
    lifestyle: LIFESTYLE_UPGRADES,
    achievements: ACHIEVEMENTS_LIST,
    legends: WALL_ST_LEGENDS,
    tutorials: {
      features: FEATURE_TOUR_ITEMS,
      hotTips: PRO_HOT_TIPS,
      walkthrough: WALKTHROUGH_STEPS
    },
    rules: {
      sessionsPerYear: 252,
      dividendSessionInterval: 63,
      optionTermSessions: 30,
      optionLeverage: 5,
      marketEncoding: 'float32-le',
      marketLayout: 'asset-major',
      seriesEncoding: 'float64-le',
      seriesLayout: 'day-major',
      seriesFields: ['fedRatePct', 'cpiDeflator']
    }
  };

  const contentBuffer = Buffer.from(JSON.stringify(content, null, 2) + '\n');
  const sourceBuffer = fs.readFileSync(DATA_PATH);
  const manifest = {
    schemaVersion: 1,
    contentVersion: pkg.version,
    source: {
      file: 'src/data.js',
      sha256: sha256(sourceBuffer)
    },
    counts: {
      assets: assets.length,
      days: TOTAL_DAYS,
      events: HISTORICAL_EVENTS.length,
      dilemmas: HISTORICAL_DILEMMAS.length,
      scenarios: SCENARIO_MISSIONS.length,
      achievements: ACHIEVEMENTS_LIST.length,
      lifestyle: LIFESTYLE_UPGRADES.length
    },
    files: {
      content: {
        path: 'content.json',
        bytes: contentBuffer.length,
        sha256: sha256(contentBuffer)
      },
      market: {
        path: 'market.f32',
        bytes: market.length,
        sha256: sha256(market),
        assetCount: assets.length,
        dayCount: TOTAL_DAYS,
        encoding: 'float32-le',
        layout: 'asset-major'
      },
      series: {
        path: 'series.f64',
        bytes: series.length,
        sha256: sha256(series),
        dayCount: TOTAL_DAYS,
        encoding: 'float64-le',
        layout: 'day-major',
        fields: ['fedRatePct', 'cpiDeflator']
      }
    }
  };
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');

  return {
    manifest,
    files: new Map([
      ['content.json', contentBuffer],
      ['market.f32', market],
      ['series.f64', series],
      ['manifest.json', manifestBuffer]
    ])
  };
}

function checkSpec(built) {
  let failed = false;
  for (const [name, buffer] of built.files) {
    const filePath = path.join(OUTPUT_DIR, name);
    if (!fs.existsSync(filePath)) {
      console.error(`missing ${name}`);
      failed = true;
      continue;
    }
    const current = fs.readFileSync(filePath);
    if (!current.equals(buffer)) {
      console.error(`stale ${name} (${current.length} bytes on disk, ${buffer.length} expected)`);
      failed = true;
    }
  }
  if (failed) {
    console.error('Native spec is stale. Run npm run native:spec.');
    process.exitCode = 1;
    return;
  }
  console.log(`Native spec is current: ${built.manifest.counts.assets} assets, ${built.manifest.counts.days} days.`);
}

function writeSpec(built) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, buffer] of built.files) {
    const filePath = path.join(OUTPUT_DIR, name);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, filePath);
  }
  const { counts, files } = built.manifest;
  console.log(`Wrote native spec to ${path.relative(ROOT, OUTPUT_DIR)}`);
  console.log(`  ${counts.assets} assets x ${counts.days} days`);
  console.log(`  market.f32 ${files.market.bytes.toLocaleString()} bytes`);
  console.log(`  content.json ${files.content.bytes.toLocaleString()} bytes`);
  console.log(`  series.f64 ${files.series.bytes.toLocaleString()} bytes`);
}

function main() {
  const built = buildSpec();
  if (process.argv.includes('--check')) checkSpec(built);
  else writeSpec(built);
}

if (require.main === module) main();

module.exports = { buildSpec, OUTPUT_DIR };
