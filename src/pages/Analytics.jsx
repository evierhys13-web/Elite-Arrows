import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts'

const COLORS = ['#4da8da', '#ef4444', '#f59e0b', '#22c55e']

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

export default function Analytics() {
  const { user, getAllUsers } = useAuth()
  const [activeSection, setActiveSection] = useState('personal')
  const [timePeriod, setTimePeriod] = useState('all')
  const [h2hOpponent, setH2hOpponent] = useState('')

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')

  const filteredResults = useMemo(() => timeFilter(approvedResults, timePeriod), [approvedResults, timePeriod])
  const userResults = useMemo(() => filteredResults.filter(r => r.player1Id === user.id || r.player2Id === user.id), [filteredResults, user.id])

  const personalStats = useMemo(() => {
    const stats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, legsWon: 0, legsLost: 0, total180s: 0, highestCheckout: 0, totalDoubleSuccess: 0, doubleSuccessCount: 0 }
    const monthlyData = {}
    const opponentStats = {}

    userResults.forEach(r => {
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

    const avgLegsPerMatch = stats.played > 0 ? ((stats.legsWon / stats.played) * 100).toFixed(1) : 0
    const avgDoubleSuccess = stats.doubleSuccessCount > 0 ? (stats.totalDoubleSuccess / stats.doubleSuccessCount).toFixed(1) : 0

    return {
      ...stats,
      winRate: stats.played > 0 ? ((stats.wins / stats.played) * 100).toFixed(1) : 0,
      avgLegsPerMatch,
      avgDoubleSuccess,
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      opponentData: Object.values(opponentStats).map(o => ({
        ...o,
        myAvg: o.played > 0 ? (o.myAvg / o.played).toFixed(1) : 0,
        theirAvg: o.played > 0 ? (o.theirAvg / o.played).toFixed(1) : 0
      })).sort((a, b) => b.played - a.played)
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

      if (!divisionStats[r.division]) divisionStats[r.division] = { division: r.division, players: 0, matches: 0, totalLegs: 0, total180s: 0 }
      divisionStats[r.division].matches++
      divisionStats[r.division].totalLegs += r.score1 + r.score2
      divisionStats[r.division].total180s += (r.player1Stats?.['180s'] || 0) + (r.player2Stats?.['180s'] || 0)

      ;[
        { id: r.player1Id, name: r.player1, score: r.score1, stats: r.player1Stats },
        { id: r.player2Id, name: r.player2, score: r.score2, stats: r.player2Stats }
      ].forEach(({ id, name, score, stats }) => {
        if (!playerStats[id]) playerStats[id] = { id, name, played: 0, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, '_180s': 0, highestCheckout: 0, points: 0 }
        const p = playerStats[id]
        p.played++
        p.legsWon += score
        const oppScore = id === r.player1Id ? r.score2 : r.score1
        p.legsLost += oppScore
        if (score > oppScore) { p.wins++; p.points += 3 }
        else if (score < oppScore) p.losses++
        else { p.draws++; p.points += 1 }
        p['180s'] += stats?.['180s'] || 0
        if ((stats?.highestCheckout || 0) > p.highestCheckout) p.highestCheckout = stats.highestCheckout
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
      avg180sPerMatch: d.matches > 0 ? (d.total180s / d.matches).toFixed(1) : 0
    }))

    const players = Object.values(playerStats).sort((a, b) => b.points - a.points)
    const topWins = [...players].sort((a, b) => b.wins - a.wins).slice(0, 5)
    const top180s = [...players].sort((a, b) => b['180s'] - a['180s']).slice(0, 5)
    const topCheckout = [...players].sort((a, b) => b.highestCheckout - a.highestCheckout).slice(0, 5)
    const topLegDiff = [...players].sort((a, b) => (b.legsWon - b.legsLost) - (a.legsWon - a.legsLost)).slice(0, 5)

    const monthlyData = Object.values(monthlyTotals).sort((a, b) => a.month.localeCompare(b.month))

    return { divData, players, topWins, top180s, topCheckout, topLegDiff, monthlyData, totalMatches, uniquePlayers: Object.keys(playerStats).length }
  }, [filteredResults])

  const sections = [
    { id: 'personal', label: 'Personal Performance' },
    { id: 'h2h', label: 'Head-to-Head' },
    { id: 'league', label: 'League Analytics' }
  ]

  const pieData = [
    { name: 'Wins', value: personalStats.wins },
    { name: 'Losses', value: personalStats.losses },
    { name: 'Draws', value: personalStats.draws }
  ].filter(d => d.value > 0)

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
          </div>

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
