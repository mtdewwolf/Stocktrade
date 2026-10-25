package com.mtdewwolf.stocktrade.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.mtdewwolf.stocktrade.android.ui.StocktradeApp
import com.mtdewwolf.stocktrade.android.ui.theme.StocktradeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            StocktradeTheme {
                StocktradeApp()
            }
        }
    }
}
