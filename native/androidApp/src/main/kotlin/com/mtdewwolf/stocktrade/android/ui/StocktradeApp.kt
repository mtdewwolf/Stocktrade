package com.mtdewwolf.stocktrade.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.mtdewwolf.stocktrade.android.data.AndroidCampaignStorage
import com.mtdewwolf.stocktrade.android.data.SpecAssets
import com.mtdewwolf.stocktrade.android.ui.theme.Border
import com.mtdewwolf.stocktrade.android.ui.theme.Cyan
import com.mtdewwolf.stocktrade.android.ui.theme.Emerald
import com.mtdewwolf.stocktrade.android.ui.theme.Gold
import com.mtdewwolf.stocktrade.android.ui.theme.Ink
import com.mtdewwolf.stocktrade.android.ui.theme.Muted
import com.mtdewwolf.stocktrade.android.ui.theme.Obsidian
import com.mtdewwolf.stocktrade.android.ui.theme.Panel
import com.mtdewwolf.stocktrade.android.ui.theme.PanelRaised
import com.mtdewwolf.stocktrade.android.ui.theme.Rose
import com.mtdewwolf.stocktrade.core.Asset
import com.mtdewwolf.stocktrade.core.CampaignPersistence
import com.mtdewwolf.stocktrade.core.EngineEvent
import com.mtdewwolf.stocktrade.core.GameSpec
import com.mtdewwolf.stocktrade.core.HistoricalDilemma
import com.mtdewwolf.stocktrade.core.LifestyleUpgrade
import com.mtdewwolf.stocktrade.core.NoticeKind
import com.mtdewwolf.stocktrade.core.PortfolioMetrics
import com.mtdewwolf.stocktrade.core.Scenario
import com.mtdewwolf.stocktrade.core.TradeRecord
import com.mtdewwolf.stocktrade.core.TradingEngine
import com.mtdewwolf.stocktrade.core.TradingEngineListener
import com.mtdewwolf.stocktrade.core.TradingState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

@Composable
fun StocktradeApp() {
    val context = LocalContext.current
    var spec by remember { mutableStateOf<GameSpec?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(attempt) {
        spec = null
        errorMessage = null
        runCatching {
            withContext(Dispatchers.IO) {
                SpecAssets.load(context.assets)
            }
        }.onSuccess {
            spec = it
        }.onFailure {
            errorMessage = it.message ?: "Could not read the packaged game spec."
        }
    }

    when {
        errorMessage != null -> ErrorScreen(
            message = errorMessage.orEmpty(),
            onRetry = { attempt++ },
        )

        spec == null -> LoadingScreen()

        else -> TradingScreen(spec = spec!!)
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Obsidian),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = Gold)
            Spacer(Modifier.height(18.dp))
            Text(
                text = "LOADING MARKET HISTORY",
                style = MaterialTheme.typography.labelLarge,
                color = Muted,
            )
        }
    }
}

