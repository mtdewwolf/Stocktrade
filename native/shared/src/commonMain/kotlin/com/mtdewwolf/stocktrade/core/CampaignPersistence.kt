package com.mtdewwolf.stocktrade.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.abs

interface CampaignStorage {
    fun getItem(key: String): String?
    fun putItem(key: String, value: String)
}

class CampaignPersistence(
    private val spec: GameSpec,
    private val state: TradingState,
    private val engine: TradingEngine,
    private val storage: CampaignStorage,
    private val key: String = STORAGE_KEY,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    fun saveCampaignToStorage(): Boolean {
        return try {
            val metrics = engine.computePortfolioMetrics()
            state.netWorthHistory[state.dayIdx] = metrics.netWorth
            val save = CampaignSaveDto(
                version = 4,
                baseStartingCash = state.baseStartingCash,
                runStartDayIdx = state.runStartDayIdx,
                scenarioCompleted = state.scenarioCompleted,
                netWorthHistory = (0..state.dayIdx).map { index ->
                    state.netWorthHistory[index].takeIf(Double::isFinite)
                },
                stopLossPct = state.stopLossPct,
                takeProfitPct = state.takeProfitPct,
                autoPauseOnEvents = state.autoPauseOnEvents,
                enableDilemmas = state.enableDilemmas,
                speedDaysPerSec = state.speedDaysPerSec,
                triggeredDilemmas = state.triggeredDilemmas.toMap(),
                dayIdx = state.dayIdx,
                maxLeverage = state.maxLeverage,
                startingCash = state.startingCash,
                cash = state.cash,
                dripEnabled = state.dripEnabled,
                mysteryMode = state.mysteryMode,
                totalInterestEarned = state.totalInterestEarned,
                totalDividendsEarned = state.totalDividendsEarned,
                realizedPnL = state.realizedPnL,
                selectedSymbol = state.selectedSymbol,
                positions = state.positions.mapValues { (_, pos) ->
                    PositionDto(pos.shares, pos.avgCost, pos.totalCost)
                },
                optionsPositions = state.optionsPositions.map { option ->
                    OptionDto(
                        id = option.id,
                        symbol = option.symbol,
                        optType = option.optType,
                        strikePrice = option.strikePrice,
                        premium = option.premium,
                        openDayIdx = option.openDayIdx,
                        expiryDayIdx = option.expiryDayIdx,
                    )
                },
                pendingOrders = state.pendingOrders.map { order ->
                    PendingOrderDto(
                        id = order.id,
                        type = order.type,
                        symbol = order.symbol,
                        dollarAmount = order.dollarAmount,
                        limitPrice = order.limitPrice,
                    )
                },
                ownedLifestyle = state.ownedLifestyle.toMap(),
                unlockedAchievements = state.unlockedAchievements.toMap(),
                activeScenario = state.activeScenario,
                bestTrade = TradeExtremeDto(state.bestTrade.symbol, state.bestTrade.pnl),
                worstTrade = TradeExtremeDto(state.worstTrade.symbol, state.worstTrade.pnl),
                peakNetWorth = state.peakNetWorth,
                maxDrawdownPct = state.maxDrawdownPct,
                tradeMarkers = state.tradeMarkers.takeLast(80).map { marker ->
                    TradeMarkerDto(marker.dayIdx, marker.symbol, marker.type, marker.price)
                },
                tradeHistory = state.tradeHistory.take(40).map { trade ->
                    TradeRecordDto(
                        dayIdx = trade.dayIdx,
                        dateStr = trade.dateStr,
                        type = trade.type,
                        symbol = trade.symbol,
                        shares = trade.shares,
                        price = trade.price,
                        amount = trade.amount,
                        note = trade.note,
                    )
                },
            )
            storage.putItem(key, json.encodeToString(CampaignSaveDto.serializer(), save))
            true
        } catch (_: Exception) {
            false
        }
    }

    fun loadCampaignFromStorage(): Boolean {
        return try {
            val raw = storage.getItem(key) ?: return false
            val candidate = validateCampaign(raw) ?: return false
            apply(candidate)
            engine.syncOptionSequence()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun validateCampaign(raw: String): TradingState? {
        return try {
            validate(json.decodeFromString(CampaignSaveDto.serializer(), raw))
        } catch (_: Exception) {
            null
        }
    }

    private fun validate(save: CampaignSaveDto): TradingState? {
        if (save.version != null && save.version != 4) return null
        if (save.dayIdx !in 0 until spec.calendar.totalDays) return null
        if (!validNumber(save.cash) || !validNumber(save.startingCash) || save.startingCash <= 0) return null
        if (save.maxLeverage !in ALLOWED_LEVERAGE) return null
        if (spec.asset(save.selectedSymbol) == null) return null

        val candidate = TradingState(spec.calendar.totalDays)
        candidate.prestigeLevel = state.prestigeLevel
        candidate.dayIdx = save.dayIdx
        candidate.cash = save.cash
        candidate.startingCash = save.startingCash
        candidate.maxLeverage = save.maxLeverage
        candidate.selectedSymbol = save.selectedSymbol

        candidate.totalInterestEarned = save.totalInterestEarned ?: 0.0
        candidate.totalDividendsEarned = save.totalDividendsEarned ?: 0.0
        candidate.realizedPnL = save.realizedPnL ?: 0.0
        candidate.peakNetWorth = save.peakNetWorth ?: save.startingCash
        candidate.maxDrawdownPct = save.maxDrawdownPct ?: 0.0
        for (value in listOf(
            candidate.totalInterestEarned,
            candidate.totalDividendsEarned,
            candidate.realizedPnL,
            candidate.peakNetWorth,
            candidate.maxDrawdownPct,
        )) {
            if (!validNumber(value)) return null
        }
        if (candidate.peakNetWorth < 0 || candidate.maxDrawdownPct < 0) return null

        candidate.dripEnabled = save.dripEnabled ?: false
        candidate.mysteryMode = save.mysteryMode ?: false
        candidate.autoPauseOnEvents = save.autoPauseOnEvents ?: true
        candidate.enableDilemmas = save.enableDilemmas ?: true

        candidate.stopLossPct = save.stopLossPct ?: 0.0
        candidate.takeProfitPct = save.takeProfitPct ?: 0.0
        if (candidate.stopLossPct !in ALLOWED_STOP_LOSS) return null
        if (candidate.takeProfitPct !in ALLOWED_TAKE_PROFIT) return null

        candidate.speedDaysPerSec = save.speedDaysPerSec ?: 5
        if (candidate.speedDaysPerSec !in 1..252) return null

        val positions = save.positions ?: return null
        for ((symbol, position) in positions) {
            val asset = spec.asset(symbol) ?: return null
            if (!validNumber(position.shares) || !validNumber(position.avgCost) ||
                position.avgCost <= 0 || !validNumber(position.totalCost) || position.totalCost < 0
            ) {
                return null
            }
            if (save.dayIdx < asset.ipoIdx) return null
            val delistIdx = asset.delistIdx
            if (delistIdx != null && save.dayIdx >= delistIdx) return null
            candidate.positions[symbol] = Position(position.shares, position.avgCost, position.totalCost)
        }

        val options = save.optionsPositions ?: emptyList()
        if (options.size > MAX_COLLECTION_SIZE) return null
        for (option in options) {
            if (!validText(option.id, 100) || spec.asset(option.symbol) == null) return null
            if (option.optType != "CALL" && option.optType != "PUT") return null
            if (!validNumber(option.strikePrice) || option.strikePrice <= 0) return null
            if (!validNumber(option.premium) || option.premium <= 0) return null
            if (option.openDayIdx !in 0 until spec.calendar.totalDays) return null
            if (option.openDayIdx > save.dayIdx) return null
            if (option.expiryDayIdx !in 0 until spec.calendar.totalDays) return null
            if (option.expiryDayIdx < save.dayIdx) return null
            candidate.optionsPositions.add(
                OptionPosition(
                    id = option.id,
                    symbol = option.symbol,
                    optType = option.optType,
                    strikePrice = option.strikePrice,
                    premium = option.premium,
                    openDayIdx = option.openDayIdx,
                    expiryDayIdx = option.expiryDayIdx,
                ),
            )
        }

        val orders = save.pendingOrders ?: emptyList()
        if (orders.size > MAX_COLLECTION_SIZE) return null
        for (order in orders) {
            if (!validText(order.id, 100) || spec.asset(order.symbol) == null) return null
            if (order.type != "PRE_IPO" && order.type != "LIMIT_BUY") return null
            if (!validNumber(order.dollarAmount) || order.dollarAmount <= 0) return null
            if (order.type == "PRE_IPO") {
                if (order.limitPrice != null) return null
            } else {
                if (order.limitPrice == null || !validNumber(order.limitPrice) || order.limitPrice <= 0) return null
            }
            candidate.pendingOrders.add(
                PendingOrder(order.id, order.type, order.symbol, order.dollarAmount, order.limitPrice),
            )
        }

        val lifestyleIds = spec.content.lifestyle.map(LifestyleUpgrade::id).toSet()
        val achievementIds = spec.content.achievements.map(Achievement::id).toSet()
        val dilemmaIds = spec.content.dilemmas.map(HistoricalDilemma::id).toSet()
        if (!copyBooleanMap(save.ownedLifestyle ?: emptyMap(), lifestyleIds, candidate.ownedLifestyle)) return null
        if (!copyBooleanMap(save.unlockedAchievements ?: emptyMap(), achievementIds, candidate.unlockedAchievements)) return null
        if (!copyBooleanMap(save.triggeredDilemmas ?: emptyMap(), dilemmaIds, candidate.triggeredDilemmas)) return null

        candidate.activeScenario = save.activeScenario
        val scenario = candidate.activeScenario
        if (scenario != null) {
            if (!validText(scenario.id, 100) || !validText(scenario.title, 200)) return null
            if (scenario.startDayIdx !in 0 until spec.calendar.totalDays) return null
            if (scenario.endDayIdx !in 0 until spec.calendar.totalDays) return null
            if (scenario.startDayIdx >= scenario.endDayIdx) return null
            if (save.dayIdx < scenario.startDayIdx) return null
            if (!validNumber(scenario.startCash) || scenario.startCash <= 0) return null
            if (!validNumber(scenario.targetNw) || scenario.targetNw <= 0) return null
        }

        candidate.runStartDayIdx = save.runStartDayIdx ?: scenario?.startDayIdx ?: 0
        if (candidate.runStartDayIdx !in 0 until spec.calendar.totalDays) return null
        if (candidate.runStartDayIdx > save.dayIdx) return null
        if (scenario != null && candidate.runStartDayIdx != scenario.startDayIdx) return null

        candidate.baseStartingCash = save.baseStartingCash ?: (save.startingCash / (1 + state.prestigeLevel * .25))
        if (!validNumber(candidate.baseStartingCash) || candidate.baseStartingCash <= 0) return null

        candidate.scenarioCompleted = scenario != null &&
            (save.scenarioCompleted == true || save.dayIdx >= scenario.endDayIdx)

        candidate.bestTrade = save.bestTrade?.toExtreme() ?: TradeExtreme()
        candidate.worstTrade = save.worstTrade?.toExtreme() ?: TradeExtreme()
        if (!validExtreme(candidate.bestTrade) || !validExtreme(candidate.worstTrade)) return null

        val markers = save.tradeMarkers ?: emptyList()
        if (markers.size > 250) return null
        for (marker in markers) {
            if (marker.dayIdx !in 0 until spec.calendar.totalDays || marker.dayIdx > save.dayIdx) return null
            if (spec.asset(marker.symbol) == null) return null
            if (!validText(marker.type, 100) || !validNumber(marker.price) || marker.price < 0) return null
            candidate.tradeMarkers.add(TradeMarker(marker.dayIdx, marker.symbol, marker.type, marker.price))
        }

        val history = save.tradeHistory ?: emptyList()
        if (history.size > MAX_COLLECTION_SIZE) return null
        for (trade in history) {
            if (trade.dayIdx !in 0 until spec.calendar.totalDays || trade.dayIdx > save.dayIdx) return null
            if (spec.asset(trade.symbol) == null) return null
            if (!validText(trade.type, 100) || !validText(trade.dateStr, 100) || !validText(trade.note)) return null
            if (!validNumber(trade.shares) || !validNumber(trade.price) || !validNumber(trade.amount)) return null
            candidate.tradeHistory.add(
                TradeRecord(
                    dayIdx = trade.dayIdx,
                    dateStr = trade.dateStr,
                    type = trade.type,
                    symbol = trade.symbol,
                    shares = trade.shares,
                    price = trade.price,
                    amount = trade.amount,
                    note = trade.note,
                ),
            )
        }

        val savedHistory = save.netWorthHistory
        if (savedHistory != null) {
            if (savedHistory.size != save.dayIdx + 1 || savedHistory.size > spec.calendar.totalDays) return null
            for (index in savedHistory.indices) {
                val value = savedHistory[index] ?: continue
                if (!validNumber(value) || value < 0) return null
                candidate.netWorthHistory[index] = value
            }
        } else {
            candidate.netWorthHistory[candidate.runStartDayIdx] = candidate.startingCash
        }

        candidate.triggeredEvents.addAll(
            spec.content.events.filter { it.dayIdx <= save.dayIdx }.sortedByDescending(HistoricalEvent::dayIdx),
        )
        if (candidate.triggeredEvents.isEmpty()) {
            spec.content.events.firstOrNull()?.let(candidate.triggeredEvents::add)
        }

        val metrics = engine.computePortfolioMetrics(candidate.dayIdx, candidate)
        if (!validNumber(metrics.netWorth) || !validNumber(metrics.equityValue) ||
            !validNumber(metrics.unrealizedPnL) || !validNumber(metrics.buyingPower) ||
            !validNumber(candidate.peakNetWorth) || !validNumber(candidate.maxDrawdownPct)
        ) {
            return null
        }
        candidate.netWorthHistory[candidate.dayIdx] = metrics.netWorth
        return candidate
    }

    private fun apply(candidate: TradingState) {
        state.dayIdx = candidate.dayIdx
        state.autoPauseOnEvents = candidate.autoPauseOnEvents
        state.dripEnabled = candidate.dripEnabled
        state.mysteryMode = candidate.mysteryMode
        state.speedDaysPerSec = candidate.speedDaysPerSec
        state.maxLeverage = candidate.maxLeverage
        state.baseStartingCash = candidate.baseStartingCash
        state.runStartDayIdx = candidate.runStartDayIdx
        state.scenarioCompleted = candidate.scenarioCompleted
        state.startingCash = candidate.startingCash
        state.cash = candidate.cash
        state.totalInterestEarned = candidate.totalInterestEarned
        state.totalDividendsEarned = candidate.totalDividendsEarned
        state.realizedPnL = candidate.realizedPnL
        state.selectedSymbol = candidate.selectedSymbol
        state.stopLossPct = candidate.stopLossPct
        state.takeProfitPct = candidate.takeProfitPct
        state.enableDilemmas = candidate.enableDilemmas
        state.activeScenario = candidate.activeScenario
        state.bestTrade = candidate.bestTrade
        state.worstTrade = candidate.worstTrade
        state.peakNetWorth = candidate.peakNetWorth
        state.maxDrawdownPct = candidate.maxDrawdownPct
        state.positions.clear()
        state.positions.putAll(candidate.positions)
        state.optionsPositions.clear()
        state.optionsPositions.addAll(candidate.optionsPositions)
        state.pendingOrders.clear()
        state.pendingOrders.addAll(candidate.pendingOrders)
        state.ownedLifestyle.clear()
        state.ownedLifestyle.putAll(candidate.ownedLifestyle)
        state.triggeredDilemmas.clear()
        state.triggeredDilemmas.putAll(candidate.triggeredDilemmas)
        state.unlockedAchievements.clear()
        state.unlockedAchievements.putAll(candidate.unlockedAchievements)
        state.tradeMarkers.clear()
        state.tradeMarkers.addAll(candidate.tradeMarkers)
        state.tradeHistory.clear()
        state.tradeHistory.addAll(candidate.tradeHistory)
        state.triggeredEvents.clear()
        state.triggeredEvents.addAll(candidate.triggeredEvents)
        state.netWorthHistory = candidate.netWorthHistory.copyOf()
    }

    private fun copyBooleanMap(
        source: Map<String, Boolean>,
        allowed: Set<String>,
        target: MutableMap<String, Boolean>,
    ): Boolean {
        for ((id, value) in source) {
            if (id !in allowed) return false
            target[id] = value
        }
        return true
    }

    private fun validExtreme(extreme: TradeExtreme): Boolean {
        if (extreme.symbol != "—" && spec.asset(extreme.symbol) == null) return false
        return validNumber(extreme.pnl)
    }

    private fun TradeExtremeDto.toExtreme(): TradeExtreme = TradeExtreme(symbol, pnl)

    private fun validNumber(value: Double): Boolean {
        return value.isFinite() && abs(value) <= 1e100
    }

    private fun validText(value: String, max: Int = 2_000): Boolean {
        return value.length <= max
    }

    companion object {
        const val STORAGE_KEY: String = "ws_time_machine_campaign_save_v3"
        private const val MAX_COLLECTION_SIZE = 10_000
        private val ALLOWED_LEVERAGE = setOf(1.0, 1.5, 2.0, 2.5)
        private val ALLOWED_STOP_LOSS = setOf(0.0, 0.15, 0.25, 0.35)
        private val ALLOWED_TAKE_PROFIT = setOf(0.0, 0.5, 1.0, 2.0, 4.0)
    }
}

@Serializable
private data class CampaignSaveDto(
    val version: Int? = null,
    val baseStartingCash: Double? = null,
    val runStartDayIdx: Int? = null,
    val scenarioCompleted: Boolean? = null,
    val netWorthHistory: List<Double?>? = null,
    val stopLossPct: Double? = null,
    val takeProfitPct: Double? = null,
    val autoPauseOnEvents: Boolean? = null,
    val enableDilemmas: Boolean? = null,
    val speedDaysPerSec: Int? = null,
    val triggeredDilemmas: Map<String, Boolean>? = null,
    val dayIdx: Int,
    val maxLeverage: Double,
    val startingCash: Double,
    val cash: Double,
    val dripEnabled: Boolean? = null,
    val mysteryMode: Boolean? = null,
    val totalInterestEarned: Double? = null,
    val totalDividendsEarned: Double? = null,
    val realizedPnL: Double? = null,
    val selectedSymbol: String,
    val positions: Map<String, PositionDto>? = null,
    val optionsPositions: List<OptionDto>? = null,
    val pendingOrders: List<PendingOrderDto>? = null,
    val ownedLifestyle: Map<String, Boolean>? = null,
    val unlockedAchievements: Map<String, Boolean>? = null,
    val activeScenario: Scenario? = null,
    val bestTrade: TradeExtremeDto? = null,
    val worstTrade: TradeExtremeDto? = null,
    val peakNetWorth: Double? = null,
    val maxDrawdownPct: Double? = null,
    val tradeMarkers: List<TradeMarkerDto>? = null,
    val tradeHistory: List<TradeRecordDto>? = null,
)

@Serializable
private data class PositionDto(
    val shares: Double,
    val avgCost: Double,
    val totalCost: Double,
)

@Serializable
private data class OptionDto(
    val id: String,
    val symbol: String,
    val optType: String,
    val strikePrice: Double,
    val premium: Double,
    val openDayIdx: Int,
    val expiryDayIdx: Int,
)

@Serializable
private data class PendingOrderDto(
    val id: String,
    val type: String,
    val symbol: String,
    val dollarAmount: Double,
    val limitPrice: Double? = null,
)

@Serializable
private data class TradeExtremeDto(
    val symbol: String = "—",
    val pnl: Double = 0.0,
)

@Serializable
private data class TradeMarkerDto(
    val dayIdx: Int,
    val symbol: String,
    val type: String,
    val price: Double,
)

@Serializable
private data class TradeRecordDto(
    val dayIdx: Int,
    val dateStr: String,
    val type: String,
    val symbol: String,
    val shares: Double,
    val price: Double,
    val amount: Double,
    val note: String,
)
