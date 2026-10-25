function createTradingEngine(dependencies) {
  const { state, ASSET_MAP, TOTAL_DAYS, TRADING_DATES, EVENT_BY_DAY, DILEMMA_BY_DAY, LIFESTYLE_UPGRADES } = dependencies;
  const { getFedRateAtDay = () => {}, pauseSimulation = () => {}, openDilemmaModal = () => {}, openCareerWrapUpModal = () => {}, getDisplaySymbol = () => {}, unlockAchievement = () => {}, recordTradeStats = () => {}, sfxBuy = () => {}, sfxSell = () => {}, sfxAlert = () => {}, showToast = () => {}, triggerHaptic = () => {}, spawnFloatingPnL = () => {}, formatMoney = () => {}, renderAll = () => {}, saveCampaignToStorage = () => {}, scheduleCampaignSave = () => {} } = dependencies;
  function getStockPrice(symbol, dayIdx = state.dayIdx) {
    const asset = ASSET_MAP[symbol];
    if (!asset) return 0;
    if (dayIdx < asset.ipoIdx) return 0;
    if (asset.delistIdx !== null && dayIdx >= asset.delistIdx) return 0;
    return asset.prices[dayIdx];
  }

  function isStockTradable(symbol, dayIdx = state.dayIdx) {
    const asset = ASSET_MAP[symbol];
    if (!asset) return false;
    if (dayIdx < asset.ipoIdx) return false;
    if (asset.delistIdx !== null && dayIdx >= asset.delistIdx) return false;
    return asset.prices[dayIdx] > 0.001;
  }

  // Compute Net Worth, Long/Short Equity, Unrealized P&L, and Buying Power
  function computePortfolioMetrics(dayIdx = state.dayIdx, portfolio = state) {
    let netPositionValue = 0;
    let grossExposure = 0;
    let unrealizedPnL = 0;
    let posCount = 0;

    for (const sym of Object.keys(portfolio.positions)) {
      const pos = portfolio.positions[sym];
      if (!pos || Math.abs(pos.shares) <= 1e-6) continue;
      const mark = getStockPrice(sym, dayIdx);
      posCount++;
      if (pos.shares > 0) {
        // Long position
        const mktVal = pos.shares * mark;
        netPositionValue += mktVal;
        grossExposure += mktVal;
        unrealizedPnL += (mktVal - pos.totalCost);
      } else {
        // Short position: pos.shares < 0, pos.totalCost is initial short proceeds locked as collateral
        const absShares = Math.abs(pos.shares);
        const buybackLiability = absShares * mark;
        const shortPnL = pos.totalCost - buybackLiability;
        const shortEquity = pos.totalCost + shortPnL; // Collateral + PnL
        netPositionValue += shortEquity;
        grossExposure += buybackLiability;
        unrealizedPnL += shortPnL;
      }
    }

    // Include open 30D 5x Call/Put Options mark-to-market value
    for (const opt of portfolio.optionsPositions) {
      const mark = getStockPrice(opt.symbol, dayIdx);
      const rawPct = opt.strikePrice > 0 ? (mark - opt.strikePrice) / opt.strikePrice : 0;
      const signedPct = opt.optType === 'CALL' ? rawPct : -rawPct;
      const optVal = Math.max(0, opt.premium * (1 + 5 * signedPct));
      netPositionValue += optVal;
      grossExposure += optVal;
      unrealizedPnL += (optVal - opt.premium);
    }

    const netWorth = Math.max(0, portfolio.cash + netPositionValue);
    if (netWorth > portfolio.peakNetWorth) portfolio.peakNetWorth = netWorth;
    if (portfolio.peakNetWorth > 0) {
      const dd = ((portfolio.peakNetWorth - netWorth) / portfolio.peakNetWorth) * 100;
      if (dd > portfolio.maxDrawdownPct) portfolio.maxDrawdownPct = dd;
    }
    const marginAllowance = netWorth * (portfolio.maxLeverage - 1);
    const buyingPower = Math.max(0, portfolio.cash + marginAllowance);

    return { netWorth, equityValue: grossExposure, unrealizedPnL, posCount, buyingPower };
  }

  function checkMilestoneAchievements(netWorth, d) {
    if (netWorth >= 100000) unlockAchievement('ach_100k');
    if (netWorth >= 1000000) unlockAchievement('ach_1m');
    if (netWorth >= 10000000) unlockAchievement('ach_10m');
    if (netWorth >= 100000000) unlockAchievement('ach_100m');
    if (state.totalDividendsEarned >= 1000) unlockAchievement('ach_div_collector');
    if (d >= 2018) unlockAchievement('ach_survive_87');
    if (TRADING_DATES[d].year >= 2020) unlockAchievement('ach_modern_era');
  }

  function isScenarioComplete() {
    return !!state.activeScenario && (state.scenarioCompleted || state.dayIdx >= state.activeScenario.endDayIdx);
  }

  function processSingleTradingDayStep() {
    if (isScenarioComplete()) {
      state.scenarioCompleted = true;
      pauseSimulation();
      return false;
    }
    if (state.dayIdx >= TOTAL_DAYS - 1) {
      pauseSimulation();
      return false;
    }

    state.dayIdx++;
    const d = state.dayIdx;
    const dateObj = TRADING_DATES[d];

    // 1. Daily Money Market Interest (with Prestige & Lifestyle APY buffs) OR Margin Interest Charge
    const fedRatePct = getFedRateAtDay(d);
    const primeBonus = (state.netWorthHistory[d - 1] >= 25000 ? 0.50 : 0.0)
      + (state.prestigeLevel || 0) * 0.50
      + (state.ownedLifestyle.up_rolex ? 0.25 : 0.0)
      + (state.ownedLifestyle.up_jet ? 1.00 : 0.0);
    if (state.cash > 0.01) {
      const dailyInterest = state.cash * ((fedRatePct + primeBonus) / 100) / 252;
      state.cash += dailyInterest;
      state.totalInterestEarned += dailyInterest;
    } else if (state.cash < -0.01) {
      const loanSpread = state.ownedLifestyle.up_quant ? 0.75 : 1.5;
      const dailyMarginCost = Math.abs(state.cash) * ((fedRatePct + loanSpread) / 100) / 252;
      state.cash -= dailyMarginCost;
      state.totalInterestEarned -= dailyMarginCost;
    }

    // 1B. Settle Expiring or Bankrupt 30D 5x Call/Put Options
    if (state.optionsPositions.length > 0) {
      const activeOpts = [];
      for (const opt of state.optionsPositions) {
        const asset = ASSET_MAP[opt.symbol];
        const isBankruptToday = asset.delistIdx !== null && d >= asset.delistIdx;
        if (d >= opt.expiryDayIdx || isBankruptToday) {
          settleOptionContract(opt, isBankruptToday ? 'BANKRUPTCY EXPIRY' : '30D EXPIRY', true);
        } else {
          activeOpts.push(opt);
        }
      }
      state.optionsPositions = activeOpts;
    }

    // 2. Process Queued Pre-IPO Syndicate & Dip Limit Orders
    if (state.pendingOrders.length > 0) {
      const remainingOrders = [];
      for (const ord of state.pendingOrders) {
        const asset = ASSET_MAP[ord.symbol];
        if (!asset || (asset.delistIdx !== null && d >= asset.delistIdx)) {
          continue; // Drop expired order for delisted asset
        }
        if (ord.type === 'PRE_IPO') {
          if (d >= asset.ipoIdx && isStockTradable(ord.symbol, d)) {
            const filled = executeBuy(ord.symbol, ord.dollarAmount, 'PRE-IPO SYNDICATE FILL', true);
            if (filled) unlockAchievement('ach_ipo_hunter');
          } else {
            remainingOrders.push(ord);
          }
        } else if (ord.type === 'LIMIT_BUY') {
          if (isStockTradable(ord.symbol, d)) {
            const curP = getStockPrice(ord.symbol, d);
            if (curP <= ord.limitPrice) {
              executeBuy(ord.symbol, ord.dollarAmount, `LIMIT FILL @ $${curP.toFixed(2)}`, true);
            } else {
              remainingOrders.push(ord);
            }
          } else {
            remainingOrders.push(ord);
          }
        }
      }
      state.pendingOrders = remainingOrders;
    }

    // 3. Process Open Positions (Bankruptcies, Dividends, Short Squeeze Margin Call, Stop-Loss / Take-Profit)
    for (const sym of Object.keys(state.positions)) {
      const pos = state.positions[sym];
      if (!pos || Math.abs(pos.shares) <= 1e-6) continue;
      const asset = ASSET_MAP[sym];

      // Bankruptcy / Delisting check
      if (asset.delistIdx !== null && d === asset.delistIdx) {
        if (pos.shares > 0) {
          const lostCost = pos.totalCost;
          state.realizedPnL -= lostCost;
          recordTradeStats(sym, -lostCost, 'SELL', 0);
          state.tradeHistory.unshift({
            dayIdx: d,
            dateStr: dateObj.pretty,
            type: 'BANKRUPT',
            symbol: sym,
            shares: pos.shares,
            price: 0,
            amount: -lostCost,
            note: `${asset.name} filed Chapter 11 bankruptcy. Long wiped out.`
          });
          delete state.positions[sym];
          sfxAlert();
          showToast(`BANKRUPTCY WIPEOUT: ${sym} delisted at $0.00! (-$${formatMoney(lostCost)})`, 'rose');
        } else {
          const shortGain = pos.totalCost;
          state.cash += pos.totalCost * 2;
          state.realizedPnL += shortGain;
          recordTradeStats(sym, shortGain, 'BUY', 0);
          state.tradeHistory.unshift({
            dayIdx: d,
            dateStr: dateObj.pretty,
            type: 'SHORT WIN',
            symbol: sym,
            shares: Math.abs(pos.shares),
            price: 0,
            amount: shortGain,
            note: `${asset.name} went bankrupt at $0.00! Short locked in +100% gain!`
          });
          delete state.positions[sym];
          unlockAchievement('ach_short_profit');
          sfxBuy();
          showToast(`🐻 BIG SHORT PAYDAY: ${sym} went bankrupt at $0.00! +$${formatMoney(shortGain)} profit!`, 'emerald');
        }
        if (state.autoPauseOnEvents) pauseSimulation();
        continue;
      }

      const price = getStockPrice(sym, d);
      if (price <= 0) continue;

      // Quarterly Dividends (Long receives +10% if Penthouse owned; Short pays -25% less if Countach owned)
      if (d % 63 === 0 && asset.divYield > 0) {
        const baseDiv = Math.abs(pos.shares) * price * (asset.divYield / 4);
        if (baseDiv >= 0.01) {
          if (pos.shares > 0) {
            const quarterlyDiv = baseDiv * (state.ownedLifestyle.up_penthouse ? 1.10 : 1.0);
            state.totalDividendsEarned += quarterlyDiv;
            if (state.dripEnabled) {
              const addShares = quarterlyDiv / price;
              pos.shares += addShares;
              pos.totalCost += quarterlyDiv;
              pos.avgCost = pos.totalCost / pos.shares;
            } else {
              state.cash += quarterlyDiv;
            }
          } else {
            const shortDrag = baseDiv * (state.ownedLifestyle.up_countach ? 0.75 : 1.0);
            state.cash -= shortDrag;
          }
        }
      }

      // Short Squeeze Maintenance Margin Check (Auto-cover if short loses >= 90% of collateral)
      if (pos.shares < 0) {
        const buybackLiability = Math.abs(pos.shares) * price;
        if (buybackLiability >= pos.totalCost * 1.90) {
          executeSellAllForSymbol(sym, 'MARGIN CALL (SHORT SQUEEZE)', true);
          continue;
        }
      }

      // Auto Stop-Loss / Take-Profit
      const gainRatio = pos.shares > 0
        ? (price - pos.avgCost) / pos.avgCost
        : (pos.avgCost - price) / pos.avgCost;

      if (state.stopLossPct > 0 && gainRatio <= -state.stopLossPct) {
        executeSellAllForSymbol(sym, 'STOP-LOSS TRIGGERED', true);
      } else if (state.takeProfitPct > 0 && gainRatio >= state.takeProfitPct) {
        executeSellAllForSymbol(sym, 'TAKE-PROFIT TRIGGERED', true);
      }
    }

    // 4. Prime Broker Account-Level Margin Call & Negative Cash Guard
    let metrics = computePortfolioMetrics(d);
    if (state.cash < -1) {
      if (metrics.posCount > 0 && metrics.netWorth <= Math.abs(state.cash) * 0.20) {
        Object.keys(state.positions).forEach(sym => executeSellAllForSymbol(sym, 'MARGIN CALL LIQUIDATION', true));
        metrics = computePortfolioMetrics(d);
      }
      if (metrics.posCount === 0 && state.cash < 0) {
        // Reset wiped-out margin debt and grant a $500 prop-desk bailout so player is never soft-locked
        state.cash = 500;
        sfxAlert();
        showToast('🚨 MARGIN WIPEOUT: Broker liquidated debt & issued $500 Prop Desk Bailout!', 'rose');
        metrics = computePortfolioMetrics(d);
      }
    }

    // 5. Record Net Worth & Check Achievements
    state.netWorthHistory[d] = metrics.netWorth;
    checkMilestoneAchievements(metrics.netWorth, d);

    // 6. Historical News Events & Interactive Dilemmas
    const ev = EVENT_BY_DAY[d];
    if (ev) {
      state.triggeredEvents.unshift(ev);
      if (ev.pause && state.autoPauseOnEvents) {
        pauseSimulation();
        sfxAlert();
        showToast(`${dateObj.pretty}: ${ev.headline}`, ev.type === 'IPO' ? 'emerald' : 'amber');
      }
    }

    const dilemma = DILEMMA_BY_DAY[d];
    if (dilemma && state.enableDilemmas && state.autoPauseOnEvents && !state.triggeredDilemmas[dilemma.id]) {
      state.triggeredDilemmas[dilemma.id] = true;
      pauseSimulation();
      openDilemmaModal(dilemma);
    }

    // 7. Scenario / Daily Blitz End Check or 2026 End-of-Run Career Wrap-Up
    if (state.activeScenario && d >= state.activeScenario.endDayIdx) {
      state.scenarioCompleted = true;
      pauseSimulation();
      const won = metrics.netWorth >= state.activeScenario.targetNw;
      showToast(won ? `🏆 SCENARIO COMPLETE! You beat ${state.activeScenario.title}!` : `⏱️ Scenario Ended: Reached $${formatMoney(metrics.netWorth)}`, won ? 'emerald' : 'amber');
      openCareerWrapUpModal();
    } else if (d >= TOTAL_DAYS - 1) {
      pauseSimulation();
      openCareerWrapUpModal();
    }

    if (isScenarioComplete() || d === TOTAL_DAYS - 1) saveCampaignToStorage();
    else scheduleCampaignSave();
    return !isScenarioComplete() && d < TOTAL_DAYS - 1;
  }

  // =========================================================================
  // 7. ORDER EXECUTION (LONG BUY/SELL + SHORT SELL/COVER + QUEUED ORDERS)
  // =========================================================================
  function executeBuy(symbol, dollarAmount, customNote = null, skipRender = false) {
    if (!isStockTradable(symbol)) {
      if (!skipRender) showToast(`${getDisplaySymbol(symbol)} is not actively trading on ${TRADING_DATES[state.dayIdx].pretty}.`, 'amber');
      return false;
    }
    const existing = state.positions[symbol];
    if (existing && existing.shares < -1e-6) {
      return executeCoverShort(symbol, dollarAmount, skipRender);
    }

    const { buyingPower } = computePortfolioMetrics();
    const spend = Math.min(dollarAmount, buyingPower);
    if (spend < 1) {
      if (!skipRender) showToast('Insufficient buying power! Sell positions or raise Margin Leverage (1.5x / 2x).', 'rose');
      return false;
    }
    const price = getStockPrice(symbol);
    const sharesBought = spend / price;
    state.cash -= spend;

    if (!state.positions[symbol]) {
      state.positions[symbol] = { shares: 0, avgCost: 0, totalCost: 0 };
    }
    const pos = state.positions[symbol];
    pos.shares += sharesBought;
    pos.totalCost += spend;
    pos.avgCost = pos.totalCost / pos.shares;

    unlockAchievement('ach_first_trade');
    recordTradeStats(symbol, 0, 'BUY', price);

    state.tradeHistory.unshift({
      dayIdx: state.dayIdx,
      dateStr: TRADING_DATES[state.dayIdx].pretty,
      type: 'BUY',
      symbol,
      shares: sharesBought,
      price,
      amount: spend,
      note: customNote || `Bought ${sharesBought.toFixed(3)} sh @ $${price.toFixed(2)}`
    });

    const { netWorth } = computePortfolioMetrics();
    state.netWorthHistory[state.dayIdx] = netWorth;
    sfxBuy();
    if (!skipRender) {
      triggerHaptic(12);
      saveCampaignToStorage();
      showToast(`${customNote || 'Bought'} $${formatMoney(spend)} of ${getDisplaySymbol(symbol)} @ $${price.toFixed(2)}`, 'emerald');
      renderAll();
    }
    return true;
  }

  function executeShortSell(symbol, dollarAmount, skipRender = false) {
    if (!isStockTradable(symbol)) {
      if (!skipRender) showToast(`${getDisplaySymbol(symbol)} is not actively trading on ${TRADING_DATES[state.dayIdx].pretty}.`, 'amber');
      return false;
    }
    const existing = state.positions[symbol];
    if (existing && existing.shares > 1e-6) {
      if (!skipRender) showToast(`Sell your Long ${getDisplaySymbol(symbol)} shares first before opening a Short position.`, 'amber');
      return false;
    }

    const { buyingPower } = computePortfolioMetrics();
    const collateral = Math.min(dollarAmount, buyingPower);
    if (collateral < 1) {
      if (!skipRender) showToast('Insufficient buying power to post Short collateral.', 'rose');
      return false;
    }
    const price = getStockPrice(symbol);
    const sharesShorted = collateral / price;
    state.cash -= collateral;

    if (!state.positions[symbol]) {
      state.positions[symbol] = { shares: 0, avgCost: 0, totalCost: 0 };
    }
    const pos = state.positions[symbol];
    pos.shares -= sharesShorted;
    pos.totalCost += collateral;
    pos.avgCost = pos.totalCost / Math.abs(pos.shares);

    unlockAchievement('ach_first_trade');
    recordTradeStats(symbol, 0, 'SHORT', price);

    state.tradeHistory.unshift({
      dayIdx: state.dayIdx,
      dateStr: TRADING_DATES[state.dayIdx].pretty,
      type: 'SHORT',
      symbol,
      shares: sharesShorted,
      price,
      amount: collateral,
      note: `Shorted ${sharesShorted.toFixed(3)} sh @ $${price.toFixed(2)}`
    });

    const { netWorth } = computePortfolioMetrics();
    state.netWorthHistory[state.dayIdx] = netWorth;
    sfxSell();
    if (!skipRender) {
      triggerHaptic(15);
      saveCampaignToStorage();
      showToast(`📉 Shorted $${formatMoney(collateral)} of ${getDisplaySymbol(symbol)} @ $${price.toFixed(2)}`, 'cyan');
      renderAll();
    }
    return true;
  }

  function executeCoverShort(symbol, dollarAmount, skipRender = false) {
    const pos = state.positions[symbol];
    if (!pos || pos.shares >= -1e-6) {
      if (!skipRender) showToast(`You don't have an open Short position in ${getDisplaySymbol(symbol)}.`, 'amber');
      return false;
    }
    const price = getStockPrice(symbol);
    const absShares = Math.abs(pos.shares);
    const currentBuybackCost = absShares * price;
    if (!dollarAmount || dollarAmount >= currentBuybackCost * 0.995) {
      executeSellAllForSymbol(symbol, 'COVERED SHORT', skipRender);
      return true;
    }
    const fraction = Math.min(1, dollarAmount / currentBuybackCost);
    const sharesToCover = absShares * fraction;
    const collateralReleased = pos.totalCost * fraction;
    const buybackCost = sharesToCover * price;
    const shortPnL = collateralReleased - buybackCost;
    const cashDelta = collateralReleased + shortPnL;

    pos.shares += sharesToCover;
    pos.totalCost -= collateralReleased;
    state.cash += cashDelta;
    state.realizedPnL += shortPnL;
    if (shortPnL > 0) unlockAchievement('ach_short_profit');
    recordTradeStats(symbol, shortPnL, 'BUY', price);

    state.tradeHistory.unshift({
      dayIdx: state.dayIdx,
      dateStr: TRADING_DATES[state.dayIdx].pretty,
      type: 'COVER',
      symbol,
      shares: sharesToCover,
      price,
      amount: Math.max(0, cashDelta),
      note: `Covered ${sharesToCover.toFixed(2)} sh: ${shortPnL >= 0 ? '+' : '-'}$${formatMoney(Math.abs(shortPnL))}`
    });

    const { netWorth } = computePortfolioMetrics();
    state.netWorthHistory[state.dayIdx] = netWorth;
    sfxBuy();
    if (!skipRender) {
      triggerHaptic(14);
      spawnFloatingPnL(shortPnL, getDisplaySymbol(symbol));
      saveCampaignToStorage();
      showToast(`Covered $${formatMoney(buybackCost)} of ${getDisplaySymbol(symbol)} Short (${shortPnL >= 0 ? '+' : '-'}$${formatMoney(Math.abs(shortPnL))})`, shortPnL >= 0 ? 'emerald' : 'rose');
      renderAll();
    }
    return true;
  }

  function executeSellDollar(symbol, dollarAmount, skipRender = false) {
    const pos = state.positions[symbol];
    if (!pos || Math.abs(pos.shares) <= 1e-6) {
      if (!skipRender) showToast(`You don't hold an open position in ${getDisplaySymbol(symbol)}.`, 'amber');
      return false;
    }
    if (pos.shares < 0) {
      return executeCoverShort(symbol, dollarAmount, skipRender);
    }
    const price = getStockPrice(symbol);
    const currentVal = pos.shares * price;
    if (dollarAmount >= currentVal * 0.995) {
      executeSellAllForSymbol(symbol, 'MARKET SELL', skipRender);
      return true;
    }
    const fraction = dollarAmount / currentVal;
    const sharesToSell = pos.shares * fraction;
    const costBasisSold = pos.totalCost * fraction;
    const proceeds = sharesToSell * price;
    const realized = proceeds - costBasisSold;

    pos.shares -= sharesToSell;
    pos.totalCost -= costBasisSold;
    state.cash += proceeds;
    state.realizedPnL += realized;
    recordTradeStats(symbol, realized, 'SELL', price);

    state.tradeHistory.unshift({
      dayIdx: state.dayIdx,
      dateStr: TRADING_DATES[state.dayIdx].pretty,
      type: 'SELL',
      symbol,
      shares: sharesToSell,
      price,
      amount: proceeds,
      note: `Realized ${realized >= 0 ? '+' : '-'}$${formatMoney(Math.abs(realized))}`
    });

    const { netWorth } = computePortfolioMetrics();
    state.netWorthHistory[state.dayIdx] = netWorth;
    sfxSell();
    if (!skipRender) {
      triggerHaptic(14);
      spawnFloatingPnL(realized, getDisplaySymbol(symbol));
      saveCampaignToStorage();
      showToast(`Sold $${formatMoney(proceeds)} of ${getDisplaySymbol(symbol)} (${realized >= 0 ? '+' : '-'}$${formatMoney(Math.abs(realized))})`, 'cyan');
      renderAll();
    }
    return true;
  }

  function executeSellAllForSymbol(symbol, reasonLabel = 'CLOSED POSITION', skipRender = false) {
    const pos = state.positions[symbol];
    if (!pos || Math.abs(pos.shares) <= 1e-6) return;
    const price = getStockPrice(symbol);

    if (pos.shares > 0) {
      const proceeds = pos.shares * price;
      const realized = proceeds - pos.totalCost;
      const sharesSold = pos.shares;
      delete state.positions[symbol];
      state.cash += proceeds;
      state.realizedPnL += realized;
      recordTradeStats(symbol, realized, 'SELL', price);

      state.tradeHistory.unshift({
        dayIdx: state.dayIdx,
        dateStr: TRADING_DATES[state.dayIdx].pretty,
        type: 'SELL',
        symbol,
        shares: sharesSold,
        price,
        amount: proceeds,
        note: `${reasonLabel}: ${realized >= 0 ? '+' : '-'}$${formatMoney(Math.abs(realized))}`
      });
      sfxSell();
      if (!skipRender) {
        triggerHaptic(16);
        spawnFloatingPnL(realized, getDisplaySymbol(symbol));
        saveCampaignToStorage();
      }
      showToast(`${reasonLabel} ${getDisplaySymbol(symbol)}: +$${formatMoney(proceeds)} (${realized >= 0 ? '+' : '-'}$${formatMoney(Math.abs(realized))})`, 'cyan');
    } else {
      const absShares = Math.abs(pos.shares);
      const buybackCost = absShares * price;
      const shortPnL = pos.totalCost - buybackCost;
      const cashDelta = pos.totalCost + shortPnL;
      delete state.positions[symbol];
      state.cash += cashDelta;
      state.realizedPnL += shortPnL;
      if (shortPnL > 0) unlockAchievement('ach_short_profit');
      recordTradeStats(symbol, shortPnL, 'BUY', price);

      state.tradeHistory.unshift({
        dayIdx: state.dayIdx,
        dateStr: TRADING_DATES[state.dayIdx].pretty,
        type: 'COVER',
        symbol,
        shares: absShares,
        price,
        amount: Math.max(0, cashDelta),
        note: `${reasonLabel}: ${shortPnL >= 0 ? '+' : '-'}$${formatMoney(Math.abs(shortPnL))}`
      });
      sfxBuy();
      if (!skipRender) {
        triggerHaptic(16);
        spawnFloatingPnL(shortPnL, getDisplaySymbol(symbol));
        saveCampaignToStorage();
      }
      showToast(`${reasonLabel} ${getDisplaySymbol(symbol)}: ${shortPnL >= 0 ? '+$' : '-$'}${formatMoney(Math.abs(shortPnL))} P&L`, shortPnL >= 0 ? 'emerald' : 'rose');
    }

    const { netWorth } = computePortfolioMetrics();
    state.netWorthHistory[state.dayIdx] = netWorth;
    if (!skipRender) renderAll();
  }

  // 30-Day 5x Call & Put Options Desk
  function buyOptionContract(symbol, optType, dollarAmount) {
    if (!isStockTradable(symbol)) {
      showToast(`${getDisplaySymbol(symbol)} is not actively trading on ${TRADING_DATES[state.dayIdx].pretty}.`, 'amber');
      return false;
    }
    const { buyingPower } = computePortfolioMetrics();
    const premium = Math.min(dollarAmount, buyingPower, Math.max(0, state.cash));
    if (premium < 50) {
      showToast('Options require at least $50 in cash premium.', 'rose');
      return false;
    }
    const strikePrice = getStockPrice(symbol);
    state.cash -= premium;
    const opt = {
      id: 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      symbol,
      optType, // 'CALL' | 'PUT'
      strikePrice,
      premium,
      openDayIdx: state.dayIdx,
      expiryDayIdx: Math.min(TOTAL_DAYS - 1, state.dayIdx + 30)
    };
    state.optionsPositions.push(opt);
    unlockAchievement('ach_first_trade');
    recordTradeStats(symbol, 0, optType === 'CALL' ? 'BUY' : 'SHORT', strikePrice);
    sfxBuy();
    triggerHaptic(15);
    saveCampaignToStorage();
    showToast(`⚡ Bought 30D 5x ${optType} on ${getDisplaySymbol(symbol)} ($${formatMoney(premium)} @ $${strikePrice.toFixed(2)} strike)`, optType === 'CALL' ? 'emerald' : 'cyan');
    renderAll();
    return true;
  }

  function settleOptionContract(opt, reasonLabel = 'OPTION CASH-OUT', skipRender = false) {
    const mark = getStockPrice(opt.symbol, state.dayIdx);
    const rawPct = opt.strikePrice > 0 ? (mark - opt.strikePrice) / opt.strikePrice : 0;
    const signedPct = opt.optType === 'CALL' ? rawPct : -rawPct;
    const payout = Math.max(0, opt.premium * (1 + 5 * signedPct));
    const optPnL = payout - opt.premium;

    state.cash += payout;
    state.realizedPnL += optPnL;
    if (opt.optType === 'PUT' && optPnL > 0) unlockAchievement('ach_short_profit');
    recordTradeStats(opt.symbol, optPnL, opt.optType === 'CALL' ? 'SELL' : 'BUY', mark);

    state.tradeHistory.unshift({
      dayIdx: state.dayIdx,
      dateStr: TRADING_DATES[state.dayIdx].pretty,
      type: `5X ${opt.optType}`,
      symbol: opt.symbol,
      shares: 1,
      price: mark,
      amount: payout,
      note: `${reasonLabel}: ${optPnL >= 0 ? '+' : '-'}$${formatMoney(Math.abs(optPnL))} (${((payout / opt.premium - 1) * 100).toFixed(0)}%)`
    });

    if (!skipRender) {
      sfxSell();
      triggerHaptic(18);
      spawnFloatingPnL(optPnL, `${getDisplaySymbol(opt.symbol)} ${opt.optType}`);
      saveCampaignToStorage();
      showToast(`${reasonLabel} ${getDisplaySymbol(opt.symbol)} 5x ${opt.optType}: Payout $${formatMoney(payout)} (${optPnL >= 0 ? '+$' : '-$'}${formatMoney(Math.abs(optPnL))})`, optPnL >= 0 ? 'emerald' : 'rose');
      renderAll();
    }
  }

  function buyLifestyleUpgrade(upgradeId) {
    const item = LIFESTYLE_UPGRADES.find(u => u.id === upgradeId);
    if (!item || state.ownedLifestyle[upgradeId]) return;
    if (state.cash < item.cost) {
      showToast(`Need $${formatMoney(item.cost)} in uninvested Cash to purchase ${item.name}!`, 'rose');
      return;
    }
    state.cash -= item.cost;
    state.ownedLifestyle[upgradeId] = true;
    sfxBuy();
    triggerHaptic(25);
    saveCampaignToStorage();
    showToast(`🎩 Purchased ${item.icon} ${item.name}! Buff Active: ${item.buffText}`, 'emerald');
    renderAll();
  }


  return { getStockPrice, isStockTradable, computePortfolioMetrics, checkMilestoneAchievements, isScenarioComplete, processSingleTradingDayStep, executeBuy, executeShortSell, executeCoverShort, executeSellDollar, executeSellAllForSymbol, buyOptionContract, settleOptionContract, buyLifestyleUpgrade };
}
if (typeof module !== "undefined" && module.exports) module.exports = { createTradingEngine };
