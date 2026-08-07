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
  // MUST have scores and be approved
  if (result.score1 === undefined || result.score2 === undefined) return false

  const gameType = normalizeText(result.gameType)

  // 1. Explicitly ignore non-league types in the gameType label
  const nonLeagueTypes = ['super league', 'champions league', 'cup', 'friendly', 'playoff', 'tournament', 'open league']
  if (nonLeagueTypes.some(type => gameType.includes(type))) return false

  // 2. If it has a cupId or matchId on the result itself, it's NOT league
  if (result.cupId || result.matchId || result.tournamentId) return false

  // 3. Check the associated fixture if it exists
  if (result.fixtureId) {
    const fixture = fixturesById[String(result.fixtureId)]
    if (fixture) {
      const fixtureType = normalizeText(fixture.gameType)
      if (nonLeagueTypes.some(type => fixtureType.includes(type))) return false
      if (fixture.cupId || fixture.tournamentId || fixture.matchId) return false
    }
  }

  // 4. MUST be explicitly 'league' or contain it (e.g. 'Elite League')
  if (gameType.includes('league')) return true

  // 5. For legacy/unlabeled matches (Season 1 support)
  if (!gameType || gameType === 'unknown' || gameType === '') {
    // Only allow if it matches the standard league format (Best of 8 / max 8 legs)
    const s1 = Number(result.score1) || 0
    const s2 = Number(result.score2) || 0
    // Strictly max 8 legs for league
    return (s1 + s2) <= 8 && (s1 + s2) > 0
  }

  return false
}

export const isSuperLeagueResult = (result, fixturesById = {}) => {
  const gameType = normalizeText(result.gameType)

  // 1. Explicit labels
  if (gameType.includes('super league') || gameType.includes('superleague') || gameType.includes('champions league') || gameType.includes('championsleague')) return true

  // 2. Division-specific labels
  const superDivisions = ['premier', 'pro', 'amateur', 'champions']
  if (superDivisions.some(div => gameType.includes(div)) && !gameType.includes('cup')) return true

  const s1 = Number(result.score1) || 0
  const s2 = Number(result.score2) || 0

  // 3. Score-based detection (First to 6 / Best of 11 format)
  const otherTypes = ['cup', 'friendly', 'playoff', 'tournament', 'open league']
  if (otherTypes.some(type => gameType.includes(type))) return false
  if (result.cupId || result.matchId || result.tournamentId) return false

  // Standard Champions League is First to 6
  if ((s1 === 6 || s2 === 6) && (s1 + s2) <= 11 && (s1 + s2) >= 6) {
    return true
  }

  // 4. Fixture-based detection
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

export const isOpenLeagueResult = (result) => {
  const gameType = normalizeText(result.gameType)
  return gameType === 'open league singles'
}

export const isOpenLeagueDoublesResult = (result) => {
  const gameType = normalizeText(result.gameType)
  return gameType === 'open league doubles'
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

export const calculateDartStats = (darts) => {
  if (!darts || darts.length === 0) return { avg: 0, first9Avg: 0, doubleAcc: 0 }

  const totalScore = darts.reduce((sum, d) => sum + (d.value || 0), 0)
  const avg = (totalScore / darts.length) * 3

  const first9Darts = darts.slice(0, 9)
  const first9Score = first9Darts.reduce((sum, d) => sum + (d.value || 0), 0)
  const first9Avg = first9Darts.length > 0 ? (first9Score / first9Darts.length) * 3 : 0

  const doubleAttempts = darts.filter(d => d.isDoubleAttempt)
  const doubleHits = darts.filter(d => d.isDoubleHit)
  const doubleAcc = doubleAttempts.length > 0 ? (doubleHits.length / doubleAttempts.length) * 100 : 0

  return { avg, first9Avg, doubleAcc }
}
