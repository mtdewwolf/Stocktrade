package com.mtdewwolf.stocktrade.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@Serializable
private data class GoldenSnapshot(
    val label: String,
    val dayIdx: Int,
    val cash: Double,
    val netWorth: Double,
    val buyingPower: Double,
    val equityValue: Double,
    val unrealizedPnL: Double,
    val realizedPnL: Double,
    val totalInterestEarned: Double,
    val totalDividendsEarned: Double,
    val peakNetWorth: Double,
    val maxDrawdownPct: Double,
    val positionCount: Int,
    val optionCount: Int,
    val tradeCount: Int,
    val spxShares: Double,
    val spxCost: Double,
)

@Serializable
private data class GoldenFixture(
    val generatedFrom: String,
    val scenario: List<String>,
    val snapshots: List<GoldenSnapshot>,
)

class EngineGoldenTest {
    private companion object {
        val json = Json { ignoreUnknownKeys = true }
    }

    @Test
    fun matchesReferenceEngineForDeterministicCampaign() {
        val stream = EngineGoldenTest::class.java.getResourceAsStream("/golden/engine_parity.json")
        assertNotNull(stream)
        val fixture = json.decodeFromString<GoldenFixture>(stream.bufferedReader().use { it.readText() })
        val spec = JvmSpecLoader.load()
        val state = TradingState(spec.calendar.totalDays).apply {
            autoPauseOnEvents = false
            enableDilemmas = false
            maxLeverage = 2.0
        }
        val engine = TradingEngine(spec, state)

        val actual = mutableListOf<Snapshot>()
        actual += snapshot("initial", state, engine)

        engine.executeBuy("SPX", 4_000.0, null, true)
        advance(engine, 31)
        actual += snapshot("buy_spx_31", state, engine)

        engine.executeShortSell("SPX", 2_500.0, true)
        advance(engine, 15)
        actual += snapshot("short_spx_46", state, engine)

        engine.executeCoverShort("SPX", 1e9, true)
        advance(engine, 17)
        actual += snapshot("cover_spx_63", state, engine)

        engine.buyOptionContract("SPX", "CALL", 1_000.0)
        advance(engine, 30)
        actual += snapshot("option_expiry_93", state, engine)

        assertEquals(fixture.snapshots.map { it.label }, actual.map { it.label })
        fixture.snapshots.zip(actual).forEach { (expected, got) ->
            assertEquals(expected.dayIdx, got.dayIdx, expected.label)
            assertEquals(expected.positionCount, got.positionCount, expected.label)
            assertEquals(expected.optionCount, got.optionCount, expected.label)
            assertEquals(expected.tradeCount, got.tradeCount, expected.label)
            assertEquals(expected.cash, got.cash, 1e-6, expected.label)
            assertEquals(expected.netWorth, got.netWorth, 1e-6, expected.label)
            assertEquals(expected.buyingPower, got.buyingPower, 1e-6, expected.label)
            assertEquals(expected.equityValue, got.equityValue, 1e-6, expected.label)
            assertEquals(expected.unrealizedPnL, got.unrealizedPnL, 1e-6, expected.label)
            assertEquals(expected.realizedPnL, got.realizedPnL, 1e-6, expected.label)
            assertEquals(expected.totalInterestEarned, got.totalInterestEarned, 1e-6, expected.label)
            assertEquals(expected.totalDividendsEarned, got.totalDividendsEarned, 1e-6, expected.label)
            assertEquals(expected.peakNetWorth, got.peakNetWorth, 1e-6, expected.label)
            assertEquals(expected.maxDrawdownPct, got.maxDrawdownPct, 1e-6, expected.label)
            assertEquals(expected.spxShares, got.spxShares, 1e-6, expected.label)
            assertEquals(expected.spxCost, got.spxCost, 1e-6, expected.label)
        }
    }

    private fun advance(engine: TradingEngine, days: Int) {
        repeat(days) { engine.processSingleTradingDayStep() }
    }

    private data class Snapshot(
        val label: String,
        val dayIdx: Int,
        val cash: Double,
        val netWorth: Double,
        val buyingPower: Double,
        val equityValue: Double,
        val unrealizedPnL: Double,
        val realizedPnL: Double,
        val totalInterestEarned: Double,
        val totalDividendsEarned: Double,
        val peakNetWorth: Double,
        val maxDrawdownPct: Double,
        val positionCount: Int,
        val optionCount: Int,
        val tradeCount: Int,
        val spxShares: Double,
        val spxCost: Double,
    )

    private fun snapshot(label: String, state: TradingState, engine: TradingEngine): Snapshot {
        val metrics = engine.computePortfolioMetrics()
        val spx = state.positions["SPX"]
        return Snapshot(
            label = label,
            dayIdx = state.dayIdx,
            cash = state.cash,
            netWorth = metrics.netWorth,
            buyingPower = metrics.buyingPower,
            equityValue = metrics.equityValue,
            unrealizedPnL = metrics.unrealizedPnL,
            realizedPnL = state.realizedPnL,
            totalInterestEarned = state.totalInterestEarned,
            totalDividendsEarned = state.totalDividendsEarned,
            peakNetWorth = state.peakNetWorth,
            maxDrawdownPct = state.maxDrawdownPct,
            positionCount = state.positions.size,
            optionCount = state.optionsPositions.size,
            tradeCount = state.tradeHistory.size,
            spxShares = spx?.shares ?: 0.0,
            spxCost = spx?.totalCost ?: 0.0,
        )
    }
}
