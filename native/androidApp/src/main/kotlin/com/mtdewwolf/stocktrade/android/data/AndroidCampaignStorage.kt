package com.mtdewwolf.stocktrade.android.data

import android.content.Context
import androidx.core.content.edit
import com.mtdewwolf.stocktrade.core.CampaignStorage

class AndroidCampaignStorage(context: Context) : CampaignStorage {
    private val preferences = context.applicationContext
        .getSharedPreferences("stocktrade_campaign", Context.MODE_PRIVATE)

    override fun getItem(key: String): String? = preferences.getString(key, null)

    override fun putItem(key: String, value: String) {
        preferences.edit { putString(key, value) }
    }
}
