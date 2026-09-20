// Port of src/utils/leagueScoring.js, leagueResults.js, resultIdentity.js and
// playerStats.js from the Elite Arrows app so Discord numbers match the app exactly.
// Keep in sync with those files - do not improve or refactor, only mirror.

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const toTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export const getResultEffectiveTime = (result) => Math.max(
  toTime(result.approvedAt),
  toTime(result.updatedAt),
  toTime(result.submittedAt),
  toTime(result.createdAt),
  toTime(result.date)
)

export const isLeagueResult = (result, fixturesById = {}) => {
  if (result.score1 === undefined || result.score2 === undefined) return false

  const gameType = normalizeText(result.gameType)

  const nonLeagueTypes = ['super league', 'champions league', 'cup', 'friendly', 'playoff', 'tournament', 'friendly league', 'open league']
  if (nonLeagueTypes.some(type => gameType.includes(type))) return false

  if (result.cupId || result.matchId || result.tournamentId) return false

  if (result.fixtureId) {
    const fixture = fixturesById[String(result.fixtureId)]
    if (fixture) {
      const fixtureType = normalizeText(fixture.gameType)
      if (nonLeagueTypes.some(type => fixtureType.includes(type))) return false
      if (fixture.cupId || fixture.tournamentId || fixture.matchId) return false
    }
  }

  if (gameType.includes('league')) return true

  if (!gameType || gameType === 'unknown' || gameType === '') {
    const s1 = Number(result.score1) || 0
    const s2 = Number(result.score2) || 0
    return (s1 + s2) <= 8 && (s1 + s2) > 0
  }

  return false
}

export const isSuperLeagueResult = (result, fixturesById = {}) => {
  const gameType = normalizeText(result.gameType)

  if (gameType.includes('super league') || gameType.includes('superleague') || gameType.includes('champions league') || gameType.includes('championsleague')) return true

  const superDivisions = ['premier', 'pro', 'amateur', 'champions']
  if (superDivisions.some(div => gameType.includes(div)) && !gameType.includes('cup')) return true

  const s1 = Number(result.score1) || 0
  const s2 = Number(result.score2) || 0

  const otherTypes = ['cup', 'friendly', 'playoff', 'tournament', 'friendly league', 'open league']
  if (otherTypes.some(type => gameType.includes(type))) return false
  if (result.cupId || result.matchId || result.tournamentId) return false

  if ((s1 === 6 || s2 === 6) && (s1 + s2) <= 11 && (s1 + s2) >= 6) {
    return true
  }

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  if (fixture) {
    const fixtureGameType = normalizeText(fixture.gameType)
    if (fixtureGameType.includes('super league') || fixtureGameType.includes('superleague') || fixtureGameType.includes('champions league')) return true
    if (superDivisions.some(div => fixtureGameType.includes(div))) return true
  }

  return false
}

export const isPlayoffResult = (result, fixturesById = {}) => {
  const gameType = normalizeText(result.gameType)
  if (gameType === 'playoff') return true

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  const fixtureGameType = normalizeText(fixture?.gameType)
  return fixtureGameType === 'playoff'
}

export const getResultPlayerId = (result, playerNumber, users = []) => {
  const directId = result[`player${playerNumber}Id`]
  if (directId) return String(directId)

  const playerName = normalizeText(result[`player${playerNumber}`])
  if (!playerName) return ''

  const matchedUser = users.find(user => {
    const uid = normalizeText(user.id)
    const uname = normalizeText(user.username)
    const dname = normalizeText(user.dartCounterUsername)
    const rname = normalizeText(user.name)
    const dispname = normalizeText(user.displayName)
    const email = normalizeText(user.email)
    const nick = normalizeText(user.nickname)

    return uid === playerName ||
           uname === playerName ||
           dname === playerName ||
           rname === playerName ||
           dispname === playerName ||
           email === playerName ||
           nick === playerName ||
           (uname && playerName.includes(uname)) ||
           (nick && playerName.includes(nick))
  })

  return matchedUser?.id ? String(matchedUser.id) : ''
}

export const getOutcomePoints = (legsWon, legsLost, options = {}) => {
  const won = Number(legsWon) || 0
  const lost = Number(legsLost) || 0
  const { noDrawBonus = false, noWinBonus = false, isOpenLeague = false, isChampionsLeague = false, isSingles = false, isForfeit = false } = options

  if (isForfeit) {
    if (won > lost) return 3
    return 0
  }

  if (isOpenLeague) {
    if (won > lost) return 3
    if (won === lost) return isSingles ? 0 : 1
    return 0
  }

  if (isChampionsLeague) {
    if (won > lost) return 3
    return 1
  }

  if (noWinBonus) return 0
  if (won > lost) return 3
  if (won === lost && !noDrawBonus) return 1
  return 0
}

export const getLeaguePoints = (legsWon, legsLost, options = {}) => {
  if (options.isForfeit || options.isChampionsLeague) {
    return getOutcomePoints(legsWon, legsLost, options)
  }
  return (Number(legsWon) || 0) + getOutcomePoints(legsWon, legsLost, options)
}

const hasValue = (value) => value !== undefined && value !== null && value !== ''

