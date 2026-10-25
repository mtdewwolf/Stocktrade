let activeTipCategory = 'all';
let currentBannerTipIdx = 0;

function updateContextualHotTipBanner() {
  const yr = TRADING_DATES[state.dayIdx]?.year || 1980;
  const matching = PRO_HOT_TIPS.filter(t => yr >= t.eraRange[0] && yr <= t.eraRange[1]);
  const pool = matching.length > 0 ? matching : PRO_HOT_TIPS;
  const tip = pool[currentBannerTipIdx % pool.length];
  const bannerEl = document.getElementById('hotTipBannerText');
  if (bannerEl && tip) {
    bannerEl.textContent = `${tip.title}: ${tip.body}`;
  }
}

function spotlightFeatureTarget(screenName, targetId, options = {}) {
  closeModal(document.getElementById('tutorialModal'));
  if (options.selectSym && ASSET_MAP[options.selectSym]) {
    state.selectedSymbol = options.selectSym;
  }
  if (screenName) {
    switchScreen(screenName);
  }
  if (options.openDetails) {
    document.querySelectorAll('#screenTrade details').forEach(d => { d.open = true; });
  }
  renderAll();
  setTimeout(() => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tutorial-spotlight-ring');
      showToast(`🎯 Spotlight: ${options.label || targetId}`, 'emerald');
      setTimeout(() => el.classList.remove('tutorial-spotlight-ring'), 3200);
    }
  }, 120);
}

function renderTutorialAndHotTipsModal() {
  const featContainer = document.getElementById('tutPanelFeatures');
  if (featContainer) {
    setMarkup(featContainer, `
      <details id="simulationModelNotes" class="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
        <summary class="font-bold text-amber-300 cursor-pointer">How this simulation works</summary>
        <p class="mt-2 text-slate-300">Daily prices are synthetic, generated deterministically between hand-authored waypoints. The repository records no original data provider or citations for those values; they are unverified game inputs.</p>
        <p class="mt-2 text-slate-300">All assets, including crypto, share an approximate weekday calendar: Jan 1, Jul 4, Dec 25 and Sep 11–14, 2001 are excluded. Other holidays and observed dates are omitted. Interest and years use 252 sessions; dividends use 63; options expire after 30 sessions, capped at campaign end, or earlier on bankruptcy.</p>
        <p class="mt-2 text-slate-300">Calls and Puts are arcade contracts: payout = max(0, premium × (1 + 5 × signed return)). Puts negate the underlying return. These are not real option prices; there is no time decay, implied volatility, or exercise.</p>
      </details>` + FEATURE_TOUR_ITEMS.map(f => `
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-base">${f.icon}</span>
            <span class="font-extrabold text-white text-xs truncate">${f.title}</span>
          </div>
          <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold shrink-0">${f.badge}</span>
        </div>
        <div class="p-2 rounded-lg bg-[#070b14] border border-slate-800/90 font-mono-num text-[10px] text-cyan-300 text-center overflow-x-auto">
          ${f.visualWireframe}
        </div>
        <p class="text-[11px] text-slate-300 leading-snug">${f.summary}</p>
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/70">
          <span class="text-[10px] text-amber-300">💡 <strong>Hot Tip:</strong> ${f.hotTip}</span>
          <button type="button" data-spotlight="${f.id}" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] shrink-0">
            🎯 Spotlight
          </button>
        </div>
      </div>
    `).join(''));
  }

  const tipsContainer = document.getElementById('hotTipsListContainer');
  if (tipsContainer) {
    const filtered = activeTipCategory === 'all'
      ? PRO_HOT_TIPS
      : PRO_HOT_TIPS.filter(t => t.cat === activeTipCategory);
    setMarkup(tipsContainer, filtered.map(t => `
      <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
        <div class="flex items-center justify-between gap-2">
          <span class="font-extrabold text-amber-300 text-xs">🔥 ${t.title}</span>
          <span class="font-mono-num text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">${t.eraRange[0]}–${t.eraRange[1]}</span>
        </div>
        <p class="text-[11px] text-slate-300 mt-1 leading-snug">${t.body}</p>
      </div>
    `).join(''));
  }

  const walkContainer = document.getElementById('walkthroughStepsContainer');
  if (walkContainer) {
    setMarkup(walkContainer, WALKTHROUGH_STEPS.map(w => `
      <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2.5">
        <div class="min-w-0">
          <div class="text-xs font-extrabold text-white">${w.title}</div>
          <div class="text-[11px] text-slate-400 mt-0.5 leading-snug">${w.desc}</div>
        </div>
        <button type="button" data-walkstep="${w.step}" class="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-extrabold text-[10px] shrink-0">
          ▶ Show Me
        </button>
      </div>
    `).join(''));
  }
}

function loadPrestigeLevel() {
  try {
    return Math.max(0, parseInt(localStorage.getItem(STORAGE_KEY_PRESTIGE) || '0', 10) || 0);
  } catch (e) { return 0; }
}

function savePrestigeLevel(lvl) {
  try { localStorage.setItem(STORAGE_KEY_PRESTIGE, String(lvl)); } catch (e) {}
}

function loadCustomLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEADERBOARD);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [
    {
      id: 'custom-starter-1',
      name: 'Silicon Valley Insider',
      avatar: '💎',
      strategy: 'Early AAPL, MSFT & NVDA Accumulator',
      netWorth: 1850000,
      returnPct: 18400,
      dateStr: 'Career Target',
      isCustom: true
    }
  ];
}

function saveCustomLeaderboard(entries) {
  try {
    localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(entries));
  } catch (e) {}
}

// =========================================================================
// 5. SOUND SYNTHESIZER (WEB AUDIO API)
// =========================================================================
let audioCtx = null;
let soundEnabled = true;

function playTone(freq, durationMs, type = 'sine', gainVal = 0.04) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch (e) {}
}

function sfxBuy() {
  playTone(587.33, 75, 'triangle', 0.06);
  setTimeout(() => playTone(880, 130, 'triangle', 0.06), 65);
}
function sfxSell() {
  playTone(659.25, 75, 'triangle', 0.06);
  setTimeout(() => playTone(523.25, 130, 'triangle', 0.06), 65);
}
function sfxAlert() {
  playTone(330, 150, 'sawtooth', 0.05);
  setTimeout(() => playTone(261.63, 220, 'sawtooth', 0.05), 130);
}