@Composable
private fun ErrorScreen(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Obsidian)
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "SPEC LOAD FAILED",
                style = MaterialTheme.typography.titleLarge,
                color = Rose,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
            )
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Gold,
                    contentColor = Obsidian,
                ),
            ) {
                Text("Retry")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TradingScreen(spec: GameSpec) {
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var revision by remember { mutableIntStateOf(0) }
    var pauseRequested by remember { mutableStateOf(false) }
    var pendingDilemma by remember { mutableStateOf<HistoricalDilemma?>(null) }
    var pendingAchievement by remember { mutableStateOf<String?>(null) }
    var showResetDialog by remember { mutableStateOf(false) }
    var showScenarioSheet by remember { mutableStateOf(false) }
    var pendingScenario by remember { mutableStateOf<Scenario?>(null) }
    var showCareerScore by remember { mutableStateOf(false) }
    var showEmpireSheet by remember { mutableStateOf(false) }
    var showTradeHistory by remember { mutableStateOf(false) }
    var pendingUpgrade by remember { mutableStateOf<LifestyleUpgrade?>(null) }
    var pendingSaveJob by remember { mutableStateOf<Job?>(null) }
    var orderAmount by rememberSaveable { mutableDoubleStateOf(1_000.0) }
    var viewDayIdx by rememberSaveable { mutableIntStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    var sector by rememberSaveable { mutableStateOf("ALL") }
    var selectedSymbol by rememberSaveable { mutableStateOf<String?>(null) }

    val persistenceHolder = remember { PersistenceHolder() }
    val listener = remember(spec) {
        TradingEngineListener { event ->
            when (event) {
                is EngineEvent.Notice -> {
                    val message = noticeMessage(event)
                    scope.launch {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        snackbarHostState.showSnackbar(message, duration = SnackbarDuration.Short)
                    }
                }

                is EngineEvent.AchievementUnlocked -> pendingAchievement = event.id
                is EngineEvent.DilemmaOpened -> pendingDilemma = event.dilemma
                EngineEvent.Pause -> pauseRequested = true
                EngineEvent.CareerWrapUp -> showCareerScore = true
                EngineEvent.SaveNow -> {
                    pendingSaveJob?.cancel()
                    pendingSaveJob = null
                    persistenceHolder.persistence?.saveCampaignToStorage()
                }

                EngineEvent.ScheduleSave -> {
                    pendingSaveJob?.cancel()
                    pendingSaveJob = scope.launch {
                        delay(350)
                        persistenceHolder.persistence?.saveCampaignToStorage()
                        pendingSaveJob = null
                    }
                }

                else -> Unit
            }
            revision++
        }
    }
    val state = remember(spec) { TradingState(spec.calendar.totalDays) }
    val engine = remember(spec) { TradingEngine(spec, state, listener) }
    val persistence = remember(spec) {
        CampaignPersistence(spec, state, engine, AndroidCampaignStorage(context)).also {
            persistenceHolder.persistence = it
        }
    }

    LaunchedEffect(spec) {
        if (!persistence.loadCampaignFromStorage()) {
            engine.reset()
        }
        viewDayIdx = state.dayIdx
        pendingDilemma = engine.pendingDilemma()
        revision++
    }

    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        pendingSaveJob?.cancel()
        pendingSaveJob = null
        persistence.saveCampaignToStorage()
    }

    val dayIdx = viewDayIdx
    val metrics = remember(engine, revision) { engine.computePortfolioMetrics() }
    val sectors = remember(spec) {
        listOf("ALL") + spec.assets.map(Asset::sector).distinct().sorted()
    }
    val filteredAssets = remember(spec, query, sector, dayIdx, revision) {
        val needle = query.trim()
        spec.assets.filter { asset ->
            val sectorMatch = sector == "ALL" || asset.sector == sector
            val queryMatch = needle.isEmpty() ||
                asset.symbol.contains(needle, ignoreCase = true) ||
                asset.name.contains(needle, ignoreCase = true)
            sectorMatch && queryMatch
        }.sortedWith(
            compareBy<Asset> { asset ->
                val delistIdx = asset.delistIdx
                val listed = dayIdx >= asset.ipoIdx &&
                    (delistIdx == null || dayIdx < delistIdx)
                if (listed) 0 else 1
            }.thenBy(Asset::symbol),
        )
    }
    val selectedAsset = selectedSymbol?.let(spec.assetsBySymbol::get)

    fun moveTo(target: Int) {
        viewDayIdx = target.coerceIn(0, state.dayIdx)
    }

    fun simulate(days: Int) {
        viewDayIdx = state.dayIdx
        pauseRequested = false
        var remaining = days
        while (remaining > 0) {
            if (!engine.processSingleTradingDayStep()) break
            remaining--
            if (pauseRequested) break
        }
        viewDayIdx = state.dayIdx
        revision++
    }

    fun startScenario(scenario: Scenario) {
        engine.reset(scenario.startCash, scenario)
        persistence.saveCampaignToStorage()
        selectedSymbol = null
        viewDayIdx = state.dayIdx
        query = ""
        sector = "ALL"
        pauseRequested = false
        showCareerScore = false
        pendingScenario = null
        revision++
        scope.launch {
            snackbarHostState.showSnackbar("${scenario.title} started", duration = SnackbarDuration.Short)
        }
    }

    Scaffold(
        containerColor = Obsidian,
        contentWindowInsets = WindowInsets.safeDrawing,
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 36.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                AppHeader(
                    spec = spec,
                    dayIdx = dayIdx,
                    simDayIdx = state.dayIdx,
                    onMoveTo = ::moveTo,
                    onSimulate = ::simulate,
                )
            }
            item {
                CapitalCard(
                    state = state,
                    metrics = metrics,
                    onReset = { showResetDialog = true },
                    onScenarios = { showScenarioSheet = true },
                )
            }
            state.activeScenario?.let { scenario ->
                item {
                    ScenarioProgressCard(
                        scenario = scenario,
                        state = state,
                        metrics = metrics,
                        onOpenScorecard = { showCareerScore = true },
                    )
                }
            }
            if (state.triggeredEvents.isNotEmpty()) {
                item {
                    EventFeedCard(
                        events = state.triggeredEvents,
                        maxDayIdx = dayIdx,
                    )
                }
            }
            if (state.positions.isNotEmpty() || state.optionsPositions.isNotEmpty()) {
                item {
                    PositionsCard(
                        spec = spec,
                        state = state,
                        engine = engine,
                        onChanged = { revision++ },
                    )
                }
            }
            item {
                EmpireCard(
                    state = state,
                    achievementTotal = spec.content.achievements.size,
                    onOpen = { showEmpireSheet = true },
                )
            }
            if (state.tradeHistory.isNotEmpty()) {
                item {
                    TradeLogCard(
                        trades = state.tradeHistory,
                        onOpen = { showTradeHistory = true },
                    )
                }
            }
            item {
                SearchField(
                    query = query,
                    onQueryChange = { query = it },
                )
            }
            item {
                SectorFilters(
                    sectors = sectors,
                    selected = sector,
                    onSelect = { sector = it },
                )
            }
            item {
                SectionHeader(
                    title = "MARKET BOARD",
                    detail = "${filteredAssets.size} ASSETS",
                )
            }
            items(filteredAssets, key = Asset::symbol) { asset ->
                AssetRow(
                    spec = spec,
                    asset = asset,
                    dayIdx = dayIdx,
                    onClick = {
                        state.selectedSymbol = asset.symbol
                        selectedSymbol = asset.symbol
                    },
                )
            }
            item {
                Text(
                    text = "OFFLINE SIMULATION  •  DATA GENERATED FROM THE WEB REFERENCE  •  NOT INVESTMENT ADVICE",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted.copy(alpha = 0.72f),
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }

    if (selectedAsset != null) {
        AssetDetailSheet(
            spec = spec,
            asset = selectedAsset,
            dayIdx = dayIdx,
            state = state,
            engine = engine,
            metrics = metrics,
            orderAmount = orderAmount,
            canTrade = viewDayIdx == state.dayIdx,
            onAmountChange = { orderAmount = it },
            onAction = { revision++ },
            onReturnToLive = { viewDayIdx = state.dayIdx },
            onDismiss = { selectedSymbol = null },
        )
    }

    pendingDilemma?.let { dilemma ->
        DilemmaDialog(
            dilemma = dilemma,
            onChoose = { choice ->
                val bonus = dilemmaBonus(dilemma.id, choice, state.cash)
                state.cash += bonus
                state.realizedPnL += bonus
                state.triggeredDilemmas[dilemma.id] = true
                pendingDilemma = null
                persistence.saveCampaignToStorage()
                revision++
            },
        )
    }

    pendingAchievement?.let { id ->
        val achievement = spec.content.achievements.firstOrNull { it.id == id }
        AlertDialog(
            onDismissRequest = { pendingAchievement = null },
            containerColor = Panel,
            titleContentColor = Ink,
            textContentColor = Muted,
            title = { Text(achievement?.title ?: "Achievement unlocked") },
            text = { Text(achievement?.desc ?: id) },
            confirmButton = {
                TextButton(onClick = { pendingAchievement = null }) {
                    Text("COLLECT", color = Gold)
                }
            },
        )
    }

    if (showScenarioSheet) {
        ScenarioSheet(
            spec = spec,
            onSelect = { scenario ->
                showScenarioSheet = false
                pendingScenario = scenario
            },
            onDismiss = { showScenarioSheet = false },
        )
    }

    pendingScenario?.let { scenario ->
        AlertDialog(
            onDismissRequest = { pendingScenario = null },
            containerColor = Panel,
            titleContentColor = Ink,
            textContentColor = Muted,
            title = { Text("Start mission?") },
            text = {
                Text(
                    "${scenario.title}\n\n" +
                        "Start ${scenario.startIso} with ${formatMoney(scenario.startCash)}. " +
                        "This erases the current campaign, portfolio, and trade history.",
                )
            },
            confirmButton = {
                TextButton(onClick = { startScenario(scenario) }) {
                    Text("START MISSION", color = Gold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingScenario = null }) {
                    Text("CANCEL", color = Muted)
                }
            },
        )
    }

    if (showCareerScore) {
        CareerScoreDialog(
            spec = spec,
            state = state,
            metrics = metrics,
            onNewMission = {
                showCareerScore = false
                showScenarioSheet = true
            },
            onDismiss = { showCareerScore = false },
        )
    }

    if (showEmpireSheet) {
        EmpireSheet(
            spec = spec,
            state = state,
            onBuy = { pendingUpgrade = it },
            onDismiss = { showEmpireSheet = false },
        )
    }

    if (showTradeHistory) {
        TradeHistorySheet(
            trades = state.tradeHistory,
            onDismiss = { showTradeHistory = false },
        )
    }

    pendingUpgrade?.let { upgrade ->
        AlertDialog(
            onDismissRequest = { pendingUpgrade = null },
            containerColor = Panel,
            titleContentColor = Ink,
            textContentColor = Muted,
            title = { Text("Buy ${upgrade.name}?") },
            text = {
                Text(
                    "${upgrade.buffText}\n\n" +
                        "Cost: ${formatMoney(upgrade.cost)}. This purchase is permanent for the current campaign.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        engine.buyLifestyleUpgrade(upgrade.id)
                        pendingUpgrade = null
                        revision++
                    },
                ) {
                    Text("BUY", color = Gold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingUpgrade = null }) {
                    Text("CANCEL", color = Muted)
                }
            },
        )
    }

    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            containerColor = Panel,
            titleContentColor = Ink,
            textContentColor = Muted,
            title = { Text("Start over?") },
            text = { Text("This erases the current campaign, portfolio, and trade history.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        engine.reset()
                        persistence.saveCampaignToStorage()
                        selectedSymbol = null
                        viewDayIdx = 0
                        query = ""
                        sector = "ALL"
                        showResetDialog = false
                        revision++
                    },
                ) {
                    Text("RESET CAMPAIGN", color = Rose)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) {
                    Text("KEEP PLAYING", color = Muted)
                }
            },
        )
    }
}

