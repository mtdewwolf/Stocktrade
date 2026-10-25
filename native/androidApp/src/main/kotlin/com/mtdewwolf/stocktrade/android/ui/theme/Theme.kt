package com.mtdewwolf.stocktrade.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Obsidian = Color(0xFF060A12)
val Panel = Color(0xFF0D1420)
val PanelRaised = Color(0xFF121B2A)
val Border = Color(0xFF223047)
val Ink = Color(0xFFF4F7FB)
val Muted = Color(0xFF8A9AB4)
val Gold = Color(0xFFEAB55B)
val Emerald = Color(0xFF48D597)
val Rose = Color(0xFFF2647A)
val Cyan = Color(0xFF5CC8E8)

private val StocktradeColors = darkColorScheme(
    primary = Gold,
    onPrimary = Color(0xFF1A1200),
    primaryContainer = Color(0xFF3A2A0D),
    onPrimaryContainer = Gold,
    secondary = Emerald,
    onSecondary = Color(0xFF002114),
    tertiary = Cyan,
    background = Obsidian,
    onBackground = Ink,
    surface = Panel,
    onSurface = Ink,
    surfaceVariant = PanelRaised,
    onSurfaceVariant = Muted,
    outline = Border,
    outlineVariant = Border,
    error = Rose,
    onError = Color(0xFF2A0007),
)

private val StocktradeTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 30.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.6).sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 27.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 23.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        letterSpacing = 0.8.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        letterSpacing = 0.5.sp,
    ),
)

@Composable
fun StocktradeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = StocktradeColors,
        typography = StocktradeTypography,
        content = content,
    )
}
