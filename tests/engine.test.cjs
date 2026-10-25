const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../src/data.js');
const {createTradingEngine} = require('../src/engine.js');
const {createCampaignPersistence} = require('../src/persistence.js');
function fixture() {
  const state = {
    dayIdx: 0, runStartDayIdx: 0, baseStartingCash: 10000, startingCash: 10000,
    cash: 10000, maxLeverage: 2, positions: {}, optionsPositions: [], pendingOrders: [],
    peakNetWorth: 10000, maxDrawdownPct: 0, realizedPnL: 0,
    selectedSymbol: 'SPX', tradeHistory: [], tradeMarkers: [], ownedLifestyle: {},
    unlockedAchievements: {}, triggeredDilemmas: {}, activeScenario: null,
    scenarioCompleted: false, prestigeLevel: 0, stopLossPct: 0, takeProfitPct: 0,
    totalInterestEarned: 0, totalDividendsEarned: 0, dripEnabled: false,
    autoPauseOnEvents: false, enableDilemmas: false, speedDaysPerSec: 5,
    bestTrade: {symbol:'—',pnl:0}, worstTrade: {symbol:'—',pnl:0},
    netWorthHistory: new Float64Array(data.TOTAL_DAYS).fill(NaN)
  };
  const values = new Map();
  const localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const engine = createTradingEngine({...data, state, getDisplaySymbol: symbol => symbol, formatMoney: String});
  const persistence = createCampaignPersistence({...data, state, localStorage, computePortfolioMetrics: engine.computePortfolioMetrics});
  return {state, values, engine, persistence};
}
test('short cover conserves equity without a price move while retaining debt', () => {
  const {state, engine} = fixture();
  engine.executeShortSell('SPX', 20000, true);
  engine.executeCoverShort('SPX', 1000, true);
  assert.equal(state.cash, -9000);
  assert.equal(engine.computePortfolioMetrics().netWorth, 10000);
  engine.executeSellAllForSymbol('SPX', 'test', true);
  assert.equal(state.cash, 10000);
});
test('day advancement stops at a scenario boundary without a DOM', () => {
  const {state, engine} = fixture();
  state.activeScenario = {endDayIdx:1, targetNw:10000, title:'test'};
  assert.equal(engine.processSingleTradingDayStep(), false);
  assert.equal(state.dayIdx, 1);
  assert.equal(state.scenarioCompleted, true);
  assert.equal(engine.processSingleTradingDayStep(), false);
  assert.equal(state.dayIdx, 1);
});
test('campaign storage preserves first-day positions and exact history', () => {
  const {state, engine, persistence} = fixture();
  engine.executeBuy('SPX', 1000, null, true);
  assert.equal(persistence.saveCampaignToStorage(), true);
  state.positions = {};
  state.cash = 0;
  assert.equal(persistence.loadCampaignFromStorage(), true);
  assert.equal(state.cash, 9000);
  assert.equal(state.positions.SPX.totalCost, 1000);
  assert.equal(state.netWorthHistory[0], 10000);
});
test('invalid nested saves are rejected before changing live state', () => {
  const {state, values, persistence} = fixture();
  persistence.saveCampaignToStorage();
  const save = JSON.parse(values.get(data.STORAGE_KEY_CAMPAIGN));
  save.positions = {SPX: {shares:'bad', totalCost:100, avgCost:10}};
  values.set(data.STORAGE_KEY_CAMPAIGN, JSON.stringify(save));
  const before = structuredClone(state);
  assert.equal(persistence.loadCampaignFromStorage(), false);
  assert.deepEqual(state, before);
});
test('derived overflow is rejected without mutating the campaign', () => {
  const {state, values, persistence} = fixture();
  persistence.saveCampaignToStorage();
  const save = JSON.parse(values.get(data.STORAGE_KEY_CAMPAIGN));
  save.optionsPositions = [{id:'bad',symbol:'SPX',optType:'CALL',strikePrice:1e-320,premium:100,openDayIdx:0,expiryDayIdx:30}];
  values.set(data.STORAGE_KEY_CAMPAIGN, JSON.stringify(save));
  const before = structuredClone(state);
  assert.equal(persistence.loadCampaignFromStorage(), false);
  assert.deepEqual(state, before);
});
test('storage failures are returned to the caller', () => {
  const {state, engine} = fixture();
  let warning = '';
  const storage = createCampaignPersistence({...data, state, computePortfolioMetrics:engine.computePortfolioMetrics,
    localStorage:{setItem(){throw new Error('quota');}}, showToast: text => {warning=text;}});
  assert.equal(storage.saveCampaignToStorage(), false);
  assert.match(warning, /Could not save/);
});