private class PersistenceHolder {
    var persistence: CampaignPersistence? = null
}

@Composable
private fun AppHeader(
    spec: GameSpec,
    dayIdx: Int,
    simDayIdx: Int,
    onMoveTo: (Int) -> Unit,
    onSimulate: (Int) -> Unit,
) {
    val date = spec.date(dayIdx)
    val isLive = dayIdx == simDayIdx

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Gold),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "WS",
                    color = Obsidian,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    text = "WALL STREET",
                    style = MaterialTheme.typography.titleLarge,
                    color = Ink,
                    letterSpacing = 1.2.sp,
                )
                Text(
                    text = "TIME MACHINE",
                    style = MaterialTheme.typography.labelLarge,
                    color = Gold,
                    letterSpacing = 2.2.sp,
                )
            }
            Spacer(Modifier.weight(1f))
            Surface(
                color = Emerald.copy(alpha = 0.12f),
                contentColor = Emerald,
                shape = RoundedCornerShape(50),
                border = BorderStroke(1.dp, Emerald.copy(alpha = 0.28f)),
            ) {
                Text(
                    text = "NATIVE",
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }

        Surface(
            color = Panel,
            shape = RoundedCornerShape(22.dp),
            border = BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            listOf(Gold.copy(alpha = 0.10f), Color.Transparent),
                        ),
                    )
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = "MARKET DATE",
                    style = MaterialTheme.typography.labelMedium,
                    color = Gold,
                )
                Text(
                    text = date.pretty,
                    style = MaterialTheme.typography.headlineSmall,
                    color = Ink,
                )
                Text(
                    text = date.era,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Muted,
                )
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DayButton(label = "-1D") { onMoveTo(dayIdx - 1) }
                    DayButton(label = "+1D") { onMoveTo(dayIdx + 1) }
                    DayButton(label = "+1Y") { onMoveTo(dayIdx + 252) }
                    DayButton(label = "SIM 1D", accent = true) { onSimulate(1) }
                    DayButton(label = "SIM 30D", accent = true) { onSimulate(30) }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (isLive) "LIVE CAMPAIGN" else "VIEWING HISTORY",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (isLive) Emerald else Gold,
                    )
                    if (!isLive) {
                        Spacer(Modifier.width(8.dp))
                        DayButton(label = "RETURN LIVE") { onMoveTo(simDayIdx) }
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = "${(dayIdx + 1).formatThousands()} / ${spec.calendar.totalDays.formatThousands()}",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@Composable
private fun DayButton(label: String, accent: Boolean = false, onClick: () -> Unit) {
    Surface(
        color = if (accent) Gold.copy(alpha = 0.16f) else PanelRaised,
        contentColor = if (accent) Gold else Ink,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun CapitalCard(
    state: TradingState,
    metrics: PortfolioMetrics,
    onReset: () -> Unit,
    onScenarios: () -> Unit,
) {
    val pnl = metrics.netWorth - state.startingCash
    Surface(
        color = Panel,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        listOf(Emerald.copy(alpha = 0.09f), Color.Transparent),
                    ),
                )
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "NET WORTH",
                    style = MaterialTheme.typography.labelLarge,
                    color = Muted,
                )
                Spacer(Modifier.weight(1f))
                Surface(
                    color = Gold.copy(alpha = 0.12f),
                    contentColor = Gold,
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        text = "SIMULATION",
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                    )
                }
                TextButton(onClick = onScenarios) {
                    Text(
                        text = "MISSIONS",
                        style = MaterialTheme.typography.labelMedium,
                        color = Gold,
                    )
                }
                TextButton(onClick = onReset) {
                    Text(
                        text = "RESET",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                    )
                }
            }
            Text(
                text = formatMoney(metrics.netWorth),
                style = MaterialTheme.typography.displaySmall,
                color = Ink,
                fontFamily = FontFamily.Monospace,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CapitalStat("CASH", formatMoney(state.cash), Modifier.weight(1f))
                CapitalStat("BUYING POWER", formatMoney(metrics.buyingPower), Modifier.weight(1f))
                CapitalStat(
                    label = "P&L",
                    value = formatSignedMoney(pnl),
                    modifier = Modifier.weight(1f),
                    valueColor = if (pnl >= 0) Emerald else Rose,
                )
            }
        }
    }
}

