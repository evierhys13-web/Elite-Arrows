import { getLeaguePoints } from './leagueScoring'
import { getResultEffectiveTime, getResultPlayerId, isLeagueResult, isSuperLeagueResult } from './leagueResults'

export const DEFAULT_LEAGUE_TABLE_RESET_AT = '2026-04-29T16:14:21.338+01:00'

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
    currentSeason = null
  } = options

  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  const resetTime = includeReset ? getResetTime(adminData) : 0

  return results.filter(result => {
    if (String(result.status || '').toLowerCase() !== 'approved') return false
    if (requireProof && !resultHasProof(result)) return false

    // Season filtering logic
    if (currentSeason) {
      // If the result has a season field, it MUST match the active season
      if (result.season && result.season !== currentSeason) return false
      // Results with NO season field are treated as part of the initial/current season
      // to prevent data loss for legacy records.
    }

    if (superLeagueOnly) {
      return isSuperLeagueResult(result, fixturesById)
    }

    const leagueResult = isLeagueResult(result, fixturesById)
    if (leagueOnly && !leagueResult) return false
    if (leagueResult && resetTime && getResultEffectiveTime(result) <= resetTime) return false
    return isWithinPeriod(result, timePeriod)
  })
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
  average: 0,
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
    stats.doubleSuccess = Number((stats.doubleSuccessTotal / stats.doubleSuccessCount).toFixed(1))
  }

  stats.average = stats.played > 0 ? Number(((stats.legsWon / stats.played) * 100).toFixed(1)) : 0
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
    currentSeason = null
  } = options

  const statsByPlayerId = {}
  users.forEach(user => {
    statsByPlayerId[String(user.id)] = createEmptyPlayerStats(user)
  })

  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  const approvedResults = getApprovedResultsForStats(results, {
    fixtures,
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
    const player1Id = getResultPlayerId(result, 1, users)
    const player2Id = getResultPlayerId(result, 2, users)
    const score1 = toNumber(result.score1)
    const score2 = toNumber(result.score2)

    const isSuper = isSuperLeagueResult(result, fixturesById)
    const countsForPoints = isSuper || isLeagueResult(result, fixturesById)
    const scoringOptions = { noDrawBonus: isSuper }

    if (player1Id && statsByPlayerId[player1Id]) {
      addResultToPlayer(statsByPlayerId[player1Id], result, 1, score2, score1, countsForPoints, scoringOptions)
    }
    if (player2Id && statsByPlayerId[player2Id]) {
      addResultToPlayer(statsByPlayerId[player2Id], result, 2, score1, score2, countsForPoints, scoringOptions)
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
