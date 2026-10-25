package com.mtdewwolf.stocktrade.android.data

import android.content.res.AssetManager
import com.mtdewwolf.stocktrade.core.GameContent
import com.mtdewwolf.stocktrade.core.GameSpec
import kotlinx.serialization.json.Json
import java.nio.ByteBuffer
import java.nio.ByteOrder

object SpecAssets {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun load(assets: AssetManager): GameSpec {
        val contentBytes = assets.open("content.json").use { it.readBytes() }
        val content = json.decodeFromString<GameContent>(contentBytes.decodeToString())
        val marketBytes = assets.open("market.f32").use { it.readBytes() }
        val seriesBytes = assets.open("series.f64").use { it.readBytes() }

        require(marketBytes.size % Float.SIZE_BYTES == 0) { "Market data is not float32-aligned" }
        require(seriesBytes.size % Double.SIZE_BYTES == 0) { "Series data is not float64-aligned" }

        val prices = FloatArray(marketBytes.size / Float.SIZE_BYTES)
        ByteBuffer.wrap(marketBytes)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asFloatBuffer()
            .get(prices)

        val series = DoubleArray(seriesBytes.size / Double.SIZE_BYTES)
        ByteBuffer.wrap(seriesBytes)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asDoubleBuffer()
            .get(series)

        return GameSpec(content, prices, series)
    }
}
