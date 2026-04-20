import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ComposedChart
} from 'recharts'

const COLORS = ['#4da8da', '#ef4444', '#f59e0b', '#22c55e']
const RADAR_COLORS = ['#4da8da', '#ef4444']

function timeFilter(results, period) {
  if (period === 'all') return results
  const now = new Date()
  const cutoff = new Date()
  if (period === 'week') cutoff.setDate(now.getDate() - 7)
  else if (period === 'month') cutoff.setMonth(now.getMonth() - 1)
  else if (period === 'quarter') cutoff.setMonth(now.getMonth() - 3)
  else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1)
  return results.filter(r => new Date(r.date) >= cutoff)
}

function calcStdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sqDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length)
}

function calcPercentile(value, allValues) {
  if (allValues.length === 0) return 50
  const sorted = [...allValues].sort((a, b) => a - b)
  const rank = sorted.filter(v => v < value).length
  return Math.round((rank / sorted.length) * 100)
}

function calcMomentum(results) {
  if (results.length < 3) return 'neutral'
  const last5 = results.slice(-5)
  let score = 0
  last5.forEach((r, i) => {
    const weight = (i + 1) / last5.length
    if (r.result === 'W') score += weight
    else if (r.result === 'L') score -= weight
  })
  if (score > 0.3) return 'hot'
  if (score < -0.3) return 'cold'
  return 'neutral'
}

function calcWinProbability(playerStats, oppStats) {
  if (!playerStats || !oppStats || playerStats.played < 2 || oppStats.played < 2) return null
  const pWR = playerStats.wins / playerStats.played
  const oWR = oppStats.wins / oppStats.played
  const pAvgLegs = playerStats.legsWon / playerStats.played
  const oAvgLegs = oppStats.legsWon / oppStats.played
  
  const winRateFactor = (pWR - oWR) * 50
  const legsFactor = (pAvgLegs - oAvgLegs) * 10
  const baseProb = 50 + winRateFactor + legsFactor
  return Math.max(10, Math.min(90, Math.round(baseProb)))
}