function triggerHaptic(ms = 14) {
  try {
    if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch (e) {}
}

function spawnFloatingPnL(deltaDollars, labelPrefix = '') {
  const container = document.getElementById('floatingPnlContainer');
  if (!container || !isFinite(deltaDollars) || Math.abs(deltaDollars) < 0.01) return;
  const el = document.createElement('div');
  const isPos = deltaDollars >= 0;
  el.className = `animate-float-pnl font-mono-num text-xs font-extrabold px-2.5 py-1 rounded-full shadow-lg border ${
    isPos ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' : 'bg-rose-500/25 text-rose-300 border-rose-500/50'
  }`;
  el.textContent = `${labelPrefix ? labelPrefix + ' ' : ''}${isPos ? '+$' : '-$'}${formatMoney(Math.abs(deltaDollars))}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1450);
}

// =========================================================================
// 6. GAME STATE & PORTFOLIO ENGINE (SUPPORTS LONG, SHORT, MARGIN & QUEUES)
// =========================================================================
const state = {
  dayIdx: 0,
  isPlaying: false,
  speedDaysPerSec: 5,
  autoPauseOnEvents: true,
  dripEnabled: false,
  showSma200: true,
  maxLeverage: 1, // 1 | 1.5 | 2
  baseStartingCash: 10000,
  runStartDayIdx: 0,
  scenarioCompleted: false,
  startingCash: 10000,
  cash: 10000, // Can go negative when using 1.5x or 2x Margin Leverage!
  totalInterestEarned: 0,
  totalDividendsEarned: 0,
  realizedPnL: 0,
  selectedSymbol: 'SPX',
  activeScreen: 'trade',
  marketFilter: 'all',
  sectorFilter: 'ALL',
  marketSearchQuery: '',
  chartMode: 'stock',
  chartTimeframeDays: 252,
  activeBottomTab: 'news',
  leaderboardFilter: 'all',
  stopLossPct: 0,
  takeProfitPct: 0,
  // positions[sym] = { shares (positive=Long, negative=Short), avgCost, totalCost }
  positions: {},
  // optionsPositions = array of { id, symbol, optType: 'CALL'|'PUT', strikePrice, premium, openDayIdx, expiryDayIdx }
  optionsPositions: [],
  // pendingOrders = array of { id, type: 'PRE_IPO'|'LIMIT_BUY', symbol, dollarAmount, limitPrice }
  pendingOrders: [],
  ownedLifestyle: {},
  mysteryMode: false,
  enableDilemmas: true,
  triggeredDilemmas: {},
  prestigeLevel: loadPrestigeLevel(),
  activeScenario: null,
  bestTrade: { symbol: '—', pnl: 0 },
  worstTrade: { symbol: '—', pnl: 0 },
  peakNetWorth: 10000,
  maxDrawdownPct: 0,
  tradeMarkers: [],
  unlockedAchievements: { ach_first_trade: false, ach_short_profit: false },
  tradeHistory: [],
  triggeredEvents: [],
  customLeaderboard: loadCustomLeaderboard(),
  netWorthHistory: new Float64Array(TOTAL_DAYS)
};

function getDisplaySymbol(sym) {
  if (!state.mysteryMode) return sym;
  const asset = ASSET_MAP[sym];
  if (asset && asset.delistIdx !== null && state.dayIdx >= asset.delistIdx) return sym;
  if (state.dayIdx >= TOTAL_DAYS - 1) return sym;
  return MYSTERY_CODE_MAP[sym]?.code || sym;
}

function getDisplayName(sym) {
  const asset = ASSET_MAP[sym];
  if (!asset) return sym;
  if (!state.mysteryMode) return asset.name;
  if (asset.delistIdx !== null && state.dayIdx >= asset.delistIdx) return asset.name;
  if (state.dayIdx >= TOTAL_DAYS - 1) return asset.name;
  return MYSTERY_CODE_MAP[sym]?.name || asset.name;
}

function getDisplayBio(sym) {
  const asset = ASSET_MAP[sym];
  if (!asset) return '';
  if (!state.mysteryMode) return asset.bio;
  if (asset.delistIdx !== null && state.dayIdx >= asset.delistIdx) return asset.bio;
  if (state.dayIdx >= TOTAL_DAYS - 1) return asset.bio;
  return MYSTERY_CODE_MAP[sym]?.bio || asset.bio;
}

function recordTradeStats(symbol, realizedPnL, tradeType, price) {
  if (realizedPnL > state.bestTrade.pnl) {
    state.bestTrade = { symbol, pnl: realizedPnL };
  }
  if (realizedPnL < state.worstTrade.pnl) {
    state.worstTrade = { symbol, pnl: realizedPnL };
  }
  if (Number.isFinite(price) && price >= 0) {
    state.tradeMarkers.push({ dayIdx: state.dayIdx, symbol, type: tradeType, price });
    if (state.tradeMarkers.length > 250) state.tradeMarkers.shift();
  }
}

const { scheduleCampaignSave, saveCampaignToStorage, validateCampaign, loadCampaignFromStorage } = createCampaignPersistence({
  state,
  ASSET_MAP,
  TOTAL_DAYS,
  STORAGE_KEY_CAMPAIGN,
  LIFESTYLE_UPGRADES,
  ACHIEVEMENTS_LIST,
  HISTORICAL_DILEMMAS,
  HISTORICAL_EVENTS,
  localStorage: {getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value)},
  computePortfolioMetrics: (...args) => computePortfolioMetrics(...args),
  showToast: (...args) => showToast(...args)
});

function syncCampaignControls() {
  document.getElementById('stopLossSelect').value = state.stopLossPct;
  const takeProfitSelect = document.getElementById('takeProfitSelect');
  takeProfitSelect.value = [...takeProfitSelect.options].find(option => Number(option.value) === state.takeProfitPct)?.value || '0';
  document.getElementById('chkEnableDilemmas').checked = state.enableDilemmas;
  document.getElementById('dripStatusLabel').textContent = state.dripEnabled ? 'ON' : 'OFF';
  document.getElementById('autoPauseStateText').textContent = state.autoPauseOnEvents ? 'ON' : 'OFF';
  document.getElementById('speedSlider').value = state.speedDaysPerSec;
  document.getElementById('speedValueLabel').textContent = state.speedDaysPerSec + 'd/s';
  document.getElementById('autoPauseDot').className = 'w-1.5 h-1.5 rounded-full ' + (state.autoPauseOnEvents ? 'bg-amber-400' : 'bg-slate-500');
  document.querySelectorAll('.leverage-btn').forEach(button => {
    button.className = Number(button.dataset.leverage) === state.maxLeverage
      ? 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num font-bold bg-emerald-500 text-slate-950'
      : 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num text-slate-300 hover:text-white';
  });
}

function initGameState(baseCashAmount = 10000, scenarioConfig = null) {
  const prestigeMult = 1 + (state.prestigeLevel || 0) * 0.25;
  const startingCashAmount = Math.round(baseCashAmount * prestigeMult);
  state.dayIdx = scenarioConfig ? scenarioConfig.startDayIdx : 0;
  state.isPlaying = false;
  state.maxLeverage = 1;
  state.baseStartingCash = baseCashAmount;
  state.runStartDayIdx = state.dayIdx;
  state.scenarioCompleted = false;
  state.stopLossPct = 0;
  state.takeProfitPct = 0;
  state.startingCash = startingCashAmount;
  state.cash = startingCashAmount;
  state.totalInterestEarned = 0;
  state.totalDividendsEarned = 0;
  state.realizedPnL = 0;
  state.positions = {};
  state.optionsPositions = [];
  state.pendingOrders = [];
  state.ownedLifestyle = {};
  state.triggeredDilemmas = {};
  state.activeScenario = scenarioConfig || null;
  state.bestTrade = { symbol: '—', pnl: 0 };
  state.worstTrade = { symbol: '—', pnl: 0 };
  state.peakNetWorth = startingCashAmount;
  state.maxDrawdownPct = 0;
  state.tradeMarkers = [];
  state.tradeHistory = [];
  state.triggeredEvents = HISTORICAL_EVENTS.filter(ev => ev.dayIdx <= state.dayIdx).reverse();
  if (state.triggeredEvents.length === 0) state.triggeredEvents = [HISTORICAL_EVENTS[0]];
  state.netWorthHistory.fill(NaN);
  state.netWorthHistory[state.dayIdx] = startingCashAmount;
  if (!isStockTradable(state.selectedSymbol, 0)) {
    state.selectedSymbol = 'SPX';
  }
  document.querySelectorAll('.leverage-btn').forEach(b => {
    if (parseFloat(b.getAttribute('data-leverage')) === 1) {
      b.className = 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num font-bold bg-emerald-500 text-slate-950';
    } else {
      b.className = 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num text-slate-300 hover:text-white';
    }
  });
  updatePlayPauseUI();
  renderAll();
}

function unlockAchievement(id) {
  if (state.unlockedAchievements[id]) return;
  state.unlockedAchievements[id] = true;
  const meta = ACHIEVEMENTS_LIST.find(a => a.id === id);
  if (meta) {
    sfxBuy();
    showToast(`🏅 Badge Unlocked: ${meta.title} — ${meta.desc}!`, 'emerald');
  }
}

const { getStockPrice, isStockTradable, computePortfolioMetrics, checkMilestoneAchievements, isScenarioComplete, processSingleTradingDayStep, executeBuy, executeShortSell, executeCoverShort, executeSellDollar, executeSellAllForSymbol, buyOptionContract, settleOptionContract, buyLifestyleUpgrade } = createTradingEngine({
  state,
  ASSET_MAP,
  TOTAL_DAYS,
  TRADING_DATES,
  EVENT_BY_DAY,
  DILEMMA_BY_DAY,
  LIFESTYLE_UPGRADES,
  getFedRateAtDay: (...args) => getFedRateAtDay(...args),
  pauseSimulation: (...args) => pauseSimulation(...args),
  openDilemmaModal: (...args) => openDilemmaModal(...args),
  openCareerWrapUpModal: (...args) => openCareerWrapUpModal(...args),
  getDisplaySymbol: (...args) => getDisplaySymbol(...args),
  unlockAchievement: (...args) => unlockAchievement(...args),
  recordTradeStats: (...args) => recordTradeStats(...args),
  sfxBuy: (...args) => sfxBuy(...args),
  sfxSell: (...args) => sfxSell(...args),
  sfxAlert: (...args) => sfxAlert(...args),
  showToast: (...args) => showToast(...args),
  triggerHaptic: (...args) => triggerHaptic(...args),
  spawnFloatingPnL: (...args) => spawnFloatingPnL(...args),
  formatMoney: (...args) => formatMoney(...args),
  renderAll: (...args) => renderAll(...args),
  saveCampaignToStorage: (...args) => saveCampaignToStorage(...args),
  scheduleCampaignSave: (...args) => scheduleCampaignSave(...args)
});

let activeDilemmaObj = null;
function openDilemmaModal(dilemma) {
  activeDilemmaObj = dilemma;
  document.getElementById('dilemmaDateLabel').textContent = TRADING_DATES[dilemma.dayIdx].pretty;
  document.getElementById('dilemmaTitle').textContent = dilemma.title;
  document.getElementById('dilemmaDescription').textContent = dilemma.desc;
  document.getElementById('dilemmaChoiceATitle').textContent = dilemma.choiceATitle;
  document.getElementById('dilemmaChoiceADesc').textContent = dilemma.choiceADesc;
  document.getElementById('dilemmaChoiceBTitle').textContent = dilemma.choiceBTitle;
  document.getElementById('dilemmaChoiceBDesc').textContent = dilemma.choiceBDesc;
  openModal(document.getElementById('dilemmaModal'));
  sfxAlert();
  triggerHaptic(20);
}

function resolveDilemmaChoice(choiceKey) {
  const modal = document.getElementById('dilemmaModal');
  closeModal(modal);
  if (!activeDilemmaObj) return;
  const id = activeDilemmaObj.id;
  let bonus = 0;
  if (choiceKey === 'A') {
    const pctMap = { dil_1982: 0.08, dil_1987: 0.12, dil_1999: 0.15, dil_2008: 0.12, dil_2020: 0.10 };
    bonus = Math.max(250, Math.max(0, state.cash) * (pctMap[id] || 0.10));
  } else {
    const flatMap = { dil_1982: 600, dil_1987: 1500, dil_1999: 5000, dil_2008: 10000, dil_2020: 25000 };
    bonus = flatMap[id] || 1000;
  }
  state.cash += bonus;
  state.realizedPnL += bonus;
  sfxBuy();
  spawnFloatingPnL(bonus, 'Dilemma Bonus');
  showToast(`⚡ Decision Executed: +$${formatMoney(bonus)} credited to Cash!`, 'emerald');
  activeDilemmaObj = null;
  saveCampaignToStorage();
  renderAll();
}

function computeCareerGrade(netWorth, d) {
  const spxMult = ASSET_MAP['SPX'].prices[d] / ASSET_MAP['SPX'].prices[state.runStartDayIdx];
  const playerMult = netWorth / Math.max(1, state.startingCash);
  const ratio = playerMult / Math.max(0.1, spxMult);
  const lifestyleBonus = state.ownedLifestyle.up_foundation ? 1 : 0;
  const grades = ['F', 'D', 'C', 'B', 'A', 'S', 'S+'];
  let idx = 3; // B default
  if (ratio >= 25) idx = 6;
  else if (ratio >= 5) idx = 5;
  else if (ratio >= 1.5) idx = 4;
  else if (ratio >= 0.85) idx = 3;
  else if (ratio >= 0.5) idx = 2;
  else if (ratio >= 0.2) idx = 1;
  else idx = 0;
  return grades[Math.min(grades.length - 1, idx + lifestyleBonus)];
}

function generateShareableChallengeCode() {
  const { netWorth } = computePortfolioMetrics();
  const name = (document.getElementById('leaderboardNameInput')?.value.trim() || 'WallStTycoon').slice(0, 18);
  const retPct = ((netWorth - state.startingCash) / state.startingCash) * 100;
  const grade = computeCareerGrade(netWorth, state.dayIdx);
  const payload = {
    n: name,
    nw: Math.round(netWorth),
    r: Number(retPct.toFixed(1)),
    d: TRADING_DATES[state.dayIdx].iso,
    g: grade
  };
  try {
    return 'WSTM-' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch (e) {
    return `WSTM-${Math.round(netWorth)}`;
  }
}

function openCareerWrapUpModal() {
  const d = state.dayIdx;
  const { netWorth } = computePortfolioMetrics(d);
  const totalRetPct = ((netWorth - state.startingCash) / state.startingCash) * 100;
  const spxRetPct = ((ASSET_MAP['SPX'].prices[d] / ASSET_MAP['SPX'].prices[state.runStartDayIdx]) - 1) * 100;
  const alpha = totalRetPct - spxRetPct;
  const grade = computeCareerGrade(netWorth, d);

  document.getElementById('wrapUpHeaderTitle').textContent = state.activeScenario
    ? `${state.activeScenario.title} — Scorecard`
    : `Campaign Scorecard (${TRADING_DATES[d].pretty})`;
  document.getElementById('wrapUpNetWorth').textContent = '$' + formatMoney(netWorth);
  document.getElementById('wrapUpReturnVsSpx').textContent = `${totalRetPct >= 0 ? '+' : ''}${totalRetPct.toFixed(1)}% (${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}% vs S&P)`;
  document.getElementById('wrapUpLetterGrade').textContent = grade;

  document.getElementById('wrapUpBestTrade').textContent = state.bestTrade.pnl > 0
    ? `${getDisplaySymbol(state.bestTrade.symbol)} (+$${formatMoney(state.bestTrade.pnl)})`
    : 'No closed gains yet';
  document.getElementById('wrapUpWorstTrade').textContent = state.worstTrade.pnl < 0
    ? `${getDisplaySymbol(state.worstTrade.symbol)} (-$${formatMoney(Math.abs(state.worstTrade.pnl))})`
    : '0 wipeouts';
  document.getElementById('wrapUpMaxDrawdown').textContent = `-${state.maxDrawdownPct.toFixed(1)}%`;

  const ownedLifeCount = Object.values(state.ownedLifestyle).filter(Boolean).length;
  const unlockedAchCount = Object.values(state.unlockedAchievements).filter(Boolean).length;
  document.getElementById('wrapUpLifestyleSummary').textContent = `${ownedLifeCount}/6 Luxe • ${unlockedAchCount}/10 Badges`;

  document.getElementById('wrapUpShareCodeOutput').value = generateShareableChallengeCode();
  document.getElementById('wrapUpPrestigeCount').textContent = `★${state.prestigeLevel || 0}`;
  openModal(document.getElementById('careerWrapUpModal'));
}

// =========================================================================
// 8. REAL-TIME SIMULATION LOOP & SCREEN NAVIGATION
// =========================================================================
let rafId = null;
let lastFrameTime = 0;
let dayAccumulator = 0;

function simulationLoop(timestamp) {
  if (!state.isPlaying) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  const dtSeconds = Math.min(0.25, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;

  dayAccumulator += dtSeconds * state.speedDaysPerSec;
  const stepsToRun = Math.floor(dayAccumulator);
  if (stepsToRun >= 1) {
    const maxStepsPerFrame = Math.min(stepsToRun, 30);
    dayAccumulator -= maxStepsPerFrame;
    for (let i = 0; i < maxStepsPerFrame; i++) {
      const keepGoing = processSingleTradingDayStep();
      if (!keepGoing || !state.isPlaying) break;
    }
    renderAll();
  }
  if (state.isPlaying) {
    rafId = requestAnimationFrame(simulationLoop);
  }
}

function startSimulation() {
  if (state.dayIdx >= TOTAL_DAYS - 1 || isScenarioComplete()) return;
  state.isPlaying = true;
  lastFrameTime = 0;
  dayAccumulator = 0;
  updatePlayPauseUI();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(simulationLoop);
}

function pauseSimulation() {
  state.isPlaying = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  updatePlayPauseUI();
}

function togglePlayPause() {
  if (state.isPlaying) pauseSimulation();
  else startSimulation();
}

function stepDays(count) {
  pauseSimulation();
  const prevAutoPause = state.autoPauseOnEvents;
  state.autoPauseOnEvents = false;
  for (let i = 0; i < count; i++) {
    if (!processSingleTradingDayStep()) break;
  }
  state.autoPauseOnEvents = prevAutoPause;
  saveCampaignToStorage();
  renderAll();
}

function jumpToEraDay(targetDayIdx) {
  pauseSimulation();
  if (isScenarioComplete()) return;
  if (targetDayIdx < state.dayIdx) {
    initGameState(state.baseStartingCash, state.activeScenario);
  }
  const prevAuto = state.autoPauseOnEvents;
  state.autoPauseOnEvents = false;
  while (state.dayIdx < targetDayIdx) {
    if (!processSingleTradingDayStep()) break;
  }
  state.autoPauseOnEvents = prevAuto;
  saveCampaignToStorage();
  renderAll();
  showToast(`Time-traveled to ${TRADING_DATES[state.dayIdx].pretty}`, 'emerald');
}

function switchScreen(screenName) {
  state.activeScreen = screenName;
  const map = {
    trade: 'screenTrade',
    market: 'screenMarket',
    portfolio: 'screenPortfolio',
    news: 'screenNews',
    leaderboard: 'screenLeaderboard'
  };
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', key !== screenName);
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const s = btn.getAttribute('data-screen');
    if (s === screenName) {
      btn.className = 'mobile-nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-emerald-400 bg-emerald-500/15 font-bold relative';
    } else {
      btn.className = 'mobile-nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 hover:text-slate-200 font-medium relative';
    }
  });

  renderAll();
}

function cycleTradableStock(direction = 1) {
  const tradableList = ASSETS_CONFIG.filter(c => isStockTradable(c.symbol)).map(c => c.symbol);
  if (tradableList.length === 0) return;
  const curIdx = tradableList.indexOf(state.selectedSymbol);
  const nextIdx = curIdx === -1 ? 0 : (curIdx + direction + tradableList.length) % tradableList.length;
  state.selectedSymbol = tradableList[nextIdx];
  renderAll();
}

// =========================================================================
// 9. UI RENDERING ACROSS SCREENS
// =========================================================================
function formatMoney(val) {
  const abs = Math.abs(val);
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updatePlayPauseUI() {
  const btn = document.getElementById('btnPlayPause');
  const icon = document.getElementById('playPauseIcon');
  const label = document.getElementById('playPauseLabel');
  if (state.isPlaying) {
    icon.textContent = '⏸';
    label.textContent = 'PAUSE';
    btn.className = 'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-extrabold text-xs tracking-wide transition-all bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/15';
  } else {
    icon.textContent = '▶';
    label.textContent = 'PLAY';
    btn.className = 'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-extrabold text-xs tracking-wide transition-all bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/15';
  }
}

function showToast(message, color = 'emerald') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  while (container.children.length >= 2) {
    container.firstElementChild.remove();
  }
  const toast = document.createElement('div');
  const borderMap = {
    emerald: 'border-emerald-500/60 bg-slate-900/95 text-emerald-200',
    amber: 'border-amber-500/60 bg-slate-900/95 text-amber-200',
    rose: 'border-rose-500/70 bg-slate-900/95 text-rose-200',
    cyan: 'border-cyan-500/60 bg-slate-900/95 text-cyan-200'
  };
  toast.className = `pointer-events-auto border-l-4 px-3 py-2 rounded-xl shadow-2xl text-xs font-semibold transition-all duration-300 ${borderMap[color] || borderMap.emerald}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 280);
  }, 3200);
}