@Composable
private fun CapitalStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color = Ink,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = Muted,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = valueColor,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun TradeLogCard(
    trades: List<TradeRecord>,
    onOpen: () -> Unit,
) {
    Surface(
        color = Panel,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onOpen),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "TRADE LOG",
                        style = MaterialTheme.typography.labelLarge,
                        color = Gold,
                    )
                    Text(
                        text = "${trades.size.formatThousands()} ${if (trades.size == 1) "EXECUTION" else "EXECUTIONS"}",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                    )
                }
                Text(
                    text = "VIEW ALL",
                    style = MaterialTheme.typography.labelMedium,
                    color = Ink,
                )
            }
            trades.take(3).forEach { trade ->
                TradeLogRow(trade = trade)
            }
        }
    }
}

@Composable
private fun TradeLogRow(trade: TradeRecord) {
    val typeColor = when (trade.type) {
        "BUY", "SHORT WIN" -> Emerald
        "BANKRUPT" -> Rose
        else -> Cyan
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = trade.dateStr,
                style = MaterialTheme.typography.labelMedium,
                color = Muted,
            )
            Text(
                text = "${trade.type} ${trade.symbol}",
                style = MaterialTheme.typography.bodySmall,
                color = typeColor,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = trade.note,
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = formatMoney(abs(trade.amount)),
            style = MaterialTheme.typography.bodySmall,
            color = Ink,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TradeHistorySheet(
    trades: List<TradeRecord>,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        contentColor = Ink,
        scrimColor = Color.Black.copy(alpha = 0.62f),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "TRADE LOG",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Ink,
                    )
                    Text(
                        text = "${trades.size.formatThousands()} ${if (trades.size == 1) "execution" else "executions"} in this campaign, newest first.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
            }
            if (trades.isEmpty()) {
                item {
                    Text(
                        text = "No trades executed yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Muted,
                    )
                }
            } else {
                items(trades.take(60)) { trade ->
                    TradeLogRow(trade = trade)
                }
            }
        }
    }
}