export default function Analytics() {
  const { user, getAllUsers } = useAuth()
  const [activeSection, setActiveSection] = useState('personal')
  const [timePeriod, setTimePeriod] = useState('all')
  const [h2hOpponent, setH2hOpponent] = useState('')
  const [comparePlayer1, setComparePlayer1] = useState('')
  const [comparePlayer2, setComparePlayer2] = useState('')

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')

  const filteredResults = useMemo(() => timeFilter(approvedResults, timePeriod), [approvedResults, timePeriod])
  const userResults = useMemo(() => filteredResults.filter(r => r.player1Id === user.id || r.player2Id === user.id), [filteredResults, user.id])

  const personalStats = useMemo(() => {
    const stats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, legsWon: 0, legsLost: 0, total180s: 0, highestCheckout: 0, totalDoubleSuccess: 0, doubleSuccessCount: 0, totalCheckoutAttempts: 0, totalCheckoutsHit: 0 }
    const monthlyData = {}
    const opponentStats = {}
    const threeDartAvgTrend = []
    const checkoutTrend = []
    const legsPerMatchValues = []
    const formGuide = []
    let currentStreak = 0
    let streakType = ''
    let longestWinStreak = 0
    let longestLossStreak = 0
    let tempStreak = 0
    let tempStreakType = ''

    const sortedResults = [...userResults].sort((a, b) => a.date.localeCompare(b.date))

    sortedResults.forEach((r, idx) => {
      const isP1 = r.player1Id === user.id
      const myScore = isP1 ? r.score1 : r.score2
      const theirScore = isP1 ? r.score2 : r.score1
      const myStats = isP1 ? r.player1Stats : r.player2Stats
      const oppId = isP1 ? r.player2Id : r.player1Id
      const oppName = isP1 ? r.player2 : r.player1

      stats.played++
      stats.legsWon += myScore
      stats.legsLost += theirScore
      if (myScore > theirScore) { stats.wins++; stats.points += 3 }
      else if (myScore < theirScore) stats.losses++
      else { stats.draws++; stats.points += 1 }

      stats.total180s += myStats?.['180s'] || 0
      if ((myStats?.highestCheckout || 0) > stats.highestCheckout) stats.highestCheckout = myStats.highestCheckout
      if (myStats?.doubleSuccess) {
        stats.totalDoubleSuccess += myStats.doubleSuccess
        stats.doubleSuccessCount++
      }
      if (myStats?.checkoutAttempts) stats.totalCheckoutAttempts += myStats.checkoutAttempts
      if (myStats?.checkoutsHit) stats.totalCheckoutsHit += myStats.checkoutsHit

      const totalLegs = myScore + theirScore
      const estimatedAvg = totalLegs > 0 ? ((myScore / (totalLegs || 1)) * 180).toFixed(1) : 0
      legsPerMatchValues.push(myScore)

      threeDartAvgTrend.push({
        date: r.date,
        average: parseFloat(estimatedAvg),
        legs: myScore
      })

      if (myStats?.doubleSuccess !== undefined) {
        checkoutTrend.push({
          date: r.date,
          doubleSuccess: parseFloat(myStats.doubleSuccess)
        })
      }

      const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D'
      formGuide.push({ date: r.date, result, opponent: oppName, score: `${myScore}-${theirScore}` })

      if (result === 'W') {
        if (tempStreakType === 'W') { tempStreak++ } else { tempStreak = 1; tempStreakType = 'W' }
        longestWinStreak = Math.max(longestWinStreak, tempStreak)
      } else if (result === 'L') {
        if (tempStreakType === 'L') { tempStreak++ } else { tempStreak = 1; tempStreakType = 'L' }
        longestLossStreak = Math.max(longestLossStreak, tempStreak)
      } else {
        tempStreak = 0; tempStreakType = ''
      }

      const month = r.date.substring(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { month, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, '_180s': 0 }
      monthlyData[month].legsWon += myScore
      monthlyData[month].legsLost += theirScore
      monthlyData[month]['_180s'] += myStats?.['180s'] || 0
      if (myScore > theirScore) monthlyData[month].wins++
      else if (myScore < theirScore) monthlyData[month].losses++
      else monthlyData[month].draws++

      if (!opponentStats[oppId]) opponentStats[oppId] = { name: oppName, played: 0, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, myAvg: 0, theirAvg: 0 }
      opponentStats[oppId].played++
      opponentStats[oppId].legsWon += myScore
      opponentStats[oppId].legsLost += theirScore
      opponentStats[oppId].myAvg += myScore
      opponentStats[oppId].theirAvg += theirScore
      if (myScore > theirScore) opponentStats[oppId].wins++
      else if (myScore < theirScore) opponentStats[oppId].losses++
      else opponentStats[oppId].draws++
    })

    if (tempStreakType === 'W') currentStreak = tempStreak
    else if (tempStreakType === 'L') currentStreak = -tempStreak

    const avgLegsPerMatch = stats.played > 0 ? ((stats.legsWon / stats.played) * 100).toFixed(1) : 0
    const avgDoubleSuccess = stats.doubleSuccessCount > 0 ? (stats.totalDoubleSuccess / stats.doubleSuccessCount).toFixed(1) : 0
    const checkoutPercent = stats.totalCheckoutAttempts > 0 ? ((stats.totalCheckoutsHit / stats.totalCheckoutAttempts) * 100).toFixed(1) : 'N/A'
    const legsRatio = stats.legsLost > 0 ? (stats.legsWon / stats.legsLost).toFixed(2) : stats.legsWon.toFixed(2)
    const pointsPerPlayed = stats.played > 0 ? (stats.points / stats.played).toFixed(2) : 0
    const consistency = calcStdDev(legsPerMatchValues)
    const momentum = calcMomentum(formGuide)

    const bestOpponent = Object.values(opponentStats)
      .filter(o => o.played >= 2 && o.wins > 0)
      .sort((a, b) => (b.wins / b.played) - (a.wins / a.played))[0]

    const worstOpponent = Object.values(opponentStats)
      .filter(o => o.played >= 2 && o.losses > 0)
      .sort((a, b) => (a.losses / a.played) - (b.losses / b.played))[0]

    const last5Matches = formGuide.slice(-5)

    const radarData = [
      { metric: 'Win Rate', value: stats.played > 0 ? (stats.wins / stats.played) * 100 : 0 },
      { metric: 'Legs Ratio', value: Math.min(parseFloat(legsRatio) * 33, 100) },
      { metric: '180s/Match', value: stats.played > 0 ? Math.min((stats.total180s / stats.played) * 20, 100) : 0 },
      { metric: 'Points/Match', value: Math.min(parseFloat(pointsPerPlayed) / 3 * 100, 100) },
      { metric: 'Consistency', value: Math.max(100 - consistency * 10, 0) },
      { metric: 'Checkout %', value: checkoutPercent !== 'N/A' ? parseFloat(checkoutPercent) : 50 }
    ]

    const scatterData = threeDartAvgTrend.map((t, i) => ({
      match: i + 1,
      average: t.average,
      legs: t.legs,
      date: t.date
    }))

    const heatmapData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      month: m.month,
      wins: m.wins,
      losses: m.losses,
      intensity: m.wins + m.losses > 0 ? (m.wins / (m.wins + m.losses)) * 100 : 0
    }))

    return {
      ...stats,
      winRate: stats.played > 0 ? ((stats.wins / stats.played) * 100).toFixed(1) : 0,
      avgLegsPerMatch,
      avgDoubleSuccess,
      checkoutPercent,
      legsRatio,
      pointsPerPlayed,
      consistency: consistency.toFixed(2),
      momentum,
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      opponentData: Object.values(opponentStats).map(o => ({
        ...o,
        myAvg: o.played > 0 ? (o.myAvg / o.played).toFixed(1) : 0,
        theirAvg: o.played > 0 ? (o.theirAvg / o.played).toFixed(1) : 0
      })).sort((a, b) => b.played - a.played),
      threeDartAvgTrend,
      checkoutTrend,
      currentStreak,
      longestWinStreak,
      longestLossStreak,
      bestOpponent,
      worstOpponent,
      radarData,
      scatterData,
      heatmapData,
      last5Matches
    }
  }, [userResults, user.id])

  const h2hStats = useMemo(() => {
    if (!h2hOpponent) return null
    const oppResults = userResults.filter(r =>
      (r.player1Id === user.id && r.player2Id === h2hOpponent) ||
      (r.player2Id === user.id && r.player1Id === h2hOpponent)
    )
    const stats = { played: 0, wins: 0, losses: 0, draws: 0, my180s: 0, opp180s: 0, myHighestCheckout: 0, oppHighestCheckout: 0, myLegsWon: 0, oppLegsWon: 0, matches: [] }
    oppResults.forEach(r => {
      const isP1 = r.player1Id === user.id
      const myScore = isP1 ? r.score1 : r.score2
      const theirScore = isP1 ? r.score2 : r.score1
      const myStats = isP1 ? r.player1Stats : r.player2Stats
      const oppStats = isP1 ? r.player2Stats : r.player1Stats

      stats.played++
      stats.myLegsWon += myScore
      stats.oppLegsWon += theirScore
      if (myScore > theirScore) stats.wins++
      else if (myScore < theirScore) stats.losses++
      else stats.draws++
      stats.my180s += myStats?.['180s'] || 0
      stats.opp180s += oppStats?.['180s'] || 0
      if ((myStats?.highestCheckout || 0) > stats.myHighestCheckout) stats.myHighestCheckout = myStats.highestCheckout
      if ((oppStats?.highestCheckout || 0) > stats.oppHighestCheckout) stats.oppHighestCheckout = oppStats.highestCheckout
      stats.matches.push({ date: r.date, myScore, theirScore, my180s: myStats?.['180s'] || 0, opp180s: oppStats?.['180s'] || 0 })
    })
    stats.matches.sort((a, b) => b.date.localeCompare(a.date))
    return stats
  }, [h2hOpponent, userResults, user.id])

  const leagueStats = useMemo(() => {
    const divisionStats = {}
    const playerStats = {}
    const monthlyTotals = {}
    let totalMatches = 0

    filteredResults.forEach(r => {
      totalMatches++

      if (!divisionStats[r.division]) divisionStats[r.division] = { division: r.division, players: 0, matches: 0, totalLegs: 0, total180s: 0, totalWins: 0, totalPoints: 0 }
      divisionStats[r.division].matches++
      divisionStats[r.division].totalLegs += r.score1 + r.score2
      divisionStats[r.division].total180s += (r.player1Stats?.['180s'] || 0) + (r.player2Stats?.['180s'] || 0)

      ;[
        { id: r.player1Id, name: r.player1, score: r.score1, stats: r.player1Stats },
        { id: r.player2Id, name: r.player2, score: r.score2, stats: r.player2Stats }
      ].forEach(({ id, name, score, stats }) => {
        if (!playerStats[id]) playerStats[id] = { id, name, played: 0, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, '_180s': 0, highestCheckout: 0, points: 0, division: r.division }
        const p = playerStats[id]
        p.played++
        p.legsWon += score
        const oppScore = id === r.player1Id ? r.score2 : r.score1
        p.legsLost += oppScore
        if (score > oppScore) { p.wins++; p.points += 3; divisionStats[r.division].totalWins++ }
        else if (score < oppScore) p.losses++
        else { p.draws++; p.points += 1 }
        p['180s'] += stats?.['180s'] || 0
        if ((stats?.highestCheckout || 0) > p.highestCheckout) p.highestCheckout = stats.highestCheckout
        divisionStats[r.division].totalPoints += score > oppScore ? 3 : score === oppScore ? 1 : 0
      })

      const month = r.date.substring(0, 7)
      if (!monthlyTotals[month]) monthlyTotals[month] = { month, matches: 0, legs: 0, '_180s': 0 }
      monthlyTotals[month].matches++
      monthlyTotals[month].legs += r.score1 + r.score2
      monthlyTotals[month]['180s'] += (r.player1Stats?.['180s'] || 0) + (r.player2Stats?.['180s'] || 0)
    })

    const divData = Object.values(divisionStats).map(d => ({
      ...d,
      avgLegsPerMatch: d.matches > 0 ? (d.totalLegs / d.matches).toFixed(1) : 0,
      avg180sPerMatch: d.matches > 0 ? (d.total180s / d.matches).toFixed(1) : 0,
      avgPointsPerMatch: d.matches > 0 ? (d.totalPoints / d.matches).toFixed(1) : 0
    }))

    const players = Object.values(playerStats).sort((a, b) => b.points - a.points)
    const topWins = [...players].sort((a, b) => b.wins - a.wins).slice(0, 5)
    const top180s = [...players].sort((a, b) => b['180s'] - a['180s']).slice(0, 5)
    const topCheckout = [...players].sort((a, b) => b.highestCheckout - a.highestCheckout).slice(0, 5)
    const topLegDiff = [...players].sort((a, b) => (b.legsWon - b.legsLost) - (a.legsWon - a.legsLost)).slice(0, 5)

    const monthlyData = Object.values(monthlyTotals).sort((a, b) => a.month.localeCompare(b.month))

    const userDivision = userResults.length > 0 ? userResults[0].division : null
    const userDivisionAvg = divData.find(d => d.division === userDivision)

    const userLeagueStats = playerStats[user.id] || { played: 0, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, '_180s': 0, highestCheckout: 0, points: 0 }
    const userLeagueAvg = {
      legsPerMatch: userLeagueStats.played > 0 ? (userLeagueStats.legsWon / userLeagueStats.played).toFixed(1) : 0,
      winRate: userLeagueStats.played > 0 ? ((userLeagueStats.wins / userLeagueStats.played) * 100).toFixed(1) : 0,
      pointsPerMatch: userLeagueStats.played > 0 ? (userLeagueStats.points / userLeagueStats.played).toFixed(1) : 0,
      '_180sPerMatch': userLeagueStats.played > 0 ? (userLeagueStats['180s'] / userLeagueStats.played).toFixed(1) : 0
    }

    const allWinRates = players.map(p => p.played > 0 ? p.wins / p.played : 0)
    const all180sPerMatch = players.map(p => p.played > 0 ? p['180s'] / p.played : 0)
    const allLegsRatios = players.map(p => p.legsLost > 0 ? p.legsWon / p.legsLost : p.legsWon)

    const playerPercentiles = {}
    players.forEach(p => {
      const wr = p.played > 0 ? p.wins / p.played : 0
      const lrm = p.played > 0 ? p.legsWon / p.played : 0
      const pm = p.played > 0 ? p.points / p.played : 0
      const lr = p.legsLost > 0 ? p.legsWon / p.legsLost : p.legsWon
      playerPercentiles[p.id] = {
        winRate: calcPercentile(wr, allWinRates),
        legsPerMatch: calcPercentile(lrm, players.map(x => x.played > 0 ? x.legsWon / x.played : 0)),
        pointsPerMatch: calcPercentile(pm, players.map(x => x.played > 0 ? x.points / x.played : 0)),
        legsRatio: calcPercentile(lr, allLegsRatios),
        '180s': calcPercentile(p.played > 0 ? p['180s'] / p.played : 0, all180sPerMatch)
      }
    })

    return { divData, players, topWins, top180s, topCheckout, topLegDiff, monthlyData, totalMatches, uniquePlayers: Object.keys(playerStats).length, userDivision, userDivisionAvg, userLeagueAvg, playerPercentiles }
  }, [filteredResults, userResults, user.id])

  const comparisonStats = useMemo(() => {
    if (!comparePlayer1 || !comparePlayer2) return null
    
    const p1Results = filteredResults.filter(r => r.player1Id === comparePlayer1 || r.player2Id === comparePlayer1)
    const p2Results = filteredResults.filter(r => r.player1Id === comparePlayer2 || r.player2Id === comparePlayer2)

    const calcPlayerStats = (results, playerId) => {
      let played = 0, wins = 0, losses = 0, draws = 0, legsWon = 0, legsLost = 0, total180s = 0, highestCheckout = 0, points = 0
      results.forEach(r => {
        const isP1 = r.player1Id === playerId
        const score = isP1 ? r.score1 : r.score2
        const oppScore = isP1 ? r.score2 : r.score1
        const stats = isP1 ? r.player1Stats : r.player2Stats
        played++
        legsWon += score
        legsLost += oppScore
        if (score > oppScore) { wins++; points += 3 }
        else if (score < oppScore) losses++
        else draws++
        total180s += stats?.['180s'] || 0
        if ((stats?.highestCheckout || 0) > highestCheckout) highestCheckout = stats.highestCheckout
      })
      return {
        played, wins, losses, draws, legsWon, legsLost, total180s, highestCheckout, points,
        winRate: played > 0 ? ((wins / played) * 100).toFixed(1) : 0,
        legsPerMatch: played > 0 ? (legsWon / played).toFixed(1) : 0,
        pointsPerMatch: played > 0 ? (points / played).toFixed(2) : 0,
        legsRatio: legsLost > 0 ? (legsWon / legsLost).toFixed(2) : legsWon.toFixed(2),
        '180sPerMatch': played > 0 ? (total180s / played).toFixed(1) : 0
      }
    }

    const p1 = calcPlayerStats(p1Results, comparePlayer1)
    const p2 = calcPlayerStats(p2Results, comparePlayer2)
    const p1Name = allUsers.find(u => u.id === comparePlayer1)?.username || 'Player 1'
    const p2Name = allUsers.find(u => u.id === comparePlayer2)?.username || 'Player 2'

    const winProb = calcWinProbability(p1, p2)

    const radarComparison = [
      { metric: 'Win Rate', p1: parseFloat(p1.winRate), p2: parseFloat(p2.winRate) },
      { metric: 'Legs/Match', p1: parseFloat(p1.legsPerMatch) * 10, p2: parseFloat(p2.legsPerMatch) * 10 },
      { metric: 'Pts/Match', p1: parseFloat(p1.pointsPerMatch) * 33, p2: parseFloat(p2.pointsPerMatch) * 33 },
      { metric: '180s/Match', p1: parseFloat(p1['180sPerMatch']) * 20, p2: parseFloat(p2['180sPerMatch']) * 20 },
      { metric: 'Legs Ratio', p1: parseFloat(p1.legsRatio) * 25, p2: parseFloat(p2.legsRatio) * 25 }
    ]

    return { p1, p2, p1Name, p2Name, winProb, radarComparison }
  }, [comparePlayer1, comparePlayer2, filteredResults, allUsers])

  const sections = [
    { id: 'personal', label: 'Personal Performance' },
    { id: 'h2h', label: 'Head-to-Head' },
    { id: 'compare', label: 'Player Compare' },
    { id: 'league', label: 'League Analytics' }
  ]

  const pieData = [
    { name: 'Wins', value: personalStats.wins },
    { name: 'Losses', value: personalStats.losses },
    { name: 'Draws', value: personalStats.draws }
  ].filter(d => d.value > 0)

  const momentumColor = personalStats.momentum === 'hot' ? 'var(--success)' : personalStats.momentum === 'cold' ? 'var(--error)' : 'var(--text-muted)'
  const momentumLabel = personalStats.momentum === 'hot' ? 'HOT' : personalStats.momentum === 'cold' ? 'COLD' : 'NEUTRAL'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Performance Analytics</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button
            key={s.id}
            className={`division-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'personal' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['week', 'month', 'quarter', 'year', 'all'].map(p => (
              <button
                key={p}
                className={`division-tab ${timePeriod === p ? 'active' : ''}`}
                onClick={() => setTimePeriod(p)}
                style={{ textTransform: 'capitalize' }}
              >
                {p === 'all' ? 'All Time' : p}
              </button>
            ))}
          </div>

          <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-value">{personalStats.played}</div>
              <div className="stat-label">Matches Played</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.avgLegsPerMatch}</div>
              <div className="stat-label">Avg Legs/Match</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.total180s}</div>
              <div className="stat-label">Total 180s</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.highestCheckout}</div>
              <div className="stat-label">Best Checkout</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.avgDoubleSuccess}%</div>
              <div className="stat-label">Avg Double %</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: personalStats.currentStreak > 0 ? 'var(--success)' : personalStats.currentStreak < 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                {personalStats.currentStreak > 0 ? `W${personalStats.currentStreak}` : personalStats.currentStreak < 0 ? `L${Math.abs(personalStats.currentStreak)}` : '-'}
              </div>
              <div className="stat-label">Current Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{personalStats.longestWinStreak}</div>
              <div className="stat-label">Longest Win Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.checkoutPercent !== 'N/A' ? `${personalStats.checkoutPercent}%` : 'N/A'}</div>
              <div className="stat-label">Checkout %</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.legsRatio}</div>
              <div className="stat-label">Legs Ratio</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{personalStats.pointsPerPlayed}</div>
              <div className="stat-label">Points/Match</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: momentumColor }}>{momentumLabel}</div>
              <div className="stat-label">Momentum</div>
            </div>
          </div>

          {personalStats.last5Matches.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 className="card-title">Form Guide (Last 5)</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px 0' }}>
                {personalStats.last5Matches.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '12px 16px', borderRadius: '8px', minWidth: '80px',
                    background: m.result === 'W' ? 'var(--success)' + '22' : m.result === 'L' ? 'var(--error)' + '22' : 'var(--warning)' + '22',
                    border: `1px solid ${m.result === 'W' ? 'var(--success)' : m.result === 'L' ? 'var(--error)' : 'var(--warning)'}`
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '1.2rem', color: m.result === 'W' ? 'var(--success)' : m.result === 'L' ? 'var(--error)' : 'var(--warning)' }}>{m.result}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.score}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.opponent.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card">
              <h3 className="card-title">Win/Loss Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Performance Radar</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={personalStats.radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="You" dataKey="value" stroke="#4da8da" fill="#4da8da" fillOpacity={0.5} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Monthly Performance</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={personalStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="wins" fill="#22c55e" name="Wins" />
                  <Bar dataKey="losses" fill="#ef4444" name="Losses" />
                  <Bar dataKey="draws" fill="#f59e0b" name="Draws" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Legs Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={personalStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="legsWon" stroke="#22c55e" fill="#22c55e33" name="Legs Won" />
                  <Area type="monotone" dataKey="legsLost" stroke="#ef4444" fill="#ef444433" name="Legs Lost" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">180s per Month</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={personalStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="_180s" fill="#4da8da" name="180s" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {personalStats.threeDartAvgTrend.length > 0 && (
              <div className="card">
                <h3 className="card-title">3-Dart Average Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={personalStats.threeDartAvgTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="average" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="3-Dart Avg" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {personalStats.checkoutTrend.length > 0 && (
              <div className="card">
                <h3 className="card-title">Checkout Success Rate</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={personalStats.checkoutTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="doubleSuccess" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Double %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card">
              <h3 className="card-title">Performance Scatter (Avg vs Legs)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" dataKey="average" name="3-Dart Avg" stroke="var(--text-muted)" />
                  <YAxis type="number" dataKey="legs" name="Legs Won" stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Scatter name="Matches" data={personalStats.scatterData} fill="#4da8da" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Consistency (Legs per Match)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={personalStats.threeDartAvgTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="legs" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Legs Won" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Std Deviation: {personalStats.consistency} (lower = more consistent)
              </div>
            </div>
          </div>

          {personalStats.opponentData.length > 0 && (
            <div className="card">
              <h3 className="card-title">Performance by Opponent</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={personalStats.opponentData.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="wins" fill="#22c55e" name="Wins" />
                  <Bar dataKey="losses" fill="#ef4444" name="Losses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(personalStats.bestOpponent || personalStats.worstOpponent) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {personalStats.bestOpponent && (
                <div className="card" style={{ borderTop: '3px solid var(--success)' }}>
                  <h3 className="card-title" style={{ color: 'var(--success)' }}>Best Opponent</h3>
                  <div style={{ padding: '12px 0' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>{personalStats.bestOpponent.name}</div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
                      <span>{personalStats.bestOpponent.wins}W - {personalStats.bestOpponent.losses}L</span>
                      <span>{((personalStats.bestOpponent.wins / personalStats.bestOpponent.played) * 100).toFixed(0)}% Win Rate</span>
                    </div>
                  </div>
                </div>
              )}
              {personalStats.worstOpponent && (
                <div className="card" style={{ borderTop: '3px solid var(--error)' }}>
                  <h3 className="card-title" style={{ color: 'var(--error)' }}>Worst Opponent</h3>
                  <div style={{ padding: '12px 0' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>{personalStats.worstOpponent.name}</div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
                      <span>{personalStats.worstOpponent.wins}W - {personalStats.worstOpponent.losses}L</span>
                      <span>{((personalStats.worstOpponent.wins / personalStats.worstOpponent.played) * 100).toFixed(0)}% Win Rate</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeSection === 'h2h' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Select Opponent</h3>
            <select
              value={h2hOpponent}
              onChange={e => setH2hOpponent(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            >
              <option value="">Choose a player...</option>
              {allUsers.filter(u => u.id !== user.id).map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>

          {h2hStats && (
            <>
              <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.played}</div>
                  <div className="stat-label">Matches Played</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.wins}</div>
                  <div className="stat-label">Your Wins</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.losses}</div>
                  <div className="stat-label">Your Losses</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.draws}</div>
                  <div className="stat-label">Draws</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.my180s}</div>
                  <div className="stat-label">Your 180s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{h2hStats.opp180s}</div>
                  <div className="stat-label">Their 180s</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div className="card">
                  <h3 className="card-title">Head-to-Head Record</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={[
                        { name: 'Your Wins', value: h2hStats.wins },
                        { name: 'Their Wins', value: h2hStats.losses },
                        { name: 'Draws', value: h2hStats.draws }
                      ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                        {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <h3 className="card-title">Score Comparison</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={h2hStats.matches.slice(0, 10).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--text-muted)" />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="myScore" fill="#4da8da" name="You" />
                      <Bar dataKey="theirScore" fill="#ef4444" name="Opponent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">Recent Matches</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Your Score</th>
                        <th>Their Score</th>
                        <th>Your 180s</th>
                        <th>Their 180s</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h2hStats.matches.map((m, i) => {
                        const result = m.myScore > m.theirScore ? 'Win' : m.myScore < m.theirScore ? 'Loss' : 'Draw'
                        return (
                          <tr key={i}>
                            <td>{m.date}</td>
                            <td style={{ fontWeight: '600' }}>{m.myScore}</td>
                            <td style={{ fontWeight: '600' }}>{m.theirScore}</td>
                            <td>{m.my180s}</td>
                            <td>{m.opp180s}</td>
                            <td style={{ color: result === 'Win' ? 'var(--success)' : result === 'Loss' ? 'var(--error)' : 'var(--warning)', fontWeight: '600' }}>{result}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!h2hOpponent && (
            <div className="empty-state">
              <p>Select an opponent to view head-to-head statistics</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'compare' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card">
              <h3 className="card-title">Player 1</h3>
              <select
                value={comparePlayer1}
                onChange={e => setComparePlayer1(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">Choose player...</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <div className="card">
              <h3 className="card-title">Player 2</h3>
              <select
                value={comparePlayer2}
                onChange={e => setComparePlayer2(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">Choose player...</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          </div>

          {comparisonStats && (
            <>
              {comparisonStats.winProb && (
                <div className="card" style={{ marginBottom: '20px', borderTop: '3px solid var(--accent-cyan)' }}>
                  <h3 className="card-title">Win Probability Prediction</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#4da8da' }}>{comparisonStats.winProb}%</div>
                      <div style={{ color: 'var(--text-muted)' }}>{comparisonStats.p1Name}</div>
                    </div>
                    <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>vs</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>{100 - comparisonStats.winProb}%</div>
                      <div style={{ color: 'var(--text-muted)' }}>{comparisonStats.p2Name}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: '0.9rem' }}>{comparisonStats.p1Name}</div>
                  <div className="stat-label">Player 1</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.played}</div>
                  <div className="stat-label">Matches</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.winRate}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.legsPerMatch}</div>
                  <div className="stat-label">Legs/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.pointsPerMatch}</div>
                  <div className="stat-label">Pts/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1['180sPerMatch']}</div>
                  <div className="stat-label">180s/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.legsRatio}</div>
                  <div className="stat-label">Legs Ratio</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p1.highestCheckout}</div>
                  <div className="stat-label">Best CO</div>
                </div>
              </div>

              <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: '0.9rem' }}>{comparisonStats.p2Name}</div>
                  <div className="stat-label">Player 2</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.played}</div>
                  <div className="stat-label">Matches</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.winRate}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.legsPerMatch}</div>
                  <div className="stat-label">Legs/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.pointsPerMatch}</div>
                  <div className="stat-label">Pts/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2['180sPerMatch']}</div>
                  <div className="stat-label">180s/Match</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.legsRatio}</div>
                  <div className="stat-label">Legs Ratio</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{comparisonStats.p2.highestCheckout}</div>
                  <div className="stat-label">Best CO</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div className="card">
                  <h3 className="card-title">Radar Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={comparisonStats.radarComparison}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar name={comparisonStats.p1Name} dataKey="p1" stroke="#4da8da" fill="#4da8da" fillOpacity={0.3} />
                      <Radar name={comparisonStats.p2Name} dataKey="p2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <h3 className="card-title">Metric Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { metric: 'Win Rate', p1: parseFloat(comparisonStats.p1.winRate), p2: parseFloat(comparisonStats.p2.winRate) },
                      { metric: 'Legs/Match', p1: parseFloat(comparisonStats.p1.legsPerMatch) * 10, p2: parseFloat(comparisonStats.p2.legsPerMatch) * 10 },
                      { metric: 'Pts/Match', p1: parseFloat(comparisonStats.p1.pointsPerMatch) * 30, p2: parseFloat(comparisonStats.p2.pointsPerMatch) * 30 },
                      { metric: '180s/Match', p1: parseFloat(comparisonStats.p1['180sPerMatch']) * 20, p2: parseFloat(comparisonStats.p2['180sPerMatch']) * 20 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="metric" stroke="var(--text-muted)" />
                      <YAxis stroke="var(--text-muted)" />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="p1" fill="#4da8da" name={comparisonStats.p1Name} />
                      <Bar dataKey="p2" fill="#ef4444" name={comparisonStats.p2Name} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {leagueStats.playerPercentiles && (
                <div className="card">
                  <h3 className="card-title">Percentile Rankings (vs League)</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th style={{ color: '#4da8da' }}>{comparisonStats.p1Name}</th>
                          <th style={{ color: '#ef4444' }}>{comparisonStats.p2Name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: 'winRate', label: 'Win Rate' },
                          { key: 'legsPerMatch', label: 'Legs/Match' },
                          { key: 'pointsPerMatch', label: 'Points/Match' },
                          { key: 'legsRatio', label: 'Legs Ratio' },
                          { key: '180s', label: '180s Frequency' }
                        ].map(m => {
                          const p1p = leagueStats.playerPercentiles[comparePlayer1]?.[m.key] ?? '-'
                          const p2p = leagueStats.playerPercentiles[comparePlayer2]?.[m.key] ?? '-'
                          return (
                            <tr key={m.key}>
                              <td>{m.label}</td>
                              <td>{typeof p1p === 'number' ? `Top ${100 - p1p}%` : p1p}</td>
                              <td>{typeof p2p === 'number' ? `Top ${100 - p2p}%` : p2p}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {(!comparePlayer1 || !comparePlayer2) && (
            <div className="empty-state">
              <p>Select two players to compare their statistics</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'league' && (
        <div>
          <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-value">{leagueStats.totalMatches}</div>
              <div className="stat-label">Total Matches</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{leagueStats.uniquePlayers}</div>
              <div className="stat-label">Active Players</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{leagueStats.monthlyData.length}</div>
              <div className="stat-label">Active Months</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{leagueStats.divData.length}</div>
              <div className="stat-label">Divisions</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card">
              <h3 className="card-title">Division Comparison (Avg Legs/Match)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leagueStats.divData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="division" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="avgLegsPerMatch" fill="#4da8da" name="Avg Legs" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Division 180s (Avg/Match)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leagueStats.divData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="division" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="avg180sPerMatch" fill="#f59e0b" name="Avg 180s" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Matches Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={leagueStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="matches" stroke="#4da8da" strokeWidth={2} dot={{ r: 4 }} name="Matches" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="card-title">Legs Played Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={leagueStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="legs" stroke="#22c55e" fill="#22c55e33" name="Total Legs" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {leagueStats.userDivisionAvg && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 className="card-title">Your Performance vs {leagueStats.userDivisionAvg.division} Division Average</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { metric: 'Legs/Match', you: parseFloat(leagueStats.userLeagueAvg.legsPerMatch), division: parseFloat(leagueStats.userDivisionAvg.avgLegsPerMatch) },
                  { metric: 'Win Rate %', you: parseFloat(leagueStats.userLeagueAvg.winRate), division: leagueStats.userDivisionAvg.matches > 0 ? ((leagueStats.userDivisionAvg.totalWins / (leagueStats.userDivisionAvg.matches * 2)) * 100).toFixed(1) : 0 },
                  { metric: 'Pts/Match', you: parseFloat(leagueStats.userLeagueAvg.pointsPerMatch), division: parseFloat(leagueStats.userDivisionAvg.avgPointsPerMatch) },
                  { metric: '180s/Match', you: parseFloat(leagueStats.userLeagueAvg['_180sPerMatch']), division: parseFloat(leagueStats.userDivisionAvg.avg180sPerMatch) }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="metric" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="you" fill="#4da8da" name="You" />
                  <Bar dataKey="division" fill="#6b7280" name="Division Avg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card">
              <h3 className="card-title">Top Wins</h3>
              {leagueStats.topWins.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '8px' }}>#{i + 1}</span>
                    {p.name}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--success)' }}>{p.wins} wins</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="card-title">Most 180s</h3>
              {leagueStats.top180s.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '8px' }}>#{i + 1}</span>
                    {p.name}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--warning)' }}>{p['180s']} 180s</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="card-title">Best Checkout</h3>
              {leagueStats.topCheckout.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '8px' }}>#{i + 1}</span>
                    {p.name}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>{p.highestCheckout}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="card-title">Best Leg Difference</h3>
              {leagueStats.topLegDiff.map((p, i) => {
                const diff = p.legsWon - p.legsLost
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                    <span>
                      <span style={{ color: 'var(--accent-cyan)', marginRight: '8px' }}>#{i + 1}</span>
                      {p.name}
                    </span>
                    <span style={{ fontWeight: '600', color: diff >= 0 ? 'var(--success)' : 'var(--error)' }}>{diff > 0 ? '+' : ''}{diff}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Full Player Rankings</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>P</th>
                    <th>W</th>
                    <th>L</th>
                    <th>D</th>
                    <th>+/-</th>
                    <th>Pts</th>
                    <th>180s</th>
                    <th>Best CO</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueStats.players.map((p, i) => {
                    const diff = p.legsWon - p.legsLost
                    return (
                      <tr key={p.id} style={{ background: p.id === user.id ? 'var(--bg-hover)' : 'transparent' }}>
                        <td>{i + 1}</td>
                        <td>{p.name}{p.id === user.id && <span className="admin-badge" style={{ marginLeft: '8px' }}>You</span>}</td>
                        <td>{p.played}</td>
                        <td>{p.wins}</td>
                        <td>{p.losses}</td>
                        <td>{p.draws}</td>
                        <td style={{ color: diff >= 0 ? 'var(--success)' : 'var(--error)' }}>{diff > 0 ? '+' : ''}{diff}</td>
                        <td style={{ fontWeight: '600' }}>{p.points}</td>
                        <td>{p['180s']}</td>
                        <td>{p.highestCheckout}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
