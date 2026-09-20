// Mirrors the league table computation in src/pages/Table.jsx (plus its division list
// logic) so the Discord table matches the app exactly for the selected season.
// Keep in sync with Table.jsx.

import { derivePlayerStatsFromResults, getResultPlayerId } from './scoring.js'

const DEFAULT_CURRENT_SEASON = 'Elite Arrows Season 5'

export function getCurrentSeason(adminData) {
  return adminData?.currentSeason || DEFAULT_CURRENT_SEASON
}

export function getSeasonsList(seasons) {
  return (Array.isArray(seasons) ? seasons : []).filter(s => !s.isArchived)
}

export function getDivisionsForSeason(selectedSeason, adminData) {
  const isNewStructure =
    selectedSeason === (adminData?.currentSeason || DEFAULT_CURRENT_SEASON)
  if (isNewStructure || selectedSeason === 'Season 4' || selectedSeason === 'Season 5') {
    return ['Overall', 'Elite', 'Emerald', 'Diamond', 'Platinum']
  }
  return ['Overall', 'Elite', 'Emerald', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']
}

function getUsersWithCorrectDivisions(users, seasons, selectedSeason, adminData) {
  const activeSeasonDoc = seasons.find(s => s.name === selectedSeason)
  const staged = activeSeasonDoc?.stagedDivisions || {}
  const isLive = selectedSeason === (adminData?.currentSeason || 'Season 1')

  return (Array.isArray(users) ? users : []).map(u => {
    const uid = String(u.id)
    const effectiveDiv = staged[uid] || staged[u.id] || (isLive ? u.division : 'Unassigned')
    return {
      ...u,
      division: effectiveDiv || 'Unassigned'
    }
  })
}

export function buildStandings({
  users = [],
  results = [],
  fixtures = [],
  seasons = [],
  adminData = null,
  selectedSeason = null
}) {
  const currentSeason = getCurrentSeason(adminData)
  const season = selectedSeason || currentSeason
  const divisions = getDivisionsForSeason(season, adminData)

  const usersWithCorrectDivisions = getUsersWithCorrectDivisions(users, getSeasonsList(seasons), season, adminData)

  const divMap = {}
  usersWithCorrectDivisions.forEach(u => {
    divMap[String(u.id)] = u.division
  })

  const divisionFilteredResults = (Array.isArray(results) ? results : []).filter(r => {
    const p1Id = getResultPlayerId(r, 1, usersWithCorrectDivisions)
    const p2Id = getResultPlayerId(r, 2, usersWithCorrectDivisions)
    if (!p1Id || !p2Id) return false
    const d1 = divMap[p1Id]
    const d2 = divMap[p2Id]
    if (!d1 || !d2 || d1 === 'Unassigned' || d2 === 'Unassigned' || d1 === 'Admin' || d2 === 'Admin') return false
    return d1 === d2
  })

  const playerStats = derivePlayerStatsFromResults(usersWithCorrectDivisions, divisionFilteredResults, {
    fixtures: Array.isArray(fixtures) ? fixtures : [],
    adminData,
    leagueOnly: true,
    currentSeason: season,
    includePlayoffs: false
  })

  const buildTable = (activeDivision) => {
    const source = activeDivision === 'Overall'
      ? usersWithCorrectDivisions
      : usersWithCorrectDivisions.filter(u => u.division === activeDivision)

    return source
      .filter(p => {
        if (season === 'Season 4' && (p.username === 'Tom Beaumont' || p.name === 'Tom Beaumont')) {
          return false
        }
        return true
      })
      .map(p => ({
        ...p,
        displayDivision: p.division || 'Unassigned',
        stats: playerStats[String(p.id)] || {
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          legsWon: 0,
          legsLost: 0,
          points: 0,
          average: p.threeDartAverage || 0
        }
      }))
      .filter(p => {
        if (activeDivision !== 'Overall') return true

        if (season === 'Season 4') {
          return p.division && p.division !== 'Unassigned' && p.division !== 'Admin'
        }

        const hasValidDivision = p.division && p.division !== 'Unassigned' && p.division !== 'Admin'
        return p.stats.played > 0 || hasValidDivision
      })
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        const aLegDiff = a.stats.legsWon - a.stats.legsLost
        const bLegDiff = b.stats.legsWon - b.stats.legsLost
        if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff
        if (b.stats.legsWon !== a.stats.legsWon) return b.stats.legsWon - a.stats.legsWon
        return (b.stats.average || 0) - (a.stats.average || 0)
      })
  }

  const tables = {}
  for (const division of divisions) {
    tables[division] = buildTable(division)
  }
  tables.buildTable = buildTable

  return tables
}