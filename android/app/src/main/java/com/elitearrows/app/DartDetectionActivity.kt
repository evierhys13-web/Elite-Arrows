package com.elitearrows.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.Button
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
    private val scoringEngine = ScoringEngine()

    private var centerX = 0f
    private var centerY = 0f
    private var radius = 0f
    private var calibrationStep = 0
    private var isLiveMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        isLiveMode = intent.getBooleanExtra("isLiveMode", false)

        // Dynamic UI creation for isolation
        val root = ConstraintLayout(this)
        previewView = PreviewView(this)
        overlayView = DartboardOverlayView(this, null)
        
        root.addView(previewView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        root.addView(overlayView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        
        // UI Controls for Testing
        val controls = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.BOTTOM or android.view.Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, 100)
        }

        val closeButton = Button(this).apply {
            text = "Close"
            setOnClickListener { finish() }
        }

        val submitButton = Button(this).apply {
            text = "Submit Turn"
            setOnClickListener { 
                sendSubmitToWeb()
                Toast.makeText(this@DartDetectionActivity, "Turn Submitted", Toast.LENGTH_SHORT).show()
            }
        }

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
        Toast.makeText(this, "Tap center of board (Bullseye)", Toast.LENGTH_LONG).show()
    }

    private fun handleCalibrationTouch(x: Float, y: Float) {
        when (calibrationStep) {
            0 -> {
                centerX = x
                centerY = y
                calibrationStep = 1
                Toast.makeText(this, "Tap outer ring (Top 20 wire)", Toast.LENGTH_SHORT).show()
            }
            1 -> {
                val dx = x - centerX
                val dy = y - centerY
                radius = kotlin.math.sqrt(dx * dx + dy * dy)
                overlayView.updateCalibration(centerX, centerY, radius)
                calibrationStep = 2
                Toast.makeText(this, "Calibration Done. Tap board to simulate darts.", Toast.LENGTH_SHORT).show()
            }
            2 -> {
                // Simulate detection on tap
                val score = scoringEngine.calculateScore(x, y, centerX, centerY, radius)
                overlayView.updateLastDart(x, y, score.label)
                Log.d("DartDetection", "Detected: ${score.label} (${score.value})")
                
                // Send to Web View via a custom event
                sendScoreToWeb(score.label, score.value)
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
                        // 1. Detect Darts using ML
                        // val bitmap = image.toBitmap()
                        // val detections = mlModel.detect(bitmap)
                        
                        // 2. Logic: If previous turn had darts, and current frame has 0
                        // indicating player removed them:
                        // if (previousDartCount >= 1 && currentDartCount == 0) {
                        //    sendSubmitToWeb()
                        // }

                        image.close()
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
            } catch (exc: Exception) {
                Log.e("DartDetection", "Use case binding failed", exc)
            }

        }, ContextCompat.getMainExecutor(this))
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
