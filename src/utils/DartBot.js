/**
 * DartBot AI Opponent
 * Simulates a darts player with configurable skill levels.
 */
export class DartBot {
    constructor(options = {}) {
      this.name = options.name || 'Elite Bot'
      this.targetAverage = options.targetAverage || 50 // Typical average
      this.checkoutRate = options.checkoutRate || 0.2 // 20% success on doubles
      this.setupRate = options.setupRate || 0.4 // 40% success on setup shots
    }

    /**
     * Simulates a 3-dart turn
     * @param currentScore The bot's current score remaining
     * @returns Array of 3 darts [{ value: 60, label: 'T20' }, ...]
     */
    async takeTurn(currentScore) {
      const turnDarts = []
      let remaining = currentScore

      for (let i = 0; i < 3; i++) {
        // Add a small delay for "thinking/throwing" feel
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500))

        const dart = this.calculateDart(remaining, i)
        turnDarts.push(dart)
        remaining -= dart.value

        if (remaining <= 0) break // Leg over
      }

      return turnDarts
    }

    calculateDart(remaining, dartIndex) {
      // 1. If we can finish, try the finish
      if (remaining <= 50 && remaining % 2 === 0 || remaining === 50) {
        return this.attemptCheckout(remaining)
      }

      // 2. If we are in setup range (under 100 but not finishable)
      if (remaining <= 100) {
        return this.attemptSetup(remaining)
      }

      // 3. Scoring mode (T20 hunting)
      return this.attemptScoring()
    }

    attemptCheckout(remaining) {
      const success = Math.random() < this.checkoutRate
      const targetValue = remaining === 50 ? 50 : remaining
      const targetLabel = remaining === 50 ? 'BULL' : `D${remaining / 2}`

      if (success) {
        return { value: targetValue, label: targetLabel, isDouble: true }
      } else {
        // Missed double - either hit single or bust/other segment
        const missType = Math.random()
        if (missType < 0.6) { // Hit the single version
            const singleVal = remaining === 50 ? 25 : remaining / 2
            return { value: singleVal, label: singleVal.toString() }
        }
        return { value: 0, label: 'MISS' }
      }
    }

    attemptSetup(remaining) {
      // Simplistic setup: try to get to a favorite double (like D20)
      const success = Math.random() < this.setupRate
      if (success) {
        // Ideal setup shot
        if (remaining > 40) {
            const val = remaining - 40
            return { value: val, label: val.toString() }
        }
      }
      return this.attemptScoring() // Fallback to scoring
    }

    attemptScoring() {
      // Use target average to determine probability of T20 vs S20 vs 5/1
      // Formula roughly: High average = higher T20 probability
      const roll = Math.random() * 100
      const t20Prob = (this.targetAverage - 30) / 0.6 // Rough heuristic

      if (roll < t20Prob) return { value: 60, label: 'T20' }
      if (roll < t20Prob + 40) return { value: 20, label: '20' }
      if (roll < t20Prob + 60) return { value: 5, label: '5' }
      if (roll < t20Prob + 80) return { value: 1, label: '1' }

      return { value: 20, label: '20' } // Most likely 20
    }
  }