function renderHeaderAndKpis() {
  const d = state.dayIdx;
  const dateObj = TRADING_DATES[d];
  const fedRate = getFedRateAtDay(d);
  const { netWorth, equityValue, unrealizedPnL, posCount, buyingPower } = computePortfolioMetrics(d);

  document.getElementById('currentDateDisplay').textContent = dateObj.pretty;
  document.getElementById('dayIndexDisplay').textContent = (d + 1).toLocaleString();
  document.getElementById('totalDaysDisplay').textContent = TOTAL_DAYS.toLocaleString();
  document.getElementById('fedRateDisplay').textContent = fedRate.toFixed(2) + '%';
  document.getElementById('eraBadge').textContent = getEraNameForYear(dateObj.year);

  document.getElementById('headerQuickNetWorth').textContent = '$' + formatMoney(netWorth);
  document.getElementById('headerQuickCash').textContent = '$' + formatMoney(buyingPower);

  const levBadge = document.getElementById('headerLeverageBadge');
  if (state.maxLeverage > 1) {
    levBadge.textContent = state.maxLeverage + 'x Margin';
    levBadge.classList.remove('hidden');
  } else {
    levBadge.classList.add('hidden');
  }

  const prestBadge = document.getElementById('headerPrestigeBadge');
  if (prestBadge) {
    if (state.prestigeLevel > 0) {
      prestBadge.textContent = `★${state.prestigeLevel}`;
      prestBadge.classList.remove('hidden');
    } else {
      prestBadge.classList.add('hidden');
    }
  }

  const mystBtn = document.getElementById('btnMysteryToggle');
  const mystTxt = document.getElementById('mysteryStateText');
  if (mystBtn && mystTxt) {
    mystTxt.textContent = state.mysteryMode ? 'Blind: ON' : 'Blind: OFF';
    mystBtn.className = state.mysteryMode
      ? 'px-2 py-1.5 rounded-lg text-[11px] font-bold bg-purple-500/25 text-purple-300 border border-purple-500/50 flex items-center gap-1'
      : 'px-2 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1';
  }

  const scenBanner = document.getElementById('activeScenarioBanner');
  if (scenBanner) {
    if (state.activeScenario) {
      scenBanner.classList.remove('hidden');
      document.getElementById('activeScenarioTitle').textContent = `🎯 ${state.activeScenario.title}:`;
      const pctGoal = Math.min(999, (netWorth / state.activeScenario.targetNw) * 100);
      document.getElementById('activeScenarioGoalText').textContent = `Target $${formatMoney(state.activeScenario.targetNw)} by ${TRADING_DATES[state.activeScenario.endDayIdx].iso} (${pctGoal.toFixed(0)}%)`;
    } else {
      scenBanner.classList.add('hidden');
    }
  }

  // Unlocked badges count
  const unlockedCount = Object.values(state.unlockedAchievements).filter(Boolean).length;
  document.getElementById('perksUnlockedCountBadge').textContent = `${unlockedCount}/${ACHIEVEMENTS_LIST.length}`;

  const navBadge = document.getElementById('navPortfolioBadge');
  if (posCount > 0) {
    navBadge.textContent = posCount;
    navBadge.classList.remove('hidden');
  } else {
    navBadge.classList.add('hidden');
  }

  const pctTimeline = ((d + 1) / TOTAL_DAYS) * 100;
  document.getElementById('timelineProgressBar').style.width = pctTimeline.toFixed(2) + '%';

  const latestEv = state.triggeredEvents[0] || HISTORICAL_EVENTS[0];
  const latestDateObj = TRADING_DATES[latestEv.dayIdx];
  document.getElementById('latestNewsDate').textContent = latestDateObj.pretty.replace(/^[A-Za-z]+,\s*/, '');
  document.getElementById('latestNewsHeadline').textContent = latestEv.headline;
  const badgeEl = document.getElementById('newsImpactBadge');
  badgeEl.textContent = latestEv.type;

  const totalRetPct = ((netWorth - state.startingCash) / state.startingCash) * 100;
  const retEl = document.getElementById('netWorthTotalReturnPct');
  retEl.textContent = (totalRetPct >= 0 ? '+' : '') + totalRetPct.toFixed(2) + '%';
  retEl.className = 'font-mono-num font-bold ' + (totalRetPct >= 0 ? 'text-emerald-400' : 'text-rose-400');

  document.getElementById('kpiNetWorth').textContent = '$' + formatMoney(netWorth);
  const realNetWorth = netWorth / getCpiDeflatorAtDay(d);
  document.getElementById('kpiRealNetWorth').textContent = '$' + formatMoney(realNetWorth);

  document.getElementById('kpiCash').textContent = (state.cash < 0 ? '-$' : '$') + formatMoney(Math.abs(state.cash));
  const cashPct = netWorth > 0 ? (state.cash / netWorth) * 100 : 100;
  document.getElementById('cashAllocationPct').textContent = cashPct.toFixed(0) + '%';
  document.getElementById('kpiInterestEarned').textContent = (state.totalInterestEarned >= 0 ? '+$' : '-$') + formatMoney(Math.abs(state.totalInterestEarned));

  document.getElementById('kpiEquityValue').textContent = '$' + formatMoney(equityValue);
  document.getElementById('activePositionsCount').textContent = posCount + ' Pos';
  const unPnLEl = document.getElementById('kpiUnrealizedPnL');
  unPnLEl.textContent = (unrealizedPnL >= 0 ? '+$' : '-$') + formatMoney(Math.abs(unrealizedPnL));
  unPnLEl.className = 'font-mono-num ' + (unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400');

  const spx0 = ASSET_MAP['SPX'].prices[state.runStartDayIdx];
  const spxNow = ASSET_MAP['SPX'].prices[d];
  const spxMultiplier = spxNow / spx0;
  const benchmarkVal = state.startingCash * spxMultiplier;
  const benchmarkRetPct = (spxMultiplier - 1) * 100;
  document.getElementById('kpiBenchmarkValue').textContent = '$' + formatMoney(benchmarkVal);
  document.getElementById('kpiBenchmarkReturnPct').textContent = (benchmarkRetPct >= 0 ? '+' : '') + benchmarkRetPct.toFixed(1) + '%';
  document.getElementById('spxReturnHeader').textContent = (benchmarkRetPct >= 0 ? '+' : '') + benchmarkRetPct.toFixed(1) + '%';

  const alphaPct = totalRetPct - benchmarkRetPct;
  document.getElementById('alphaHeader').textContent = (alphaPct >= 0 ? '+' : '') + alphaPct.toFixed(1) + '%';

  document.getElementById('kpiDividendsTotal').textContent = '+$' + formatMoney(state.totalDividendsEarned);
  const realEl = document.getElementById('kpiRealizedPnL');
  realEl.textContent = (state.realizedPnL >= 0 ? '+$' : '-$') + formatMoney(Math.abs(state.realizedPnL));
  realEl.className = 'font-mono-num ' + (state.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400');

  const yrsElapsed = Math.max(0, (d - state.runStartDayIdx) / 252);
  document.getElementById('kpiYearsElapsed').textContent = yrsElapsed.toFixed(1) + ' Yrs';
  const cagr = yrsElapsed >= 0.25 ? (Math.pow(Math.max(0.01, netWorth / state.startingCash), 1 / yrsElapsed) - 1) * 100 : totalRetPct;
  document.getElementById('kpiCagr').textContent = (cagr >= 0 ? '+' : '') + cagr.toFixed(1) + '%';

  let rank = 'Floor Trainee';
  if (netWorth >= 100000000) rank = 'Wall St Centurion 💎';
  else if (netWorth >= 10000000) rank = 'Wall Street Titan 👑';
  else if (netWorth >= 1000000) rank = 'Hedge Fund Legend 🏆';
  else if (netWorth >= 250000) rank = 'Managing Director 🌟';
  else if (netWorth >= 50000) rank = 'Senior Portfolio Mgr';
  else if (netWorth >= 15000) rank = 'Prop Desk Trader';
  document.getElementById('kpiInvestorRank').textContent = rank;
  updateContextualHotTipBanner();
}

function renderMarketWatchList() {
  const d = state.dayIdx;
  const container = document.getElementById('stockListContainer');
  const q = state.marketSearchQuery.trim().toLowerCase();
  let activeCount = 0;
  let upcomingCount = 0;

  const htmlRows = [];
  ASSETS_CONFIG.forEach(cfg => {
    const asset = ASSET_MAP[cfg.symbol];
    const isPreIpo = d < asset.ipoIdx;
    const isDelisted = asset.delistIdx !== null && d >= asset.delistIdx;
    const isTradable = !isPreIpo && !isDelisted;
    if (isTradable) activeCount++;
    if (isPreIpo) upcomingCount++;

    const pos = state.positions[cfg.symbol];
    const sharesOwned = pos ? pos.shares : 0;

    if (state.marketFilter === 'active' && !isTradable) return;
    if (state.marketFilter === 'owned' && Math.abs(sharesOwned) <= 1e-5) return;
    if (state.marketFilter === 'ipo' && !isPreIpo) return;
    if (state.marketFilter === 'delisted' && !isDelisted) return;

    if (state.sectorFilter !== 'ALL' && cfg.sector !== state.sectorFilter) return;

    if (q) {
      const hay = `${getDisplaySymbol(cfg.symbol)} ${getDisplayName(cfg.symbol)} ${cfg.sector}`.toLowerCase();
      if (!hay.includes(q)) return;
    }

    const price = isTradable ? asset.prices[d] : 0;
    const prevPrice = isTradable && d > asset.ipoIdx ? asset.prices[d - 1] : price;
    const dayChgPct = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
    const isSelected = state.selectedSymbol === cfg.symbol;
    const rowClass = isSelected ? 'stock-row-active' : 'hover:bg-slate-800/50';

    let priceCol = '';
    let chgCol = '';
    if (isPreIpo) {
      priceCol = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">IPO ${cfg.ipoDate.slice(0, 7)}</span>`;
      chgCol = `<span class="text-amber-300/80 text-[10px]">Pre-Order</span>`;
    } else if (isDelisted) {
      priceCol = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">BANKRUPT</span>`;
      chgCol = `<span class="text-rose-400 text-[11px]">$0.00</span>`;
    } else {
      priceCol = `<span class="font-mono-num font-bold text-slate-100">$${price.toFixed(2)}</span>`;
      const sign = dayChgPct >= 0 ? '+' : '';
      const color = dayChgPct >= 0 ? 'text-emerald-400' : 'text-rose-400';
      chgCol = `<span class="font-mono-num text-[11px] ${color}">${sign}${dayChgPct.toFixed(2)}%</span>`;
    }

    const posBadge = Math.abs(sharesOwned) > 1e-4
      ? `<span class="text-[9px] px-1 rounded ${sharesOwned > 0 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/25 text-purple-300'} font-mono-num">${sharesOwned > 0 ? 'L' : 'S'}:${Math.abs(sharesOwned).toFixed(1)}</span>`
      : '';

    const actionCol = isTradable
      ? `<span class="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">Trade</span>`
      : `<span class="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px]">Inspect</span>`;

    const dispSym = getDisplaySymbol(cfg.symbol);
    const dispName = getDisplayName(cfg.symbol);
    htmlRows.push(`
      <button type="button" data-symbol="${cfg.symbol}" class="w-full text-left stock-watch-row grid grid-cols-12 items-center px-3 py-2.5 cursor-pointer transition ${rowClass}">
        <span class="col-span-5 min-w-0 pr-1">
          <span class="flex items-center gap-1">
            <span class="font-mono-num font-extrabold text-xs text-white">${dispSym}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">${cfg.sector}</span>
            ${posBadge}
          </span>
          <span class="text-[11px] text-slate-400 truncate">${dispName}</span>
        </span>
        <span class="col-span-3 text-right">${priceCol}</span>
        <span class="col-span-2 text-right">${chgCol}</span>
        <span class="col-span-2 text-right">${actionCol}</span>
      </button>
    `);
  });

  setMarkup(container, htmlRows.length
    ? htmlRows.join('')
    : `<div class="p-6 text-center text-xs text-slate-500">No assets match this filter on ${TRADING_DATES[d].pretty}.</div>`);

  document.getElementById('activeListingsBadge').textContent = `${activeCount} Active • ${upcomingCount} IPOs`;
}

function renderTradingDesk() {
  const sym = state.selectedSymbol;
  const asset = ASSET_MAP[sym];
  const d = state.dayIdx;
  const tradable = isStockTradable(sym, d);
  const price = tradable ? asset.prices[d] : 0;
  const { buyingPower } = computePortfolioMetrics(d);

  const dispSym = getDisplaySymbol(sym);
  const dispName = getDisplayName(sym);
  document.getElementById('tradeDeskTitle').textContent = `${dispSym} — ${dispName}`;
  document.getElementById('btnBuyTickerLabel').textContent = dispSym;
  document.getElementById('btnShortTickerLabel').textContent = dispSym;
  document.getElementById('tradeDeskCashAvailable').textContent = '$' + formatMoney(buyingPower);

  // Forensic Risk Badge
  const forensicEl = document.getElementById('stockForensicBadge');
  if (asset.delistIdx !== null) {
    const daysLeft = asset.delistIdx - d;
    if (daysLeft <= 0) {
      forensicEl.textContent = '💀 Bankrupt $0';
      forensicEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold';
    } else if (daysLeft < 504) {
      forensicEl.textContent = '🚨 Debt/Fraud Alert';
      forensicEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold';
    } else {
      forensicEl.textContent = '⚠️ High Leverage';
      forensicEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold';
    }
  } else if (asset.divYield >= 0.022) {
    forensicEl.textContent = '🛡️ Dividend Payer';
    forensicEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold';
  } else {
    forensicEl.textContent = '🚀 Growth Leader';
    forensicEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold';
  }

  const pos = state.positions[sym];
  const shares = pos ? pos.shares : 0;
  const absShares = Math.abs(shares);
  const posVal = absShares * price;
  const posPnL = pos
    ? (shares > 0 ? posVal - pos.totalCost : pos.totalCost - posVal)
    : 0;
  const posPnLPct = pos && pos.totalCost > 0 ? (posPnL / pos.totalCost) * 100 : 0;

  document.getElementById('tradeDeskOwnedShares').textContent = shares === 0 ? '0.00' : (shares > 0 ? `LONG ${shares.toFixed(2)}` : `SHORT ${absShares.toFixed(2)}`);
  document.getElementById('tradeDeskOwnedValue').textContent = '$' + formatMoney(posVal);
  document.getElementById('tradeDeskAvgCost').textContent = pos && absShares > 1e-5 ? '$' + pos.avgCost.toFixed(2) : '—';
  const pnlEl = document.getElementById('tradeDeskPositionPnL');
  if (pos && absShares > 1e-5) {
    pnlEl.textContent = `${posPnLPct >= 0 ? '+' : ''}${posPnLPct.toFixed(1)}%`;
    pnlEl.className = 'font-mono-num font-bold ' + (posPnL >= 0 ? 'text-emerald-400' : 'text-rose-400');
  } else {
    pnlEl.textContent = '0.0%';
    pnlEl.className = 'font-mono-num text-slate-400';
  }

  const unavailBanner = document.getElementById('tradeUnavailableBanner');
  const unavailText = document.getElementById('unavailableBannerText');
  const preIpoBox = document.getElementById('preIpoSyndicateBox');
  const controlsBox = document.getElementById('tradeControlsContainer');

  if (!tradable) {
    document.getElementById('tradeDeskPrice').textContent = d < asset.ipoIdx ? 'PRE-IPO' : 'DELISTED';
    unavailBanner.classList.remove('hidden');
    if (d < asset.ipoIdx) {
      setMarkup(unavailText, `<strong>Upcoming IPO:</strong> ${dispName} (${dispSym}) unlocks on <strong>${TRADING_DATES[asset.ipoIdx].pretty}</strong> at <strong>$${asset.prices[asset.ipoIdx].toFixed(2)}</strong>.`);
      preIpoBox.classList.remove('hidden');
    } else {
      setMarkup(unavailText, `<strong>Bankrupt &amp; Delisted:</strong> ${dispName} (${dispSym}) went bankrupt on <strong>${TRADING_DATES[asset.delistIdx].pretty}</strong> at $0.00.`);
      preIpoBox.classList.add('hidden');
    }
    controlsBox.classList.add('opacity-40', 'pointer-events-none');
  } else {
    document.getElementById('tradeDeskPrice').textContent = '$' + price.toFixed(2);
    unavailBanner.classList.add('hidden');
    controlsBox.classList.remove('opacity-40', 'pointer-events-none');
  }

  // Render Active 30D 5x Options
  const optBox = document.getElementById('activeOptionsBox');
  const optList = document.getElementById('activeOptionsList');
  document.getElementById('activeOptionsCount').textContent = state.optionsPositions.length;
  if (state.optionsPositions.length === 0) {
    optBox.classList.add('hidden');
  } else {
    optBox.classList.remove('hidden');
    setMarkup(optList, state.optionsPositions.map(opt => {
      const mark = getStockPrice(opt.symbol, d);
      const rawPct = opt.strikePrice > 0 ? (mark - opt.strikePrice) / opt.strikePrice : 0;
      const signedPct = opt.optType === 'CALL' ? rawPct : -rawPct;
      const val = Math.max(0, opt.premium * (1 + 5 * signedPct));
      const pnlPct = ((val - opt.premium) / opt.premium) * 100;
      const daysLeft = Math.max(0, opt.expiryDayIdx - d);
      return `
        <div class="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span class="font-mono-num text-slate-200 text-[10px]">
            <strong class="${opt.optType === 'CALL' ? 'text-emerald-400' : 'text-rose-400'}">5x ${opt.optType} ${getDisplaySymbol(opt.symbol)}</strong>
            • Val: <strong>$${formatMoney(val)}</strong> (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(0)}%) • ${daysLeft}d left
          </span>
          <button type="button" data-closeopt="${opt.id}" class="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">Cash Out</button>
        </div>
      `;
    }).join(''));
  }

  // Render Pending Orders Queue
  const pendingBox = document.getElementById('pendingOrdersBox');
  const pendingList = document.getElementById('pendingOrdersList');
  document.getElementById('pendingOrdersCount').textContent = state.pendingOrders.length;
  if (state.pendingOrders.length === 0) {
    pendingBox.classList.add('hidden');
  } else {
    pendingBox.classList.remove('hidden');
    setMarkup(pendingList, state.pendingOrders.map(ord => `
      <div class="flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
        <span class="font-mono-num text-slate-200">
          <strong class="text-amber-300">${ord.type === 'PRE_IPO' ? 'IPO' : 'LIMIT'} ${getDisplaySymbol(ord.symbol)}</strong>
          • $${formatMoney(ord.dollarAmount)} ${ord.limitPrice ? `@ ≤$${ord.limitPrice.toFixed(2)}` : 'on IPO Day'}
        </span>
        <button type="button" data-cancelord="${ord.id}" class="text-[10px] text-rose-400 font-bold">✕</button>
      </div>
    `).join(''));
  }

  updateOrderEstimate();
}

function updateOrderEstimate() {
  const sym = state.selectedSymbol;
  const price = getStockPrice(sym);
  const dollarInput = parseFloat(document.getElementById('orderDollarInput').value) || 0;
  const formattedAmt = Math.round(dollarInput).toLocaleString();
  document.getElementById('btnSellAmountLabel').textContent = formattedAmt;
  const preIpoPreview = document.getElementById('preIpoOrderAmtPreview');
  if (preIpoPreview) preIpoPreview.textContent = formattedAmt;
  const estShares = price > 0 ? dollarInput / price : 0;
  document.getElementById('estSharesOutput').textContent = estShares.toFixed(3);
}

function renderPortfolioAndLogs() {
  const d = state.dayIdx;
  const posKeys = Object.keys(state.positions).filter(k => Math.abs(state.positions[k].shares) > 1e-5);
  document.getElementById('tabPositionsCount').textContent = posKeys.length;
  document.getElementById('tabTradesCount').textContent = state.tradeHistory.length;

  if (state.activeScreen === 'portfolio') {
  const liquidateBtn = document.getElementById('btnSellAllPositions');
  if (posKeys.length > 0) liquidateBtn.classList.remove('hidden');
  else liquidateBtn.classList.add('hidden');

  const emptyState = document.getElementById('emptyPositionsState');
  const tableWrap = document.getElementById('positionsTableWrapper');
  const tbody = document.getElementById('positionsTableBody');

  if (posKeys.length === 0) {
    emptyState.classList.remove('hidden');
    tableWrap.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    setMarkup(tbody, posKeys.map(sym => {
      const pos = state.positions[sym];
      const mark = getStockPrice(sym, d);
      const absShares = Math.abs(pos.shares);
      const mktVal = absShares * mark;
      const pnl = pos.shares > 0 ? (mktVal - pos.totalCost) : (pos.totalCost - mktVal);
      const pnlPct = pos.totalCost > 0 ? (pnl / pos.totalCost) * 100 : 0;
      const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
      const sideBadge = pos.shares > 0
        ? `<span class="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 mr-1">LONG</span>`
        : `<span class="text-[9px] px-1 rounded bg-purple-500/25 text-purple-300 mr-1">SHORT</span>`;
      return `
        <tr class="hover:bg-slate-800/40">
          <td class="py-2 font-bold text-white"><button type="button" class="select-pos-row" data-symbol="${sym}" aria-label="Trade ${getDisplaySymbol(sym)}">${sideBadge}${getDisplaySymbol(sym)}</button></td>
          <td class="py-2 text-right text-slate-300">${absShares.toFixed(2)}</td>
          <td class="py-2 text-right font-semibold text-white">$${formatMoney(mktVal)}</td>
          <td class="py-2 text-right font-semibold ${pnlColor}">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%</td>
          <td class="py-2 text-right">
            <button type="button" data-quicksell="${sym}" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-sans font-semibold border border-rose-500/30">
              ${pos.shares > 0 ? 'Sell All' : 'Cover'}
            </button>
          </td>
        </tr>
      `;
    }).join(''));
  }

  }
  if (state.activeScreen === 'news' && state.activeBottomTab === 'news') {
  const newsPanel = document.getElementById('tabPanelNews');
  setMarkup(newsPanel, state.triggeredEvents.slice(0, 50).map(ev => {
    const dt = TRADING_DATES[ev.dayIdx].pretty;
    return `
      <div class="py-2.5 flex flex-col gap-0.5 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono-num text-[10px] font-bold text-emerald-400">${dt}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">${ev.type}</span>
        </div>
        <div class="text-slate-200 leading-snug">${ev.headline}</div>
      </div>
    `;
  }).join(''));

  }
  if (state.activeScreen === 'news' && state.activeBottomTab === 'trades') {
  const tradesPanel = document.getElementById('tabPanelTrades');
  if (state.tradeHistory.length === 0) {
    setMarkup(tradesPanel, `<div class="text-center py-8 text-slate-500 font-sans">No trades executed yet.</div>`);
  } else {
    setMarkup(tradesPanel, state.tradeHistory.slice(0, 60).map(tr => {
      const badgeColor = (tr.type === 'BUY' || tr.type === 'SHORT WIN') ? 'text-emerald-400' : (tr.type === 'BANKRUPT' ? 'text-rose-400' : 'text-cyan-400');
      return `
        <div class="py-2 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[10px] text-slate-400">${tr.dateStr}</div>
            <div class="truncate"><strong class="${badgeColor}">${tr.type} ${getDisplaySymbol(tr.symbol)}</strong> <span class="text-slate-300">${tr.note}</span></div>
          </div>
          <div class="font-bold text-slate-200 shrink-0">$${formatMoney(Math.abs(tr.amount))}</div>
        </div>
      `;
    }).join(''));
  }

  }
  // Render Tycoon Lifestyle & Hedge Fund Upgrades Shop
  const lifeShop = document.getElementById('lifestyleShopContainer');
  const lifeCountEl = document.getElementById('lifestyleOwnedCount');
  if (state.activeScreen === 'portfolio' && lifeShop && lifeCountEl) {
    const ownedCount = Object.values(state.ownedLifestyle).filter(Boolean).length;
    lifeCountEl.textContent = `${ownedCount}/${LIFESTYLE_UPGRADES.length}`;
    setMarkup(lifeShop, LIFESTYLE_UPGRADES.map(item => {
      const owned = Boolean(state.ownedLifestyle[item.id]);
      const canAfford = state.cash >= item.cost;
      return `
        <div class="p-2.5 rounded-xl border ${owned ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-slate-950/80 border-slate-800'} flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-white truncate">${item.icon} ${item.name}</div>
            <div class="text-[10px] text-emerald-300 truncate">${item.buffText}</div>
            <div class="text-[10px] font-mono-num text-slate-400">$${formatMoney(item.cost)}</div>
          </div>
          ${owned
            ? `<span class="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold shrink-0">OWNED</span>`
            : `<button type="button" data-buylife="${item.id}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold shrink-0 ${canAfford ? 'bg-amber-400 hover:bg-amber-300 text-slate-950' : 'bg-slate-800 text-slate-500'}">Buy</button>`
          }
        </div>
      `;
    }).join(''));
  }
}

function renderLeaderboard() {
  const d = state.dayIdx;
  const yrs = (d - state.runStartDayIdx) / 252;
  const dateStr = TRADING_DATES[d].pretty;
  document.getElementById('lbComparisonDateLabel').textContent = dateStr;

  const { netWorth } = computePortfolioMetrics(d);
  const playerRetPct = ((netWorth - state.startingCash) / state.startingCash) * 100;

  const entries = [];
  entries.push({
    id: 'live-player',
    name: (document.getElementById('leaderboardNameInput')?.value.trim() || 'You (Live Campaign)'),
    avatar: document.getElementById('leaderboardAvatarSelect')?.value || '🦅',
    strategy: `Active Run • ${dateStr}`,
    netWorth,
    returnPct: playerRetPct,
    isLivePlayer: true
  });

  if (state.leaderboardFilter === 'all' || state.leaderboardFilter === 'custom') {
    state.customLeaderboard.forEach(item => {
      entries.push({ ...item, isCustom: true });
    });
  }

  if (state.leaderboardFilter === 'all' || state.leaderboardFilter === 'legends') {
    const spxMult = ASSET_MAP['SPX'].prices[d] / ASSET_MAP['SPX'].prices[state.runStartDayIdx];
    WALL_ST_LEGENDS.forEach(leg => {
      let legNw = state.startingCash;
      if (leg.cagr === null) {
        legNw = state.startingCash * spxMult * Math.pow(1.018, yrs);
      } else {
        legNw = state.startingCash * Math.pow(1 + leg.cagr, yrs);
      }
      const legRet = ((legNw - state.startingCash) / state.startingCash) * 100;
      entries.push({
        id: leg.id,
        name: leg.name,
        avatar: leg.avatar,
        strategy: leg.strategy,
        netWorth: legNw,
        returnPct: legRet,
        isLegend: true
      });
    });
  }

  entries.sort((a, b) => b.netWorth - a.netWorth);

  const container = document.getElementById('leaderboardListContainer');
  setMarkup(container, entries.map((ent, idx) => {
    const rankNum = idx + 1;
    const medal = rankNum === 1 ? '🥇' : (rankNum === 2 ? '🥈' : (rankNum === 3 ? '🥉' : `#${rankNum}`));
    const highlight = ent.isLivePlayer
      ? 'bg-emerald-500/15 border-emerald-500/50'
      : (ent.isCustom ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-950/80 border-slate-800');
    const retSign = ent.returnPct >= 0 ? '+' : '';
    return `
      <div class="p-3 rounded-xl border ${highlight} flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-mono-num text-xs font-extrabold text-amber-300 shrink-0">
            ${medal}
          </div>
          <div class="text-lg shrink-0" data-lb-avatar></div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-extrabold text-white truncate" data-lb-name></span>
              ${ent.isLivePlayer ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-bold">LIVE</span>' : ''}
              ${ent.isCustom ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">CUSTOM</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-400 truncate" data-lb-strategy></div>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono-num text-sm font-extrabold text-white">$${formatMoney(ent.netWorth)}</div>
          <div class="font-mono-num text-[11px] ${ent.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${retSign}${ent.returnPct.toFixed(1)}%</div>
        </div>
      </div>
    `;
  }).join(''));
  // Names, avatars and strategies can come from shared codes or saved storage.
  // Assign them as text so even older saved entries cannot introduce markup.
  entries.forEach((ent, idx) => {
    const row = container.children[idx];
    row.querySelector('[data-lb-avatar]').textContent = ent.avatar || '📈';
    row.querySelector('[data-lb-name]').textContent = ent.name;
    row.querySelector('[data-lb-strategy]').textContent = ent.strategy;
  });
}

function renderAchievementsModal() {
  const grid = document.getElementById('achievementsGridContainer');
  if (!grid) return;
  setMarkup(grid, ACHIEVEMENTS_LIST.map(ach => {
    const unlocked = Boolean(state.unlockedAchievements[ach.id]);
    return `
      <div class="p-2 rounded-xl border ${unlocked ? 'bg-emerald-500/15 border-emerald-500/40 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-500'} flex items-center gap-2">
        <span class="text-base">${ach.icon}</span>
        <div class="min-w-0">
          <div class="text-[11px] font-bold truncate">${ach.title}</div>
          <div class="text-[9px] truncate">${ach.desc}</div>
        </div>
      </div>
    `;
  }).join(''));
}

// =========================================================================
// 10. HIGH-DPI HTML5 CANVAS CHART ENGINE (WITH 200-DAY SMA OVERLAY)
// =========================================================================
function renderChart() {
  const canvas = document.getElementById('mainChartCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(260, rect.width);
  const height = Math.max(160, rect.height);
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#080d1a';
  ctx.fillRect(0, 0, width, height);

  const d = state.dayIdx;
  const sym = state.selectedSymbol;
  const asset = ASSET_MAP[sym];

  document.getElementById('chartSymbolTitle').textContent = getDisplaySymbol(sym);
  document.getElementById('chartCompanyTitle').textContent = getDisplayName(sym);
  document.getElementById('chartSectorBadge').textContent = asset.sector;
  document.getElementById('chartDividendBadge').textContent = `Yield: ${(asset.divYield * 100).toFixed(1)}%`;
  document.getElementById('companyHistoryText').textContent = getDisplayBio(sym);
  document.getElementById('companyIpoDate').textContent = TRADING_DATES[asset.ipoIdx].pretty;

  const padLeft = 10;
  const padRight = 58;
  const padTop = 14;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padTop + (plotH * g) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  if (state.chartMode === 'stock') {
    if (d < asset.ipoIdx) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${getDisplayName(sym)} (${getDisplaySymbol(sym)}) IPOs on ${TRADING_DATES[asset.ipoIdx].pretty}`, width / 2, height / 2 - 6);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Use ⚡ Pre-Order IPO below to auto-buy at the opening bell!', width / 2, height / 2 + 14);
      document.getElementById('chartCurrentPrice').textContent = 'Locked (Pre-IPO)';
      document.getElementById('chartPeriodReturn').textContent = '—';
      document.getElementById('company52WRange').textContent = 'Pre-IPO (Locked)';
      ctx.restore();
      return;
    }

    const endDay = asset.delistIdx !== null ? Math.min(d, asset.delistIdx) : d;
    const startDay = Math.max(asset.ipoIdx, endDay - state.chartTimeframeDays);
    const span = Math.max(1, endDay - startDay);

    let minP = Infinity, maxP = -Infinity;
    for (let i = startDay; i <= endDay; i++) {
      const p = asset.prices[i];
      if (p < minP) minP = p;
      if (p > maxP) maxP = p;
    }
    if (!isFinite(minP)) { minP = 0; maxP = 100; }
    if (Math.abs(maxP - minP) < 1e-4) { maxP += 1; minP = Math.max(0, minP - 1); }

    const w52Start = Math.max(asset.ipoIdx, endDay - 252);
    let hi52 = -Infinity, lo52 = Infinity;
    for (let i = w52Start; i <= endDay; i++) {
      const p = asset.prices[i];
      if (p > hi52) hi52 = p;
      if (p < lo52) lo52 = p;
    }
    document.getElementById('company52WRange').textContent = `$${hi52.toFixed(2)} / $${lo52.toFixed(2)}`;

    const startPrice = asset.prices[startDay];
    const curPrice = asset.delistIdx !== null && d >= asset.delistIdx ? 0 : asset.prices[endDay];
    const periodRet = startPrice > 0 ? ((curPrice - startPrice) / startPrice) * 100 : 0;

    document.getElementById('chartCurrentPrice').textContent = '$' + curPrice.toFixed(2);
    const retSpan = document.getElementById('chartPeriodReturn');
    retSpan.textContent = `Period: ${periodRet >= 0 ? '+' : ''}${periodRet.toFixed(2)}%`;
    retSpan.className = 'font-mono-num text-xs font-semibold ' + (periodRet >= 0 ? 'text-emerald-400' : 'text-rose-400');

    const isUp = curPrice >= startPrice;
    const strokeColor = isUp ? '#10b981' : '#f43f5e';

    const stepStride = Math.max(1, Math.floor(span / 350));
    ctx.beginPath();
    for (let i = startDay; i <= endDay; i += stepStride) {
      const x = padLeft + ((i - startDay) / span) * plotW;
      const p = asset.prices[i];
      const y = padTop + plotH - ((p - minP) / (maxP - minP)) * plotH;
      if (i === startDay) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const lastX = padLeft + plotW;
    const lastY = padTop + plotH - ((curPrice - minP) / (maxP - minP)) * plotH;
    ctx.lineTo(lastX, lastY);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(lastX, padTop + plotH);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, isUp ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 200-Day Simple Moving Average (SMA) Overlay
    if (state.showSma200 && endDay - asset.ipoIdx >= 20) {
      ctx.beginPath();
      let startedSma = false;
      for (let i = startDay; i <= endDay; i += stepStride) {
        const winStart = Math.max(asset.ipoIdx, i - 200);
        let sum = 0;
        const cnt = i - winStart + 1;
        for (let k = winStart; k <= i; k++) sum += asset.prices[k];
        const smaVal = sum / cnt;
        const x = padLeft + ((i - startDay) / span) * plotW;
        const y = padTop + plotH - ((smaVal - minP) / (maxP - minP)) * plotH;
        if (!startedSma) { ctx.moveTo(x, y); startedSma = true; }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Visual Trade Markers (▲ Buy, ▼ Sell, ◆ Short) on the Price Curve
    const symMarkers = state.tradeMarkers.filter(m => m.symbol === sym && m.dayIdx >= startDay && m.dayIdx <= endDay);
    if (symMarkers.length > 0) {
      ctx.save();
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      symMarkers.slice(-25).forEach(mk => {
        const mx = padLeft + ((mk.dayIdx - startDay) / span) * plotW;
        const mp = asset.prices[mk.dayIdx] || mk.price;
        const my = padTop + plotH - ((mp - minP) / (maxP - minP)) * plotH;
        if (mk.type === 'BUY') {
          ctx.fillStyle = '#34d399';
          ctx.fillText('▲', mx, Math.min(padTop + plotH - 2, my + 9));
        } else if (mk.type === 'SELL') {
          ctx.fillStyle = '#fb7185';
          ctx.fillText('▼', mx, Math.max(padTop + 9, my - 4));
        } else {
          ctx.fillStyle = '#c084fc';
          ctx.fillText('◆', mx, Math.max(padTop + 9, my - 4));
        }
      });
      ctx.restore();
    }

    // Average Cost / Short Entry Line
    const pos = state.positions[sym];
    if (pos && Math.abs(pos.shares) > 1e-5 && pos.avgCost >= minP && pos.avgCost <= maxP) {
      const costY = padTop + plotH - ((pos.avgCost - minP) / (maxP - minP)) * plotH;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = pos.shares > 0 ? '#38bdf8' : '#c084fc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padLeft, costY);
      ctx.lineTo(width - padRight, costY);
      ctx.stroke();
      ctx.fillStyle = pos.shares > 0 ? '#38bdf8' : '#c084fc';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`${pos.shares > 0 ? 'Long' : 'Short'} $${pos.avgCost.toFixed(2)}`, padLeft + 6, Math.max(padTop + 10, costY - 4));
      ctx.restore();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    for (let g = 0; g <= 4; g++) {
      const val = maxP - ((maxP - minP) * g) / 4;
      const y = padTop + (plotH * g) / 4 + 3;
      ctx.fillText('$' + (val >= 100 ? val.toFixed(0) : val.toFixed(2)), width - padRight + 4, y);
    }

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText(TRADING_DATES[startDay].iso, padLeft, height - 5);
    ctx.textAlign = 'right';
    ctx.fillText(TRADING_DATES[endDay].iso, width - padRight, height - 5);
  } else {
    const startDay = Math.max(state.runStartDayIdx, d - state.chartTimeframeDays);
    const span = Math.max(1, d - startDay);
    const spx0 = ASSET_MAP['SPX'].prices[state.runStartDayIdx];

    let minV = Infinity, maxV = -Infinity;
    for (let i = startDay; i <= d; i++) {
      const nw = state.netWorthHistory[i];
      const bench = state.startingCash * (ASSET_MAP['SPX'].prices[i] / spx0);
      minV = Math.min(minV, Number.isFinite(nw) ? nw : bench, bench);
      maxV = Math.max(maxV, Number.isFinite(nw) ? nw : bench, bench);
    }
    if (Math.abs(maxV - minV) < 1) { maxV += 100; minV = Math.max(0, minV - 100); }

    const stepStride = Math.max(1, Math.floor(span / 350));

    ctx.beginPath();
    for (let i = startDay; i <= d; i += stepStride) {
      const x = padLeft + ((i - startDay) / span) * plotW;
      const bench = state.startingCash * (ASSET_MAP['SPX'].prices[i] / spx0);
      const y = padTop + plotH - ((bench - minV) / (maxV - minV)) * plotH;
      if (i === startDay) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    let hasPreviousPoint = false;
    for (let i = startDay; i <= d; i += stepStride) {
      const nw = state.netWorthHistory[i];
      if (!Number.isFinite(nw)) { hasPreviousPoint = false; continue; }
      const x = padLeft + ((i - startDay) / span) * plotW;
      const y = padTop + plotH - ((nw - minV) / (maxV - minV)) * plotH;
      if (!hasPreviousPoint) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      hasPreviousPoint = true;
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText('● You', padLeft + 6, padTop + 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('● S&P 500', padLeft + 55, padTop + 12);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    for (let g = 0; g <= 4; g++) {
      const val = maxV - ((maxV - minV) * g) / 4;
      const y = padTop + (plotH * g) / 4 + 3;
      ctx.fillText('$' + formatMoney(val), width - padRight + 4, y);
    }

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText(TRADING_DATES[startDay].iso, padLeft, height - 5);
    ctx.textAlign = 'right';
    ctx.fillText(TRADING_DATES[d].iso, width - padRight, height - 5);
  }

  ctx.restore();
}

function renderAll() {
  syncCampaignControls();
  renderHeaderAndKpis();
  if (state.activeScreen === 'market') renderMarketWatchList();
  if (state.activeScreen === 'portfolio' || state.activeScreen === 'news') renderPortfolioAndLogs();
  if (state.activeScreen === 'leaderboard') renderLeaderboard();
  if (state.activeScreen === 'trade') {
    renderTradingDesk();
    renderChart();
  }
  if (!document.getElementById('perksModal').classList.contains('hidden')) renderAchievementsModal();
}

// =========================================================================
// 11. EVENT LISTENERS & MOBILE CONTROLS WIRING
// =========================================================================
let appDomInitialized = false;
window.addEventListener('DOMContentLoaded', () => {
  if (appDomInitialized) return;
  appDomInitialized = true;
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.getAttribute('data-screen')));
  });

  document.getElementById('headerNewsBarBtn').addEventListener('click', () => switchScreen('news'));
  document.getElementById('btnPrevStock').addEventListener('click', () => cycleTradableStock(-1));
  document.getElementById('btnNextStock').addEventListener('click', () => cycleTradableStock(1));
  document.getElementById('btnQuickOpenMarket').addEventListener('click', () => switchScreen('market'));

  // 200D SMA Overlay Toggle
  const smaBtn = document.getElementById('btnToggleSmaOverlay');
  smaBtn.addEventListener('click', () => {
    state.showSma200 = !state.showSma200;
    smaBtn.textContent = `200D SMA: ${state.showSma200 ? 'ON' : 'OFF'}`;
    smaBtn.className = state.showSma200
      ? 'px-2 py-1 rounded-lg text-[10px] font-mono-num font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
      : 'px-2 py-1 rounded-lg text-[10px] font-mono-num bg-slate-800 text-slate-400';
    renderChart();
  });

  // Mystery / Blind Mode Toggle
  document.getElementById('btnMysteryToggle').addEventListener('click', () => {
    state.mysteryMode = !state.mysteryMode;
    saveCampaignToStorage();
    showToast(`🕵️ Blind Mystery Ticker Mode turned ${state.mysteryMode ? 'ON (Tickers Masked!)' : 'OFF (Real Names Shown)'}`, 'cyan');
    renderAll();
  });

  // Career Wrap-Up & Prestige Modal Controls
  const wrapUpModal = document.getElementById('careerWrapUpModal');
  document.getElementById('btnOpenWrapUpModal').addEventListener('click', () => {
    pauseSimulation();
    openCareerWrapUpModal();
  });
  document.getElementById('btnCloseWrapUpModal').addEventListener('click', () => closeModal(wrapUpModal));
  document.getElementById('btnDoneWrapUpModal').addEventListener('click', () => closeModal(wrapUpModal));

  document.getElementById('btnCopyShareCode').addEventListener('click', async () => {
    const code = generateShareableChallengeCode();
    const output = document.getElementById('wrapUpShareCodeOutput');
    output.value = code;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      sfxBuy();
      showToast('📋 Copied Rival Code to clipboard!', 'emerald');
    } catch (e) {
      output.focus();
      output.select();
      showToast('Clipboard unavailable. Copy the selected Rival Code manually.', 'amber');
    }
  });

  document.getElementById('btnPrestigeReset').addEventListener('click', () => {
    const { netWorth } = computePortfolioMetrics();
    if (netWorth < 50000) {
      showToast('Reach at least $50,000 Net Worth before retiring to claim a Prestige Star (★)!', 'amber');
      return;
    }
    state.prestigeLevel = (state.prestigeLevel || 0) + 1;
    savePrestigeLevel(state.prestigeLevel);
    closeModal(wrapUpModal);
    initGameState(10000);
    saveCampaignToStorage();
    sfxBuy();
    triggerHaptic(30);
    showToast(`🎖️ PRESTIGE ★${state.prestigeLevel} UNLOCKED! Starting with $${formatMoney(state.startingCash)} (+${state.prestigeLevel * 25}%) & +${(state.prestigeLevel * 0.5).toFixed(1)}% APY!`, 'emerald');
  });

  // Interactive Dilemma Modal Controls
  document.getElementById('btnDilemmaChoiceA').addEventListener('click', () => resolveDilemmaChoice('A'));
  document.getElementById('btnDilemmaChoiceB').addEventListener('click', () => resolveDilemmaChoice('B'));
  document.getElementById('chkEnableDilemmas').addEventListener('change', (e) => {
    state.enableDilemmas = Boolean(e.target.checked);
    saveCampaignToStorage();
  });

  // Margin Leverage Selector (2.5x requires Prestige >= 1 or Quant AI Server Cluster)
  document.querySelectorAll('.leverage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqLev = parseFloat(btn.getAttribute('data-leverage')) || 1;
      if (reqLev > 2 && !state.ownedLifestyle.up_quant && (state.prestigeLevel || 0) < 1) {
        showToast('🔒 2.5x Margin unlocks via Prestige ★1 or buying the 🖥️ Quant AI Server Cluster in Portfolio!', 'amber');
        return;
      }
      state.maxLeverage = reqLev;
    saveCampaignToStorage();
      document.querySelectorAll('.leverage-btn').forEach(b => {
        if (parseFloat(b.getAttribute('data-leverage')) === state.maxLeverage) {
          b.className = 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num font-bold bg-emerald-500 text-slate-950';
        } else {
          b.className = 'leverage-btn px-2 py-0.5 rounded-lg text-[10px] font-mono-num text-slate-300 hover:text-white';
        }
      });
      showToast(`Margin Leverage set to ${state.maxLeverage}x Net Worth buying power.`, 'cyan');
      renderAll();
    });
  });

  // Pre-IPO Syndicate Auto-Order Queue
  document.getElementById('btnQueuePreIpoOrder').addEventListener('click', () => {
    const sym = state.selectedSymbol;
    const asset = ASSET_MAP[sym];
    const amt = Math.max(100, parseFloat(document.getElementById('orderDollarInput').value) || 1000);
    state.pendingOrders.push({
      id: 'ord-' + Date.now() + '-' + Math.random(),
      type: 'PRE_IPO',
      symbol: sym,
      dollarAmount: amt,
      limitPrice: null
    });
    sfxBuy();
    saveCampaignToStorage();
    showToast(`⚡ Queued $${formatMoney(amt)} Pre-IPO order for ${getDisplaySymbol(sym)} (executes ${TRADING_DATES[asset.ipoIdx].pretty})!`, 'emerald');
    renderAll();
  });

  // Limit Dip -10% Order Queue
  document.getElementById('btnQueueDipLimitOrder').addEventListener('click', () => {
    const sym = state.selectedSymbol;
    if (!isStockTradable(sym)) return;
    const curP = getStockPrice(sym);
    const targetP = curP * 0.90;
    const amt = Math.max(100, parseFloat(document.getElementById('orderDollarInput').value) || 1000);
    state.pendingOrders.push({
      id: 'ord-' + Date.now() + '-' + Math.random(),
      type: 'LIMIT_BUY',
      symbol: sym,
      dollarAmount: amt,
      limitPrice: targetP
    });
    sfxBuy();
    saveCampaignToStorage();
    showToast(`🎯 Queued Limit Buy: $${formatMoney(amt)} of ${getDisplaySymbol(sym)} if price drops ≤ $${targetP.toFixed(2)}`, 'cyan');
    renderAll();
  });

  document.getElementById('btnClearPendingOrders').addEventListener('click', () => {
    state.pendingOrders = [];
    saveCampaignToStorage();
    renderAll();
  });

  document.getElementById('pendingOrdersList').addEventListener('click', (e) => {
    const cancelBtn = e.target.closest('[data-cancelord]');
    if (cancelBtn) {
      const id = cancelBtn.getAttribute('data-cancelord');
      state.pendingOrders = state.pendingOrders.filter(o => o.id !== id);
    saveCampaignToStorage();
      renderAll();
    }
  });

  // Phone / Wide Shell Toggle
  let isWideShell = false;
  document.getElementById('btnToggleShellWidth').addEventListener('click', () => {
    isWideShell = !isWideShell;
    const shell = document.getElementById('appShellContainer');
    const nav = document.getElementById('bottomNavBar');
    shell.classList.toggle('mobile-shell-narrow', !isWideShell);
    shell.classList.toggle('mobile-shell-wide', isWideShell);
    nav.classList.toggle('mobile-shell-narrow', !isWideShell);
    nav.classList.toggle('mobile-shell-wide', isWideShell);
    renderChart();
  });

  // Play / Pause & Step Buttons
  document.getElementById('btnPlayPause').addEventListener('click', togglePlayPause);
  document.getElementById('btnStep1Day').addEventListener('click', () => stepDays(1));
  document.getElementById('btnStep5Days').addEventListener('click', () => stepDays(5));
  document.getElementById('btnStep21Days').addEventListener('click', () => stepDays(21));

  // Speed Slider & Presets
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedValueLabel');
  function updateSpeed(newSpeed) {
    state.speedDaysPerSec = Number(newSpeed);
    saveCampaignToStorage();
    speedSlider.value = state.speedDaysPerSec;
    speedLabel.textContent = state.speedDaysPerSec + 'd/s';
    document.querySelectorAll('.speed-preset-btn').forEach(btn => {
      const s = Number(btn.getAttribute('data-speed'));
      if (s === state.speedDaysPerSec) {
        btn.className = 'speed-preset-btn px-1.5 py-0.5 rounded text-[10px] font-mono-num bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      } else {
        btn.className = 'speed-preset-btn px-1.5 py-0.5 rounded text-[10px] font-mono-num bg-slate-800 text-slate-300';
      }
    });
  }
  speedSlider.addEventListener('input', (e) => updateSpeed(e.target.value));
  document.querySelectorAll('.speed-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => updateSpeed(btn.getAttribute('data-speed')));
  });

  // Auto-Pause Toggle
  document.getElementById('btnAutoPauseToggle').addEventListener('click', () => {
    state.autoPauseOnEvents = !state.autoPauseOnEvents;
    saveCampaignToStorage();
    document.getElementById('autoPauseStateText').textContent = state.autoPauseOnEvents ? 'ON' : 'OFF';
    document.getElementById('autoPauseDot').className = 'w-1.5 h-1.5 rounded-full ' + (state.autoPauseOnEvents ? 'bg-amber-400' : 'bg-slate-500');
  });

  // DRIP Toggle
  document.getElementById('btnToggleDrip').addEventListener('click', () => {
    state.dripEnabled = !state.dripEnabled;
    saveCampaignToStorage();
    document.getElementById('dripStatusLabel').textContent = state.dripEnabled ? 'ON' : 'OFF';
    showToast(`Dividend Reinvestment (DRIP) turned ${state.dripEnabled ? 'ON' : 'OFF'}`, 'emerald');
  });

  // Sound Toggle
  document.getElementById('btnSoundToggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('btnSoundToggle').innerHTML = (soundEnabled ? '🔊' : '🔇') + ' <span id="soundStateText" class="sr-only">SFX</span>';
  });

  // Market Search, Status Filter & Sector Filter Pills
  document.getElementById('marketSearchInput').addEventListener('input', (e) => {
    state.marketSearchQuery = e.target.value || '';
    renderMarketWatchList();
  });

  document.querySelectorAll('.market-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.marketFilter = btn.getAttribute('data-filter');
      document.querySelectorAll('.market-filter-btn').forEach(b => {
        if (b.getAttribute('data-filter') === state.marketFilter) {
          b.className = 'market-filter-btn shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950';
        } else {
          b.className = 'market-filter-btn shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300';
        }
      });
      renderMarketWatchList();
    });
  });

  document.querySelectorAll('.sector-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sectorFilter = btn.getAttribute('data-sector');
      document.querySelectorAll('.sector-filter-btn').forEach(b => {
        if (b.getAttribute('data-sector') === state.sectorFilter) {
          b.className = 'sector-filter-btn shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
        } else {
          b.className = 'sector-filter-btn shrink-0 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400';
        }
      });
      renderMarketWatchList();
    });
  });

  document.getElementById('stockListContainer').addEventListener('click', (e) => {
    const row = e.target.closest('.stock-watch-row');
    if (!row) return;
    const sym = row.getAttribute('data-symbol');
    if (sym) {
      state.selectedSymbol = sym;
      switchScreen('trade');
    }
  });

  // Chart Mode & Timeframes
  const btnModeStock = document.getElementById('btnChartModeStock');
  const btnModePort = document.getElementById('btnChartModePortfolio');
  btnModeStock.addEventListener('click', () => {
    state.chartMode = 'stock';
    btnModeStock.className = 'px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500 text-slate-950';
    btnModePort.className = 'px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white';
    renderChart();
  });
  btnModePort.addEventListener('click', () => {
    state.chartMode = 'portfolio';
    btnModePort.className = 'px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500 text-slate-950';
    btnModeStock.className = 'px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white';
    renderChart();
  });

  document.querySelectorAll('.chart-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.chartTimeframeDays = Number(btn.getAttribute('data-tf'));
      document.querySelectorAll('.chart-tf-btn').forEach(b => {
        if (Number(b.getAttribute('data-tf')) === state.chartTimeframeDays) {
          b.className = 'chart-tf-btn py-1 rounded-lg text-xs font-mono-num bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
        } else {
          b.className = 'chart-tf-btn py-1 rounded-lg text-xs font-mono-num bg-slate-800 text-slate-300';
        }
      });
      renderChart();
    });
  });

  // News vs Order Log Segmented Switcher
  document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === 'positions') {
        switchScreen('portfolio');
        return;
      }
      state.activeBottomTab = tab;
      document.querySelectorAll('.bottom-tab-btn').forEach(b => {
        const bt = b.getAttribute('data-tab');
        if (bt === 'positions') return;
        if (bt === tab) {
          b.className = 'bottom-tab-btn py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950';
        } else {
          b.className = 'bottom-tab-btn py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white';
        }
      });
      document.getElementById('tabPanelNews').classList.toggle('hidden', tab !== 'news');
      document.getElementById('tabPanelTrades').classList.toggle('hidden', tab !== 'trades');
      renderPortfolioAndLogs();
    });
  });

  // Portfolio Holdings Actions
  document.getElementById('positionsTableBody').addEventListener('click', (e) => {
    const quickSellBtn = e.target.closest('[data-quicksell]');
    if (quickSellBtn) {
      const sym = quickSellBtn.getAttribute('data-quicksell');
      executeSellAllForSymbol(sym, 'CLOSED POSITION');
      return;
    }
    const symCell = e.target.closest('.select-pos-row');
    if (symCell) {
      state.selectedSymbol = symCell.getAttribute('data-symbol');
      switchScreen('trade');
    }
  });

  document.getElementById('btnSellAllPositions').addEventListener('click', () => {
    Object.keys(state.positions).forEach(sym => executeSellAllForSymbol(sym, 'LIQUIDATED ALL'));
  });

  // Trading Desk Order Controls (Buy, Sell, Short, Cover)
  const orderInput = document.getElementById('orderDollarInput');
  orderInput.addEventListener('input', updateOrderEstimate);

  document.querySelectorAll('.quick-cash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseFloat(btn.getAttribute('data-cashpct'));
      const { buyingPower } = computePortfolioMetrics();
      const amt = Math.max(1, Math.floor(buyingPower * pct));
      orderInput.value = amt;
      updateOrderEstimate();
    });
  });

  document.getElementById('btnExecuteBuy').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    executeBuy(state.selectedSymbol, amt);
  });

  document.getElementById('btnExecuteSell').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    executeSellDollar(state.selectedSymbol, amt);
  });

  document.getElementById('btnExecuteShort').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    executeShortSell(state.selectedSymbol, amt);
  });

  document.getElementById('btnExecuteCover').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    executeCoverShort(state.selectedSymbol, amt);
  });

  document.getElementById('btnSell25Pct').addEventListener('click', () => {
    const pos = state.positions[state.selectedSymbol];
    if (!pos) return;
    const val = Math.abs(pos.shares) * getStockPrice(state.selectedSymbol) * 0.25;
    executeSellDollar(state.selectedSymbol, val);
  });

  document.getElementById('btnSell50Pct').addEventListener('click', () => {
    const pos = state.positions[state.selectedSymbol];
    if (!pos) return;
    const val = Math.abs(pos.shares) * getStockPrice(state.selectedSymbol) * 0.50;
    executeSellDollar(state.selectedSymbol, val);
  });

  document.getElementById('btnSell100Pct').addEventListener('click', () => {
    executeSellAllForSymbol(state.selectedSymbol, 'CLOSED ENTIRE POS');
  });

  document.getElementById('stopLossSelect').addEventListener('change', (e) => {
    state.stopLossPct = parseFloat(e.target.value) || 0;
    saveCampaignToStorage();
  });
  document.getElementById('takeProfitSelect').addEventListener('change', (e) => {
    state.takeProfitPct = parseFloat(e.target.value) || 0;
    saveCampaignToStorage();
  });

  // Custom Leaderboard Actions
  document.getElementById('leaderboardNameInput').addEventListener('input', renderLeaderboard);
  document.getElementById('leaderboardAvatarSelect').addEventListener('change', renderLeaderboard);

  document.getElementById('btnSaveRunToLeaderboard').addEventListener('click', () => {
    const name = document.getElementById('leaderboardNameInput').value.trim() || 'Wall St Player';
    const avatar = document.getElementById('leaderboardAvatarSelect').value || '🦅';
    const strat = document.getElementById('leaderboardStrategySelect').value;
    const { netWorth } = computePortfolioMetrics();
    const retPct = ((netWorth - state.startingCash) / state.startingCash) * 100;
    const dateStr = TRADING_DATES[state.dayIdx].pretty;

    state.customLeaderboard.unshift({
      id: 'run-' + Date.now(),
      name,
      avatar,
      strategy: `${strat} • ${dateStr}`,
      netWorth,
      returnPct: retPct,
      dateStr,
      isCustom: true
    });
    saveCustomLeaderboard(state.customLeaderboard);
    sfxBuy();
    showToast(`Saved ${name} ($${formatMoney(netWorth)}) to Leaderboard!`, 'emerald');
    renderLeaderboard();
  });

  document.querySelectorAll('.lb-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.leaderboardFilter = btn.getAttribute('data-lbfilter');
      document.querySelectorAll('.lb-filter-btn').forEach(b => {
        if (b.getAttribute('data-lbfilter') === state.leaderboardFilter) {
          b.className = 'lb-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950';
        } else {
          b.className = 'lb-filter-btn px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300';
        }
      });
      renderLeaderboard();
    });
  });

  document.getElementById('btnClearCustomLeaderboard').addEventListener('click', () => {
    state.customLeaderboard = [];
    saveCustomLeaderboard([]);
    showToast('Cleared saved custom leaderboard entries.', 'amber');
    renderLeaderboard();
  });

  // Custom Rival Modal
  const rivalModal = document.getElementById('customRivalModal');
  document.getElementById('btnOpenCustomRivalModal').addEventListener('click', () => openModal(rivalModal));
  document.getElementById('btnCloseCustomRivalModal').addEventListener('click', () => closeModal(rivalModal));
  document.getElementById('btnCancelCustomRivalModal').addEventListener('click', () => closeModal(rivalModal));
  document.getElementById('btnSaveCustomRival').addEventListener('click', () => {
    const rName = document.getElementById('rivalNameInput').value.trim() || 'Custom Rival';
    const rNw = Math.max(100, parseFloat(document.getElementById('rivalNetWorthInput').value) || 100000);
    const rStrat = document.getElementById('rivalStrategyInput').value.trim() || 'Custom Challenger';
    const rRet = ((rNw - state.startingCash) / state.startingCash) * 100;

    state.customLeaderboard.unshift({
      id: 'rival-' + Date.now(),
      name: rName,
      avatar: '🦊',
      strategy: rStrat,
      netWorth: rNw,
      returnPct: rRet,
      isCustom: true
    });
    saveCustomLeaderboard(state.customLeaderboard);
    closeModal(rivalModal);
    sfxBuy();
    showToast(`Added rival ${rName} ($${formatMoney(rNw)}) to Leaderboard!`, 'cyan');
    renderLeaderboard();
  });

  // Perks & Achievements Modal
  const perksModal = document.getElementById('perksModal');
  document.getElementById('btnOpenPerksModal').addEventListener('click', () => {
    pauseSimulation();
    renderAchievementsModal();
    openModal(perksModal);
  });
  document.getElementById('btnClosePerksModal').addEventListener('click', () => closeModal(perksModal));
  document.getElementById('btnDonePerksModal').addEventListener('click', () => closeModal(perksModal));

  // Era Modal
  const eraModal = document.getElementById('eraModal');
  document.getElementById('btnOpenEraModal').addEventListener('click', () => {
    pauseSimulation();
    openModal(eraModal);
  });
  document.getElementById('btnCloseEraModal').addEventListener('click', () => closeModal(eraModal));
  document.getElementById('btnCancelEraModal').addEventListener('click', () => closeModal(eraModal));
  document.querySelectorAll('.era-jump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDay = Number(btn.getAttribute('data-eraday'));
      closeModal(eraModal);
      jumpToEraDay(targetDay);
    });
  });

  // Reset Modal
  const resetModal = document.getElementById('resetModal');
  document.getElementById('btnOpenResetModal').addEventListener('click', () => {
    pauseSimulation();
    openModal(resetModal);
  });
  document.getElementById('btnCloseResetModal').addEventListener('click', () => closeModal(resetModal));
  document.getElementById('btnCancelResetModal').addEventListener('click', () => closeModal(resetModal));
  document.querySelectorAll('.start-cash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cash = Number(btn.getAttribute('data-startcash'));
      closeModal(resetModal);
      initGameState(cash);
      saveCampaignToStorage();
      showToast(`New campaign started on Jan 2, 1980 with $${formatMoney(cash)}!`, 'emerald');
    });
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (hasOpenModal() || e.defaultPrevented || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepDays(e.shiftKey ? 5 : 1);
    }
  });

  const chartCanvas = document.getElementById('mainChartCanvas');
  const chartTooltip = document.getElementById('chartHoverTooltip');
  function handleChartPointer(e) {
    const rect = chartCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left - 10) / Math.max(1, rect.width - 68)));
    const d = state.dayIdx;
    const asset = ASSET_MAP[state.selectedSymbol];
    if (state.chartMode === 'stock' && d < asset.ipoIdx) {
      chartTooltip.classList.add('hidden');
      return;
    }
    const endDay = state.chartMode === 'stock' && asset.delistIdx !== null ? Math.min(d, asset.delistIdx) : d;
    const minStart = state.chartMode === 'stock' ? asset.ipoIdx : state.runStartDayIdx;
    const startDay = Math.max(minStart, endDay - state.chartTimeframeDays);
    const hoverDay = Math.round(startDay + relX * (endDay - startDay));
    const dateStr = TRADING_DATES[hoverDay]?.pretty || '';
    if (state.chartMode === 'stock') {
      const p = asset.prices[hoverDay] || 0;
      chartTooltip.textContent = `${dateStr} • ${getDisplaySymbol(state.selectedSymbol)}: $${p.toFixed(2)}`;
    } else {
      const nw = state.netWorthHistory[hoverDay];
      chartTooltip.textContent = `${dateStr} • NW: ${Number.isFinite(nw) ? '$' + formatMoney(nw) : 'History unavailable'}`;
    }
    chartTooltip.classList.remove('hidden');
  }
  chartCanvas.addEventListener('mousemove', handleChartPointer);
  chartCanvas.addEventListener('touchmove', handleChartPointer, { passive: true });
  chartCanvas.addEventListener('mouseleave', () => chartTooltip.classList.add('hidden'));
  chartCanvas.addEventListener('touchend', () => chartTooltip.classList.add('hidden'));

  window.addEventListener('resize', () => {
    if (state.activeScreen === 'trade') renderChart();
  });

  // 30D 5x Call & Put Options Desk Buttons
  document.getElementById('btnBuyCallOption').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    buyOptionContract(state.selectedSymbol, 'CALL', amt);
  });
  document.getElementById('btnBuyPutOption').addEventListener('click', () => {
    const amt = parseFloat(orderInput.value) || 0;
    buyOptionContract(state.selectedSymbol, 'PUT', amt);
  });
  document.getElementById('activeOptionsList').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-closeopt]');
    if (closeBtn) {
      const id = closeBtn.getAttribute('data-closeopt');
      const idx = state.optionsPositions.findIndex(o => o.id === id);
      if (idx !== -1) {
        const [opt] = state.optionsPositions.splice(idx, 1);
        settleOptionContract(opt, 'EARLY CASH-OUT', false);
      }
    }
  });

  // Tycoon Lifestyle Shop Click Delegation
  document.getElementById('lifestyleShopContainer').addEventListener('click', (e) => {
    const buyBtn = e.target.closest('[data-buylife]');
    if (buyBtn) {
      buyLifestyleUpgrade(buyBtn.getAttribute('data-buylife'));
    }
  });

  // Import Friend's Shareable Challenge Code in Custom Rival Modal
  document.getElementById('btnImportChallengeCode').addEventListener('click', () => {
    const rawCode = (document.getElementById('importChallengeCodeInput').value || '').trim();
    if (!rawCode.startsWith('WSTM-')) {
      showToast('Invalid Challenge Code! Must start with WSTM-...', 'rose');
      return;
    }
    try {
      if (rawCode.length > 4096) throw new Error('Challenge code too long');
      const b64 = rawCode.slice(5);
      const decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)
        || typeof decoded.n !== 'string' || !decoded.n.trim() || decoded.n.length > 100
        || typeof decoded.nw !== 'number' || !Number.isFinite(decoded.nw) || decoded.nw < 0
        || typeof decoded.r !== 'number' || !Number.isFinite(decoded.r)
        || typeof decoded.g !== 'string' || !['F', 'D', 'C', 'B', 'A', 'S', 'S+'].includes(decoded.g)
        || typeof decoded.d !== 'string' || !Object.prototype.hasOwnProperty.call(DATE_TO_INDEX, decoded.d)) {
        throw new Error('Invalid challenge payload');
      }
      const rName = decoded.n.trim();
      const rNw = decoded.nw;
      const rRet = decoded.r;
      const rStrat = `Imported Code (Grade ${decoded.g}) • ${decoded.d}`;
      state.customLeaderboard.unshift({
        id: 'import-' + Date.now(),
        name: rName,
        avatar: '🏆',
        strategy: rStrat,
        netWorth: rNw,
        returnPct: rRet,
        isCustom: true
      });
      saveCustomLeaderboard(state.customLeaderboard);
      closeModal(document.getElementById('customRivalModal'));
      sfxBuy();
      showToast(`🏆 Imported Challenger ${rName} ($${formatMoney(rNw)}) to Ranks!`, 'emerald');
      renderLeaderboard();
    } catch (err) {
      showToast('Could not parse Challenge Code. Check the pasted string.', 'rose');
    }
  });

  // Populate Daily 5-Year Blitz & 6 Scenario Missions inside Era Modal
  const dailyBlitz = getDailyBlitzScenario();
  document.getElementById('dailyBlitzTitle').textContent = dailyBlitz.title;
  document.getElementById('dailyBlitzDesc').textContent = dailyBlitz.desc;
  document.getElementById('btnStartDailyBlitz').addEventListener('click', () => {
    closeModal(eraModal);
    initGameState(dailyBlitz.startCash, dailyBlitz);
    saveCampaignToStorage();
    sfxBuy();
    showToast(`🔥 Started ${dailyBlitz.title}! Goal: $${formatMoney(dailyBlitz.targetNw)}`, 'emerald');
  });

  const scenListEl = document.getElementById('scenarioListContainer');
  if (scenListEl) {
    setMarkup(scenListEl, SCENARIO_MISSIONS.map(sc => `
      <button type="button" data-scenid="${sc.id}" class="scenario-start-btn text-left p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-cyan-500/30 flex items-center justify-between gap-2">
        <div>
          <div class="text-xs font-bold text-cyan-300">${sc.title}</div>
          <div class="text-[11px] text-slate-400">${sc.desc}</div>
        </div>
        <span class="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-extrabold shrink-0">Goal $${formatMoney(sc.targetNw)}</span>
      </button>
    `).join(''));
    scenListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scenid]');
      if (!btn) return;
      const sc = SCENARIO_MISSIONS.find(s => s.id === btn.getAttribute('data-scenid'));
      if (sc) {
        closeModal(eraModal);
        initGameState(sc.startCash, sc);
        saveCampaignToStorage();
        sfxBuy();
        showToast(`🎯 Mission Started: ${sc.title}!`, 'emerald');
      }
    });
  }

  document.getElementById('btnExitScenarioMode').addEventListener('click', () => {
    state.activeScenario = null;
    state.scenarioCompleted = false;
    saveCampaignToStorage();
    showToast('Exited Scenario goal mode — continuing in Sandbox campaign.', 'cyan');
    renderAll();
  });

  // Interactive Tutorials, Feature Gallery & Hot-Tips Modal Controls
  const tutorialModal = document.getElementById('tutorialModal');
  function openTutorialCenter(defaultTab = 'features') {
    pauseSimulation();
    renderTutorialAndHotTipsModal();
    switchTutorialTab(defaultTab);
    openModal(tutorialModal);
  }
  function switchTutorialTab(tabName) {
    document.getElementById('tutPanelFeatures').classList.toggle('hidden', tabName !== 'features');
    document.getElementById('tutPanelHotTips').classList.toggle('hidden', tabName !== 'hottips');
    document.getElementById('tutPanelWalkthrough').classList.toggle('hidden', tabName !== 'walkthrough');
    document.querySelectorAll('.tut-tab-btn').forEach(b => {
      if (b.getAttribute('data-tuttab') === tabName) {
        b.className = 'tut-tab-btn py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 text-slate-950';
      } else {
        b.className = 'tut-tab-btn py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white';
      }
    });
  }
  document.getElementById('btnOpenTutorialModal').addEventListener('click', () => openTutorialCenter('features'));
  document.getElementById('btnOpenGuideFromBanner').addEventListener('click', () => openTutorialCenter('features'));
  document.getElementById('btnCloseTutorialModal').addEventListener('click', () => closeModal(tutorialModal));
  document.getElementById('btnDoneTutorialModal').addEventListener('click', () => closeModal(tutorialModal));

  document.getElementById('btnCycleHotTip').addEventListener('click', () => {
    currentBannerTipIdx++;
    updateContextualHotTipBanner();
  });

  document.querySelectorAll('.tut-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTutorialTab(btn.getAttribute('data-tuttab')));
  });

  document.querySelectorAll('.tip-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTipCategory = btn.getAttribute('data-tipcat');
      document.querySelectorAll('.tip-cat-btn').forEach(b => {
        if (b.getAttribute('data-tipcat') === activeTipCategory) {
          b.className = 'tip-cat-btn px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-400 text-slate-950 shrink-0';
        } else {
          b.className = 'tip-cat-btn px-2 py-1 rounded-lg text-[10px] bg-slate-800 text-slate-300 shrink-0';
        }
      });
      renderTutorialAndHotTipsModal();
    });
  });

  document.getElementById('tutPanelFeatures').addEventListener('click', (e) => {
    const spotBtn = e.target.closest('[data-spotlight]');
    if (!spotBtn) return;
    const item = FEATURE_TOUR_ITEMS.find(f => f.id === spotBtn.getAttribute('data-spotlight'));
    if (item) {
      spotlightFeatureTarget(item.screen, item.spotlightId, { openDetails: item.openDetails, label: item.title });
    }
  });

  document.getElementById('walkthroughStepsContainer').addEventListener('click', (e) => {
    const stepBtn = e.target.closest('[data-walkstep]');
    if (!stepBtn) return;
    const w = WALKTHROUGH_STEPS.find(s => s.step === Number(stepBtn.getAttribute('data-walkstep')));
    if (w) {
      spotlightFeatureTarget(w.screen, w.spotlightId, { openDetails: w.openDetails, selectSym: w.selectSym, label: w.title });
    }
  });

  window.addEventListener('pagehide', saveCampaignToStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCampaignToStorage();
  });

  // Initialize or Auto-Resume Saved Campaign from localStorage
  initGameState(10000);
  if (loadCampaignFromStorage()) {
    renderAll();
    showToast(`💾 Resumed saved campaign on ${TRADING_DATES[state.dayIdx].pretty}`, 'cyan');
  }
});
