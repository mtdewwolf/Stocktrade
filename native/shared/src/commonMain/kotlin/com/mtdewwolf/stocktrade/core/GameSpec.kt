package com.mtdewwolf.stocktrade.core

class GameSpec(
    val content: GameContent,
    private val marketPrices: FloatArray,
    private val dailySeries: DoubleArray,
) {
    val assets: List<Asset> = content.assets
    val assetsBySymbol: Map<String, Asset> = assets.associateBy(Asset::symbol)
    val calendar: TradingCalendar = content.calendar

    init {
        require(assets.isNotEmpty()) { "Game spec contains no assets" }
        require(calendar.totalDays > 0) { "Game spec contains no trading days" }
        require(calendar.dates.size == calendar.totalDays) { "Trading calendar size mismatch" }
        require(marketPrices.size >= assets.size * calendar.totalDays) { "Market series is truncated" }
        require(dailySeries.size >= calendar.totalDays * SERIES_STRIDE) { "Daily series is truncated" }
        require(content.rules.marketLayout == "asset-major") { "Unsupported market layout" }
        require(content.rules.seriesLayout == "day-major") { "Unsupported series layout" }
    }

    fun asset(symbol: String): Asset? = assetsBySymbol[symbol]

    fun price(symbol: String, dayIdx: Int): Float {
        val asset = assetsBySymbol[symbol] ?: return 0f
        return price(asset, dayIdx)
    }

    fun price(asset: Asset, dayIdx: Int): Float {
        if (dayIdx < 0 || dayIdx >= calendar.totalDays) return 0f
        if (dayIdx < asset.ipoIdx) return 0f
        if (asset.delistIdx != null && dayIdx >= asset.delistIdx) return 0f
        return marketPrices[asset.priceOffset + dayIdx]
    }

    fun isTradable(asset: Asset, dayIdx: Int): Boolean = price(asset, dayIdx) > MIN_TRADABLE_PRICE

    fun fedRatePct(dayIdx: Int): Double = seriesValue(dayIdx, 0)

    fun cpiDeflator(dayIdx: Int): Double = seriesValue(dayIdx, 1)

    fun date(dayIdx: Int): TradingDate = calendar.dates[dayIdx.coerceIn(0, calendar.totalDays - 1)]

    private fun seriesValue(dayIdx: Int, field: Int): Double {
        if (dayIdx < 0 || dayIdx >= calendar.totalDays) return 0.0
        return dailySeries[dayIdx * SERIES_STRIDE + field]
    }

    private companion object {
        const val SERIES_STRIDE = 2
        const val MIN_TRADABLE_PRICE = 0.001f
    }
}
