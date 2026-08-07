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
     * Uses 3-point calibration for perspective correction.
     * @param x Touch/Detection X
     * @param y Touch/Detection Y
     * @param bullX Bullseye X
     * @param bullY Bullseye Y
     * @param top20X Outer Top 20 Wire X
     * @param top20Y Outer Top 20 Wire Y
     */
    fun calculateScore(x: Float, y: Float, bullX: Float, bullY: Float, top20X: Float, top20Y: Float): DartScore {
        val dx = x - bullX
        val dy = bullY - y // Invert Y as screen coordinates go down
        
        // Calculate radius based on Bull to Top 20 wire
        val outerRadius = sqrt((top20X - bullX).pow(2) + (bullY - top20Y).pow(2))
        
        val distance = sqrt(dx.pow(2) + dy.pow(2))
        val relativeDistance = distance / outerRadius

        // Radial boundaries as fractions of outer radius (approximate)
        val doubleWire = 1.0f
        val tripleOuter = 0.65f
        val tripleInner = 0.58f
        val outerBull = 0.12f
        val innerBull = 0.05f

        // 1. Check Bullseye
        if (relativeDistance <= innerBull) return DartScore(50, 1, "BULL")
        if (relativeDistance <= outerBull) return DartScore(25, 1, "25")

        // 2. Out of bounds
        if (relativeDistance > 1.05f) return DartScore(0, 1, "MISS")

        // Determine Segment Angle
        // We use the top20 position to establish the board's rotation
        val boardRotation = atan2((top20X - bullX).toDouble(), (bullY - top20Y).toDouble())
        var angle = atan2(dx.toDouble(), dy.toDouble()) - boardRotation
        
        var angleDegrees = Math.toDegrees(angle).toFloat()
        // Adjust so 0 is top (20 segment)
        angleDegrees += 9.0f // Shift by half a segment width
        while (angleDegrees < 0) angleDegrees += 360f
        while (angleDegrees >= 360) angleDegrees -= 360f
        
        val segmentIndex = ((angleDegrees / 18.0f).toInt()) % 20
        val segmentValue = segments[segmentIndex]

        // 4. Determine Multiplier
        return when {
            relativeDistance >= 0.95f && relativeDistance <= 1.02f -> DartScore(segmentValue * 2, 2, "D$segmentValue")
            relativeDistance >= tripleInner && relativeDistance <= tripleOuter -> DartScore(segmentValue * 3, 3, "T$segmentValue")
            else -> DartScore(segmentValue, 1, segmentValue.toString())
        }
    }
}
