import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { useToast } from '../context/ToastContext'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line
} from 'recharts'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import CountUp from '../components/CountUp'

const DIVISION_COLORS = {
  'Elite': '#fbbf24',
  'Emerald': '#10b981',
  'Diamond': '#38bdf8',
  'Platinum': '#818cf8',
  'Unassigned': '#6B7280'
}

const DIVISIONS = ['Elite', 'Emerald', 'Diamond', 'Platinum']

function calcStdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sqDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length)
}

export default function Statistics() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, getAllUsers, getResults, getFixtures, adminData, forceFetchResults, triggerDataRefresh, getSeasons } = useAuth()
  const { showToast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState(adminData?.currentSeason || 'Season 4')
  const [hasInitializedSeason, setHasInitializedSeason] = useState(false)
  const [selectedDivFilter, setSelectedDivFilter] = useState('all')
  const [allLeagueResults, setAllLeagueResults] = useState(null)

  const allUsers = getAllUsers()
  const results = getResults()
  const fixtures = getFixtures()
  const seasons = getSeasons()

  useEffect(() => {
    if (adminData?.currentSeason && !hasInitializedSeason) {
      setSelectedSeason(adminData.currentSeason)
      setHasInitializedSeason(true)
    }
  }, [adminData?.currentSeason, hasInitializedSeason])

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      try {
        const { collection, getDocs } = await import('../firebase')
        const snap = await getDocs(collection.default ? collection.default : collection)
        if (cancelled) return
        const usable = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id, firestoreId: d.id }))
          .filter(r => {
            const status = String(r.status || '').toLowerCase()
            if (status === 'approved') return true
            return !status && r.score1 !== undefined && r.score2 !== undefined
          })
        setAllLeagueResults(usable)
      } catch (e) {
        console.error('Error fetching all-time results:', e)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  const approvedResults = useMemo(() =>
    results.filter(r =>
      String(r.status || '').toLowerCase() === 'approved' &&
      (!r.season || r.season === selectedSeason)
    ), [results, selectedSeason])

  const isPlayerView = Boolean(id)

  const viewedUser = useMemo(() => {
    if (!id) return null
    return allUsers.find(u => String(u.id) === String(id))
  }, [allUsers, id])

  const playerStatsMap = useMemo(() => derivePlayerStatsFromResults(allUsers, results, {
    fixtures, adminData, leagueOnly: true
  }), [allUsers, results, fixtures, adminData])

  const allTimeStatsMap = useMemo(() => derivePlayerStatsFromResults(allUsers, allLeagueResults || results, {
    fixtures, adminData, leagueOnly: true, timePeriod: 'all', includeReset: false, dedupe: false
  }), [allUsers, results, allLeagueResults, fixtures, adminData])

  const playerAllTime = useMemo(() => {
    if (!id || !allTimeStatsMap) return null
    return allTimeStatsMap[String(id)] || null
  }, [allTimeStatsMap, id])

  const personalStats = useMemo(() => {
    if (!id) return null
    const userResults = approvedResults.filter(r =>
      String(r.player1Id) === String(id) || String(r.player2Id) === String(id)
    )
    const stats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, legsWon: 0, legsLost: 0, total180s: 0, highestCheckout: 0 }
    const monthlyData = {}
    const checkoutTrend = []
    const legsPerMatchValues = []
    const formGuide = []

    const sorted = [...userResults].sort((a, b) => String(a.date || a.submittedAt || '').localeCompare(String(b.date || b.submittedAt || '')))

    sorted.forEach(r => {
      const isP1 = String(r.player1Id) === String(id)
      const myScore = isP1 ? Number(r.score1) : Number(r.score2)
      const theirScore = isP1 ? Number(r.score2) : Number(r.score1)
      const myStats = isP1 ? r.player1Stats : r.player2Stats
      const oppName = isP1 ? r.player2 : r.player1
      const matchDate = r.date || r.submittedAt || r.approvedAt
      const isForfeit = Boolean(r.forfeit)
      const effMy = isForfeit ? 0 : myScore
      const effTheir = isForfeit ? 0 : theirScore

      stats.played++
      stats.legsWon += effMy
      stats.legsLost += effTheir
      if (myScore > theirScore) stats.wins++
      else if (myScore < theirScore) stats.losses++
      else stats.draws++
      stats.points += isForfeit ? (myScore > theirScore ? 3 : 0) : getLeaguePoints(myScore, theirScore)
      stats.total180s += Number(myStats?.['180s'] || 0)
      if (Number(myStats?.highestCheckout || 0) > stats.highestCheckout) stats.highestCheckout = Number(myStats.highestCheckout)

      legsPerMatchValues.push(effMy)
      if (myStats?.doubleSuccess !== undefined) checkoutTrend.push({ date: matchDate, doubleSuccess: parseFloat(myStats.doubleSuccess) })
      const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D'
      formGuide.push({ date: matchDate, result, opponent: oppName, score: isForfeit ? '🏳️' : `${myScore}-${theirScore}` })

      const month = String(matchDate || '').substring(0, 7)
      if (month && month.length === 7) {
        if (!monthlyData[month]) monthlyData[month] = { month, wins: 0, losses: 0, draws: 0, legsWon: 0, legsLost: 0 }
        monthlyData[month].legsWon += myScore
        monthlyData[month].legsLost += theirScore
        if (myScore > theirScore) monthlyData[month].wins++
        else if (myScore < theirScore) monthlyData[month].losses++
        else monthlyData[month].draws++
      }
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
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      checkoutTrend,
      radarData,
      last5Matches: formGuide.slice(-5)
    }
  }, [approvedResults, id])

  const leagueStats = useMemo(() => {
    const divisionData = {}
    allUsers.forEach(u => {
      const div = u.division || 'Unassigned'
      if (!divisionData[div]) {
        divisionData[div] = { name: div, playerCount: 0, total180s: 0, matchesPlayed: 0, avgAvg: 0, avgPlayerCount: 0, topCheckout: 0 }
      }
      const ps = playerStatsMap[String(u.id)]
      if (ps && ps.played > 0) {
        divisionData[div].playerCount++
        if (ps.average > 0) {
          divisionData[div].avgAvg += ps.average
          divisionData[div].avgPlayerCount++
        }
      }
    })
    approvedResults.forEach(r => {
      const p1 = allUsers.find(u => u.id === r.player1Id)
      const p2 = allUsers.find(u => u.id === r.player2Id)
      if (p1 && p1.division && divisionData[p1.division]) {
        const div = divisionData[p1.division]
        div.matchesPlayed++
        div.total180s += Number(r.player1Stats?.['180s'] || 0)
        if (Number(r.player1Stats?.highestCheckout || 0) > div.topCheckout) div.topCheckout = Number(r.player1Stats.highestCheckout)
      }
      if (p2 && p2.division && divisionData[p2.division]) {
        const div = divisionData[p2.division]
        div.total180s += Number(r.player2Stats?.['180s'] || 0)
        if (Number(r.player2Stats?.highestCheckout || 0) > div.topCheckout) div.topCheckout = Number(r.player2Stats.highestCheckout)
        if (p1?.division !== p2.division) div.matchesPlayed++
      }
    })
    return Object.values(divisionData)
      .filter(div => div.name !== 'Unassigned' && div.playerCount > 0)
      .map(div => ({
        ...div,
        avgAvg: div.avgPlayerCount > 0 ? (div.avgAvg / div.avgPlayerCount).toFixed(1) : '0',
        avg180s: div.matchesPlayed > 0 ? (div.total180s / div.matchesPlayed).toFixed(2) : 0
      }))
  }, [allUsers, approvedResults, playerStatsMap])

  const division180sByDivision = useMemo(() => {
    const divPlayers = {}
    allUsers.forEach(u => {
      const div = u.division
      if (div && DIVISIONS.includes(div)) {
        if (!divPlayers[div]) divPlayers[div] = []
        divPlayers[div].push(String(u.id))
      }
    })
    return DIVISIONS.map(div => {
      const pids = new Set(divPlayers[div] || [])
      let total180s = 0
      let matchesPlayed = 0
      ;(allLeagueResults || results).forEach(r => {
        const p1 = String(r.player1Id)
        const p2 = String(r.player2Id)
        const p1InDiv = pids.has(p1)
        const p2InDiv = pids.has(p2)
        if (p1InDiv || p2InDiv) matchesPlayed++
        if (p1InDiv) total180s += Number(r.player1Stats?.['180s'] || 0)
        if (p2InDiv) total180s += Number(r.player2Stats?.['180s'] || 0)
      })
      return { division: div, total180s, matchesPlayed, avg180s: matchesPlayed > 0 ? (total180s / matchesPlayed).toFixed(2) : '0' }
    })
  }, [allUsers, allLeagueResults, results])

  const filteredDiv180s = useMemo(() => {
    if (selectedDivFilter === 'all') return division180sByDivision
    return division180sByDivision.filter(d => d.division === selectedDivFilter)
  }, [division180sByDivision, selectedDivFilter])

  if (isPlayerView && !viewedUser) {
    return (
      <div className="page animate-fade-in">
        <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Statistics', path: '/statistics' }, { label: 'Player Not Found' }]} />
        <div className="card glass" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Player not found.</p>
          <button className="btn btn-primary" onClick={() => navigate('/statistics')}>Back to Statistics</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[
        { label: 'Home', path: '/home' },
        { label: 'Statistics', path: '/statistics' },
        ...(isPlayerView ? [{ label: viewedUser?.username || 'Player' }] : [])
      ]} />

      <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>
            {isPlayerView ? viewedUser?.username : 'Statistics'}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isPlayerView ? `${viewedUser?.division || 'Unassigned'} Division` : 'League-wide performance insights'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="glass"
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {seasons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            {!seasons.find(s => s.name === 'Season 4') && <option value="Season 4">Season 4</option>}
          </select>
          <button
            className="btn btn-secondary glass"
            disabled={isSyncing}
            onClick={async () => {
              setIsSyncing(true)
              showToast?.('Syncing data...', 'info')
              try {
                if (forceFetchResults) await forceFetchResults()
                else triggerDataRefresh('all')
                showToast?.('Data synchronized!', 'success')
              } catch { showToast?.('Sync failed.', 'error') }
              setIsSyncing(false)
            }}
            style={{ padding: '8px 16px', borderRadius: '99px', fontSize: '0.8rem', minWidth: '80px' }}
          >
            {isSyncing ? '...' : 'Sync'}
          </button>
        </div>
      </div>

      {isPlayerView ? (
        <PlayerView
          user={viewedUser}
          personalStats={personalStats}
          allTime={playerAllTime}
          onBack={() => navigate('/statistics')}
        />
      ) : (
        <DivisionOverview
          leagueStats={leagueStats}
          filteredDiv180s={filteredDiv180s}
          selectedDivFilter={selectedDivFilter}
          setSelectedDivFilter={setSelectedDivFilter}
          approvedResults={approvedResults}
          allUsers={allUsers}
          navigate={navigate}
        />
      )}
    </div>
  )
}

function PlayerView({ user, personalStats, allTime, onBack }) {
  if (!personalStats) return (
    <div className="card glass" style={{ padding: '60px 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>No stats available for this player.</p>
    </div>
  )

  const formColor = (r) => r === 'W' ? 'var(--success)' : r === 'L' ? 'var(--error)' : 'var(--text-muted)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-primary)', overflow: 'hidden', flexShrink: 0 }}>
          {user?.profilePicture ? <img src={user.profilePicture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 800, fontSize: '1.5rem' }}>{(user?.username || '?').charAt(0)}</span>}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'white' }}>{user?.username}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{user?.division || 'Unassigned'}</div>
        </div>
      </div>

      <div className="home-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: '#10b981' }}>
            <CountUp end={personalStats.played} />
          </div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            <CountUp end={personalStats.winRate} decimals={1} />%
          </div>
          <div className="stat-label">Win Rate</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: '#fbbf24' }}>
            <CountUp end={allTime?.['180s'] || personalStats.total180s} />
          </div>
          <div className="stat-label">All-Time 180s</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            <CountUp end={allTime?.highestCheckout || personalStats.highestCheckout} />
          </div>
          <div className="stat-label">Highest Checkout</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            <CountUp end={allTime?.legsWon || personalStats.legsWon} />
          </div>
          <div className="stat-label">All-Time Legs Won</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--error)' }}>
            <CountUp end={allTime?.legsLost || personalStats.legsLost} />
          </div>
          <div className="stat-label">All-Time Legs Lost</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            <CountUp end={allTime?.wins || personalStats.wins} />
          </div>
          <div className="stat-label">All-Time Wins</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value" style={{ color: 'var(--error)' }}>
            <CountUp end={allTime?.losses || personalStats.losses} />
          </div>
          <div className="stat-label">All-Time Losses</div>
        </div>
      </div>

      {personalStats.last5Matches.length > 0 && (
        <div className="card glass" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 className="card-title" style={{ margin: '0 0 16px 0' }}>Form Guide</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {personalStats.last5Matches.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ display: 'inline-block', width: '28px', height: '28px', borderRadius: '6px', background: formColor(m.result), color: 'white', textAlign: 'center', lineHeight: '28px', fontWeight: 900, fontSize: '0.8rem' }}>{m.result}</span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{m.opponent}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' }}>
        <div className="card glass" style={{ padding: '16px' }}>
          <h3 className="card-title">Performance Radar</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={personalStats.radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Player" dataKey="value" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card glass" style={{ padding: '16px' }}>
          <h3 className="card-title">Monthly Progress</h3>
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

        {personalStats.checkoutTrend.length > 0 && (
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
        )}
      </div>
    </div>
  )
}

