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
        activity.startActivity(intent)
        call.resolve()
    }
}
