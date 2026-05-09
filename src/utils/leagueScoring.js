export const getOutcomePoints = (legsWon, legsLost, options = {}) => {
  const won = Number(legsWon) || 0
  const lost = Number(legsLost) || 0
  const { noDrawBonus = false } = options

  if (won > lost) return 3
  if (won === lost && !noDrawBonus) return 1
  return 0
}

export const getLeaguePoints = (legsWon, legsLost, options = {}) => (
  (Number(legsWon) || 0) + getOutcomePoints(legsWon, legsLost, options)
)
