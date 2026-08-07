package com.elitearrows.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

class DartboardOverlayView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    private val paint = Paint().apply {
        color = Color.CYAN
        style = Paint.Style.STROKE
        strokeWidth = 5f
        isAntiAlias = true
    }

    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 40f
        textAlign = Paint.Align.CENTER
    }

    var centerX = 0f
    var centerY = 0f
    var radius = 0f
    var lastDetectedScore = ""
    var lastDartX = -1f
    var lastDartY = -1f

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        if (centerX > 0 && centerY > 0 && radius > 0) {
            paint.style = Paint.Style.STROKE
            
            // Draw calibration circles (Using precise proportions from ScoringEngine)
            paint.color = Color.CYAN
            canvas.drawCircle(centerX, centerY, radius, paint) // Double Outer
            canvas.drawCircle(centerX, centerY, radius * 0.953f, paint) // Double Inner
            
            canvas.drawCircle(centerX, centerY, radius * 0.629f, paint) // Triple Outer
            canvas.drawCircle(centerX, centerY, radius * 0.582f, paint) // Triple Inner

            paint.color = Color.RED
            canvas.drawCircle(centerX, centerY, radius * 0.0935f, paint) // Outer Bull
            canvas.drawCircle(centerX, centerY, radius * 0.0374f, paint) // Inner Bull

            // Draw segment lines for debugging orientation
            paint.color = Color.argb(100, 0, 255, 255)
            for (i in 0 until 20) {
                val angle = Math.toRadians((i * 18.0) - 9.0) // Shift by half segment
                val stopX = centerX + radius * Math.sin(angle).toFloat()
                val stopY = centerY - radius * Math.cos(angle).toFloat()
                canvas.drawLine(centerX, centerY, stopX, stopY, paint)
            }

            // Draw last detected dart
            if (lastDartX > 0 && lastDartY > 0) {
                paint.style = Paint.Style.FILL
                paint.color = Color.YELLOW
                canvas.drawCircle(lastDartX, lastDartY, 15f, paint)
                paint.style = Paint.Style.STROKE
                
                canvas.drawText(lastDetectedScore, lastDartX, lastDartY - 30f, textPaint)
            }
        }
        
        canvas.drawText("AI DART DETECTION ACTIVE", width / 2f, 80f, textPaint)
    }
    
    fun updateCalibration(x: Float, y: Float, r: Float) {
        centerX = x
        centerY = y
        radius = r
        invalidate()
    }

    fun updateLastDart(x: Float, y: Float, score: String) {
        lastDartX = x
        lastDartY = y
        lastDetectedScore = score
        invalidate()
    }
}
