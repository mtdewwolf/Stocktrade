package com.mtdewwolf.stocktrade.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

data class Position(
    var shares: Double = 0.0,
    var avgCost: Double = 0.0,
    var totalCost: Double = 0.0,
)

data class OptionPosition(
    val id: String,
    val symbol: String,
    val optType: String,
    val strikePrice: Double,
    val premium: Double,
    val openDayIdx: Int,
    val expiryDayIdx: Int,
)

data class PendingOrder(
    val id: String,
    val type: String,
    val symbol: String,
    val dollarAmount: Double,
    val limitPrice: Double?,
)

data class TradeMarker(
    val dayIdx: Int,
    val symbol: String,
    val type: String,
    val price: Double,
)

data class TradeRecord(
    val dayIdx: Int,
    val dateStr: String,
    val type: String,
    val symbol: String,
    val shares: Double,
    val price: Double,
    val amount: Double,
    val note: String,
)

data class TradeExtreme(
    val symbol: String = "—",
    val pnl: Double = 0.0,
)

data class PortfolioMetrics(
    val netWorth: Double,
    val equityValue: Double,
    val unrealizedPnL: Double,
    val posCount: Int,
    val buyingPower: Double,
)

class TradingState(
    val totalDays: Int,
) {
    var dayIdx: Int = 0
    var speedDaysPerSec: Int = 5
    var autoPauseOnEvents: Boolean = true
    var dripEnabled: Boolean = false
    var mysteryMode: Boolean = false
    var maxLeverage: Double = 1.0
    var baseStartingCash: Double = 10_000.0
    var runStartDayIdx: Int = 0
    var scenarioCompleted: Boolean = false
    var startingCash: Double = 10_000.0
    var cash: Double = 10_000.0
    var totalInterestEarned: Double = 0.0
    var totalDividendsEarned: Double = 0.0
    var realizedPnL: Double = 0.0
    var selectedSymbol: String = "SPX"
    var stopLossPct: Double = 0.0
    var takeProfitPct: Double = 0.0
    var enableDilemmas: Boolean = true
    var prestigeLevel: Int = 0
    var activeScenario: Scenario? = null
    var bestTrade: TradeExtreme = TradeExtreme()
    var worstTrade: TradeExtreme = TradeExtreme()
    var peakNetWorth: Double = 10_000.0
    var maxDrawdownPct: Double = 0.0
    var netWorthHistory: DoubleArray = DoubleArray(totalDays) { Double.NaN }

    val positions: MutableMap<String, Position> = mutableMapOf()
    val optionsPositions: MutableList<OptionPosition> = mutableListOf()
    val pendingOrders: MutableList<PendingOrder> = mutableListOf()
    val ownedLifestyle: MutableMap<String, Boolean> = mutableMapOf()
    val triggeredDilemmas: MutableMap<String, Boolean> = mutableMapOf()
    val unlockedAchievements: MutableMap<String, Boolean> = mutableMapOf()
    val tradeMarkers: MutableList<TradeMarker> = mutableListOf()
    val tradeHistory: MutableList<TradeRecord> = mutableListOf()
    val triggeredEvents: MutableList<HistoricalEvent> = mutableListOf()
}

sealed interface EngineEvent {
    data object Pause : EngineEvent
    data object CareerWrapUp : EngineEvent
    data object Render : EngineEvent
    data object SaveNow : EngineEvent
    data object ScheduleSave : EngineEvent

    data class DilemmaOpened(val dilemma: HistoricalDilemma) : EngineEvent
    data class AchievementUnlocked(val id: String) : EngineEvent
    data class Sound(val kind: EngineSound) : EngineEvent
    data class Haptic(val milliseconds: Int) : EngineEvent
    data class FloatingPnl(val amount: Double, val label: String) : EngineEvent
    data class Notice(
        val kind: NoticeKind,
        val symbol: String? = null,
        val amount: Double = 0.0,
        val pnl: Double = 0.0,
        val detail: String? = null,
    ) : EngineEvent
}

enum class EngineSound {
    BUY,
    SELL,
    ALERT,
}

enum class NoticeKind {
    NOT_TRADABLE,
    INSUFFICIENT_BUYING_POWER,
    INSUFFICIENT_SHORT_COLLATERAL,
    COVER_LONG_FIRST,
    NO_SHORT_POSITION,
    NO_POSITION,
    OPTIONS_MIN_PREMIUM,
    LIFESTYLE_NEED_CASH,
    TRADE_BUY,
    TRADE_SHORT,
    TRADE_COVER,
    TRADE_SELL,
    POSITION_CLOSED,
    OPTION_OPENED,
    OPTION_SETTLED,
    LIFESTYLE_PURCHASED,
    BANKRUPTCY_WIPEOUT,
    SHORT_BANKRUPTCY_WIN,
    MARGIN_WIPEOUT,
    SCENARIO_WON,
    SCENARIO_ENDED,
    HISTORICAL_EVENT,
}

