import { derivePlayerStatsFromResults } from './playerStats'
import { getResultPlayerId } from './leagueResults'

export const DIVISION_COLORS = {
  'Pro League': '#ec4899',
  Elite: '#fbbf24',
  Emerald: '#10b981',
  Diamond: '#38bdf8',
  Platinum: '#818cf8',
  Overall: '#818cf8',
}

export const LEAGUE_DIVISION_KEYS = ['pro_league', 'elite', 'emerald', 'diamond', 'platinum']

export const LEAGUE_DIVISION_NAMES = {
  pro_league: 'Pro League',
  elite: 'Elite',
  emerald: 'Emerald',
  diamond: 'Diamond',
  platinum: 'Platinum',
}

export const getDivisionsForSeason = (selectedSeason, adminData) => {
  const isNewStructure =
    selectedSeason === (adminData?.currentSeason || 'Elite Arrows Season 5')
  if (isNewStructure || selectedSeason === 'Season 4' || selectedSeason === 'Season 5') {
    return ['Overall', 'Pro League', 'Elite', 'Emerald', 'Diamond', 'Platinum']
  }
  return ['Overall', 'Pro League', 'Elite', 'Emerald', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']
}

export const getPlayersWithEffectiveDivisions = (allUsers, seasonDoc, selectedSeason, adminData) => {
  const staged = seasonDoc?.stagedDivisions || {}
  const currentSeason = adminData?.currentSeason || 'Elite Arrows Season 5'
  const isLive = !selectedSeason || selectedSeason === currentSeason || selectedSeason === 'Season 5' || selectedSeason.includes('Season 5')
  return allUsers.map((u) => {
    const uid = String(u.id)
    const effectiveDiv =
      staged[uid] || staged[u.id] || (isLive ? u.division : 'Unassigned')
    return {
      ...u,
      division: effectiveDiv || 'Unassigned',
    }
  })
}

export const getDivisionFilteredResults = (results, usersWithCorrectDivisions) => {
  const divMap = {}
  usersWithCorrectDivisions.forEach((u) => {
    divMap[String(u.id)] = u.division
  })

  return results.filter((r) => {
    const p1Id = getResultPlayerId(r, 1, usersWithCorrectDivisions)
    const p2Id = getResultPlayerId(r, 2, usersWithCorrectDivisions)
    if (!p1Id || !p2Id) return false
    const d1 = divMap[p1Id]
    const d2 = divMap[p2Id]
    if (!d1 || !d2 || d1 === 'Unassigned' || d2 === 'Unassigned' || d1 === 'Admin' || d2 === 'Admin') return false
    return d1 === d2
  })
}

export const computeDivisionStandings = ({ allUsers, results, fixtures, adminData, seasonName, seasonDoc, division }) => {
  const usersWithCorrectDivisions = getPlayersWithEffectiveDivisions(allUsers, seasonDoc, seasonName, adminData)
  const divisionFilteredResults = getDivisionFilteredResults(results, usersWithCorrectDivisions)
  const playerStats = derivePlayerStatsFromResults(usersWithCorrectDivisions, divisionFilteredResults, {
    fixtures,
    adminData,
    leagueOnly: true,
    currentSeason: seasonName,
    includePlayoffs: false,
  })

  return usersWithCorrectDivisions
    .filter((p) => p.division === division)
    .filter(p => {
      // Specifically remove Tom Beaumont from Season 4 standings as requested
      if (seasonName === "Season 4" && (p.username === "Tom Beaumont" || p.name === "Tom Beaumont")) {
        return false;
      }
      return true;
    })
    .map((p) => ({
      ...p,
      stats: playerStats[String(p.id)] || {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0,
        average: p.threeDartAverage || 0,
      },
    }))
    .sort((a, b) => {
      if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
      const aLegDiff = a.stats.legsWon - a.stats.legsLost
      const bLegDiff = b.stats.legsWon - b.stats.legsLost
      if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff
      if (b.stats.legsWon !== a.stats.legsWon) return b.stats.legsWon - a.stats.legsWon
      return (b.stats.average || 0) - (a.stats.average || 0)
    })
}