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
  const nonLeagueTypes = ['super league', 'cup', 'friendly', 'playoff', 'tournament']
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
  if (gameType === 'super league') return true

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  const fixtureGameType = normalizeText(fixture?.gameType)
  return fixtureGameType === 'super league'
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

  const matchedUser = users.find(user => (
    normalizeText(user.id) === playerName ||
    normalizeText(user.username) === playerName ||
    normalizeText(user.dartCounterUsername) === playerName ||
    normalizeText(user.name) === playerName ||
    normalizeText(user.displayName) === playerName ||
    normalizeText(user.email) === playerName
  ))

  return matchedUser?.id ? String(matchedUser.id) : ''
}
