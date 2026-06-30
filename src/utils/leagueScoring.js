export const getOutcomePoints = (legsWon, legsLost, options = {}) => {
  const won = Number(legsWon) || 0
  const lost = Number(legsLost) || 0
  const { noDrawBonus = false, noWinBonus = false, isOpenLeague = false, isChampionsLeague = false } = options

  if (isOpenLeague) {
    if (won > lost) return 3
    if (won === lost) return 1
    return -1
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
  if (options.isOpenLeague || options.isChampionsLeague) {
    return getOutcomePoints(legsWon, legsLost, options)
  }
  return (Number(legsWon) || 0) + getOutcomePoints(legsWon, legsLost, options)
}
