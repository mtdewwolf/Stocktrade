package com.mtdewwolf.stocktrade.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class GameContent(
    val schemaVersion: Int,
    val contentVersion: String,
    val calendar: TradingCalendar,
    val assets: List<Asset>,
    val events: List<HistoricalEvent> = emptyList(),
    val dilemmas: List<HistoricalDilemma> = emptyList(),
    val scenarios: List<Scenario> = emptyList(),
    val lifestyle: List<LifestyleUpgrade> = emptyList(),
    val achievements: List<Achievement> = emptyList(),
    val legends: List<Legend> = emptyList(),
    val tutorials: JsonObject? = null,
    val rules: GameRules,
)

@Serializable
data class TradingCalendar(
    val startIso: String,
    val endIso: String,
    val totalDays: Int,
    val dates: List<TradingDate>,
)

@Serializable
data class TradingDate(
    val iso: String,
    val year: Int,
    val month: Int,
    val day: Int,
    val pretty: String,
    val era: String,
)

@Serializable
data class Asset(
    val symbol: String,
    val name: String,
    val sector: String,
    val divYield: Double,
    val ipoDate: String,
    val delistDate: String? = null,
    val volatility: Double,
    val bio: String,
    val ipoIdx: Int,
    val delistIdx: Int? = null,
    val priceOffset: Int,
    val mystery: MysteryIdentity? = null,
)

@Serializable
data class MysteryIdentity(
    val code: String,
    val name: String,
    val bio: String,
)

@Serializable
data class HistoricalEvent(
    val date: String,
    val type: String,
    val pause: Boolean,
    val headline: String,
    val dayIdx: Int,
)

@Serializable
data class HistoricalDilemma(
    val id: String,
    val date: String,
    val title: String,
    val desc: String,
    val choiceATitle: String,
    val choiceADesc: String,
    val choiceBTitle: String,
    val choiceBDesc: String,
    val dayIdx: Int,
)

@Serializable
data class Scenario(
    val id: String,
    val title: String,
    val startIso: String,
    val endIso: String,
    val startCash: Double,
    val targetNw: Double,
    val desc: String,
    val startDayIdx: Int,
    val endDayIdx: Int,
)

@Serializable
data class LifestyleUpgrade(
    val id: String,
    val icon: String,
    val name: String,
    val cost: Double,
    val buffText: String,
)

@Serializable
data class Achievement(
    val id: String,
    val icon: String,
    val title: String,
    val desc: String,
)

@Serializable
data class Legend(
    val id: String,
    val name: String,
    val avatar: String,
    val strategy: String,
    val cagr: Double?,
    val isLegend: Boolean,
)

@Serializable
data class GameRules(
    val sessionsPerYear: Int,
    val dividendSessionInterval: Int,
    val optionTermSessions: Int,
    val optionLeverage: Int,
    val marketEncoding: String,
    val marketLayout: String,
    val seriesEncoding: String,
    val seriesLayout: String,
    val seriesFields: List<String>,
)
