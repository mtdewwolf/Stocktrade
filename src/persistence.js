function createCampaignPersistence(dependencies) {
  const { state, ASSET_MAP, TOTAL_DAYS, STORAGE_KEY_CAMPAIGN, LIFESTYLE_UPGRADES, ACHIEVEMENTS_LIST, HISTORICAL_DILEMMAS, HISTORICAL_EVENTS, localStorage } = dependencies;
  const { computePortfolioMetrics = () => {}, showToast = () => {} } = dependencies;
  let campaignSaveFailed = false;
  let campaignSaveQueued = false;

  function scheduleCampaignSave() {
    if (campaignSaveQueued) return;
    campaignSaveQueued = true;
    queueMicrotask(() => {
      campaignSaveQueued = false;
      saveCampaignToStorage();
    });
  }

  function saveCampaignToStorage() {
    try {
      state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth;
      const payload = {
        version: 4,
        baseStartingCash: state.baseStartingCash,
        runStartDayIdx: state.runStartDayIdx,
        scenarioCompleted: state.scenarioCompleted,
        netWorthHistory: Array.from(state.netWorthHistory.slice(0, state.dayIdx + 1), v => Number.isFinite(v) ? v : null),
        stopLossPct: state.stopLossPct,
        takeProfitPct: state.takeProfitPct,
        autoPauseOnEvents: state.autoPauseOnEvents,
        enableDilemmas: state.enableDilemmas,
        speedDaysPerSec: state.speedDaysPerSec,
        triggeredDilemmas: state.triggeredDilemmas,
        dayIdx: state.dayIdx,
        maxLeverage: state.maxLeverage,
        startingCash: state.startingCash,
        cash: state.cash,
        dripEnabled: state.dripEnabled,
        mysteryMode: state.mysteryMode,
        totalInterestEarned: state.totalInterestEarned,
        totalDividendsEarned: state.totalDividendsEarned,
        realizedPnL: state.realizedPnL,
        selectedSymbol: state.selectedSymbol,
        positions: state.positions,
        optionsPositions: state.optionsPositions,
        pendingOrders: state.pendingOrders,
        ownedLifestyle: state.ownedLifestyle,
        unlockedAchievements: state.unlockedAchievements,
        activeScenario: state.activeScenario,
        bestTrade: state.bestTrade,
        worstTrade: state.worstTrade,
        peakNetWorth: state.peakNetWorth,
        maxDrawdownPct: state.maxDrawdownPct,
        tradeMarkers: state.tradeMarkers.slice(-80),
        tradeHistory: state.tradeHistory.slice(0, 40)
      };
      localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(payload));
      campaignSaveFailed = false;
      return true;
    } catch (e) {
      if (!campaignSaveFailed) showToast('Could not save campaign. Browser storage may be full or unavailable.', 'rose');
      campaignSaveFailed = true;
      return false;
    }
  }

  // Validate the entire save before changing live state. Older v3 saves remain
  // supported; their missing history is shown as a gap, never reconstructed.
  function validateCampaign(data) {
    const fail = () => { throw new Error('Invalid campaign save'); };
    const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const num = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e100;
    const day = v => Number.isInteger(v) && v >= 0 && v < TOTAL_DAYS;
    const text = (v, max = 2000) => typeof v === 'string' && v.length <= max;
    const symbol = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ASSET_MAP, v);
    const array = (v, check, max = 10000) => Array.isArray(v) && v.length <= max && v.every(check);
    if (!obj(data) || (data.version !== undefined && data.version !== 4) || !day(data.dayIdx) || !num(data.cash)
      || !num(data.startingCash) || data.startingCash <= 0
      || ![1, 1.5, 2, 2.5].includes(data.maxLeverage) || !symbol(data.selectedSymbol)) fail();
    const candidate = {
      dayIdx: data.dayIdx, cash: data.cash, startingCash: data.startingCash,
      maxLeverage: data.maxLeverage, selectedSymbol: data.selectedSymbol
    };
    for (const key of ['totalInterestEarned', 'totalDividendsEarned', 'realizedPnL', 'peakNetWorth', 'maxDrawdownPct']) {
      const value = data[key] ?? (key === 'peakNetWorth' ? data.startingCash : 0);
      if (!num(value) || (['peakNetWorth', 'maxDrawdownPct'].includes(key) && value < 0)) fail();
      candidate[key] = value;
    }
    for (const [key, fallback] of Object.entries({dripEnabled: false, mysteryMode: false, autoPauseOnEvents: true, enableDilemmas: true})) {
      if (data[key] !== undefined && typeof data[key] !== 'boolean') fail();
      candidate[key] = data[key] ?? fallback;
    }
    for (const [key, allowed] of Object.entries({stopLossPct: [0, .15, .25, .35], takeProfitPct: [0, .5, 1, 2, 4]})) {
      candidate[key] = data[key] ?? 0;
      if (!allowed.includes(candidate[key])) fail();
    }
    candidate.speedDaysPerSec = data.speedDaysPerSec ?? 5;
    if (!num(candidate.speedDaysPerSec) || candidate.speedDaysPerSec < 1 || candidate.speedDaysPerSec > 252) fail();
    if (!obj(data.positions)) fail();
    candidate.positions = {};
    for (const [sym, pos] of Object.entries(data.positions)) {
      if (!symbol(sym) || !obj(pos) || !num(pos.shares) || !num(pos.avgCost) || pos.avgCost <= 0
        || !num(pos.totalCost) || pos.totalCost < 0 || data.dayIdx < ASSET_MAP[sym].ipoIdx
        || (ASSET_MAP[sym].delistIdx !== null && data.dayIdx >= ASSET_MAP[sym].delistIdx)) fail();
      candidate.positions[sym] = {shares: pos.shares, avgCost: pos.avgCost, totalCost: pos.totalCost};
    }
    const optionValid = o => obj(o) && text(o.id, 100) && symbol(o.symbol) && ['CALL', 'PUT'].includes(o.optType)
      && num(o.strikePrice) && o.strikePrice > 0 && num(o.premium) && o.premium > 0
      && day(o.openDayIdx) && o.openDayIdx <= data.dayIdx && day(o.expiryDayIdx) && o.expiryDayIdx >= data.dayIdx;
    const orderValid = o => obj(o) && text(o.id, 100) && symbol(o.symbol) && ['PRE_IPO', 'LIMIT_BUY'].includes(o.type)
      && num(o.dollarAmount) && o.dollarAmount > 0 && (o.type === 'PRE_IPO' ? o.limitPrice === null : num(o.limitPrice) && o.limitPrice > 0);
    for (const [key, check] of [['optionsPositions', optionValid], ['pendingOrders', orderValid]]) {
      candidate[key] = data[key] ?? [];
      if (!array(candidate[key], check)) fail();
    }
    for (const [key, ids] of [
      ['ownedLifestyle', LIFESTYLE_UPGRADES.map(x => x.id)],
      ['unlockedAchievements', ACHIEVEMENTS_LIST.map(x => x.id)],
      ['triggeredDilemmas', HISTORICAL_DILEMMAS.map(x => x.id)]
    ]) {
      candidate[key] = data[key] ?? {};
      if (!obj(candidate[key]) || Object.entries(candidate[key]).some(([id, value]) => !ids.includes(id) || typeof value !== 'boolean')) fail();
    }
    candidate.activeScenario = data.activeScenario ?? null;
    if (candidate.activeScenario !== null) {
      const sc = candidate.activeScenario;
      if (!obj(sc) || !text(sc.id, 100) || !text(sc.title, 200) || !day(sc.startDayIdx) || !day(sc.endDayIdx)
        || sc.startDayIdx >= sc.endDayIdx || data.dayIdx < sc.startDayIdx
        || !num(sc.startCash) || sc.startCash <= 0 || !num(sc.targetNw) || sc.targetNw <= 0) fail();
    }
    candidate.runStartDayIdx = data.runStartDayIdx ?? candidate.activeScenario?.startDayIdx ?? 0;
    if (!day(candidate.runStartDayIdx) || candidate.runStartDayIdx > data.dayIdx
      || (candidate.activeScenario && candidate.runStartDayIdx !== candidate.activeScenario.startDayIdx)) fail();
    candidate.baseStartingCash = data.baseStartingCash ?? data.startingCash / (1 + state.prestigeLevel * .25);
    if (!num(candidate.baseStartingCash) || candidate.baseStartingCash <= 0) fail();
    if (data.scenarioCompleted !== undefined && typeof data.scenarioCompleted !== 'boolean') fail();
    candidate.scenarioCompleted = !!candidate.activeScenario && (data.scenarioCompleted === true || data.dayIdx >= candidate.activeScenario.endDayIdx);
    for (const key of ['bestTrade', 'worstTrade']) {
      candidate[key] = data[key] ?? {symbol: '—', pnl: 0};
      if (!obj(candidate[key]) || !(candidate[key].symbol === '—' || symbol(candidate[key].symbol)) || !num(candidate[key].pnl)) fail();
    }
    candidate.tradeMarkers = data.tradeMarkers ?? [];
    if (!array(candidate.tradeMarkers, m => obj(m) && day(m.dayIdx) && m.dayIdx <= data.dayIdx && symbol(m.symbol)
      && text(m.type, 100) && num(m.price) && m.price >= 0, 250)) fail();
    candidate.tradeHistory = data.tradeHistory ?? [];
    if (!array(candidate.tradeHistory, t => obj(t) && day(t.dayIdx) && t.dayIdx <= data.dayIdx && symbol(t.symbol)
      && text(t.type, 100) && text(t.dateStr, 100) && text(t.note) && num(t.shares) && num(t.price) && num(t.amount))) fail();
    candidate.netWorthHistory = new Float64Array(TOTAL_DAYS).fill(NaN);
    if (data.netWorthHistory !== undefined) {
      if (!array(data.netWorthHistory, v => v === null || num(v) && v >= 0, TOTAL_DAYS)
        || data.netWorthHistory.length !== data.dayIdx + 1) fail();
      data.netWorthHistory.forEach((v, i) => { if (v !== null) candidate.netWorthHistory[i] = v; });
    } else {
      candidate.netWorthHistory[candidate.runStartDayIdx] = candidate.startingCash;
    }
    candidate.triggeredEvents = HISTORICAL_EVENTS.filter(ev => ev.dayIdx <= data.dayIdx).reverse();
    if (!candidate.triggeredEvents.length) candidate.triggeredEvents = [HISTORICAL_EVENTS[0]];
    const metrics = computePortfolioMetrics(candidate.dayIdx, candidate);
    if (![metrics.netWorth, metrics.equityValue, metrics.unrealizedPnL, metrics.buyingPower,
      candidate.peakNetWorth, candidate.maxDrawdownPct].every(num)) fail();
    candidate.netWorthHistory[candidate.dayIdx] = metrics.netWorth;
    return candidate;
  }

  function loadCampaignFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGN);
      if (!raw) return false;
      const candidate = validateCampaign(JSON.parse(raw));
      Object.assign(state, candidate);
      return true;
    } catch (e) { return false; }
  }


  return { scheduleCampaignSave, saveCampaignToStorage, validateCampaign, loadCampaignFromStorage };
}
if (typeof module !== "undefined" && module.exports) module.exports = { createCampaignPersistence };
