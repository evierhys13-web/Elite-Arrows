package com.elitearrows.app

import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import com.getcapacitor.BridgeActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }

    private var tapCount = 0
    private var lastTapTime: Long = 0

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_DOWN) {
            val now = System.currentTimeMillis()
            if (now - lastTapTime < 500) {
                tapCount++
            } else {
                tapCount = 1
            }
            lastTapTime = now

            if (tapCount == 3) {
                checkAdminAndLaunchTest()
                tapCount = 0
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun checkAdminAndLaunchTest() {
        val user = FirebaseAuth.getInstance().currentUser
        if (user != null) {
            FirebaseFirestore.getInstance().collection("users").document(user.uid)
                .get()
                .addOnSuccessListener { doc ->
                    if (doc.exists() && doc.getBoolean("isAdmin") == true) {
                        startActivity(Intent(this, DartDetectionActivity::class.java))
                    }
                }
        }
    }
}
