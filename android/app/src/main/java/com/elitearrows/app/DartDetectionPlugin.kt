package com.elitearrows.app

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DartDetection")
class DartDetectionPlugin : Plugin() {

    @PluginMethod
    fun startDetection(call: PluginCall) {
        val intent = Intent(context, DartDetectionActivity::class.java)
        intent.putExtra("isLiveMode", true)
        intent.putExtra("playerName", call.getString("playerName", "YOU"))
        intent.putExtra("playerScore", call.getInt("playerScore", 501))
        intent.putExtra("opponentName", call.getString("opponentName", "BOT"))
        intent.putExtra("opponentScore", call.getInt("opponentScore", 501))
        activity.startActivity(intent)
        call.resolve()
    }
}
