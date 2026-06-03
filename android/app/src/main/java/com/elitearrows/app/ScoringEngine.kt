package com.elitearrows.app

import kotlin.math.atan2
import kotlin.math.pow
import kotlin.math.sqrt

class ScoringEngine {
    // Standard dartboard segments in order (clockwise starting from top)
    private val segments = arrayOf(20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5)

    data class DartScore(val value: Int, val multiplier: Int, val label: String)

    /**
     * Translates coordinates to a dart score based on board calibration.
     * @param x Touch/Detection X
     * @param y Touch/Detection Y
     * @param centerX Calibrated center X
     * @param centerY Calibrated center Y
     * @param outerRadius Distance from center to outer double wire
     */
    fun calculateScore(x: Float, y: Float, centerX: Float, centerY: Float, outerRadius: Float): DartScore {
        val dx = x - centerX
        val dy = centerY - y // Invert Y as screen coordinates go down
        
        val distance = sqrt(dx.pow(2) + dy.pow(2))
        val relativeDistance = distance / outerRadius

        // Radial boundaries as fractions of outer radius
        val doubleWire = 1.0f
        val tripleOuter = 0.65f
        val tripleInner = 0.60f
        val outerBull = 0.12f
        val innerBull = 0.05f

        // 1. Check Bullseye
        if (relativeDistance <= innerBull) return DartScore(50, 1, "BULL")
        if (relativeDistance <= outerBull) return DartScore(25, 1, "25")

        // 2. Out of bounds
        if (relativeDistance > 1.05f) return DartScore(0, 1, "MISS")

        // Determine Segment Angle
        // atan2 returns angle in radians from -PI to PI
        var angle = Math.toDegrees(atan2(dx.toDouble(), dy.toDouble())).toFloat()
        // Adjust so 0 is top (20 segment)
        angle += 9.0f // Shift by half a segment width
        if (angle < 0) angle += 360f
        
        val segmentIndex = ((angle / 18.0f).toInt()) % 20
        val segmentValue = segments[segmentIndex]

        // 4. Determine Multiplier
        return when {
            relativeDistance >= 0.95f && relativeDistance <= 1.0f -> DartScore(segmentValue * 2, 2, "D$segmentValue")
            relativeDistance >= tripleInner && relativeDistance <= tripleOuter -> DartScore(segmentValue * 3, 3, "T$segmentValue")
            else -> DartScore(segmentValue, 1, segmentValue.toString())
        }
    }
}
