export const getOutcomePoints = (legsWon, legsLost) => {
  const won = Number(legsWon) || 0
  const lost = Number(legsLost) || 0

  if (won > lost) return 3
  if (won === lost) return 1
  return 0
}

export const getLeaguePoints = (legsWon, legsLost) => (
  (Number(legsWon) || 0) + getOutcomePoints(legsWon, legsLost)
)