const getPlayerKey = (result, playerNumber) => {
  const id = result[`player${playerNumber}Id`]
  const name = result[`player${playerNumber}`]
  return hasValue(id) ? String(id) : hasValue(name) ? String(name).trim().toLowerCase() : ''
}

const getResultSignature = (result) => {
  const player1 = getPlayerKey(result, 1)
  const player2 = getPlayerKey(result, 2)
  if (!player1 || !player2) return ''

  return `${player1}|${player2}|${result.score1 ?? ''}|${result.score2 ?? ''}|${result.date || ''}|${result.gameType || ''}`
}

const getNormalizedResultSignature = (result) => {
  const players = [
    { key: getPlayerKey(result, 1), score: result.score1 ?? '' },
    { key: getPlayerKey(result, 2), score: result.score2 ?? '' }
  ].filter(player => player.key)

  if (players.length !== 2) return ''

  players.sort((a, b) => a.key.localeCompare(b.key))
  return `${players[0].key}:${players[0].score}|${players[1].key}:${players[1].score}|${result.date || ''}|${result.gameType || ''}`
}

export const getResultIdentityKey = (result) => {
  if (result.fixtureId) return `fixture:${result.fixtureId}`
  if (result.cupId && result.matchId) return `cup:${result.cupId}:${result.matchId}`
  return getNormalizedResultSignature(result) || getResultSignature(result) || String(result.id || result.firestoreId || '')
}

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

const resultHasProof = (result) => Boolean(
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
    includePlayoffs = true,
    dedupe = true
  } = options

  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  const resetTime = includeReset ? getResetTime(adminData) : 0

  const approvedResults = results.filter(result => {
    if (String(result.status || '').toLowerCase() !== 'approved') return false
    if (result.excludeFromLeague) return false
    if (requireProof && !resultHasProof(result) && !result.forfeit) return false

    if (resetTime > 0) {
      const effectiveTime = getResultEffectiveTime(result)
      if (effectiveTime <= resetTime) return false
    }

    if (currentSeason) {
      const resSeason = String(result.season || '').replace(/\s+/g, '').toLowerCase()
      const actSeason = String(currentSeason).replace(/\s+/g, '').toLowerCase()

      if (resSeason === actSeason) {
        // Matched successfully
      }
      else if (actSeason === 'season1' || actSeason === '2026' || actSeason === 'legacy') {
        const isLegacyMatch = ['season1', '2026', 'legacy', '', 'undefined', 'null'].includes(resSeason)
        if (!isLegacyMatch) return false
      }
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

    if (leagueOnly) {
      if (!leagueResult) return false
      if (result.cupId || result.matchId || result.tournamentId) return false
      const gt = String(result.gameType || '').toLowerCase().trim()
      const nonLeague = ['cup', 'friendly', 'playoff', 'tournament', 'super league', 'champions league', 'friendly league', 'open league']
      if (nonLeague.some(t => gt.includes(t))) return false
    }

    if (!leagueResult && !playoffResult) return false

    return isWithinPeriod(result, timePeriod)
  })

  if (!dedupe) return approvedResults

  const uniqueResults = []
  const seenIdentities = new Set()

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
  averageTotal: 0,
  averageCount: 0,
  average: 0,
  form: [],
  history: []
})

const addResultToPlayer = (stats, result, playerNumber, opponentScore, score, countsForPoints, scoringOptions = {}) => {
  const submittedStats = result[`player${playerNumber}Stats`] || {}
  const isForfeit = Boolean(result.forfeit)
  const effectiveScore = isForfeit ? 0 : score
  const effectiveOpponentScore = isForfeit ? 0 : opponentScore
  stats.played += 1
  stats.legsWon += effectiveScore
  stats.legsLost += effectiveOpponentScore
  stats.legDiff = stats.legsWon - stats.legsLost
  stats.points += countsForPoints ? getLeaguePoints(isForfeit ? score : effectiveScore, isForfeit ? opponentScore : effectiveOpponentScore, { ...scoringOptions, isForfeit }) : 0

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

  const matchAvg = toNumber(submittedStats.avg)
  if (matchAvg > 0) {
    stats.averageTotal += matchAvg
    stats.averageCount += 1
    stats.average = Number((stats.averageTotal / stats.averageCount).toFixed(2))
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
    const scoringOptions = { noDrawBonus: isSuper || isPlayoff, noWinBonus: isSuper, isChampionsLeague: isSuper }

    if (player1Id && statsByPlayerId[player1Id]) {
      addResultToPlayer(statsByPlayerId[player1Id], result, 1, score2, score1, countsForPoints, scoringOptions)
    }
    if (player2Id && statsByPlayerId[player2Id]) {
      addResultToPlayer(statsByPlayerId[player2Id], result, 2, score1, score2, countsForPoints, scoringOptions)
    }
  })

  const isLegacySeason = !currentSeason || ['season1', '2026', 'legacy'].includes(String(currentSeason).replace(/\s+/g, '').toLowerCase())

  if (isLegacySeason) {
    users.forEach(user => {
      if (user && user.id) {
        const id = String(user.id)
        const overrides = (superLeagueOnly ? user.manualSuperStats : user.manualStats)
        if (overrides && statsByPlayerId[id]) {
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
  }

  return statsByPlayerId
}