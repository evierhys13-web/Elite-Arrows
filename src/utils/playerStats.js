import { getLeaguePoints } from './leagueScoring'
import { getResultEffectiveTime, getResultPlayerId, isLeagueResult, isSuperLeagueResult, isPlayoffResult } from './leagueResults'
import { getResultIdentityKey } from './resultIdentity'

export const DEFAULT_LEAGUE_TABLE_RESET_AT = '2020-01-01T00:00:00.000Z'

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const getResetTime = (adminData) => {
  const resetTimes = [DEFAULT_LEAGUE_TABLE_RESET_AT, adminData?.leagueTableResetAt]
    .map(value => value ? new Date(value).getTime() : 0)
    .filter(value => Number.isFinite(value) && value > 0)
  return resetTimes.length ? Math.max(...resetTimes) : 0
}

const isWithinPeriod = (result, period) => {
  if (!period || period === 'all') return true
  const resultTime = new Date(result.date || result.approvedAt || result.submittedAt || 0).getTime()
  if (!Number.isFinite(resultTime)) return false

  const now = new Date()
  const cutoff = new Date(now)
  if (period === 'week') cutoff.setDate(now.getDate() - 7)
  if (period === 'month') cutoff.setMonth(now.getMonth() - 1)
  if (period === 'quarter') cutoff.setMonth(now.getMonth() - 3)
  if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1)
  return resultTime >= cutoff.getTime()
}

export const resultHasProof = (result) => Boolean(
  result?.proofImage ||
  result?.proof ||
  result?.proofUrl ||
  result?.proofImageUrl ||
  result?.proofFile ||
  result?.hasProofImage
)

export const getApprovedResultsForStats = (results = [], options = {}) => {
  const {
    fixtures = [],
    adminData = null,
    leagueOnly = false,
    superLeagueOnly = false,
    includeReset = true,
    timePeriod = 'all',
    requireProof = false,
    currentSeason = null,
    includePlayoffs = true
  } = options

  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  const resetTime = includeReset ? getResetTime(adminData) : 0

  const approvedResults = results.filter(result => {
    if (String(result.status || '').toLowerCase() !== 'approved') return false
    if (result.excludeFromLeague) return false
    if (requireProof && !resultHasProof(result)) return false

    // Apply Soft Reset filter (if resetTime is set)
    if (resetTime > 0) {
      const effectiveTime = getResultEffectiveTime(result)
      if (effectiveTime <= resetTime) return false
    }

    // Season filtering logic - robust matching
    if (currentSeason) {
      const resSeason = String(result.season || '').replace(/\s+/g, '').toLowerCase()
      const actSeason = String(currentSeason).replace(/\s+/g, '').toLowerCase()

      // 1. Exact match (normalized)
      if (resSeason === actSeason) {
         // Matched successfully
      }
      // 2. Legacy/Window fallback for Season 1
      else if (actSeason === 'season1' || actSeason === '2026' || actSeason === 'legacy') {
        const isLegacyMatch = ['season1', '2026', 'legacy', '', 'undefined', 'null'].includes(resSeason)
        if (!isLegacyMatch) return false
      }
      // 3. Mismatch
      else {
        return false
      }
    }

    if (superLeagueOnly) {
      if (!isSuperLeagueResult(result, fixturesById)) return false
      return isWithinPeriod(result, timePeriod)
    }

    const leagueResult = isLeagueResult(result, fixturesById)
    const playoffResult = isPlayoffResult(result, fixturesById)

    // If we only want league games, exclude playoffs and other types
    if (leagueOnly) {
      if (!leagueResult) return false
      // Defense-in-depth: explicitly exclude any result with cup/tournament markers
      if (result.cupId || result.matchId || result.tournamentId) return false
      const gt = String(result.gameType || '').toLowerCase().trim()
      const nonLeague = ['cup', 'friendly', 'playoff', 'tournament', 'super league', 'open league']
      if (nonLeague.some(t => gt.includes(t))) return false
    }

    // Fallback check if playoffs are explicitly wanted
    if (!leagueResult && !playoffResult) return false

    return isWithinPeriod(result, timePeriod)
  })

  // 2. Merge duplicates based on logical identity as a fallback
  const uniqueResults = []
  const seenIdentities = new Set()

  // Process in reverse (newest first) to keep the most recent version of a result if identity matches
  const sortedByRecency = [...approvedResults].sort((a, b) => {
    const timeA = new Date(a.date || a.submittedAt || 0).getTime()
    const timeB = new Date(b.date || b.submittedAt || 0).getTime()
    return timeB - timeA
  })

  sortedByRecency.forEach(result => {
    const identity = getResultIdentityKey(result)
    if (!seenIdentities.has(identity)) {
      seenIdentities.add(identity)
      uniqueResults.push(result)
    }
  })

  return uniqueResults
}

export const createEmptyPlayerStats = (player = {}) => ({
  id: player.id,
  username: player.username,
  nickname: player.nickname,
  division: player.division || 'Unassigned',
  profilePicture: player.profilePicture,
  played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  points: 0,
  legsWon: 0,
  legsLost: 0,
  legDiff: 0,
  '180s': 0,
  '170s': 0,
  highestCheckout: 0,
  doubleSuccessTotal: 0,
  doubleSuccessCount: 0,
  doubleSuccess: 0,
  average: Math.min(70, player.threeDartAverage || 0),
  form: [],
  history: []
})

