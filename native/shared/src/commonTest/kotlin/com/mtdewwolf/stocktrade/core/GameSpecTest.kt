package com.mtdewwolf.stocktrade.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GameSpecTest {
    private val dates = listOf(
        TradingDate("1980-01-02", 1980, 1, 2, "Wed, Jan 2, 1980", "1980–82 Volcker Era"),
        TradingDate("1980-01-03", 1980, 1, 3, "Thu, Jan 3, 1980", "1980–82 Volcker Era"),
        TradingDate("1980-01-04", 1980, 1, 4, "Fri, Jan 4, 1980", "1980–82 Volcker Era"),
        TradingDate("1980-01-07", 1980, 1, 7, "Mon, Jan 7, 1980", "1980–82 Volcker Era"),
        TradingDate("1980-01-08", 1980, 1, 8, "Tue, Jan 8, 1980", "1980–82 Volcker Era"),
    )

    private fun asset(
        symbol: String,
        ipoIdx: Int,
        delistIdx: Int?,
        priceOffset: Int,
    ) = Asset(
        symbol = symbol,
        name = symbol,
        sector = "Macro",
        divYield = 0.0,
        ipoDate = dates[ipoIdx].iso,
        delistDate = delistIdx?.let { dates[it].iso },
        volatility = 0.01,
        bio = "",
        ipoIdx = ipoIdx,
        delistIdx = delistIdx,
        priceOffset = priceOffset,
    )

    private fun spec(): GameSpec {
        val assets = listOf(
            asset("SPX", ipoIdx = 0, delistIdx = null, priceOffset = 0),
            asset("IPO", ipoIdx = 2, delistIdx = null, priceOffset = 5),
            asset("DEAD", ipoIdx = 0, delistIdx = 3, priceOffset = 10),
        )
        val content = GameContent(
            schemaVersion = 1,
            contentVersion = "test",
            calendar = TradingCalendar(
                startIso = dates.first().iso,
                endIso = dates.last().iso,
                totalDays = dates.size,
                dates = dates,
            ),
            assets = assets,
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
        val prices = floatArrayOf(
            100f, 101f, 102f, 103f, 104f,
            0f, 0f, 50f, 51f, 52f,
            20f, 21f, 22f, 0f, 0f,
        )
        val series = DoubleArray(dates.size * 2) { index ->
            val day = index / 2
            if (index % 2 == 0) 14.0 + day else 1.0 + day
        }
        return GameSpec(content, prices, series)
    }

    @Test
    fun appliesIpoAndDelistingBoundaries() {
        val spec = spec()

        assertEquals(100f, spec.price("SPX", 0))
        assertEquals(0f, spec.price("IPO", 1))
        assertEquals(50f, spec.price("IPO", 2))
        assertTrue(spec.isTradable(spec.asset("IPO")!!, 2))

        assertEquals(22f, spec.price("DEAD", 2))
        assertEquals(0f, spec.price("DEAD", 3))
        assertFalse(spec.isTradable(spec.asset("DEAD")!!, 3))
    }

    @Test
    fun readsDailyMacroSeriesAndCalendar() {
        val spec = spec()

        assertEquals(14.0, spec.fedRatePct(0))
        assertEquals(18.0, spec.fedRatePct(4))
        assertEquals(1.0, spec.cpiDeflator(0))
        assertEquals(5.0, spec.cpiDeflator(4))
        assertEquals("Fri, Jan 4, 1980", spec.date(2).pretty)
    }
}
