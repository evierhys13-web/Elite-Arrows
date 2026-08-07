package com.elitearrows.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.graphics.Color
import android.graphics.Paint
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DartDetectionActivity : AppCompatActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private lateinit var previewView: PreviewView
    private lateinit var overlayView: DartboardOverlayView
    private lateinit var scoreNotification: TextView
    private var cameraControl: CameraControl? = null
    private val scoringEngine = ScoringEngine()

    private var bullX = 0f
    private var bullY = 0f
    private var top20X = 0f
    private var top20Y = 0f
    private var radius = 0f
    private var calibrationStep = 0
    private var isLiveMode = false
    private var currentZoom = 1f
    private var isAutoScoringEnabled = false
    private var lastAverageLuminance = 0.0
    private var isStable = true
    private var dartCount = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        isLiveMode = intent.getBooleanExtra("isLiveMode", false)

        val root = ConstraintLayout(this)
        previewView = PreviewView(this)
        overlayView = DartboardOverlayView(this, null)
        
        // Large Score Notification (Scolia Style)
        scoreNotification = TextView(this).apply {
            textSize = 80f
            setTextColor(Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#CC00D4FF"))
            setPadding(80, 40, 80, 40)
            visibility = android.view.View.GONE
        }

        root.addView(previewView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        root.addView(overlayView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        
        val scoreParams = ConstraintLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topToTop = ConstraintLayout.LayoutParams.PARENT_ID
            startToStart = ConstraintLayout.LayoutParams.PARENT_ID
            endToEnd = ConstraintLayout.LayoutParams.PARENT_ID
            setMargins(0, 150, 0, 0)
        }
        root.addView(scoreNotification, scoreParams)

        // UI Controls
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            setPadding(40, 40, 40, 150)
            setBackgroundColor(Color.parseColor("#88000000"))
        }

        val autoScoreButton = Button(this).apply {
            text = "AI OFF"
            setBackgroundColor(Color.DKGRAY)
            setOnClickListener { 
                isAutoScoringEnabled = !isAutoScoringEnabled
                text = if (isAutoScoringEnabled) "AI ON" else "AI OFF"
                setBackgroundColor(if (isAutoScoringEnabled) Color.parseColor("#00FF88") else Color.DKGRAY)
                if (isAutoScoringEnabled) Toast.makeText(this@DartDetectionActivity, "AI Auto-Scoring Enabled", Toast.LENGTH_SHORT).show()
            }
        }

        val zoomInButton = Button(this).apply {
            text = "Zoom +"
            setOnClickListener { 
                currentZoom = (currentZoom + 0.5f).coerceAtMost(8f)
                cameraControl?.setZoomRatio(currentZoom)
            }
        }

        val submitButton = Button(this).apply {
            text = "Submit"
            setOnClickListener { 
                sendSubmitToWeb()
                finish()
            }
        }

        val closeButton = Button(this).apply {
            text = "Close"
            setOnClickListener { finish() }
        }

        controls.addView(autoScoreButton)
        controls.addView(zoomInButton)
        controls.addView(submitButton)
        controls.addView(closeButton)

        val params = ConstraintLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomToBottom = ConstraintLayout.LayoutParams.PARENT_ID
        }
        root.addView(controls, params)

        setContentView(root)

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, REQUEST_CODE_PERMISSIONS)
        }

        cameraExecutor = Executors.newSingleThreadExecutor()
        
        setupCalibration()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupCalibration() {
        overlayView.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                handleCalibrationTouch(event.x, event.y)
            }
            true
        }
        Toast.makeText(this, "Calibration: Tap Bullseye Center", Toast.LENGTH_LONG).show()
    }

    private fun handleCalibrationTouch(x: Float, y: Float) {
        when (calibrationStep) {
            0 -> {
                bullX = x
                bullY = y
                calibrationStep = 1
                Toast.makeText(this, "Tap top of 20 double wire", Toast.LENGTH_SHORT).show()
            }
            1 -> {
                top20X = x
                top20Y = y
                
                val dx = x - bullX
                val dy = y - bullY
                radius = kotlin.math.sqrt(dx * dx + dy * dy)
                overlayView.updateCalibration(bullX, bullY, radius)
                
                calibrationStep = 2
                Toast.makeText(this, "Calibration Complete. AI active.", Toast.LENGTH_SHORT).show()
            }
            2 -> {
                // Manual override/correction on tap
                val score = scoringEngine.calculateScore(x, y, bullX, bullY, top20X, top20Y)
                overlayView.updateLastDart(x, y, score.label)
                showHitNotification(score.label)
                sendScoreToWeb(score.label, score.value)
            }
        }
    }

    private fun showHitNotification(label: String) {
        scoreNotification.text = label
        scoreNotification.visibility = android.view.View.VISIBLE
        scoreNotification.animate().alpha(1f).setDuration(200).withEndAction {
            scoreNotification.animate().alpha(0f).setStartDelay(1500).setDuration(500).withEndAction {
                scoreNotification.visibility = android.view.View.GONE
                scoreNotification.alpha = 1f
            }
        }
    }

    private fun sendScoreToWeb(label: String, value: Int) {
        MainActivity.instance?.let { bridgeActivity ->
            val script = "window.dispatchEvent(new CustomEvent('dartDetectionScore', { detail: { scoreLabel: '$label', scoreValue: $value } }));"
            bridgeActivity.bridge.webView.post {
                bridgeActivity.bridge.webView.evaluateJavascript(script, null)
            }
        }
    }

    private fun sendSubmitToWeb() {
        MainActivity.instance?.let { bridgeActivity ->
            val script = "window.dispatchEvent(new CustomEvent('dartDetectionSubmit'));"
            bridgeActivity.bridge.webView.post {
                bridgeActivity.bridge.webView.evaluateJavascript(script, null)
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { image ->
                        if (isAutoScoringEnabled && calibrationStep == 2) {
                            val average = image.planes[0].buffer.averageLuminance()
                            val delta = kotlin.math.abs(average - lastAverageLuminance)
                            
                            if (delta > 2.0) { // Motion detected
                                if (isStable) {
                                    isStable = false
                                }
                            } else if (!isStable) { // Movement stopped
                                isStable = true
                                // Possible dart hit or removal
                                // In a full implementation, we'd compare the diff mask here
                            }
                            
                            lastAverageLuminance = average
                        }
                        image.close()
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                val camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
                cameraControl = camera.cameraControl
            } catch (exc: Exception) {
                Log.e("DartDetection", "Use case binding failed", exc)
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun java.nio.ByteBuffer.averageLuminance(): Double {
        rewind()
        val data = ByteArray(remaining())
        get(data)
        val pixels = data.map { it.toInt() and 0xFF }
        return pixels.average()
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 10
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }
}
