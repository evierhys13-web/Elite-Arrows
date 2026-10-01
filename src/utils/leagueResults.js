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

  // 1. Explicitly ignore non-league types in the gameType label.
  // NOTE: 'super league' / 'champions league' are retained here on purpose even
  // though the competition is retired. Results written before the retirement
  // still carry those labels in Firestore, and dropping the entry would silently
  // fold them into league standings and retroactively change past tables. They
  // stay excluded here permanently; approving them now relabels them to League.
  const nonLeagueTypes = ['super league', 'champions league', 'cup', 'friendly', 'playoff', 'tournament', 'friendly league', 'open league']
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
    // Only allow if it matches a valid league format (max 15 legs for Pro League BO15)
    const s1 = Number(result.score1) || 0
    const s2 = Number(result.score2) || 0
    // Strictly max 15 legs for league
    return (s1 + s2) <= 15 && (s1 + s2) > 0
  }

  return false
}

// Champions League / Super League is retired. This still recognises results that
// were written under the old labels so they keep their original scoring and stay
// out of league standings until Admin relabels them.
export const isSuperLeagueResult = (result, fixturesById = {}) => {
  const gameType = normalizeText(result.gameType)

  const isChampionsLabel = (text) =>
    text.includes('super league') ||
    text.includes('superleague') ||
    text.includes('champions league') ||
    text.includes('championsleague')

  if (isChampionsLabel(gameType)) return true

  // Legacy division-named labels (e.g. an old "Pro League" fixture).
  const superDivisions = ['premier', 'pro', 'amateur', 'champions']
  if (superDivisions.some(div => gameType.includes(div)) && !gameType.includes('cup')) return true

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  if (fixture) {
    const fixtureGameType = normalizeText(fixture.gameType)
    if (isChampionsLabel(fixtureGameType)) return true
    if (superDivisions.some(div => fixtureGameType.includes(div))) return true
  }

  // NOTE: score-based detection (any 6-x within 11 legs) was removed. With the
  // competition retired there is no longer any legitimate 6-x competition
  // result, and keeping the heuristic mislabelled ordinary league matches as
  // Champions League, applying the old no-win-bonus scoring to them.
  return false
}

export const isPlayoffResult = (result, fixturesById = {}) => {
  const gameType = normalizeText(result.gameType)
  if (gameType === 'playoff') return true

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  const fixtureGameType = normalizeText(fixture?.gameType)
  return fixtureGameType === 'playoff'
}

export const isFriendlyLeagueResult = (result) => {
  const gameType = normalizeText(result.gameType)
  return gameType === 'friendly league singles'
}

export const isFriendlyLeagueDoublesResult = (result) => {
  const gameType = normalizeText(result.gameType)
  return gameType === 'friendly league doubles'
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
