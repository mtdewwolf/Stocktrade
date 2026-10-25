const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const data = require(path.join(root, 'src', 'data.js'));
const { createTradingEngine } = require(path.join(root, 'src', 'engine.js'));

function fixture() {
  const state = {
    dayIdx: 0,
    runStartDayIdx: 0,
    baseStartingCash: 10000,
    startingCash: 10000,
    cash: 10000,
    maxLeverage: 2,
    positions: {},
    optionsPositions: [],
    pendingOrders: [],
    peakNetWorth: 10000,
    maxDrawdownPct: 0,
    realizedPnL: 0,
    selectedSymbol: 'SPX',
    tradeHistory: [],
    tradeMarkers: [],
    ownedLifestyle: {},
    unlockedAchievements: {},
    triggeredDilemmas: {},
    activeScenario: null,
    scenarioCompleted: false,
    prestigeLevel: 0,
    stopLossPct: 0,
    takeProfitPct: 0,
    totalInterestEarned: 0,
    totalDividendsEarned: 0,
    dripEnabled: false,
    autoPauseOnEvents: false,
    enableDilemmas: false,
    speedDaysPerSec: 5,
    bestTrade: { symbol: '—', pnl: 0 },
    worstTrade: { symbol: '—', pnl: 0 },
    netWorthHistory: new Float64Array(data.TOTAL_DAYS).fill(NaN),
  };
  const noop = () => {};
  const engine = createTradingEngine({
    ...data,
    state,
    getDisplaySymbol: (symbol) => symbol,
    formatMoney: String,
    showToast: noop,
    renderAll: noop,
    sfxBuy: noop,
    sfxSell: noop,
    sfxAlert: noop,
    triggerHaptic: noop,
    spawnFloatingPnL: noop,
    saveCampaignToStorage: () => true,
    pauseSimulation: noop,
  });
  return { state, engine };
}

function snapshot(label, state, engine) {
  const metrics = engine.computePortfolioMetrics();
  return {
    label,
    dayIdx: state.dayIdx,
    cash: state.cash,
    netWorth: metrics.netWorth,
    buyingPower: metrics.buyingPower,
    equityValue: metrics.equityValue,
    unrealizedPnL: metrics.unrealizedPnL,
    realizedPnL: state.realizedPnL,
    totalInterestEarned: state.totalInterestEarned,
    totalDividendsEarned: state.totalDividendsEarned,
    peakNetWorth: state.peakNetWorth,
    maxDrawdownPct: state.maxDrawdownPct,
    positionCount: Object.keys(state.positions).length,
    optionCount: state.optionsPositions.length,
    tradeCount: state.tradeHistory.length,
    spxShares: state.positions.SPX?.shares ?? 0,
    spxCost: state.positions.SPX?.totalCost ?? 0,
  };
}

function advance(engine, days) {
  for (let i = 0; i < days; i += 1) engine.processSingleTradingDayStep();
}

function main() {
  const { state, engine } = fixture();
  const snapshots = [];
  snapshots.push(snapshot('initial', state, engine));

  engine.executeBuy('SPX', 4000, null, true);
  advance(engine, 31);
  snapshots.push(snapshot('buy_spx_31', state, engine));

  engine.executeShortSell('SPX', 2500, true);
  advance(engine, 15);
  snapshots.push(snapshot('short_spx_46', state, engine));

  engine.executeCoverShort('SPX', 1e9, true);
  advance(engine, 17);
  snapshots.push(snapshot('cover_spx_63', state, engine));

  engine.buyOptionContract('SPX', 'CALL', 1000);
  advance(engine, 30);
  snapshots.push(snapshot('option_expiry_93', state, engine));

  const output = {
    generatedFrom: 'src/engine.js',
    scenario: [
      'buy SPX 4000 at day 0',
      'advance 31 days',
      'short SPX 2500',
      'advance 15 days',
      'cover SPX fully',
      'advance 17 days to quarterly dividend',
      'buy SPX 30D 5x call with 1000 premium',
      'advance 30 days to expiry',
    ],
    snapshots,
  };
  const outPath = path.join(__dirname, '..', 'shared', 'src', 'jvmTest', 'resources', 'golden', 'engine_parity.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  for (const s of snapshots) {
    console.log(s.label, s.dayIdx, s.cash.toFixed(6), s.netWorth.toFixed(6));
  }
}

main();
