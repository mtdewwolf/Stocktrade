package com.mtdewwolf.stocktrade.core

import kotlinx.serialization.json.Json
import java.nio.ByteBuffer
import java.nio.ByteOrder

object JvmSpecLoader {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun load(): GameSpec {
        val content = json.decodeFromString<GameContent>(resource("content.json").decodeToString())
        val marketBytes = resource("market.f32")
        val seriesBytes = resource("series.f64")
        require(marketBytes.size % Float.SIZE_BYTES == 0)
        require(seriesBytes.size % Double.SIZE_BYTES == 0)
        val prices = FloatArray(marketBytes.size / Float.SIZE_BYTES)
        ByteBuffer.wrap(marketBytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(prices)
        val series = DoubleArray(seriesBytes.size / Double.SIZE_BYTES)
        ByteBuffer.wrap(seriesBytes).order(ByteOrder.LITTLE_ENDIAN).asDoubleBuffer().get(series)
        return GameSpec(content, prices, series)
    }

    private fun resource(name: String): ByteArray =
        checkNotNull(JvmSpecLoader::class.java.getResourceAsStream("/$name")) { "Missing spec resource $name" }
            .use { it.readBytes() }
}
