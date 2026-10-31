import { derivePlayerStatsFromResults } from './playerStats'
import { getResultPlayerId } from './leagueResults'

export const DIVISION_COLORS = {
  Premier: '#ec4899',
  'Premier Division': '#ec4899',
  'Pro League': '#ec4899',
  Elite: '#fbbf24',
  'Emerald 1': '#10b981',
  'Emerald 2': '#059669',
  Emerald: '#10b981',
  Diamond: '#38bdf8',
  Platinum: '#818cf8',
  Overall: '#818cf8',
}

export const LEAGUE_DIVISION_KEYS = ['premier', 'premier_division', 'pro_league', 'elite', 'emerald_1', 'emerald_2', 'emerald', 'diamond', 'platinum']

export const LEAGUE_DIVISION_NAMES = {
  premier: 'Premier',
  premier_division: 'Premier',
  pro_league: 'Premier',
  elite: 'Elite',
  emerald_1: 'Emerald 1',
  emerald_2: 'Emerald 2',
  emerald: 'Emerald',
  diamond: 'Diamond',
  platinum: 'Platinum',
}

// Divisions not currently in use and hidden from public-facing lists
export const HIDDEN_LEAGUE_DIVISIONS = []

// Divisions shown on the site (in order)
export const ACTIVE_LEAGUE_DIVISIONS = ['Premier', 'Elite', 'Emerald 1', 'Emerald 2', 'Diamond', 'Platinum']

export const getDivisionsForSeason = (selectedSeason, adminData) => {
  return ['Overall', 'Premier', 'Elite', 'Emerald 1', 'Emerald 2', 'Diamond', 'Platinum']
}

export const normalizeDivisionName = (div) => {
  if (!div) return 'Unassigned'
  const norm = String(div).trim().toLowerCase()
  if (norm === 'premier' || norm === 'premier division' || norm === 'pro league' || norm === 'pro_league' || norm === 'premier_division') return 'Premier'
  if (norm === 'emerald 1' || norm === 'emerald_1' || norm === 'emerald') return 'Emerald 1'
  if (norm === 'emerald 2' || norm === 'emerald_2') return 'Emerald 2'
  if (norm === 'elite') return 'Elite'
  if (norm === 'diamond') return 'Diamond'
  if (norm === 'platinum') return 'Platinum'
  return div
}

export const getPlayersWithEffectiveDivisions = (allUsers, seasonDoc, selectedSeason, adminData) => {
  const staged = seasonDoc?.stagedDivisions || {}
  const currentSeason = adminData?.currentSeason || 'Elite Arrows Season 6'
  const normSelected = String(selectedSeason || '').toLowerCase()
  const normCurrent = String(currentSeason || '').toLowerCase()

  const isLive =
    !selectedSeason ||
    normSelected === normCurrent ||
    normSelected.includes('season 6') ||
    normSelected.includes('season 5') ||
    !seasonDoc

  return allUsers.map((u) => {
    const uid = String(u.id)
    const rawDiv = staged[uid] || staged[u.id] || u.division
    const effectiveDiv = normalizeDivisionName(rawDiv)
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
    const d1 = divMap[p1Id] || 'Unassigned'
    const d2 = divMap[p2Id] || 'Unassigned'
    if (d1 === 'Admin' || d2 === 'Admin') return false
    if (d1 === 'Unassigned' || d2 === 'Unassigned') return true
    return d1 === d2
  })
}

export const computeDivisionStandings = ({ allUsers, results, fixtures, adminData, seasonName, seasonDoc, division }) => {
  const usersWithCorrectDivisions = getPlayersWithEffectiveDivisions(allUsers, seasonDoc, seasonName, adminData)
  const playerStats = derivePlayerStatsFromResults(usersWithCorrectDivisions, results, {
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