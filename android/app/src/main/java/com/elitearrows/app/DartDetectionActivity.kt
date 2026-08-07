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
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.ObjectDetector
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DartDetectionActivity : AppCompatActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private lateinit var previewView: PreviewView
    private lateinit var overlayView: DartboardOverlayView
    private lateinit var scoreNotification: TextView
    private lateinit var playerNameView: TextView
    private lateinit var playerScoreView: TextView
    private lateinit var opponentNameView: TextView
    private lateinit var opponentScoreView: TextView
    private var currentPlayerScore = 501
    private var currentOpponentScore = 501

    private var cameraControl: CameraControl? = null
    private val scoringEngine = ScoringEngine()
    private lateinit var objectDetector: ObjectDetector

    private var bullX = 0f
    private var bullY = 0f
    private var top20X = 0f
    private var top20Y = 0f
    private var radius = 0f
    private var calibrationStep = 0 // 0: Searching, 2: Active
    private var isLiveMode = false
    private var currentZoom = 1f
    private var isAutoScoringEnabled = true
    private var isStable = true
    private var lastFrameData: ByteArray? = null
    private var frameWidth = 0
    private var frameHeight = 0
    
    // Landing detection state
    private var isWaitingForLanding = false
    private var landingSumSX = 0L
    private var landingSumSY = 0L
    private var landingDiffCount = 0
    private var landingFrames = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        isLiveMode = intent.getBooleanExtra("isLiveMode", false)

        // Initialize ML Kit Object Detector
        val options = ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableMultipleObjects()
            .enableClassification() // To identify "Sports equipment"
            .build()
        objectDetector = ObjectDetection.getClient(options)

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
        previewView.scaleType = PreviewView.ScaleType.FILL_CENTER

        root.addView(overlayView, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)

        // Native Scoreboard Overlay
        if (isLiveMode) {
            val pName = intent.getStringExtra("playerName") ?: "YOU"
            currentPlayerScore = intent.getIntExtra("playerScore", 501)
            val oName = intent.getStringExtra("opponentName") ?: "BOT"
            currentOpponentScore = intent.getIntExtra("opponentScore", 501)

            val scoreboard = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                setPadding(40, 20, 40, 20)
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(Color.parseColor("#CC050816"))
                    cornerRadius = 30f
                }
            }

            fun createPlayerView(name: String, score: Int, isPlayer: Boolean): LinearLayout {
                return LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = if (isPlayer) Gravity.START else Gravity.END
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                    
                    val nView = TextView(this@DartDetectionActivity).apply {
                        text = name.uppercase()
                        textSize = 10f
                        setTextColor(Color.LTGRAY)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                    }
                    val sView = TextView(this@DartDetectionActivity).apply {
                        text = score.toString()
                        textSize = 28f
                        setTextColor(if (isPlayer) Color.parseColor("#00D4FF") else Color.WHITE)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                    }
                    
                    if (isPlayer) {
                        playerNameView = nView
                        playerScoreView = sView
                    } else {
                        opponentNameView = nView
                        opponentScoreView = sView
                    }
                    
                    addView(nView)
                    addView(sView)
                }
            }

            scoreboard.addView(createPlayerView(pName, currentPlayerScore, true))
            scoreboard.addView(TextView(this).apply {
                text = "VS"
                textSize = 12f
                setTextColor(Color.DKGRAY)
                setPadding(30, 0, 30, 0)
                setTypeface(null, android.graphics.Typeface.BOLD)
            })
            scoreboard.addView(createPlayerView(oName, currentOpponentScore, false))

            val boardParams = ConstraintLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topToTop = ConstraintLayout.LayoutParams.PARENT_ID
                setMargins(40, 40, 40, 0)
            }
            root.addView(scoreboard, boardParams)
        }
        
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
                // Manual override if needed
                if (calibrationStep == 2) {
                    handleCalibrationTouch(event.x, event.y)
                }
            }
            true
        }
        Toast.makeText(this, "Scanning for Dartboard...", Toast.LENGTH_LONG).show()
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
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
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

    @SuppressLint("UnsafeOptInUsageError")
    private fun processImageProxy(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            
            if (calibrationStep < 2) {
                // AUTO-CALIBRATION MODE: Search for dartboard
                objectDetector.process(image)
                    .addOnSuccessListener { objects ->
                        for (obj in objects) {
                            val bounds = obj.boundingBox
                            
                            val rotation = imageProxy.imageInfo.rotationDegrees
                            val isRotated = rotation == 90 || rotation == 270
                            
                            val rotatedWidth = if (isRotated) imageProxy.height else imageProxy.width
                            val rotatedHeight = if (isRotated) imageProxy.width else imageProxy.height
                            
                            // Calculate scale for FILL_CENTER
                            val scale = Math.max(
                                previewView.width.toFloat() / rotatedWidth.toFloat(),
                                previewView.height.toFloat() / rotatedHeight.toFloat()
                            )
                            
                            val offsetX = (previewView.width - rotatedWidth * scale) / 2f
                            val offsetY = (previewView.height - rotatedHeight * scale) / 2f
                            
                            // Map bounding box to screen coordinates
                            val screenLeft = bounds.left * scale + offsetX
                            val screenTop = bounds.top * scale + offsetY
                            val screenRight = bounds.right * scale + offsetX
                            val screenBottom = bounds.bottom * scale + offsetY
                            val screenWidth = screenRight - screenLeft
                            
                            // Found a potential board!
                            bullX = screenLeft + screenWidth / 2f
                            bullY = screenTop + (screenBottom - screenTop) / 2f
                            
                            // Standard dartboard double wire diameter is 340mm
                            // Total board diameter is 451mm
                            // If ML Kit detects the whole board: radius = (width/2) * (170/225.5) = 0.754
                            // If it detects just the scoring area: radius = (width/2)
                            // Most models detect the scoring area + some surround.
                            radius = (screenWidth / 2f) * 0.78f 
                            
                            top20X = bullX
                            top20Y = bullY - radius
                            
                            runOnUiThread {
                                overlayView.updateCalibration(bullX, bullY, radius)
                                calibrationStep = 2
                                // Show segment lines so user can see alignment
                                Toast.makeText(this, "AI: Board Locked. Tap to reset if off.", Toast.LENGTH_SHORT).show()
                            }
                            break
                        }
                    }
                    .addOnCompleteListener { imageProxy.close() }
            } else {
                // DART DETECTION MODE: Frame Differencing
                val buffer = mediaImage.planes[0].buffer
                val data = ByteArray(buffer.remaining())
                buffer.get(data)
                
                if (lastFrameData != null && isAutoScoringEnabled) {
                    val rotation = imageProxy.imageInfo.rotationDegrees
                    
                    val rotatedWidth = if (rotation == 90 || rotation == 270) imageProxy.height else imageProxy.width
                    val rotatedHeight = if (rotation == 90 || rotation == 270) imageProxy.width else imageProxy.height
                    
                    val scale = Math.max(
                        previewView.width.toFloat() / rotatedWidth.toFloat(),
                        previewView.height.toFloat() / rotatedHeight.toFloat()
                    )
                    val offsetX = (previewView.width - rotatedWidth * scale) / 2f
                    val offsetY = (previewView.height - rotatedHeight * scale) / 2f
                    
                    detectDartHit(data, imageProxy.width, imageProxy.height, rotation, scale, offsetX, offsetY)
                }
                
                lastFrameData = data
                frameWidth = imageProxy.width
                frameHeight = imageProxy.height
                imageProxy.close()
            }
        } else {
            imageProxy.close()
        }
    }

    private fun detectDartHit(currentData: ByteArray, width: Int, height: Int, rotation: Int, scale: Float, offsetX: Float, offsetY: Float) {
        var diffCount = 0
        var currentSumSX = 0L
        var currentSumSY = 0L
        
        val step = 2 // Higher resolution for better accuracy
        for (y in 0 until height step step) {
            for (x in 0 until width step step) {
                val idx = y * width + x
                val diff = kotlin.math.abs((currentData[idx].toInt() and 0xFF) - (lastFrameData!![idx].toInt() and 0xFF))
                if (diff > 50) { 
                    diffCount++
                    
                    val sx: Float
                    val sy: Float
                    when (rotation) {
                        90 -> { sx = (height - y).toFloat(); sy = x.toFloat() }
                        180 -> { sx = (width - x).toFloat(); sy = (height - y).toFloat() }
                        270 -> { sx = y.toFloat(); sy = (width - x).toFloat() }
                        else -> { sx = x.toFloat(); sy = y.toFloat() }
                    }
                    currentSumSX += sx.toLong()
                    currentSumSY += sy.toLong()
                }
            }
        }

        val totalPixels = (width / step) * (height / step)
        val changePercentage = diffCount.toFloat() / totalPixels

        // If we see significant motion, start tracking the "landing"
        if (changePercentage > 0.0005f) { 
            isStable = false
            if (changePercentage < 0.03f) { // Ignore huge changes (like a person walking)
                landingSumSX += currentSumSX
                landingSumSY += currentSumSY
                landingDiffCount += diffCount
                landingFrames++
                isWaitingForLanding = true
            }
        } else if (!isStable && changePercentage < 0.0002f) {
            // Motion stopped!
            isStable = true
            
            if (isWaitingForLanding && landingDiffCount > 0) {
                val avgSX = (landingSumSX.toFloat() / landingDiffCount) * scale + offsetX
                val avgSY = (landingSumSY.toFloat() / landingDiffCount) * scale + offsetY
                
                runOnUiThread {
                    // Tip detection correction (0.98 pulls it closer to the tip vs the flight)
                    val correctedX = bullX + (avgSX - bullX) * 0.98f
                    val correctedY = bullY + (avgSY - bullY) * 0.98f

                    val score = scoringEngine.calculateScore(correctedX, correctedY, bullX, bullY, top20X, top20Y)
                    if (score.value >= 0 && score.label != "MISS") {
                        if (isLiveMode) {
                            currentPlayerScore -= score.value
                            if (currentPlayerScore < 0) currentPlayerScore = 0
                            playerScoreView.text = currentPlayerScore.toString()
                        }
                        
                        overlayView.updateLastDart(correctedX, correctedY, score.label)
                        showHitNotification(score.label)
                        sendScoreToWeb(score.label, score.value)
                    }
                }
                
                // Reset landing trackers
                isWaitingForLanding = false
                landingSumSX = 0L
                landingSumSY = 0L
                landingDiffCount = 0
                landingFrames = 0
            }
        }
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        objectDetector.close()
    }

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 10
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }
}