function DivisionOverview({ leagueStats, filteredDiv180s, selectedDivFilter, setSelectedDivFilter, approvedResults, allUsers, navigate }) {
  const totalPlayers = useMemo(() => {
    const playerIds = new Set()
    approvedResults.forEach(r => {
      if (r.player1Id) playerIds.add(String(r.player1Id))
      if (r.player2Id) playerIds.add(String(r.player2Id))
    })
    return playerIds.size
  }, [approvedResults])
  const totalMatches = approvedResults.length
  const total180s = approvedResults.reduce((acc, r) => acc + Number(r.player1Stats?.['180s'] || 0) + Number(r.player2Stats?.['180s'] || 0), 0)
  const seasonHighCO = Math.max(...approvedResults.map(r => Math.max(Number(r.player1Stats?.highestCheckout || 0), Number(r.player2Stats?.highestCheckout || 0))), 0)

  return (
    <div className="animate-fade-in">
      <div className="home-stats-grid" style={{ marginBottom: '32px' }}>
        <div className="stat-card glass glass-hover">
          <div className="stat-value"><CountUp end={totalPlayers} /></div>
          <div className="stat-label">Total Players</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value"><CountUp end={totalMatches} /></div>
          <div className="stat-label">Matches Played</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value"><CountUp end={total180s} /></div>
          <div className="stat-label">Total 180s</div>
        </div>
        <div className="stat-card glass glass-hover">
          <div className="stat-value"><CountUp end={seasonHighCO} /></div>
          <div className="stat-label">Season High CO</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card glass" style={{ padding: '16px' }}>
          <h3 className="card-title">3-Dart Average by Division</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leagueStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="avgAvg" radius={[4, 4, 0, 0]} name="3-Dart Avg">
                  {leagueStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DIVISION_COLORS[entry.name] || 'var(--accent-cyan)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card glass" style={{ padding: '16px' }}>
          <h3 className="card-title">180s Distribution</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leagueStats} dataKey="total180s" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name.substring(0, 3)} ${(percent * 100).toFixed(0)}%`}>
                  {leagueStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DIVISION_COLORS[entry.name] || '#7C5CFC'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Division Performance Summary</h3>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Division</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Players</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>3-Dart Avg</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Avg 180s</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Top CO</th>
              </tr>
            </thead>
            <tbody>
              {leagueStats.sort((a, b) => Number(b.avgAvg) - Number(a.avgAvg)).map((div, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: DIVISION_COLORS[div.name] || 'var(--accent-cyan)', fontSize: '0.85rem' }}>{div.name}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem' }}>{div.playerCount}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center', fontSize: '0.85rem' }}>{div.avgAvg}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem' }}>{div.avg180s}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--success)', fontWeight: 700, textAlign: 'right', fontSize: '0.85rem' }}>{div.topCheckout || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card glass" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>180s by Division</h3>
        </div>
        <div className="division-tabs" style={{ marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[{ key: 'all', label: 'All' }, ...DIVISIONS.map(d => ({ key: d, label: d }))].map(tab => (
            <button key={tab.key} className={`division-tab ${selectedDivFilter === tab.key ? 'active' : ''}`} onClick={() => setSelectedDivFilter(tab.key)} style={{ fontSize: '0.75rem', padding: '8px 14px' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredDiv180s}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="division" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="total180s" radius={[4, 4, 0, 0]} name="Total 180s">
                {filteredDiv180s.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DIVISION_COLORS[entry.division] || 'var(--accent-cyan)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