fun interface TradingEngineListener {
    fun onEvent(event: EngineEvent)
}

class TradingEngine(
    val spec: GameSpec,
    val state: TradingState,
    private val listener: TradingEngineListener = TradingEngineListener {},
) {
    private val eventByDay: Map<Int, HistoricalEvent> = spec.content.events.associateBy(HistoricalEvent::dayIdx)
    private val dilemmaByDay: Map<Int, HistoricalDilemma> = spec.content.dilemmas.associateBy(HistoricalDilemma::dayIdx)
    private var optionSequence: Long = 0

    private val totalDays: Int
        get() = spec.calendar.totalDays

    private val optionTermSessions: Int
        get() = spec.content.rules.optionTermSessions

    private val optionLeverage: Double
        get() = spec.content.rules.optionLeverage.toDouble()

    private val dividendSessionInterval: Int
        get() = spec.content.rules.dividendSessionInterval

    fun syncOptionSequence() {
        optionSequence = state.optionsPositions.size.toLong()
    }

    fun reset(baseCashAmount: Double = 10_000.0, scenarioConfig: Scenario? = null) {
        val startingCashAmount = round(baseCashAmount * (1.0 + state.prestigeLevel * 0.25))
        state.dayIdx = scenarioConfig?.startDayIdx ?: 0
        state.maxLeverage = 1.0
        state.baseStartingCash = baseCashAmount
        state.runStartDayIdx = state.dayIdx
        state.scenarioCompleted = false
        state.stopLossPct = 0.0
        state.takeProfitPct = 0.0
        state.startingCash = startingCashAmount
        state.cash = startingCashAmount
        state.totalInterestEarned = 0.0
        state.totalDividendsEarned = 0.0
        state.realizedPnL = 0.0
        state.positions.clear()
        state.optionsPositions.clear()
        state.pendingOrders.clear()
        state.ownedLifestyle.clear()
        state.triggeredDilemmas.clear()
        state.activeScenario = scenarioConfig
        state.bestTrade = TradeExtreme()
        state.worstTrade = TradeExtreme()
        state.peakNetWorth = startingCashAmount
        state.maxDrawdownPct = 0.0
        state.tradeMarkers.clear()
        state.tradeHistory.clear()
        state.triggeredEvents.clear()
        state.triggeredEvents.addAll(
            spec.content.events.filter { it.dayIdx <= state.dayIdx }.sortedByDescending(HistoricalEvent::dayIdx),
        )
        if (state.triggeredEvents.isEmpty()) {
            spec.content.events.firstOrNull()?.let(state.triggeredEvents::add)
        }
        if (state.netWorthHistory.size != totalDays) {
            state.netWorthHistory = DoubleArray(totalDays) { Double.NaN }
        } else {
            state.netWorthHistory.fill(Double.NaN)
        }
        state.netWorthHistory[state.dayIdx] = startingCashAmount
        if (!isStockTradable(state.selectedSymbol, 0)) {
            state.selectedSymbol = "SPX"
        }
        optionSequence = 0
    }

    fun getStockPrice(symbol: String, dayIdx: Int = state.dayIdx): Double {
        return spec.price(symbol, dayIdx).toDouble()
    }

    fun isStockTradable(symbol: String, dayIdx: Int = state.dayIdx): Boolean {
        val asset = spec.asset(symbol) ?: return false
        return spec.isTradable(asset, dayIdx)
    }

    fun computePortfolioMetrics(
        dayIdx: Int = state.dayIdx,
        portfolio: TradingState = state,
    ): PortfolioMetrics {
        var netPositionValue = 0.0
        var grossExposure = 0.0
        var unrealizedPnL = 0.0
        var posCount = 0

        for ((symbol, pos) in portfolio.positions) {
            if (abs(pos.shares) <= 1e-6) continue
            val mark = getStockPrice(symbol, dayIdx)
            posCount++
            if (pos.shares > 0) {
                val marketValue = pos.shares * mark
                netPositionValue += marketValue
                grossExposure += marketValue
                unrealizedPnL += marketValue - pos.totalCost
            } else {
                val absShares = abs(pos.shares)
                val buybackLiability = absShares * mark
                val shortPnL = pos.totalCost - buybackLiability
                val shortEquity = pos.totalCost + shortPnL
                netPositionValue += shortEquity
                grossExposure += buybackLiability
                unrealizedPnL += shortPnL
            }
        }

        for (opt in portfolio.optionsPositions) {
            val mark = getStockPrice(opt.symbol, dayIdx)
            val rawPct = if (opt.strikePrice > 0) (mark - opt.strikePrice) / opt.strikePrice else 0.0
            val signedPct = if (opt.optType == "CALL") rawPct else -rawPct
            val optValue = max(0.0, opt.premium * (1 + optionLeverage * signedPct))
            netPositionValue += optValue
            grossExposure += optValue
            unrealizedPnL += optValue - opt.premium
        }

        val netWorth = max(0.0, portfolio.cash + netPositionValue)
        if (netWorth > portfolio.peakNetWorth) portfolio.peakNetWorth = netWorth
        if (portfolio.peakNetWorth > 0) {
            val drawdown = (portfolio.peakNetWorth - netWorth) / portfolio.peakNetWorth * 100
            if (drawdown > portfolio.maxDrawdownPct) portfolio.maxDrawdownPct = drawdown
        }
        val marginAllowance = netWorth * (portfolio.maxLeverage - 1)
        val buyingPower = max(0.0, portfolio.cash + marginAllowance)
        return PortfolioMetrics(
            netWorth = netWorth,
            equityValue = grossExposure,
            unrealizedPnL = unrealizedPnL,
            posCount = posCount,
            buyingPower = buyingPower,
        )
    }

    fun checkMilestoneAchievements(netWorth: Double, dayIdx: Int) {
        if (netWorth >= 100_000) unlockAchievement("ach_100k")
        if (netWorth >= 1_000_000) unlockAchievement("ach_1m")
        if (netWorth >= 10_000_000) unlockAchievement("ach_10m")
        if (netWorth >= 100_000_000) unlockAchievement("ach_100m")
        if (state.totalDividendsEarned >= 1_000) unlockAchievement("ach_div_collector")
        if (dayIdx >= 2_018) unlockAchievement("ach_survive_87")
        if (spec.date(dayIdx).year >= 2_020) unlockAchievement("ach_modern_era")
    }

    fun isScenarioComplete(): Boolean {
        val scenario = state.activeScenario ?: return false
        return state.scenarioCompleted || state.dayIdx >= scenario.endDayIdx
    }

    fun pendingDilemma(): HistoricalDilemma? {
        val dilemma = dilemmaByDay[state.dayIdx] ?: return null
        if (!state.enableDilemmas || state.triggeredDilemmas[dilemma.id] == true) return null
        return dilemma
    }

    fun processSingleTradingDayStep(): Boolean {
        if (isScenarioComplete()) {
            state.scenarioCompleted = true
            emit(EngineEvent.Pause)
            return false
        }
        if (state.dayIdx >= totalDays - 1) {
            emit(EngineEvent.Pause)
            return false
        }

        state.dayIdx++
        val d = state.dayIdx
        val dateObj = spec.date(d)

        val fedRatePct = spec.fedRatePct(d)
        val primeBonus = (if (state.netWorthHistory[d - 1] >= 25_000) 0.50 else 0.0) +
            state.prestigeLevel * 0.50 +
            (if (state.ownedLifestyle["up_rolex"] == true) 0.25 else 0.0) +
            (if (state.ownedLifestyle["up_jet"] == true) 1.00 else 0.0)
        if (state.cash > 0.01) {
            val dailyInterest = state.cash * ((fedRatePct + primeBonus) / 100) / 252
            state.cash += dailyInterest
            state.totalInterestEarned += dailyInterest
        } else if (state.cash < -0.01) {
            val loanSpread = if (state.ownedLifestyle["up_quant"] == true) 0.75 else 1.5
            val dailyMarginCost = abs(state.cash) * ((fedRatePct + loanSpread) / 100) / 252
            state.cash -= dailyMarginCost
            state.totalInterestEarned -= dailyMarginCost
        }

        if (state.optionsPositions.isNotEmpty()) {
            val activeOptions = mutableListOf<OptionPosition>()
            for (opt in state.optionsPositions) {
                val asset = spec.asset(opt.symbol) ?: continue
                val delistIdx = asset.delistIdx
                val isBankruptToday = delistIdx != null && d >= delistIdx
                if (d >= opt.expiryDayIdx || isBankruptToday) {
                    settleOptionContract(
                        opt,
                        if (isBankruptToday) "BANKRUPTCY EXPIRY" else "30D EXPIRY",
                        true,
                    )
                } else {
                    activeOptions.add(opt)
                }
            }
            state.optionsPositions.clear()
            state.optionsPositions.addAll(activeOptions)
        }

        if (state.pendingOrders.isNotEmpty()) {
            val remainingOrders = mutableListOf<PendingOrder>()
            for (order in state.pendingOrders) {
                val asset = spec.asset(order.symbol)
                val delistIdx = asset?.delistIdx
                if (asset == null || (delistIdx != null && d >= delistIdx)) {
                    continue
                }
                if (order.type == "PRE_IPO") {
                    if (d >= asset.ipoIdx && isStockTradable(order.symbol, d)) {
                        val filled = executeBuy(order.symbol, order.dollarAmount, "PRE-IPO SYNDICATE FILL", true)
                        if (filled) unlockAchievement("ach_ipo_hunter")
                    } else {
                        remainingOrders.add(order)
                    }
                } else if (order.type == "LIMIT_BUY") {
                    if (isStockTradable(order.symbol, d)) {
                        val currentPrice = getStockPrice(order.symbol, d)
                        val limitPrice = order.limitPrice
                        if (limitPrice != null && currentPrice <= limitPrice) {
                            executeBuy(order.symbol, order.dollarAmount, "LIMIT FILL @ $currentPrice", true)
                        } else {
                            remainingOrders.add(order)
                        }
                    } else {
                        remainingOrders.add(order)
                    }
                }
            }
            state.pendingOrders.clear()
            state.pendingOrders.addAll(remainingOrders)
        }

        for (symbol in state.positions.keys.toList()) {
            val pos = state.positions[symbol] ?: continue
            if (abs(pos.shares) <= 1e-6) continue
            val asset = spec.asset(symbol) ?: continue

            val delistIdx = asset.delistIdx
            if (delistIdx != null && d == delistIdx) {
                if (pos.shares > 0) {
                    val lostCost = pos.totalCost
                    state.realizedPnL -= lostCost
                    recordTradeStats(symbol, -lostCost, "SELL", 0.0)
                    state.tradeHistory.add(
                        0,
                        TradeRecord(
                            dayIdx = d,
                            dateStr = dateObj.pretty,
                            type = "BANKRUPT",
                            symbol = symbol,
                            shares = pos.shares,
                            price = 0.0,
                            amount = -lostCost,
                            note = "${asset.name} filed Chapter 11 bankruptcy. Long wiped out.",
                        ),
                    )
                    state.positions.remove(symbol)
                    emit(EngineEvent.Sound(EngineSound.ALERT))
                    emit(
                        EngineEvent.Notice(
                            kind = NoticeKind.BANKRUPTCY_WIPEOUT,
                            symbol = symbol,
                            amount = lostCost,
                        ),
                    )
                } else {
                    val shortGain = pos.totalCost
                    state.cash += pos.totalCost * 2
                    state.realizedPnL += shortGain
                    recordTradeStats(symbol, shortGain, "BUY", 0.0)
                    state.tradeHistory.add(
                        0,
                        TradeRecord(
                            dayIdx = d,
                            dateStr = dateObj.pretty,
                            type = "SHORT WIN",
                            symbol = symbol,
                            shares = abs(pos.shares),
                            price = 0.0,
                            amount = shortGain,
                            note = "${asset.name} went bankrupt at $0.00! Short locked in +100% gain!",
                        ),
                    )
                    state.positions.remove(symbol)
                    unlockAchievement("ach_short_profit")
                    emit(EngineEvent.Sound(EngineSound.BUY))
                    emit(
                        EngineEvent.Notice(
                            kind = NoticeKind.SHORT_BANKRUPTCY_WIN,
                            symbol = symbol,
                            amount = shortGain,
                        ),
                    )
                }
                if (state.autoPauseOnEvents) emit(EngineEvent.Pause)
                continue
            }

            val price = getStockPrice(symbol, d)
            if (price <= 0) continue

            if (d % dividendSessionInterval == 0 && asset.divYield > 0) {
                val baseDividend = abs(pos.shares) * price * (asset.divYield / 4)
                if (baseDividend >= 0.01) {
                    if (pos.shares > 0) {
                        val quarterlyDividend = baseDividend * if (state.ownedLifestyle["up_penthouse"] == true) 1.10 else 1.0
                        state.totalDividendsEarned += quarterlyDividend
                        if (state.dripEnabled) {
                            val addedShares = quarterlyDividend / price
                            pos.shares += addedShares
                            pos.totalCost += quarterlyDividend
                            pos.avgCost = pos.totalCost / pos.shares
                        } else {
                            state.cash += quarterlyDividend
                        }
                    } else {
                        val shortDrag = baseDividend * if (state.ownedLifestyle["up_countach"] == true) 0.75 else 1.0
                        state.cash -= shortDrag
                    }
                }
            }

            if (pos.shares < 0) {
                val buybackLiability = abs(pos.shares) * price
                if (buybackLiability >= pos.totalCost * 1.90) {
                    executeSellAllForSymbol(symbol, "MARGIN CALL (SHORT SQUEEZE)", true)
                    continue
                }
            }

            val gainRatio = if (pos.shares > 0) {
                (price - pos.avgCost) / pos.avgCost
            } else {
                (pos.avgCost - price) / pos.avgCost
            }
            if (state.stopLossPct > 0 && gainRatio <= -state.stopLossPct) {
                executeSellAllForSymbol(symbol, "STOP-LOSS TRIGGERED", true)
            } else if (state.takeProfitPct > 0 && gainRatio >= state.takeProfitPct) {
                executeSellAllForSymbol(symbol, "TAKE-PROFIT TRIGGERED", true)
            }
        }

        var metrics = computePortfolioMetrics(d)
        if (state.cash < -1) {
            if (metrics.posCount > 0 && metrics.netWorth <= abs(state.cash) * 0.20) {
                for (symbol in state.positions.keys.toList()) {
                    executeSellAllForSymbol(symbol, "MARGIN CALL LIQUIDATION", true)
                }
                metrics = computePortfolioMetrics(d)
            }
            if (metrics.posCount == 0 && state.cash < 0) {
                state.cash = 500.0
                emit(EngineEvent.Sound(EngineSound.ALERT))
                emit(EngineEvent.Notice(NoticeKind.MARGIN_WIPEOUT))
                metrics = computePortfolioMetrics(d)
            }
        }

        state.netWorthHistory[d] = metrics.netWorth
        checkMilestoneAchievements(metrics.netWorth, d)

        val event = eventByDay[d]
        if (event != null) {
            state.triggeredEvents.add(0, event)
            if (event.pause && state.autoPauseOnEvents) {
                emit(EngineEvent.Pause)
                emit(EngineEvent.Sound(EngineSound.ALERT))
                emit(
                    EngineEvent.Notice(
                        kind = NoticeKind.HISTORICAL_EVENT,
                        detail = "${event.date}: ${event.headline}",
                    ),
                )
            }
        }

        val dilemma = dilemmaByDay[d]
        if (dilemma != null && state.enableDilemmas && state.autoPauseOnEvents &&
            state.triggeredDilemmas[dilemma.id] != true
        ) {
            emit(EngineEvent.Pause)
            emit(EngineEvent.DilemmaOpened(dilemma))
        }

        val activeScenario = state.activeScenario
        if (activeScenario != null && d >= activeScenario.endDayIdx) {
            state.scenarioCompleted = true
            emit(EngineEvent.Pause)
            val won = metrics.netWorth >= activeScenario.targetNw
            emit(
                EngineEvent.Notice(
                    kind = if (won) NoticeKind.SCENARIO_WON else NoticeKind.SCENARIO_ENDED,
                    amount = metrics.netWorth,
                    detail = activeScenario.title,
                ),
            )
            emit(EngineEvent.CareerWrapUp)
        } else if (d >= totalDays - 1) {
            emit(EngineEvent.Pause)
            emit(EngineEvent.CareerWrapUp)
        }

        if (isScenarioComplete() || d == totalDays - 1) {
            emit(EngineEvent.SaveNow)
        } else {
            emit(EngineEvent.ScheduleSave)
        }
        return !isScenarioComplete() && d < totalDays - 1
    }

    fun executeBuy(
        symbol: String,
        dollarAmount: Double,
        customNote: String? = null,
        skipRender: Boolean = false,
    ): Boolean {
        if (!isStockTradable(symbol)) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NOT_TRADABLE, symbol))
            return false
        }
        val existing = state.positions[symbol]
        if (existing != null && existing.shares < -1e-6) {
            return executeCoverShort(symbol, dollarAmount, skipRender)
        }

        val buyingPower = computePortfolioMetrics().buyingPower
        val spend = min(dollarAmount, buyingPower)
        if (spend < 1) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.INSUFFICIENT_BUYING_POWER, symbol))
            return false
        }
        val price = getStockPrice(symbol)
        if (price <= 0) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NOT_TRADABLE, symbol))
            return false
        }
        val sharesBought = spend / price
        state.cash -= spend

        val pos = state.positions.getOrPut(symbol) { Position() }
        pos.shares += sharesBought
        pos.totalCost += spend
        pos.avgCost = pos.totalCost / pos.shares

        unlockAchievement("ach_first_trade")
        recordTradeStats(symbol, 0.0, "BUY", price)

        state.tradeHistory.add(
            0,
            TradeRecord(
                dayIdx = state.dayIdx,
                dateStr = spec.date(state.dayIdx).pretty,
                type = "BUY",
                symbol = symbol,
                shares = sharesBought,
                price = price,
                amount = spend,
                note = customNote ?: "Bought ${fixed(sharesBought, 3)} sh @ $${fixed(price, 2)}",
            ),
        )

        state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth
        emit(EngineEvent.Sound(EngineSound.BUY))
        if (!skipRender) {
            emit(EngineEvent.Haptic(12))
            emit(EngineEvent.SaveNow)
            emit(EngineEvent.Notice(NoticeKind.TRADE_BUY, symbol, spend, detail = customNote))
            emit(EngineEvent.Render)
        }
        return true
    }

    fun executeShortSell(
        symbol: String,
        dollarAmount: Double,
        skipRender: Boolean = false,
    ): Boolean {
        if (!isStockTradable(symbol)) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NOT_TRADABLE, symbol))
            return false
        }
        val existing = state.positions[symbol]
        if (existing != null && existing.shares > 1e-6) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.COVER_LONG_FIRST, symbol))
            return false
        }

        val buyingPower = computePortfolioMetrics().buyingPower
        val collateral = min(dollarAmount, buyingPower)
        if (collateral < 1) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.INSUFFICIENT_SHORT_COLLATERAL, symbol))
            return false
        }
        val price = getStockPrice(symbol)
        if (price <= 0) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NOT_TRADABLE, symbol))
            return false
        }
        val sharesShorted = collateral / price
        state.cash -= collateral

        val pos = state.positions.getOrPut(symbol) { Position() }
        pos.shares -= sharesShorted
        pos.totalCost += collateral
        pos.avgCost = pos.totalCost / abs(pos.shares)

        unlockAchievement("ach_first_trade")
        recordTradeStats(symbol, 0.0, "SHORT", price)

        state.tradeHistory.add(
            0,
            TradeRecord(
                dayIdx = state.dayIdx,
                dateStr = spec.date(state.dayIdx).pretty,
                type = "SHORT",
                symbol = symbol,
                shares = sharesShorted,
                price = price,
                amount = collateral,
                note = "Shorted ${fixed(sharesShorted, 3)} sh @ $${fixed(price, 2)}",
            ),
        )

        state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth
        emit(EngineEvent.Sound(EngineSound.SELL))
        if (!skipRender) {
            emit(EngineEvent.Haptic(15))
            emit(EngineEvent.SaveNow)
            emit(EngineEvent.Notice(NoticeKind.TRADE_SHORT, symbol, collateral))
            emit(EngineEvent.Render)
        }
        return true
    }

    fun executeCoverShort(
        symbol: String,
        dollarAmount: Double?,
        skipRender: Boolean = false,
    ): Boolean {
        val pos = state.positions[symbol]
        if (pos == null || pos.shares >= -1e-6) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NO_SHORT_POSITION, symbol))
            return false
        }
        val price = getStockPrice(symbol)
        val absShares = abs(pos.shares)
        val currentBuybackCost = absShares * price
        if (dollarAmount == null || dollarAmount >= currentBuybackCost * 0.995) {
            executeSellAllForSymbol(symbol, "COVERED SHORT", skipRender)
            return true
        }
        val fraction = if (currentBuybackCost > 0) min(1.0, dollarAmount / currentBuybackCost) else 1.0
        val sharesToCover = absShares * fraction
        val collateralReleased = pos.totalCost * fraction
        val buybackCost = sharesToCover * price
        val shortPnL = collateralReleased - buybackCost
        val cashDelta = collateralReleased + shortPnL

        pos.shares += sharesToCover
        pos.totalCost -= collateralReleased
        state.cash += cashDelta
        state.realizedPnL += shortPnL
        if (shortPnL > 0) unlockAchievement("ach_short_profit")
        recordTradeStats(symbol, shortPnL, "BUY", price)

        state.tradeHistory.add(
            0,
            TradeRecord(
                dayIdx = state.dayIdx,
                dateStr = spec.date(state.dayIdx).pretty,
                type = "COVER",
                symbol = symbol,
                shares = sharesToCover,
                price = price,
                amount = max(0.0, cashDelta),
                note = "Covered ${fixed(sharesToCover, 2)} sh: ${signedMoney(shortPnL)}",
            ),
        )

        state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth
        emit(EngineEvent.Sound(EngineSound.BUY))
        if (!skipRender) {
            emit(EngineEvent.Haptic(14))
            emit(EngineEvent.FloatingPnl(shortPnL, symbol))
            emit(EngineEvent.SaveNow)
            emit(EngineEvent.Notice(NoticeKind.TRADE_COVER, symbol, buybackCost, shortPnL))
            emit(EngineEvent.Render)
        }
        return true
    }

    fun executeSellDollar(
        symbol: String,
        dollarAmount: Double,
        skipRender: Boolean = false,
    ): Boolean {
        val pos = state.positions[symbol]
        if (pos == null || abs(pos.shares) <= 1e-6) {
            if (!skipRender) emit(EngineEvent.Notice(NoticeKind.NO_POSITION, symbol))
            return false
        }
        if (pos.shares < 0) {
            return executeCoverShort(symbol, dollarAmount, skipRender)
        }
        val price = getStockPrice(symbol)
        val currentValue = pos.shares * price
        if (dollarAmount >= currentValue * 0.995) {
            executeSellAllForSymbol(symbol, "MARKET SELL", skipRender)
            return true
        }
        val fraction = if (currentValue > 0) dollarAmount / currentValue else 1.0
        val sharesToSell = pos.shares * fraction
        val costBasisSold = pos.totalCost * fraction
        val proceeds = sharesToSell * price
        val realized = proceeds - costBasisSold

        pos.shares -= sharesToSell
        pos.totalCost -= costBasisSold
        state.cash += proceeds
        state.realizedPnL += realized
        recordTradeStats(symbol, realized, "SELL", price)

        state.tradeHistory.add(
            0,
            TradeRecord(
                dayIdx = state.dayIdx,
                dateStr = spec.date(state.dayIdx).pretty,
                type = "SELL",
                symbol = symbol,
                shares = sharesToSell,
                price = price,
                amount = proceeds,
                note = "Realized ${signedMoney(realized)}",
            ),
        )

        state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth
        emit(EngineEvent.Sound(EngineSound.SELL))
        if (!skipRender) {
            emit(EngineEvent.Haptic(14))
            emit(EngineEvent.FloatingPnl(realized, symbol))
            emit(EngineEvent.SaveNow)
            emit(EngineEvent.Notice(NoticeKind.TRADE_SELL, symbol, proceeds, realized))
            emit(EngineEvent.Render)
        }
        return true
    }

    fun executeSellAllForSymbol(
        symbol: String,
        reasonLabel: String = "CLOSED POSITION",
        skipRender: Boolean = false,
    ) {
        val pos = state.positions[symbol] ?: return
        if (abs(pos.shares) <= 1e-6) return
        val price = getStockPrice(symbol)

        if (pos.shares > 0) {
            val proceeds = pos.shares * price
            val realized = proceeds - pos.totalCost
            val sharesSold = pos.shares
            state.positions.remove(symbol)
            state.cash += proceeds
            state.realizedPnL += realized
            recordTradeStats(symbol, realized, "SELL", price)

            state.tradeHistory.add(
                0,
                TradeRecord(
                    dayIdx = state.dayIdx,
                    dateStr = spec.date(state.dayIdx).pretty,
                    type = "SELL",
                    symbol = symbol,
                    shares = sharesSold,
                    price = price,
                    amount = proceeds,
                    note = "$reasonLabel: ${signedMoney(realized)}",
                ),
            )
            emit(EngineEvent.Sound(EngineSound.SELL))
            if (!skipRender) {
                emit(EngineEvent.Haptic(16))
                emit(EngineEvent.FloatingPnl(realized, symbol))
                emit(EngineEvent.SaveNow)
            }
            emit(EngineEvent.Notice(NoticeKind.POSITION_CLOSED, symbol, proceeds, realized, reasonLabel))
        } else {
            val absShares = abs(pos.shares)
            val buybackCost = absShares * price
            val shortPnL = pos.totalCost - buybackCost
            val cashDelta = pos.totalCost + shortPnL
            state.positions.remove(symbol)
            state.cash += cashDelta
            state.realizedPnL += shortPnL
            if (shortPnL > 0) unlockAchievement("ach_short_profit")
            recordTradeStats(symbol, shortPnL, "BUY", price)

            state.tradeHistory.add(
                0,
                TradeRecord(
                    dayIdx = state.dayIdx,
                    dateStr = spec.date(state.dayIdx).pretty,
                    type = "COVER",
                    symbol = symbol,
                    shares = absShares,
                    price = price,
                    amount = max(0.0, cashDelta),
                    note = "$reasonLabel: ${signedMoney(shortPnL)}",
                ),
            )
            emit(EngineEvent.Sound(EngineSound.BUY))
            if (!skipRender) {
                emit(EngineEvent.Haptic(16))
                emit(EngineEvent.FloatingPnl(shortPnL, symbol))
                emit(EngineEvent.SaveNow)
            }
            emit(EngineEvent.Notice(NoticeKind.POSITION_CLOSED, symbol, max(0.0, cashDelta), shortPnL, reasonLabel))
        }

        state.netWorthHistory[state.dayIdx] = computePortfolioMetrics().netWorth
        if (!skipRender) emit(EngineEvent.Render)
    }

    fun buyOptionContract(
        symbol: String,
        optType: String,
        dollarAmount: Double,
    ): Boolean {
        if (!isStockTradable(symbol)) {
            emit(EngineEvent.Notice(NoticeKind.NOT_TRADABLE, symbol))
            return false
        }
        val buyingPower = computePortfolioMetrics().buyingPower
        val premium = minOf(dollarAmount, buyingPower, max(0.0, state.cash))
        if (premium < 50) {
            emit(EngineEvent.Notice(NoticeKind.OPTIONS_MIN_PREMIUM, symbol))
            return false
        }
        val strikePrice = getStockPrice(symbol)
        state.cash -= premium
        val option = OptionPosition(
            id = "opt-${optionSequence++}",
            symbol = symbol,
            optType = optType,
            strikePrice = strikePrice,
            premium = premium,
            openDayIdx = state.dayIdx,
            expiryDayIdx = min(totalDays - 1, state.dayIdx + optionTermSessions),
        )
        state.optionsPositions.add(option)
        unlockAchievement("ach_first_trade")
        recordTradeStats(symbol, 0.0, if (optType == "CALL") "BUY" else "SHORT", strikePrice)
        emit(EngineEvent.Sound(EngineSound.BUY))
        emit(EngineEvent.Haptic(15))
        emit(EngineEvent.SaveNow)
        emit(EngineEvent.Notice(NoticeKind.OPTION_OPENED, symbol, premium, detail = optType))
        emit(EngineEvent.Render)
        return true
    }

    fun settleOptionContract(
        option: OptionPosition,
        reasonLabel: String = "OPTION CASH-OUT",
        skipRender: Boolean = false,
    ) {
        val mark = getStockPrice(option.symbol)
        val rawPct = if (option.strikePrice > 0) (mark - option.strikePrice) / option.strikePrice else 0.0
        val signedPct = if (option.optType == "CALL") rawPct else -rawPct
        val payout = max(0.0, option.premium * (1 + optionLeverage * signedPct))
        val optionPnL = payout - option.premium

        state.cash += payout
        state.realizedPnL += optionPnL
        if (option.optType == "PUT" && optionPnL > 0) unlockAchievement("ach_short_profit")
        recordTradeStats(
            option.symbol,
            optionPnL,
            if (option.optType == "CALL") "SELL" else "BUY",
            mark,
        )

        state.tradeHistory.add(
            0,
            TradeRecord(
                dayIdx = state.dayIdx,
                dateStr = spec.date(state.dayIdx).pretty,
                type = "5X ${option.optType}",
                symbol = option.symbol,
                shares = 1.0,
                price = mark,
                amount = payout,
                note = "$reasonLabel: ${signedMoney(optionPnL)} (${fixed((payout / option.premium - 1) * 100, 0)}%)",
            ),
        )

        if (!skipRender) {
            emit(EngineEvent.Sound(EngineSound.SELL))
            emit(EngineEvent.Haptic(18))
            emit(EngineEvent.FloatingPnl(optionPnL, "${option.symbol} ${option.optType}"))
            emit(EngineEvent.SaveNow)
            emit(EngineEvent.Notice(NoticeKind.OPTION_SETTLED, option.symbol, payout, optionPnL, reasonLabel))
            emit(EngineEvent.Render)
        }
    }

    fun buyLifestyleUpgrade(upgradeId: String) {
        val item = spec.content.lifestyle.find { it.id == upgradeId } ?: return
        if (state.ownedLifestyle[upgradeId] == true) return
        if (state.cash < item.cost) {
            emit(EngineEvent.Notice(NoticeKind.LIFESTYLE_NEED_CASH, amount = item.cost, detail = item.name))
            return
        }
        state.cash -= item.cost
        state.ownedLifestyle[upgradeId] = true
        emit(EngineEvent.Sound(EngineSound.BUY))
        emit(EngineEvent.Haptic(25))
        emit(EngineEvent.SaveNow)
        emit(EngineEvent.Notice(NoticeKind.LIFESTYLE_PURCHASED, amount = item.cost, detail = item.name))
        emit(EngineEvent.Render)
    }

    private fun fixed(value: Double, places: Int): String {
        val factor = when (places) {
            0 -> 1L
            1 -> 10L
            2 -> 100L
            3 -> 1_000L
            else -> 1L
        }
        val scaled = round(value * factor).toLong()
        val sign = if (scaled < 0) "-" else ""
        val absolute = abs(scaled)
        val whole = absolute / factor
        if (places == 0) return "$sign$whole"
        val fraction = (absolute % factor).toString().padStart(places, '0')
        return "$sign$whole.$fraction"
    }

    private fun money(value: Double): String {
        val absolute = abs(value)
        if (absolute >= 1_000_000_000.0) return fixed(value / 1_000_000_000.0, 2) + "B"
        if (absolute >= 1_000_000.0) return fixed(value / 1_000_000.0, 2) + "M"
        val scaled = round(value * 100).toLong()
        val sign = if (scaled < 0) "-" else ""
        val absoluteScaled = abs(scaled)
        val whole = absoluteScaled / 100
        val fraction = (absoluteScaled % 100).toString().padStart(2, '0')
        val grouped = whole.toString()
            .reversed()
            .chunked(3)
            .joinToString(",")
            .reversed()
        return "$sign$grouped.$fraction"
    }

    private fun signedMoney(value: Double): String =
        "${if (value >= 0) "+" else "-"}$${money(abs(value))}"

    private fun unlockAchievement(id: String) {
        if (state.unlockedAchievements[id] == true) return
        state.unlockedAchievements[id] = true
        if (spec.content.achievements.any { it.id == id }) {
            emit(EngineEvent.Sound(EngineSound.BUY))
            emit(EngineEvent.AchievementUnlocked(id))
        }
    }

    private fun recordTradeStats(
        symbol: String,
        realizedPnL: Double,
        tradeType: String,
        price: Double,
    ) {
        if (realizedPnL > state.bestTrade.pnl) {
            state.bestTrade = TradeExtreme(symbol, realizedPnL)
        }
        if (realizedPnL < state.worstTrade.pnl) {
            state.worstTrade = TradeExtreme(symbol, realizedPnL)
        }
        if (price.isFinite() && price >= 0) {
            state.tradeMarkers.add(TradeMarker(state.dayIdx, symbol, tradeType, price))
            if (state.tradeMarkers.size > 250) state.tradeMarkers.removeAt(0)
        }
    }

    private fun emit(event: EngineEvent) {
        listener.onEvent(event)
    }
}
