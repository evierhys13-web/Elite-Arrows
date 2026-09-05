import { COURSES } from './courses'

export const LEVEL_BANDS = [
  {
    id: 'foundation',
    label: 'Foundation',
    min: 0,
    max: 40,
    color: '#4da8da',
    blurb: 'Building fundamentals — grip, stance and a repeatable throw come before everything else.'
  },
  {
    id: 'developing',
    label: 'Developing',
    min: 40,
    max: 50,
    color: '#22c55e',
    blurb: 'A solid base is forming. Volume on your scoring treble and structured doubles work will lift you quickly.'
  },
  {
    id: 'club',
    label: 'Club Standard',
    min: 50,
    max: 60,
    color: '#fbbf24',
    blurb: 'You score respectably — now consistency and closing legs decide how often you win.'
  },
  {
    id: 'sharp',
    label: 'League Sharp',
    min: 60,
    max: 70,
    color: '#f97316',
    blurb: 'A genuine match player. Refinement, game management and pressure reps move you forward.'
  },
  {
    id: 'elite',
    label: 'Elite',
    min: 70,
    max: Infinity,
    color: '#ef4444',
    blurb: 'High-level output. Fine margins — routing, switching and composure — decide your wins now.'
  }
]

export const getPlayerLevel = (avg) => {
  const value = Number.isFinite(Number(avg)) ? Number(avg) : 0
  return LEVEL_BANDS.find(b => value >= b.min && value < b.max) || LEVEL_BANDS[0]
}

export const getEffectiveAvg = (stats, declaredAvg) => {
  const seasonAvg = Number(stats?.average) || 0
  if (seasonAvg > 0) return seasonAvg
  const declared = Number(declaredAvg) || 0
  return declared > 0 ? declared : 0
}

export const hasEnoughStats = (stats) => {
  const games = Number(stats?.played) || 0
  return games >= 2
}

const courseFocusLabel = {
  mechanics: 'throw mechanics',
  scoring: 'scoring',
  finishing: 'doubles and finishing',
  mental: 'mindset and composure',
  schedule: 'training routine and structure',
  strategy: 'game management'
}

export const courseFitLabel = (course, effectiveAvg) => {
  const avg = Number(effectiveAvg)
  if (!avg || !course.levelRange) return 'All levels'
  if (avg < course.levelRange.min) return `Reach ${Math.ceil(course.levelRange.min)}+ avg`
  if (avg > course.levelRange.max) return 'Keeps you sharp'
  return 'Fits your level'
}

export const buildRecommendations = ({ stats = {}, declaredAvg = 0 }) => {
  const played = Number(stats?.played) || 0
  const effectiveAvg = getEffectiveAvg(stats, declaredAvg)
  const band = getPlayerLevel(effectiveAvg || 40)
  const doublesPct = Number.isFinite(Number(stats?.doubleSuccess)) && stats?.doubleSuccess !== null
    ? Number(stats.doubleSuccess)
    : null
  const highestCheckout = Number(stats?.highestCheckout) || 0
  const gameCount = played
  const wins = Number(stats?.wins) || 0

  const scored = COURSES.map((course) => {
    let score = 60
    const reasons = []

    if (effectiveAvg > 0 && course.levelRange) {
      if (effectiveAvg < course.levelRange.min) {
        score -= 30
        reasons.push(`Built for around ${Math.ceil(course.levelRange.min)}+ average`)
      } else if (effectiveAvg > course.levelRange.max) {
        score += 12
        reasons.push('Great as a sharpening refresher')
      } else {
        score += 22
        reasons.push(`Perfect for your ${band.label.toLowerCase()} level`)
      }
    } else {
      score += 8
    }

    if (course.focus === 'mechanics') {
      if (gameCount < 3) {
        score += 26
        reasons.push('Few league games yet — build the repeatable throw first')
      } else if (effectiveAvg > 0 && effectiveAvg < 48) {
        score += 12
        reasons.push('Your throw is still the fastest win available')
      }
    }

    if (course.focus === 'scoring') {
      if (effectiveAvg > 0 && effectiveAvg < 55) {
        score += 28
        reasons.push(`Season average ${effectiveAvg.toFixed(1)} — reducing bad darts lifts it fastest`)
      }
      if (gameCount >= 2 && (Number(stats?.['180s']) || 0) === 0) {
        score += 10
        reasons.push('No 180s logged yet this season — scoring volume will add them')
      }
    }

    if (course.focus === 'finishing') {
      if (doublesPct !== null && doublesPct < 40) {
        score += 30
        reasons.push(`Doubles at ${doublesPct.toFixed(0)}% — the fastest wins per leg are here`)
      }
      if (highestCheckout > 0 && highestCheckout < 100 && gameCount >= 2) {
        score += 8
        reasons.push(`Best checkout ${highestCheckout} — higher routes need drilling`)
      }
      if (doublesPct === null && effectiveAvg >= 50) {
        score += 14
        reasons.push('Finishing routes decide close legs — worth a dedicated run')
      }
    }

    if (course.focus === 'mental') {
      if (gameCount >= 3) {
        score += 10
        reasons.push('Routine and composure protect your average in matches')
      }
      const lossShare = gameCount > 0 ? 1 - wins / gameCount : 0.5
      if (gameCount >= 4 && lossShare >= 0.55) {
        score += 12
        reasons.push('Several close-round losses — process training flips those')
      }
    }

    if (course.focus === 'schedule') {
      if (gameCount === 0) {
        score += 30
        reasons.push('Fresh to the season — start with structure and a routine')
      } else if (gameCount < 5) {
        score += 12
        reasons.push('Early season is the best time to build a training plan')
      }
    }

    if (course.focus === 'strategy') {
      if (effectiveAvg >= 55) {
        score += 30
        reasons.push(`You score ${effectiveAvg.toFixed(1)} — the next wins come from decisions, not trebles`)
      } else if (gameCount >= 6) {
        score += 14
        reasons.push('Plenty of season matches logged — managing them is the edge')
      }
    }

    return { course, score, reasons }
  })

  const ranked = scored
    .sort((a, b) => b.score - a.score || (a.course.id < b.course.id ? -1 : 1))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      reason: entry.reasons[0] || `A strong fit for your game at the moment`
    }))

  return {
    band,
    effectiveAvg,
    games: gameCount,
    hasData: effectiveAvg > 0 || hasEnoughStats(stats),
    declaredOnly: effectiveAvg === Number(declaredAvg) && Number(declaredAvg) > 0 && !(Number(stats?.average) > 0),
    recommendations: ranked,
    top: ranked[0]
  }
}