@Composable
private fun EmpireCard(
    state: TradingState,
    achievementTotal: Int,
    onOpen: () -> Unit,
) {
    val lifestyleCount = state.ownedLifestyle.count { it.value }
    val achievementCount = state.unlockedAchievements.count { it.value }
    Surface(
        color = Panel,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onOpen),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = "EMPIRE BUILDER",
                    style = MaterialTheme.typography.labelLarge,
                    color = Gold,
                )
                Text(
                    text = "$lifestyleCount LIFESTYLE  •  $achievementCount/$achievementTotal BADGES",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                )
            }
            Text(
                text = "OPEN",
                style = MaterialTheme.typography.labelMedium,
                color = Ink,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmpireSheet(
    spec: GameSpec,
    state: TradingState,
    onBuy: (LifestyleUpgrade) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        contentColor = Ink,
        scrimColor = Color.Black.copy(alpha = 0.62f),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "EMPIRE BUILDER",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Ink,
                    )
                    Text(
                        text = "Spend cash on permanent perks and collect badges as your net worth grows.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
            }
            item {
                Text(
                    text = "LIFESTYLE",
                    style = MaterialTheme.typography.labelLarge,
                    color = Gold,
                )
            }
            items(spec.content.lifestyle, key = LifestyleUpgrade::id) { upgrade ->
                val owned = state.ownedLifestyle[upgrade.id] == true
                val affordable = state.cash >= upgrade.cost
                Surface(
                    color = if (owned) Emerald.copy(alpha = 0.08f) else PanelRaised,
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, if (owned) Emerald.copy(alpha = 0.30f) else Border),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable(enabled = !owned && affordable) { onBuy(upgrade) },
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(text = upgrade.icon, fontSize = 24.sp)
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(
                                text = upgrade.name,
                                style = MaterialTheme.typography.titleSmall,
                                color = Ink,
                            )
                            Text(
                                text = upgrade.buffText,
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted,
                            )
                        }
                        Text(
                            text = when {
                                owned -> "OWNED"
                                affordable -> formatMoney(upgrade.cost)
                                else -> "LOCKED"
                            },
                            style = MaterialTheme.typography.labelMedium,
                            color = when {
                                owned -> Emerald
                                affordable -> Gold
                                else -> Muted.copy(alpha = 0.65f)
                            },
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
            item {
                Text(
                    text = "BADGES",
                    style = MaterialTheme.typography.labelLarge,
                    color = Gold,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
            items(spec.content.achievements, key = { it.id }) { achievement ->
                val unlocked = state.unlockedAchievements[achievement.id] == true
                Surface(
                    color = if (unlocked) Gold.copy(alpha = 0.08f) else PanelRaised,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, if (unlocked) Gold.copy(alpha = 0.28f) else Border),
                ) {
                    Row(
                        modifier = Modifier.padding(13.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (unlocked) achievement.icon else "🔒",
                            fontSize = 20.sp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = achievement.title,
                                style = MaterialTheme.typography.titleSmall,
                                color = if (unlocked) Ink else Muted,
                            )
                            Text(
                                text = achievement.desc,
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted.copy(alpha = if (unlocked) 1f else 0.7f),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScenarioProgressCard(
    scenario: Scenario,
    state: TradingState,
    metrics: PortfolioMetrics,
    onOpenScorecard: () -> Unit,
) {
    val progress = (metrics.netWorth / scenario.targetNw).coerceIn(0.0, 1.0).toFloat()
    val daysLeft = (scenario.endDayIdx - state.dayIdx).coerceAtLeast(0)
    Surface(
        color = Panel,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.28f)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(listOf(Gold.copy(alpha = 0.08f), Color.Transparent)))
                .padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "MISSION",
                    style = MaterialTheme.typography.labelMedium,
                    color = Gold,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = if (state.scenarioCompleted) {
                        "COMPLETE"
                    } else {
                        "${daysLeft.formatThousands()} ${if (daysLeft == 1) "SESSION" else "SESSIONS"} LEFT"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = if (state.scenarioCompleted) Gold else Muted,
                )
            }
            Text(
                text = scenario.title,
                style = MaterialTheme.typography.titleMedium,
                color = Ink,
            )
            Text(
                text = scenario.desc,
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(7.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Border),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .height(7.dp)
                        .background(if (state.scenarioCompleted) Gold else Emerald),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${formatMoney(metrics.netWorth)} / ${formatMoney(scenario.targetNw)}",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                    fontFamily = FontFamily.Monospace,
                )
                Spacer(Modifier.weight(1f))
                if (state.scenarioCompleted) {
                    TextButton(onClick = onOpenScorecard) {
                        Text("VIEW SCORECARD", color = Gold)
                    }
                } else {
                    Text(
                        text = "TARGET ${formatMoney(scenario.targetNw)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScenarioSheet(
    spec: GameSpec,
    onSelect: (Scenario) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        contentColor = Ink,
        scrimColor = Color.Black.copy(alpha = 0.62f),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "MISSION SELECT",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Ink,
                    )
                    Text(
                        text = "Start a focused campaign in a historic market. Each mission begins with ${formatMoney(10_000.0)} and erases the current run.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
            }
            items(spec.content.scenarios, key = Scenario::id) { scenario ->
                Surface(
                    color = PanelRaised,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Border),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .clickable { onSelect(scenario) },
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = scenario.title,
                                style = MaterialTheme.typography.titleMedium,
                                color = Ink,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = "START",
                                style = MaterialTheme.typography.labelMedium,
                                color = Gold,
                            )
                        }
                        Text(
                            text = scenario.desc,
                            style = MaterialTheme.typography.bodySmall,
                            color = Muted,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Text(
                                text = "${scenario.startIso} → ${scenario.endIso}",
                                style = MaterialTheme.typography.labelMedium,
                                color = Muted,
                                fontFamily = FontFamily.Monospace,
                            )
                            Text(
                                text = "TARGET ${formatMoney(scenario.targetNw)}",
                                style = MaterialTheme.typography.labelMedium,
                                color = Gold,
                                fontFamily = FontFamily.Monospace,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CareerScoreDialog(
    spec: GameSpec,
    state: TradingState,
    metrics: PortfolioMetrics,
    onNewMission: () -> Unit,
    onDismiss: () -> Unit,
) {
    val score = careerScore(spec, state, metrics.netWorth)
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        titleContentColor = Ink,
        textContentColor = Muted,
        title = {
            Text(state.activeScenario?.let { "${it.title} — SCORECARD" } ?: "CAREER SCORECARD")
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "NET WORTH",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = formatMoney(score.netWorth),
                        style = MaterialTheme.typography.titleMedium,
                        color = Ink,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Text(
                    text = "TOTAL RETURN ${signedPercent(score.totalReturnPct)}  •  " +
                        "S&P 500 ${signedPercent(score.spxReturnPct)}  •  " +
                        "ALPHA ${signedPercent(score.alphaPct)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted,
                )
                Text(
                    text = "GRADE ${score.grade}",
                    style = MaterialTheme.typography.headlineMedium,
                    color = Gold,
                    fontWeight = FontWeight.Black,
                )
                state.activeScenario?.let { scenario ->
                    Text(
                        text = if (score.won) {
                            "TARGET CLEARED: ${formatMoney(scenario.targetNw)}"
                        } else {
                            "TARGET MISSED: ${formatMoney(scenario.targetNw)}"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (score.won) Emerald else Rose,
                    )
                }
                Text(
                    text = "BEST TRADE  ${score.bestTrade}",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                )
                Text(
                    text = "WORST TRADE  ${score.worstTrade}",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("VIEW MARKET", color = Gold) }
        },
        dismissButton = {
            TextButton(onClick = onNewMission) { Text("NEW MISSION", color = Muted) }
        },
    )
}

private data class CareerScore(
    val netWorth: Double,
    val totalReturnPct: Double,
    val spxReturnPct: Double,
    val alphaPct: Double,
    val grade: String,
    val won: Boolean,
    val bestTrade: String,
    val worstTrade: String,
)

private fun careerScore(spec: GameSpec, state: TradingState, netWorth: Double): CareerScore {
    val spxStart = spec.price("SPX", state.runStartDayIdx).toDouble()
    val spxNow = spec.price("SPX", state.dayIdx).toDouble()
    val spxMult = if (spxStart > 0) spxNow / spxStart else 1.0
    val playerMult = netWorth / max(1.0, state.startingCash)
    val ratio = playerMult / max(0.1, spxMult)
    val grades = listOf("F", "D", "C", "B", "A", "S", "S+")
    var index = 3
    when {
        ratio >= 25 -> index = 6
        ratio >= 5 -> index = 5
        ratio >= 1.5 -> index = 4
        ratio >= 0.85 -> index = 3
        ratio >= 0.5 -> index = 2
        ratio >= 0.2 -> index = 1
        else -> index = 0
    }
    if (state.ownedLifestyle["up_foundation"] == true) index += 1
    index = index.coerceIn(0, grades.lastIndex)
    val totalReturnPct = if (state.startingCash > 0) (playerMult - 1) * 100 else 0.0
    val spxReturnPct = (spxMult - 1) * 100
    val target = state.activeScenario?.targetNw
    return CareerScore(
        netWorth = netWorth,
        totalReturnPct = totalReturnPct,
        spxReturnPct = spxReturnPct,
        alphaPct = totalReturnPct - spxReturnPct,
        grade = grades[index],
        won = target != null && netWorth >= target,
        bestTrade = if (state.bestTrade.pnl > 0) {
            "${state.bestTrade.symbol}  ${formatSignedMoney(state.bestTrade.pnl)}"
        } else {
            "No closed gains yet"
        },
        worstTrade = if (state.worstTrade.pnl < 0) {
            "${state.worstTrade.symbol}  ${formatSignedMoney(state.worstTrade.pnl)}"
        } else {
            "No closed losses yet"
        },
    )
}

private fun signedPercent(value: Double): String =
    String.format(Locale.US, "%s%.1f%%", if (value >= 0) "+" else "", value)

@Composable
private fun EventFeedCard(
    events: List<com.mtdewwolf.stocktrade.core.HistoricalEvent>,
    maxDayIdx: Int,
) {
    val visible = events.filter { it.dayIdx <= maxDayIdx }.take(3)
    if (visible.isEmpty()) return
    Surface(
        color = Panel,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "MARKET TIMELINE",
                style = MaterialTheme.typography.labelMedium,
                color = Gold,
            )
            visible.forEach { event ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = event.date,
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                        fontFamily = FontFamily.Monospace,
                    )
                    Text(
                        text = event.headline,
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun PositionsCard(
    spec: GameSpec,
    state: TradingState,
    engine: TradingEngine,
    onChanged: () -> Unit,
) {
    val total = state.positions.size + state.optionsPositions.size
    Surface(
        color = Panel,
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "OPEN POSITIONS",
                    style = MaterialTheme.typography.labelLarge,
                    color = Muted,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = "$total ACTIVE",
                    style = MaterialTheme.typography.labelMedium,
                    color = Gold,
                )
            }

            for ((symbol, position) in state.positions) {
                val price = engine.getStockPrice(symbol)
                val shares = abs(position.shares)
                val marketValue = shares * price
                val pnl = if (position.shares >= 0) {
                    marketValue - position.totalCost
                } else {
                    position.totalCost - marketValue
                }
                PositionLine(
                    symbol = symbol,
                    side = if (position.shares >= 0) "LONG" else "SHORT",
                    sideColor = if (position.shares >= 0) Emerald else Rose,
                    detail = "${formatQuantity(shares)} sh  •  avg ${formatPrice(position.avgCost.toFloat())}",
                    pnl = pnl,
                    onClose = {
                        engine.executeSellAllForSymbol(symbol, "CLOSED POSITION")
                        onChanged()
                    },
                )
            }

            for (option in state.optionsPositions.toList()) {
                val mark = engine.getStockPrice(option.symbol)
                val rawPct = if (option.strikePrice > 0) {
                    (mark - option.strikePrice) / option.strikePrice
                } else {
                    0.0
                }
                val signedPct = if (option.optType == "CALL") rawPct else -rawPct
                val payout = max(
                    0.0,
                    option.premium * (1 + spec.content.rules.optionLeverage * signedPct),
                )
                val pnl = payout - option.premium
                PositionLine(
                    symbol = option.symbol,
                    side = "5X ${option.optType}",
                    sideColor = if (option.optType == "CALL") Cyan else Gold,
                    detail = "strike ${formatPrice(option.strikePrice.toFloat())}  •  exp ${spec.date(option.expiryDayIdx).iso}",
                    pnl = pnl,
                    onClose = {
                        state.optionsPositions.remove(option)
                        engine.settleOptionContract(option, "EARLY CASH-OUT")
                        onChanged()
                    },
                )
            }
        }
    }
}

@Composable
private fun PositionLine(
    symbol: String,
    side: String,
    sideColor: Color,
    detail: String,
    pnl: Double,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(PanelRaised)
            .padding(start = 12.dp, top = 8.dp, bottom = 8.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = symbol,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = side,
                    style = MaterialTheme.typography.labelMedium,
                    color = sideColor,
                )
            }
            Text(
                text = detail,
                style = MaterialTheme.typography.labelMedium,
                color = Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = formatSignedMoney(pnl),
            style = MaterialTheme.typography.bodyMedium,
            color = if (pnl >= 0) Emerald else Rose,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )
        TextButton(onClick = onClose) {
            Text(
                text = "CLOSE",
                style = MaterialTheme.typography.labelMedium,
                color = Gold,
            )
        }
    }
}

@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        shape = RoundedCornerShape(16.dp),
        placeholder = { Text("Search ticker or company") },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = if (query.isEmpty()) Muted else Gold,
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Clear search",
                        tint = Muted,
                    )
                }
            }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Gold.copy(alpha = 0.65f),
            unfocusedBorderColor = Border,
            focusedContainerColor = Panel,
            unfocusedContainerColor = Panel,
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedLeadingIconColor = Gold,
            unfocusedLeadingIconColor = Muted,
            focusedPlaceholderColor = Muted,
            unfocusedPlaceholderColor = Muted,
            cursorColor = Gold,
        ),
    )
}

