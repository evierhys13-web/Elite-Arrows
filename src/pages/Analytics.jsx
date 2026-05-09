import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { getLeaguePoints } from '../utils/leagueScoring'
import Breadcrumbs from '../components/Breadcrumbs'

const COLORS = ['#7C5CFC', '#ef4444', '#f59e0b', '#10b981']

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

export default function Analytics() {
  const { user, getAllUsers, getResults, adminData } = useAuth()
  const [activeSection, setActiveSection] = useState('personal')
  const [timePeriod, setTimePeriod] = useState('all')
  const [h2hOpponent, setH2hOpponent] = useState('')

  const allUsers = getAllUsers()
  const results = getResults()
  const currentSeason = adminData?.currentSeason || 'Season 1'

  const approvedResults = useMemo(() =>
    results.filter(r =>
      String(r.status || '').toLowerCase() === 'approved' &&
      (!r.season || r.season === currentSeason)
    ), [results, currentSeason])

  const filteredResults = useMemo(() => timeFilter(approvedResults, timePeriod), [approvedResults, timePeriod])
  const userResults = useMemo(() => filteredResults.filter(r => String(r.player1Id) === String(user.id) || String(r.player2Id) === String(user.id)), [filteredResults, user.id])

  const personalStats = useMemo(() => {
    const stats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, legsWon: 0, legsLost: 0, total180s: 0, highestCheckout: 0 }
    const monthlyData = {}
    const checkoutTrend = []
    const legsPerMatchValues = []
    const formGuide = []

    const sortedResults = [...userResults].sort((a, b) => a.date.localeCompare(b.date))

    sortedResults.forEach((r) => {
      const isP1 = String(r.player1Id) === String(user.id)
      const myScore = isP1 ? Number(r.score1) : Number(r.score2)
      const theirScore = isP1 ? Number(r.score2) : Number(r.score1)
      const myStats = isP1 ? r.player1Stats : r.player2Stats
      const oppName = isP1 ? r.player2 : r.player1

      stats.played++
      stats.legsWon += myScore
      stats.legsLost += theirScore
      if (myScore > theirScore) stats.wins++
      else if (myScore < theirScore) stats.losses++
      else stats.draws++

      stats.points += getLeaguePoints(myScore, theirScore)
      stats.total180s += Number(myStats?.['180s'] || 0)
      if (Number(myStats?.highestCheckout || 0) > stats.highestCheckout) stats.highestCheckout = Number(myStats.highestCheckout)

      legsPerMatchValues.push(myScore)

      if (myStats?.doubleSuccess !== undefined) {
        checkoutTrend.push({ date: r.date, doubleSuccess: parseFloat(myStats.doubleSuccess) })
      }

      const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D'
      formGuide.push({ date: r.date, result, opponent: oppName, score: `${myScore}-${theirScore}` })

      const month = r.date.substring(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { month, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0, _180s: 0 }
      monthlyData[month].legsWon += myScore
      monthlyData[month].legsLost += theirScore
      monthlyData[month]._180s += Number(myStats?.['180s'] || 0)
      if (myScore > theirScore) monthlyData[month].wins++
      else if (myScore < theirScore) monthlyData[month].losses++
      else monthlyData[month].draws++
    })

    const consistency = calcStdDev(legsPerMatchValues)

    const radarData = [
      { metric: 'Win Rate', value: stats.played > 0 ? (stats.wins / stats.played) * 100 : 0 },
      { metric: 'Leg Diff', value: stats.played > 0 ? Math.min(Math.max(50 + (stats.legsWon - stats.legsLost) * 5, 0), 100) : 0 },
      { metric: '180s', value: stats.played > 0 ? Math.min((stats.total180s / stats.played) * 50, 100) : 0 },
      { metric: 'Points', value: stats.played > 0 ? Math.min((stats.points / (stats.played * 8)) * 100, 100) : 0 },
      { metric: 'Consistency', value: Math.max(100 - consistency * 20, 0) }
    ]

    return {
      ...stats,
      winRate: stats.played > 0 ? ((stats.wins / stats.played) * 100).toFixed(1) : 0,
      consistency: consistency.toFixed(2),
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      checkoutTrend,
      radarData,
      last5Matches: formGuide.slice(-5)
    }
  }, [userResults, user.id])

  const leagueStats = useMemo(() => {
    const divisionData = {}

    // Group users by division
    allUsers.forEach(u => {
      const div = u.division || 'Unassigned'
      if (!divisionData[div]) {
        divisionData[div] = {
          name: div,
          playerCount: 0,
          total180s: 0,
          totalPoints: 0,
          matchesPlayed: 0,
          avgPoints: 0,
          topCheckout: 0
        }
      }
      divisionData[div].playerCount++
    })

    // Process results to aggregate division stats
    approvedResults.forEach(r => {
      const p1 = allUsers.find(u => u.id === r.player1Id)
      const p2 = allUsers.find(u => u.id === r.player2Id)

      if (p1 && p1.division) {
        const div = divisionData[p1.division]
        if (div) {
          div.matchesPlayed++
          div.total180s += Number(r.player1Stats?.['180s'] || 0)
          div.totalPoints += getLeaguePoints(r.score1, r.score2)
          if (Number(r.player1Stats?.highestCheckout || 0) > div.topCheckout) {
            div.topCheckout = Number(r.player1Stats.highestCheckout)
          }
        }
      }

      if (p2 && p2.division) {
        const div = divisionData[p2.division]
        if (div) {
          // matchesPlayed is per division total, so we only count the match once per division
          // but points and 180s are per player.
          // If p1 and p2 are in same division, we don't want to double count the match but we want to count both players' 180s.
          // Let's refine: matchesPlayed should be total appearances in matches for that division.
          // Actually, let's just count stats.
          div.total180s += Number(r.player2Stats?.['180s'] || 0)
          div.totalPoints += getLeaguePoints(r.score2, r.score1)
          if (Number(r.player2Stats?.highestCheckout || 0) > div.topCheckout) {
            div.topCheckout = Number(r.player2Stats.highestCheckout)
          }
          if (p1?.division !== p2.division) {
            div.matchesPlayed++
          }
        }
      }
    })

    const finalData = Object.values(divisionData).map(div => ({
      ...div,
      avgPoints: div.matchesPlayed > 0 ? (div.totalPoints / div.matchesPlayed).toFixed(2) : 0,
      avg180s: div.matchesPlayed > 0 ? (div.total180s / div.matchesPlayed).toFixed(2) : 0
    })).filter(d => d.playerCount > 0)

    return finalData
  }, [allUsers, approvedResults])

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Analytics', path: '/analytics' }]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient">Performance Insights</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Deep dive into your Season 1 statistics</p>
      </div>

      <div className="division-tabs">
        {['personal', 'league'].map(s => (
          <button key={s} className={`division-tab ${activeSection === s ? 'active' : ''}`} onClick={() => setActiveSection(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} Data
          </button>
        ))}
      </div>

      {activeSection === 'personal' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
            {['week', 'month', 'all'].map(p => (
              <button key={p} className={`btn btn-sm ${timePeriod === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimePeriod(p)} style={{ borderRadius: '99px' }}>
                {p === 'all' ? 'All Time' : `This ${p}`}
              </button>
            ))}
          </div>

          <div className="home-stats-grid" style={{ marginBottom: '32px' }}>
            <div className="stat-card glass">
              <div className="stat-value">{personalStats.played}</div>
              <div className="stat-label">Matches</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{personalStats.winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{personalStats.total180s}</div>
              <div className="stat-label">Total 180s</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{personalStats.highestCheckout}</div>
              <div className="stat-label">Best CO</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' }}>
            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">Performance Radar</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={personalStats.radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    <Radar name="You" dataKey="value" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.4} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">Monthly Progress (Wins)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={personalStats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="wins" fill="var(--success)" radius={[4, 4, 0, 0]} name="Wins" />
                    <Bar dataKey="losses" fill="var(--error)" radius={[4, 4, 0, 0]} name="Losses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">Legs Comparison</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={personalStats.monthlyData}>
                    <defs>
                      <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="legsWon" stroke="var(--success)" fillOpacity={1} fill="url(#colorWon)" name="Legs Won" />
                    <Area type="monotone" dataKey="legsLost" stroke="var(--error)" fill="transparent" name="Legs Lost" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">Checkout Success Trend</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={personalStats.checkoutTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="doubleSuccess" stroke="var(--warning)" strokeWidth={3} dot={{ r: 4, fill: 'var(--warning)', strokeWidth: 2, stroke: 'var(--bg-primary)' }} name="Checkout %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSection === 'league' && (
        <div className="animate-fade-in">
          <div className="home-stats-grid" style={{ marginBottom: '32px' }}>
            <div className="stat-card glass">
              <div className="stat-value">{allUsers.length}</div>
              <div className="stat-label">Total Players</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{approvedResults.length}</div>
              <div className="stat-label">Matches Played</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{approvedResults.reduce((acc, r) => acc + Number(r.player1Stats?.['180s'] || 0) + Number(r.player2Stats?.['180s'] || 0), 0)}</div>
              <div className="stat-label">Total 180s</div>
            </div>
            <div className="stat-card glass">
              <div className="stat-value">{Math.max(...approvedResults.map(r => Math.max(Number(r.player1Stats?.highestCheckout || 0), Number(r.player2Stats?.highestCheckout || 0))), 0)}</div>
              <div className="stat-label">Season High CO</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' }}>
            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">Average Points per Match by Division</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leagueStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="avgPoints" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} name="Avg Points" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card glass" style={{ padding: '16px' }}>
              <h3 className="card-title">180s Distribution</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leagueStats}
                      dataKey="total180s"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name.substring(0, 3)} ${(percent * 100).toFixed(0)}%`}
                    >
                      {leagueStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card glass" style={{ gridColumn: '1 / -1', padding: '16px' }}>
              <h3 className="card-title">Division Performance Summary</h3>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -16px', padding: '0 16px' }}>
                <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', marginTop: '16px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Division</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Players</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Avg Pts</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Avg 180s</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Top CO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueStats.sort((a, b) => Number(b.avgPoints) - Number(a.avgPoints)).map((div, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{div.name}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem' }}>{div.playerCount}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center', fontSize: '0.85rem' }}>{div.avgPoints}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem' }}>{div.avg180s}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--success)', fontWeight: 700, textAlign: 'right', fontSize: '0.85rem' }}>{div.topCheckout || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Scroll table horizontally to see more →
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
