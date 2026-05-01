const hasValue = (value) => value !== undefined && value !== null && value !== ''

const getPlayerKey = (result, playerNumber) => {
  const id = result[`player${playerNumber}Id`]
  const name = result[`player${playerNumber}`]
  return hasValue(id) ? String(id) : hasValue(name) ? String(name).trim().toLowerCase() : ''
}

export const getResultSignature = (result) => {
  const player1 = getPlayerKey(result, 1)
  const player2 = getPlayerKey(result, 2)
  if (!player1 || !player2) return ''

  return `${player1}|${player2}|${result.score1 ?? ''}|${result.score2 ?? ''}|${result.date || ''}|${result.gameType || ''}`
}

export const getNormalizedResultSignature = (result) => {
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

export const getResultOverrideKeys = (result) => ([
  result.id ? String(result.id) : null,
  result.firestoreId ? String(result.firestoreId) : null,
  result.fixtureId ? `fixture:${result.fixtureId}` : null,
  result.cupId && result.matchId ? `cup:${result.cupId}:${result.matchId}` : null,
  getResultSignature(result),
  getNormalizedResultSignature(result)
].filter(Boolean))
