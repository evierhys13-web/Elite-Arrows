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
  const gameType = normalizeText(result.gameType)
  if (gameType.includes('league')) return true
  if (gameType.includes('friendly') || gameType.includes('cup') || gameType.includes('tournament')) return false

  const fixture = result.fixtureId ? fixturesById[String(result.fixtureId)] : null
  const fixtureGameType = normalizeText(fixture?.gameType)
  return fixtureGameType.includes('league')
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
