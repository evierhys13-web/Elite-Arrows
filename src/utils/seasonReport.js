import { derivePlayerStatsFromResults } from './playerStats'

export const buildSeasonReportCard = ({
  user,
  results = [],
  fixtures = [],
  season,
  division = ''
}) => {
  if (!user?.id) return null

  const seasonResults = (results || []).filter(r => {
    if (r.season === undefined || r.season === null) return false
    if (String(r.season).replace(/\s+/g, '').toLowerCase() !== String(season).replace(/\s+/g, '').toLowerCase()) return false
    return true
  })

  const stats = derivePlayerStatsFromResults([user], seasonResults, {
    fixtures,
    currentSeason: season,
    includeReset: false,
    leagueOnly: false
  })

  const playerStats = stats[String(user.id)]
  if (!playerStats) return null

  const cupMatches = seasonResults.filter(r => {
    if (String(r.status || '').toLowerCase() !== 'approved') return false
    const cup = String(r.cupId || '')
    const matchId = String(r.matchId || '')
    if (!cup && !matchId) return false
    const isPlayer = String(r.player1Id || r.player1) === String(user.id) || String(r.player2Id || r.player2) === String(user.id)
    return isPlayer
  })

  const cupIds = new Set(cupMatches.map(r => String(r.cupId || r.matchId)).filter(Boolean))
  const cupWins = cupMatches.filter(r => {
    const isP1 = String(r.player1Id || r.player1) === String(user.id)
    const score = Number(r.score1)
    const oppScore = Number(r.score2)
    return isP1 ? score > oppScore : score < oppScore
  }).length

  return {
    season,
    userId: user.id,
    username: user.username || user.nickname || 'Unknown',
    division: division || user.division || 'Unassigned',
    played: playerStats.played,
    wins: playerStats.wins,
    losses: playerStats.losses,
    draws: playerStats.draws,
    points: playerStats.points,
    legsWon: playerStats.legsWon,
    legsLost: playerStats.legsLost,
    average: playerStats.average,
    highestCheckout: playerStats.highestCheckout,
    '180s': playerStats['180s'],
    cupsEntered: cupIds.size,
    cupWins,
    generatedAt: new Date().toISOString()
  }
}