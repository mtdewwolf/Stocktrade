package com.mtdewwolf.stocktrade.core

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TradingEngineTest {
    private val dates = List(66) { index ->
        val day = index + 1
        TradingDate(
            iso = "1980-01-${day.toString().padStart(2, '0')}",
            year = 1980,
            month = 1,
            day = day,
            pretty = "Day $day, 1980",
            era = "1980–82 Volcker Era",
        )
    }

    private fun asset(
        symbol: String,
        ipoIdx: Int = 0,
        delistIdx: Int? = null,
        priceOffset: Int = 0,
        divYield: Double = 0.0,
    ) = Asset(
        symbol = symbol,
        name = symbol,
        sector = "Macro",
        divYield = divYield,
        ipoDate = dates[ipoIdx].iso,
        delistDate = delistIdx?.let { dates[it].iso },
        volatility = 0.01,
        bio = "",
        ipoIdx = ipoIdx,
        delistIdx = delistIdx,
        priceOffset = priceOffset,
    )

    private fun spec(
        assets: List<Asset>,
        prices: FloatArray,
        totalDays: Int = dates.size,
        events: List<HistoricalEvent> = emptyList(),
        dilemmas: List<HistoricalDilemma> = emptyList(),
    ): GameSpec {
        val calendarDates = dates.take(totalDays)
        val content = GameContent(
            schemaVersion = 1,
            contentVersion = "test",
            calendar = TradingCalendar(
                startIso = calendarDates.first().iso,
                endIso = calendarDates.last().iso,
                totalDays = calendarDates.size,
                dates = calendarDates,
            ),
            assets = assets,
            events = events,
            dilemmas = dilemmas,
            lifestyle = listOf(
                LifestyleUpgrade("up_rolex", "", "Gold Rolex", 25_000.0, "+0.25% cash APY"),
            ),
            achievements = listOf(
                Achievement("ach_first_trade", "", "Opening Bell", ""),
                Achievement("ach_short_profit", "", "Big Short", ""),
                Achievement("ach_ipo_hunter", "", "IPO Syndicate", ""),
                Achievement("ach_div_collector", "", "Dividend Royalty", ""),
                Achievement("ach_100k", "", "$100K", ""),
                Achievement("ach_1m", "", "$1M", ""),
                Achievement("ach_10m", "", "$10M", ""),
                Achievement("ach_100m", "", "$100M", ""),
                Achievement("ach_survive_87", "", "1987", ""),
                Achievement("ach_modern_era", "", "Modern", ""),
            ),
            rules = GameRules(
                sessionsPerYear = 252,
                dividendSessionInterval = 63,
                optionTermSessions = 30,
                optionLeverage = 5,
                marketEncoding = "float32-le",
                marketLayout = "asset-major",
                seriesEncoding = "float64-le",
                seriesLayout = "day-major",
                seriesFields = listOf("fedRatePct", "cpiDeflator"),
            ),
        )
        val series = DoubleArray(totalDays * 2) { index ->
            if (index % 2 == 0) 5.0 else 1.0
        }
        return GameSpec(content, prices, series)
    }

    private fun flatSpec(
        totalDays: Int = 5,
        price: Float = 100f,
        divYield: Double = 0.0,
    ): GameSpec {
        val asset = asset("SPX", priceOffset = 0, divYield = divYield)
        return spec(listOf(asset), FloatArray(totalDays) { price }, totalDays)
    }

    private fun state(spec: GameSpec): TradingState = TradingState(spec.calendar.totalDays).apply {
        cash = 10_000.0
        startingCash = 10_000.0
        peakNetWorth = 10_000.0
        maxLeverage = 2.0
        netWorthHistory[0] = 10_000.0
    }

    @Test
    fun coversShortWithoutChangingEquity() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.executeShortSell("SPX", 20_000.0, true))
        assertEquals(-10_000.0, state.cash)
        assertEquals(20_000.0, state.positions.getValue("SPX").totalCost)

        assertTrue(engine.executeCoverShort("SPX", 1_000.0, true))
        assertEquals(-9_000.0, state.cash)
        assertEquals(10_000.0, engine.computePortfolioMetrics().netWorth, 1e-9)

        engine.executeSellAllForSymbol("SPX", "test", true)
        assertEquals(10_000.0, state.cash)
        assertNull(state.positions["SPX"])
    }

    @Test
    fun resetStartsAtScenarioBoundary() {
        val spec = flatSpec(totalDays = 10)
        val state = state(spec)
        val engine = TradingEngine(spec, state)
        val scenario = Scenario(
            id = "scen_test",
            title = "Test mission",
            startIso = dates[2].iso,
            endIso = dates[8].iso,
            startCash = 10_000.0,
            targetNw = 20_000.0,
            desc = "",
            startDayIdx = 2,
            endDayIdx = 8,
        )

        engine.reset(10_000.0, scenario)

        assertEquals(2, state.dayIdx)
        assertEquals(scenario, state.activeScenario)
        assertEquals(10_000.0, state.cash)
        assertEquals(10_000.0, state.netWorthHistory[2])
        assertFalse(state.scenarioCompleted)
    }

    @Test
    fun formatsTradeNotesForTheTradeLog() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.executeBuy("SPX", 1_000.0, null, true))
        assertEquals("Bought 10.000 sh @ $100.00", state.tradeHistory.first().note)

        engine.executeSellAllForSymbol("SPX", "MARKET SELL", true)
        assertEquals("MARKET SELL: +$0.00", state.tradeHistory.first().note)
    }

    @Test
    fun reportsUnresolvedDilemmaForTheCurrentDay() {
        val dilemma = HistoricalDilemma(
            id = "dil_test",
            date = "1980-01-03",
            title = "Test dilemma",
            desc = "",
            choiceATitle = "A",
            choiceADesc = "",
            choiceBTitle = "B",
            choiceBDesc = "",
            dayIdx = 2,
        )
        val state = TradingState(5)
        val engine = TradingEngine(
            spec(listOf(asset("SPX")), FloatArray(5) { 100f }, totalDays = 5, dilemmas = listOf(dilemma)),
            state,
        )
        state.dayIdx = 2
        assertEquals(dilemma, engine.pendingDilemma())

        state.triggeredDilemmas[dilemma.id] = true
        assertNull(engine.pendingDilemma())
    }

    @Test
    fun pausesAndNotifiesOnHistoricalEvent() {
        val asset = asset("SPX")
        val event = HistoricalEvent(
            date = "1980-01-03",
            type = "IPO",
            pause = true,
            headline = "NKE goes public.",
            dayIdx = 2,
        )
        val emitted = mutableListOf<EngineEvent>()
        val listeningEngine = TradingEngine(
            spec(listOf(asset), FloatArray(5) { 100f }, totalDays = 5, events = listOf(event)),
            TradingState(5),
            TradingEngineListener { emitted.add(it) },
        )

        listeningEngine.processSingleTradingDayStep()
        emitted.clear()
        listeningEngine.processSingleTradingDayStep()

        assertTrue(emitted.contains(EngineEvent.Pause))
        assertTrue(
            emitted.any {
                it is EngineEvent.Notice &&
                    it.kind == NoticeKind.HISTORICAL_EVENT &&
                    it.detail == "1980-01-03: NKE goes public."
            },
        )
    }

    @Test
    fun buysPermanentLifestyleUpgrade() {
        val spec = flatSpec()
        val state = state(spec)
        state.cash = 30_000.0
        val engine = TradingEngine(spec, state)

        engine.buyLifestyleUpgrade("up_rolex")

        assertEquals(5_000.0, state.cash)
        assertEquals(true, state.ownedLifestyle["up_rolex"])
    }

    @Test
    fun stopsDayAdvancementAtScenarioBoundary() {
        val spec = flatSpec()
        val state = state(spec)
        state.activeScenario = Scenario(
            id = "scen_test",
            title = "Test",
            startIso = "1980-01-01",
            endIso = "1980-01-02",
            startCash = 10_000.0,
            targetNw = 10_000.0,
            desc = "",
            startDayIdx = 0,
            endDayIdx = 1,
        )
        val engine = TradingEngine(spec, state)

        assertFalse(engine.processSingleTradingDayStep())
        assertEquals(1, state.dayIdx)
        assertTrue(state.scenarioCompleted)

        assertFalse(engine.processSingleTradingDayStep())
        assertEquals(1, state.dayIdx)
    }

    @Test
    fun buysASharePositionAndTracksNetWorth() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.executeBuy("SPX", 1_000.0, null, true))
        assertEquals(9_000.0, state.cash)
        assertEquals(10.0, state.positions.getValue("SPX").shares)
        assertEquals(1_000.0, state.positions.getValue("SPX").totalCost)
        assertEquals(10_000.0, engine.computePortfolioMetrics().netWorth, 1e-9)
        assertEquals(10_000.0, state.netWorthHistory[0], 1e-9)
    }

    @Test
    fun wipesOutLongAtDelisting() {
        val dead = asset("DEAD", delistIdx = 3, priceOffset = 0)
        val spec = spec(listOf(dead), floatArrayOf(20f, 21f, 22f, 0f, 0f), totalDays = 5)
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.executeBuy("DEAD", 1_000.0, null, true))
        assertEquals(50.0, state.positions.getValue("DEAD").shares)

        engine.processSingleTradingDayStep()
        engine.processSingleTradingDayStep()
        engine.processSingleTradingDayStep()

        assertNull(state.positions["DEAD"])
        assertEquals(3, state.dayIdx)
        assertEquals(-1_000.0, state.realizedPnL, 1e-9)
        assertTrue(state.cash > 9_000.0)
    }

    @Test
    fun paysQuarterlyDividend() {
        val spec = flatSpec(totalDays = 65, divYield = 0.04)
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.executeBuy("SPX", 1_000.0, null, true))
        repeat(63) { assertTrue(engine.processSingleTradingDayStep()) }

        assertTrue(abs(state.totalDividendsEarned - 10.0) < 1e-9)
        assertTrue(state.cash > 9_010.0)
    }

    @Test
    fun savesAndRestoresCampaign() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)
        val storage = MemoryCampaignStorage()
        val persistence = CampaignPersistence(spec, state, engine, storage)

        assertTrue(engine.executeBuy("SPX", 1_000.0, null, true))
        assertTrue(persistence.saveCampaignToStorage())

        state.positions.clear()
        state.cash = 0.0

        assertTrue(persistence.loadCampaignFromStorage())
        assertEquals(9_000.0, state.cash)
        assertEquals(1_000.0, state.positions.getValue("SPX").totalCost)
        assertEquals(10_000.0, state.netWorthHistory[0])
    }

    @Test
    fun rejectsInvalidSaveWithoutMutatingLiveState() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)
        val storage = MemoryCampaignStorage()
        val persistence = CampaignPersistence(spec, state, engine, storage)

        assertTrue(engine.executeBuy("SPX", 1_000.0, null, true))
        storage.values[CampaignPersistence.STORAGE_KEY] = """{"version":4,"dayIdx":0,"maxLeverage":2,"startingCash":10000,"cash":10000,"selectedSymbol":"SPX","positions":{"SPX":{"shares":"bad","avgCost":100,"totalCost":100}}}"""
        val beforeCash = state.cash
        val beforeShares = state.positions.getValue("SPX").shares

        assertFalse(persistence.loadCampaignFromStorage())
        assertEquals(beforeCash, state.cash)
        assertEquals(beforeShares, state.positions.getValue("SPX").shares)
    }

    @Test
    fun reportsStorageFailures() {
        val spec = flatSpec()
        val state = state(spec)
        val engine = TradingEngine(spec, state)
        val persistence = CampaignPersistence(
            spec,
            state,
            engine,
            object : CampaignStorage {
                override fun getItem(key: String): String? = null
                override fun putItem(key: String, value: String) = throw IllegalStateException("quota")
            },
        )

        assertFalse(persistence.saveCampaignToStorage())
    }

    @Test
    fun marksOptionValueAtFiveTimesReturn() {
        val prices = floatArrayOf(100f, 110f, 120f, 130f, 140f)
        val asset = asset("SPX", priceOffset = 0)
        val spec = spec(listOf(asset), prices, totalDays = 5)
        val state = state(spec)
        val engine = TradingEngine(spec, state)

        assertTrue(engine.buyOptionContract("SPX", "CALL", 100.0))
        assertEquals(1, state.optionsPositions.size)
        assertEquals(9_900.0, state.cash)

        state.dayIdx = 1
        val metrics = engine.computePortfolioMetrics()
        assertEquals(9_900.0 + 150.0, metrics.netWorth, 1e-9)
        assertEquals(50.0, metrics.unrealizedPnL, 1e-9)
    }
}


private class MemoryCampaignStorage : CampaignStorage {
    val values: MutableMap<String, String> = mutableMapOf()

    override fun getItem(key: String): String? = values[key]

    override fun putItem(key: String, value: String) {
        values[key] = value
    }
}
