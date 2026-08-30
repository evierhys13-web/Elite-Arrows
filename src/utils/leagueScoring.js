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
    return 1 // 1 point for a loss
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