const addResultToPlayer = (stats, result, playerNumber, opponentScore, score, countsForPoints, scoringOptions = {}) => {
  const submittedStats = result[`player${playerNumber}Stats`] || {}
  stats.played += 1
  stats.legsWon += score
  stats.legsLost += opponentScore
  stats.legDiff = stats.legsWon - stats.legsLost
  stats.points += countsForPoints ? getLeaguePoints(score, opponentScore, scoringOptions) : 0

  if (score > opponentScore) {
    stats.wins += 1
    stats.form.push('W')
  } else if (score < opponentScore) {
    stats.losses += 1
    stats.form.push('L')
  } else {
    stats.draws += 1
    stats.form.push('D')
  }

  stats.history.push({
    date: result.date || result.submittedAt,
    score,
    opponentScore,
    '180s': toNumber(submittedStats['180s'] ?? submittedStats._180s),
    highestCheckout: toNumber(submittedStats.highestCheckout)
  })

  stats['180s'] += toNumber(submittedStats['180s'] ?? submittedStats._180s)
  stats['170s'] += toNumber(submittedStats['170s'] ?? submittedStats._170s)
  stats.highestCheckout = Math.max(stats.highestCheckout, toNumber(submittedStats.highestCheckout))

  if (submittedStats.doubleSuccess !== undefined && submittedStats.doubleSuccess !== null && submittedStats.doubleSuccess !== '') {
    stats.doubleSuccessTotal += toNumber(submittedStats.doubleSuccess)
    stats.doubleSuccessCount += 1
    stats.doubleSuccess = Number((stats.doubleSuccessTotal / stats.doubleSuccessCount).toFixed(2))
  }

  const explicitAvg = toNumber(result[`player${playerNumber}ExplicitAverage`])
  if (explicitAvg > 0) stats.average = Math.min(70, explicitAvg)
}

export const derivePlayerStatsFromResults = (users = [], results = [], options = {}) => {
  const {
    fixtures = [],
    adminData = null,
    leagueOnly = false,
    superLeagueOnly = false,
    includeReset = true,
    timePeriod = 'all',
    requireProof = false,
    currentSeason = null,
    includePlayoffs = true
  } = options

  const statsByPlayerId = {}

  if (!Array.isArray(users)) {
    console.warn('derivePlayerStatsFromResults: users is not an array', users)
    return {}
  }

  users.forEach(user => {
    if (user && user.id) {
      statsByPlayerId[String(user.id)] = createEmptyPlayerStats(user)
    }
  })

  const fixturesList = Array.isArray(fixtures) ? fixtures : []
  const fixturesById = Object.fromEntries(fixturesList.map(fixture => [String(fixture.id), fixture]))

  const resultsList = Array.isArray(results) ? results : []
  const approvedResults = getApprovedResultsForStats(resultsList, {
    fixtures: fixturesList,
    adminData,
    leagueOnly,
    superLeagueOnly,
    includeReset,
    timePeriod,
    requireProof,
    currentSeason
  })

  // Sort results by date ascending to get form in correct order
  const sortedResults = [...approvedResults].sort((a, b) => {
    const timeA = new Date(a.date || a.submittedAt || 0).getTime()
    const timeB = new Date(b.date || b.submittedAt || 0).getTime()
    return timeA - timeB
  })

  sortedResults.forEach(result => {
    if (!result) return
    const player1Id = getResultPlayerId(result, 1, users)
    const player2Id = getResultPlayerId(result, 2, users)
    const score1 = toNumber(result.score1)
    const score2 = toNumber(result.score2)

    const isSuper = isSuperLeagueResult(result, fixturesById)
    const isPlayoff = isPlayoffResult(result, fixturesById)

    if (isPlayoff && !includePlayoffs) return

    const countsForPoints = (isSuper || isLeagueResult(result, fixturesById)) && !isPlayoff
    const scoringOptions = { noDrawBonus: isSuper || isPlayoff, noWinBonus: isSuper }

    if (player1Id && statsByPlayerId[player1Id]) {
      addResultToPlayer(statsByPlayerId[player1Id], result, 1, score2, score1, countsForPoints, scoringOptions)
    }
    if (player2Id && statsByPlayerId[player2Id]) {
      addResultToPlayer(statsByPlayerId[player2Id], result, 2, score1, score2, countsForPoints, scoringOptions)
    }
  })

  // Apply manual stats adjustments (admin overrides)
  users.forEach(user => {
    if (user && user.id) {
      const id = String(user.id)
      const overrides = (superLeagueOnly ? user.manualSuperStats : user.manualStats)
      if (overrides && statsByPlayerId[id]) {
        // We treat manual stats as absolute overrides for the main columns if provided
        statsByPlayerId[id].played = overrides.played ?? statsByPlayerId[id].played
        statsByPlayerId[id].wins = overrides.wins ?? statsByPlayerId[id].wins
        statsByPlayerId[id].draws = overrides.draws ?? statsByPlayerId[id].draws
        statsByPlayerId[id].losses = overrides.losses ?? statsByPlayerId[id].losses
        statsByPlayerId[id].points = overrides.points ?? statsByPlayerId[id].points
        statsByPlayerId[id].legsWon = overrides.legsWon ?? statsByPlayerId[id].legsWon
        statsByPlayerId[id].legsLost = overrides.legsLost ?? statsByPlayerId[id].legsLost
        statsByPlayerId[id].legDiff = statsByPlayerId[id].legsWon - statsByPlayerId[id].legsLost
      }
    }
  })

  return statsByPlayerId
}

export const getPersistedPlayerStats = (stats = createEmptyPlayerStats()) => ({
  played: stats.played || 0,
  wins: stats.wins || 0,
  losses: stats.losses || 0,
  draws: stats.draws || 0,
  points: stats.points || 0,
  legsWon: stats.legsWon || 0,
  legsLost: stats.legsLost || 0,
  legDiff: stats.legDiff || 0,
  '180s': stats['180s'] || 0,
  '170s': stats['170s'] || 0,
  highestCheckout: stats.highestCheckout || 0,
  doubleSuccess: stats.doubleSuccess || 0
})