@Composable
private fun SectorFilters(
    sectors: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        sectors.forEach { sector ->
            val isSelected = sector == selected
            Surface(
                color = if (isSelected) Gold.copy(alpha = 0.14f) else Panel,
                contentColor = if (isSelected) Gold else Muted,
                shape = RoundedCornerShape(50),
                border = BorderStroke(
                    width = 1.dp,
                    color = if (isSelected) Gold.copy(alpha = 0.38f) else Border,
                ),
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .clickable { onSelect(sector) },
            ) {
                Text(
                    text = sector.uppercase(Locale.US),
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, detail: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = Muted,
        )
        Spacer(Modifier.weight(1f))
        Text(
            text = detail,
            style = MaterialTheme.typography.labelMedium,
            color = Gold,
        )
    }
}

@Composable
private fun AssetRow(
    spec: GameSpec,
    asset: Asset,
    dayIdx: Int,
    onClick: () -> Unit,
) {
    val price = spec.price(asset, dayIdx)
    val delistIdx = asset.delistIdx
    val isDelisted = delistIdx != null && dayIdx >= delistIdx
    val isListed = !isDelisted && dayIdx >= asset.ipoIdx
    val previousPrice = if (dayIdx > 0) spec.price(asset, dayIdx - 1) else 0f
    val change = if (isListed && previousPrice > 0f && price > 0f) {
        (price - previousPrice) / previousPrice
    } else {
        null
    }
    val accent = sectorColor(asset.sector)

    Surface(
        color = Panel,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(accent.copy(alpha = 0.13f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = asset.symbol.take(5),
                    color = accent,
                    fontWeight = FontWeight.Black,
                    fontSize = 11.sp,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = asset.name,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${asset.sector}  •  ${asset.ipoDate}",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                if (isListed) {
                    Text(
                        text = formatPrice(price),
                        style = MaterialTheme.typography.bodyLarge,
                        color = Ink,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = change?.let(::formatPercent) ?: "—",
                        style = MaterialTheme.typography.labelMedium,
                        color = when {
                            change == null -> Muted
                            change >= 0 -> Emerald
                            else -> Rose
                        },
                        fontFamily = FontFamily.Monospace,
                    )
                } else {
                    Text(
                        text = if (isDelisted) "DELISTED" else "NOT LISTED",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (isDelisted) Rose else Muted,
                    )
                    Text(
                        text = if (isDelisted) {
                            asset.delistDate ?: "—"
                        } else {
                            "IPO ${asset.ipoDate}"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssetDetailSheet(
    spec: GameSpec,
    asset: Asset,
    dayIdx: Int,
    state: TradingState,
    engine: TradingEngine,
    metrics: PortfolioMetrics,
    orderAmount: Double,
    canTrade: Boolean,
    onAmountChange: (Double) -> Unit,
    onAction: () -> Unit,
    onReturnToLive: () -> Unit,
    onDismiss: () -> Unit,
) {
    val price = spec.price(asset, dayIdx)
    val delistIdx = asset.delistIdx
    val isDelisted = delistIdx != null && dayIdx >= delistIdx
    val isListed = !isDelisted && dayIdx >= asset.ipoIdx
    val previousPrice = if (dayIdx > 0) spec.price(asset, dayIdx - 1) else 0f
    val change = if (isListed && previousPrice > 0f && price > 0f) {
        (price - previousPrice) / previousPrice
    } else {
        null
    }
    val accent = sectorColor(asset.sector)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        contentColor = Ink,
        scrimColor = Color.Black.copy(alpha = 0.62f),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(17.dp))
                        .background(accent.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = asset.symbol.take(5),
                        color = accent,
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                    )
                }
                Spacer(Modifier.width(13.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = asset.name,
                        style = MaterialTheme.typography.titleLarge,
                        color = Ink,
                    )
                    Text(
                        text = "${asset.sector}  •  ${asset.symbol}",
                        style = MaterialTheme.typography.labelMedium,
                        color = Muted,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = if (isListed) formatPrice(price) else if (isDelisted) "DELISTED" else "NOT LISTED",
                        style = MaterialTheme.typography.titleLarge,
                        color = if (isDelisted) Rose else Ink,
                        fontFamily = FontFamily.Monospace,
                    )
                    if (change != null) {
                        Text(
                            text = formatPercent(change),
                            style = MaterialTheme.typography.labelMedium,
                            color = if (change >= 0) Emerald else Rose,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }

            PriceSparkline(spec = spec, asset = asset, dayIdx = dayIdx)

            Text(
                text = asset.bio,
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DetailStat("IPO", asset.ipoDate, Modifier.weight(1f))
                DetailStat("DIV YIELD", formatPercent(asset.divYield), Modifier.weight(1f))
                DetailStat("VOLATILITY", formatPercent(asset.volatility), Modifier.weight(1f))
            }

            val position = state.positions[asset.symbol]
            if (position != null && abs(position.shares) > 1e-6) {
                val long = position.shares > 0
                Surface(
                    color = if (long) Emerald.copy(alpha = 0.10f) else Rose.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(
                        1.dp,
                        if (long) Emerald.copy(alpha = 0.28f) else Rose.copy(alpha = 0.28f),
                    ),
                ) {
                    Text(
                        text = "${if (long) "LONG" else "SHORT"} ${formatQuantity(abs(position.shares))} sh  •  AVG ${formatPrice(position.avgCost.toFloat())}",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (long) Emerald else Rose,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                    )
                }
            }

            if (isListed && !canTrade) {
                Surface(
                    color = Gold.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Gold.copy(alpha = 0.28f)),
                ) {
                    Row(
                        modifier = Modifier.padding(start = 12.dp, top = 6.dp, bottom = 6.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "HISTORY VIEW · TRADING LOCKED",
                            style = MaterialTheme.typography.labelMedium,
                            color = Gold,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = onReturnToLive) {
                            Text("RETURN LIVE", color = Gold)
                        }
                    }
                }
            }

            if (isListed && canTrade) {
                Surface(
                    color = PanelRaised,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Border),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "NATIVE TRADE DESK",
                                style = MaterialTheme.typography.labelLarge,
                                color = Gold,
                            )
                            Spacer(Modifier.weight(1f))
                            Text(
                                text = formatMoney(orderAmount),
                                style = MaterialTheme.typography.bodyMedium,
                                color = Ink,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AmountChip("$1K") { onAmountChange(1_000.0) }
                            AmountChip("$5K") { onAmountChange(5_000.0) }
                            AmountChip("$10K") { onAmountChange(10_000.0) }
                            AmountChip("MAX") { onAmountChange(max(100.0, metrics.buyingPower)) }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TradeButton(
                                label = "BUY",
                                container = Emerald,
                                content = Obsidian,
                                modifier = Modifier.weight(1f),
                            ) {
                                engine.executeBuy(asset.symbol, orderAmount)
                                onAction()
                            }
                            TradeButton(
                                label = "SHORT",
                                container = Rose,
                                content = Obsidian,
                                modifier = Modifier.weight(1f),
                            ) {
                                engine.executeShortSell(asset.symbol, orderAmount)
                                onAction()
                            }
                            if (position != null && position.shares > 1e-6) {
                                TradeButton(
                                    label = "SELL",
                                    container = Panel,
                                    content = Gold,
                                    modifier = Modifier.weight(1f),
                                ) {
                                    engine.executeSellDollar(asset.symbol, orderAmount)
                                    onAction()
                                }
                            } else if (position != null && position.shares < -1e-6) {
                                TradeButton(
                                    label = "COVER",
                                    container = Panel,
                                    content = Gold,
                                    modifier = Modifier.weight(1f),
                                ) {
                                    engine.executeCoverShort(asset.symbol, orderAmount)
                                    onAction()
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TradeButton(
                                label = "5X CALL",
                                container = Cyan.copy(alpha = 0.16f),
                                content = Cyan,
                                modifier = Modifier.weight(1f),
                            ) {
                                engine.buyOptionContract(asset.symbol, "CALL", orderAmount)
                                onAction()
                            }
                            TradeButton(
                                label = "5X PUT",
                                container = Gold.copy(alpha = 0.16f),
                                content = Gold,
                                modifier = Modifier.weight(1f),
                            ) {
                                engine.buyOptionContract(asset.symbol, "PUT", orderAmount)
                                onAction()
                            }
                        }
                        Text(
                            text = "Options settle after ${spec.content.rules.optionTermSessions} sessions at ${spec.content.rules.optionLeverage}x leverage. Minimum premium $50.",
                            style = MaterialTheme.typography.labelMedium,
                            color = Muted,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AmountChip(label: String, onClick: () -> Unit) {
    Surface(
        color = Panel,
        contentColor = Ink,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun TradeButton(
    label: String,
    container: Color,
    content: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
        ),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 10.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1,
        )
    }
}

@Composable
private fun DilemmaDialog(
    dilemma: HistoricalDilemma,
    onChoose: (String) -> Unit,
) {
    AlertDialog(
        onDismissRequest = {},
        containerColor = Panel,
        titleContentColor = Ink,
        textContentColor = Muted,
        title = { Text(dilemma.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(dilemma.desc)
                Text(
                    text = "A  ${dilemma.choiceATitle}",
                    color = Emerald,
                    style = MaterialTheme.typography.labelLarge,
                )
                Text(dilemma.choiceADesc, style = MaterialTheme.typography.bodySmall)
                Text(
                    text = "B  ${dilemma.choiceBTitle}",
                    color = Gold,
                    style = MaterialTheme.typography.labelLarge,
                )
                Text(dilemma.choiceBDesc, style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = {
            Column(horizontalAlignment = Alignment.End) {
                TextButton(onClick = { onChoose("A") }) {
                    Text("CHOOSE A", color = Emerald)
                }
                TextButton(onClick = { onChoose("B") }) {
                    Text("CHOOSE B", color = Gold)
                }
            }
        },
    )
}

private fun noticeMessage(event: EngineEvent.Notice): String {
    val symbol = event.symbol.orEmpty()
    return when (event.kind) {
        NoticeKind.NOT_TRADABLE -> "$symbol is not tradable at this date."
        NoticeKind.INSUFFICIENT_BUYING_POWER -> "Not enough buying power for $symbol."
        NoticeKind.INSUFFICIENT_SHORT_COLLATERAL -> "Not enough collateral to short $symbol."
        NoticeKind.COVER_LONG_FIRST -> "Close your long $symbol position before shorting."
        NoticeKind.NO_SHORT_POSITION -> "No short position in $symbol."
        NoticeKind.NO_POSITION -> "No open position in $symbol."
        NoticeKind.OPTIONS_MIN_PREMIUM -> "Option premium must be at least $50."
        NoticeKind.LIFESTYLE_NEED_CASH ->
            "${event.detail ?: "Upgrade"} costs ${formatMoney(event.amount)}."
        NoticeKind.TRADE_BUY -> "Bought $symbol · ${formatMoney(event.amount)}"
        NoticeKind.TRADE_SHORT -> "Shorted $symbol · ${formatMoney(event.amount)} collateral"
        NoticeKind.TRADE_COVER -> "Covered $symbol · P&L ${formatSignedMoney(event.pnl)}"
        NoticeKind.TRADE_SELL ->
            "Sold $symbol · ${formatMoney(event.amount)} · P&L ${formatSignedMoney(event.pnl)}"
        NoticeKind.POSITION_CLOSED -> "Closed $symbol · P&L ${formatSignedMoney(event.pnl)}"
        NoticeKind.OPTION_OPENED ->
            "${event.detail ?: "Option"} opened on $symbol · ${formatMoney(event.amount)}"
        NoticeKind.OPTION_SETTLED ->
            "Option settled on $symbol · ${formatMoney(event.amount)} · P&L ${formatSignedMoney(event.pnl)}"
        NoticeKind.LIFESTYLE_PURCHASED ->
            "${event.detail ?: "Upgrade"} purchased for ${formatMoney(event.amount)}"
        NoticeKind.BANKRUPTCY_WIPEOUT -> "$symbol went bankrupt. Position wiped out."
        NoticeKind.SHORT_BANKRUPTCY_WIN ->
            "Short profit on $symbol bankruptcy: ${formatSignedMoney(event.pnl)}"
        NoticeKind.MARGIN_WIPEOUT -> "Margin call. Account reset with $500."
        NoticeKind.SCENARIO_WON -> "Scenario complete: ${event.detail ?: "target reached"}."
        NoticeKind.SCENARIO_ENDED -> "Scenario ended: ${event.detail ?: "target missed"}."
        NoticeKind.HISTORICAL_EVENT -> event.detail ?: "Historical market event."
    }
}

private fun dilemmaBonus(id: String, choice: String, cash: Double): Double {
    if (choice == "A") {
        val rate = when (id) {
            "dil_1982" -> 0.08
            "dil_1987" -> 0.12
            "dil_1999" -> 0.15
            "dil_2008" -> 0.12
            "dil_2020" -> 0.10
            else -> 0.10
        }
        return max(250.0, max(0.0, cash) * rate)
    }
    return when (id) {
        "dil_1982" -> 600.0
        "dil_1987" -> 1_500.0
        "dil_1999" -> 5_000.0
        "dil_2008" -> 10_000.0
        "dil_2020" -> 25_000.0
        else -> 1_000.0
    }
}

@Composable
private fun PriceSparkline(spec: GameSpec, asset: Asset, dayIdx: Int) {
    val points = remember(spec, asset, dayIdx) {
        val start = (dayIdx - 90).coerceAtLeast(0)
        (start..dayIdx).map { day -> spec.price(asset, day) }.filter { it > 0f }
    }

    if (points.size < 2) {
        Surface(
            color = PanelRaised,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(104.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "PRICE HISTORY UNAVAILABLE",
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                )
            }
        }
        return
    }

    val rising = points.last() >= points.first()
    val lineColor = if (rising) Emerald else Rose
    val min = points.min()
    val max = points.max()
    val range = (max - min).coerceAtLeast(0.01f)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(104.dp),
    ) {
        val stepX = size.width / (points.size - 1).coerceAtLeast(1)
        val line = Path()
        points.forEachIndexed { index, value ->
            val x = index * stepX
            val y = size.height - ((value - min) / range) * size.height
            if (index == 0) line.moveTo(x, y) else line.lineTo(x, y)
        }
        drawLine(
            color = Border,
            start = Offset(0f, size.height),
            end = Offset(size.width, size.height),
            strokeWidth = 1.dp.toPx(),
        )
        drawPath(
            path = line,
            color = lineColor,
            style = Stroke(
                width = 2.5.dp.toPx(),
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
            ),
        )
        drawCircle(
            color = lineColor,
            radius = 3.dp.toPx(),
            center = Offset(
                x = size.width,
                y = size.height - ((points.last() - min) / range) * size.height,
            ),
        )
    }
}

@Composable
private fun DetailStat(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        color = PanelRaised,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Border),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = Muted,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = Ink,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private fun sectorColor(sector: String): Color = when {
    sector.equals("Macro", ignoreCase = true) -> Gold
    sector.equals("Tech", ignoreCase = true) -> Cyan
    sector.equals("Crypto", ignoreCase = true) -> Color(0xFFB68CFF)
    sector.equals("Energy", ignoreCase = true) -> Color(0xFFFF9C62)
    sector.equals("Finance", ignoreCase = true) -> Emerald
    else -> Color(0xFF9CB6FF)
}

private fun formatMoney(value: Double): String {
    val normalized = if (abs(value) < 0.005) 0.0 else value
    return String.format(Locale.US, "$%,.2f", normalized)
}

private fun formatSignedMoney(value: Double): String {
    val normalized = if (abs(value) < 0.005) 0.0 else value
    return String.format(
        Locale.US,
        "%s$%,.2f",
        if (normalized >= 0) "+" else "-",
        abs(normalized),
    )
}

private fun formatQuantity(value: Double): String = when {
    abs(value) >= 1_000 -> String.format(Locale.US, "%,.0f", value)
    abs(value) >= 1 -> String.format(Locale.US, "%,.2f", value)
    else -> String.format(Locale.US, "%,.4f", value)
}

private fun formatPrice(value: Float): String = when {
    value <= 0f -> "—"
    value < 1f -> String.format(Locale.US, "$%.4f", value)
    else -> String.format(Locale.US, "$%,.2f", value)
}

private fun formatPercent(value: Float): String = String.format(Locale.US, "%.2f%%", value * 100f)

private fun formatPercent(value: Double): String = String.format(Locale.US, "%.2f%%", value * 100.0)

private fun Int.formatThousands(): String = String.format(Locale.US, "%,d", this)
