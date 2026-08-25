import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { db, doc, setDoc } from '../firebase'

const SUPER_LEAGUE_DIVISIONS = [
  { id: 'Masters Division', label: 'Masters Division', color: '#fbbf24', desc: 'The elite tier — first to 6, best of 11' },
  { id: 'Pro Division', label: 'Pro Division', color: '#38bdf8', desc: 'Rising contenders — fight for promotion' }
]

export default function SuperLeague() {
  const [activeTab, setActiveTab] = useState('Masters Division')
  const navigate = useNavigate()
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, adminData, forceFetchResults, fetchResultsBySeason, fetchUsersByDivision } = useAuth()
  const { showToast } = useToast()
  const [loadingData, setLoadingData] = useState(false)
  const [editingManual, setEditingManual] = useState(null)
  const [manualForm, setManualForm] = useState({ played: 0, wins: 0, draws: 0, losses: 0, points: 0, legsWon: 0, legsLost: 0 })
  const selectedSeason = adminData?.championsLeagueSeason || adminData?.currentSeason || 'Season 4'
  const isAdmin = user?.isAdmin === true
  const currentDiv = SUPER_LEAGUE_DIVISIONS.find(d => d.id === activeTab)

  useEffect(() => {
    const syncData = async () => {
      setLoadingData(true)
      await Promise.all([fetchResultsBySeason(selectedSeason), fetchUsersByDivision(activeTab)])
      setLoadingData(false)
    }
    const timeout = setTimeout(syncData, 100)
    return () => clearTimeout(timeout)
  }, [selectedSeason, activeTab])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures, adminData, superLeagueOnly: true, currentSeason: selectedSeason, includePlayoffs: false
    })
  }, [allUsers, results, fixtures, adminData, selectedSeason])

  const playersInDivision = useMemo(() => {
    return allUsers
      .filter(u => u.superLeagueDivision === activeTab)
      .map(p => ({
        ...p,
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0, average: p.threeDartAverage || 0 }
      }))
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        const aDiff = a.stats.legsWon - a.stats.legsLost
        const bDiff = b.stats.legsWon - b.stats.legsLost
        if (bDiff !== aDiff) return bDiff - aDiff
        if (b.stats.legsWon !== a.stats.legsWon) return b.stats.legsWon - a.stats.legsWon
        return (b.stats.average || 0) - (a.stats.average || 0)
      })
  }, [activeTab, allUsers, playerStats])

  const divisionStats = useMemo(() => {
    const total = playersInDivision.length
    const totalPlayed = playersInDivision.reduce((s, p) => s + p.stats.played, 0)
    const totalLegs = playersInDivision.reduce((s, p) => s + p.stats.legsWon + p.stats.legsLost, 0)
    const avgAvg = playersInDivision.filter(p => p.stats.average > 0).reduce((s, p, _, a) => s + p.stats.average / a.length, 0)
    return { total, totalPlayed: Math.floor(totalPlayed / 2), totalLegs, avgAvg }
  }, [playersInDivision])

  const handleRefresh = async () => {
    setLoadingData(true)
    showToast('Syncing Super League data...', 'info')
    try {
      localStorage.removeItem('eliteArrowsResults')
      await forceFetchResults()
      triggerDataRefresh('all')
      showToast('Standings synced!', 'success')
    } catch (e) {
      showToast('Sync failed', 'warning')
    }
    setLoadingData(false)
  }

  const saveAdminAdjustments = async () => {
    if (!editingManual) return
    try {
      const defaultStats = { played: 0, wins: 0, draws: 0, losses: 0, points: 0, legsWon: 0, legsLost: 0 }
      const hasChanges = Object.keys(defaultStats).some(k => {
        const v = Number(manualForm[k]) || 0
        const existing = (editingManual.manualSuperStats || {})[k]
        return v !== (existing ?? editingManual.stats[k])
      })
      if (!hasChanges) {
        await setDoc(doc(db, 'users', editingManual.id), { manualSuperStats: null }, { merge: true })
      } else {
        const payload = {}
        Object.keys(defaultStats).forEach(k => { payload[k] = Number(manualForm[k]) || 0 })
        await setDoc(doc(db, 'users', editingManual.id), { manualSuperStats: payload }, { merge: true })
      }
      showToast('Adjustments saved!', 'success')
      setEditingManual(null)
      triggerDataRefresh('all')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Super League' }]} />

      {/* Hero Header */}
      <div className="card glass" style={{ padding: '32px', marginBottom: '24px', background: `linear-gradient(135deg, ${currentDiv.color}15, transparent)`, borderLeft: `4px solid ${currentDiv.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '2.4rem', marginBottom: '4px', background: `linear-gradient(135deg, ${currentDiv.color}, white)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Super League
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>{currentDiv.desc}</p>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: currentDiv.color }}>{divisionStats.total}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Players</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{divisionStats.totalPlayed}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Matches</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--success)' }}>{divisionStats.totalLegs}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Legs Thrown</div>
              </div>
              {divisionStats.avgAvg > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{divisionStats.avgAvg.toFixed(1)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Average</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Season:</span>
            <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{selectedSeason}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={loadingData} style={{ marginLeft: '8px' }}>
              {loadingData ? 'Syncing...' : '🔄 Sync'}
            </button>
          </div>
        </div>
      </div>

      {/* Division Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {SUPER_LEAGUE_DIVISIONS.map(div => (
          <button
            key={div.id}
            onClick={() => setActiveTab(div.id)}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: activeTab === div.id ? `2px solid ${div.color}` : '2px solid rgba(255,255,255,0.08)',
              background: activeTab === div.id ? `${div.color}10` : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem', color: activeTab === div.id ? div.color : 'var(--text-muted)', marginBottom: '4px' }}>
              {div.label}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {allUsers.filter(u => u.superLeagueDivision === div.id).length} players
            </div>
          </button>
        ))}
      </div>

      {/* Standings */}
      {loadingData ? (
        <div className="card glass" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }} />
          <span style={{ color: 'var(--text-muted)' }}>Loading standings...</span>
        </div>
      ) : playersInDivision.length === 0 ? (
        <div className="card glass" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏟️</div>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>No Players Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Players will appear here once assigned by an admin.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playersInDivision.map((player, index) => {
            const legDiff = player.stats.legsWon - player.stats.legsLost
            const isMe = player.id === user?.id
            const winRate = player.stats.played > 0 ? ((player.stats.wins / player.stats.played) * 100).toFixed(0) : '0'
            const isTop3 = index < 3
            const rankColors = ['#fbbf24', '#c0c0c0', '#cd7f32']

            return (
              <div
                key={player.id}
                className="glass"
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: isMe ? 'rgba(56, 189, 248, 0.08)' : isTop3 ? `${rankColors[index]}08` : 'transparent',
                  border: isMe ? '1px solid rgba(56, 189, 248, 0.2)' : isTop3 ? `1px solid ${rankColors[index]}20` : '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.2s'
                }}
              >
                {/* Rank */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  background: isTop3 ? `${rankColors[index]}20` : 'rgba(255,255,255,0.05)',
                  color: isTop3 ? rankColors[index] : 'var(--text-muted)',
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>

                {/* Player Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/profile/${player.id}`} style={{ textDecoration: 'none', color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>
                    {player.username}
                  </Link>
                  {isAdmin && (
                    <span
                      style={{ cursor: 'pointer', marginLeft: '6px', fontSize: '0.7rem', opacity: 0.5 }}
                      onClick={() => {
                        const ms = player.manualSuperStats || {}
                        setManualForm({
                          played: ms.played ?? player.stats.played,
                          wins: ms.wins ?? player.stats.wins,
                          draws: ms.draws ?? player.stats.draws,
                          losses: ms.losses ?? player.stats.losses,
                          points: ms.points ?? player.stats.points,
                          legsWon: ms.legsWon ?? player.stats.legsWon,
                          legsLost: ms.legsLost ?? player.stats.legsLost
                        })
                        setEditingManual(player)
                      }}
                    >
                      {player.manualSuperStats ? '✏️*' : '✏️'}
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center', minWidth: '32px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>P</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{player.stats.played}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '32px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>W</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981' }}>{player.stats.wins}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '32px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ef4444' }}>{player.stats.losses}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '40px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>+/-</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                      {legDiff > 0 ? `+${legDiff}` : legDiff}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '36px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>WR</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{winRate}%</div>
                  </div>
                  {player.stats.average > 0 && (
                    <div style={{ textAlign: 'center', minWidth: '40px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AVG</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{player.stats.average.toFixed(1)}</div>
                    </div>
                  )}
                  <div style={{
                    textAlign: 'center',
                    minWidth: '44px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: `${currentDiv.color}15`,
                  }}>
                    <div style={{ fontSize: '0.6rem', color: currentDiv.color, textTransform: 'uppercase' }}>Pts</div>
                    <div style={{ fontWeight: 900, fontSize: '1rem', color: currentDiv.color }}>{player.stats.points}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admin Adjustment Modal */}
      {isAdmin && editingManual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingManual(null)}>
          <div className="card glass" style={{ padding: '28px', maxWidth: '420px', width: '90%', border: `1px solid ${currentDiv.color}` }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '4px' }}>Adjust: {editingManual.username}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Super League table overrides</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['played', 'wins', 'losses', 'points', 'legsWon', 'legsLost'].map(field => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input type="number" value={manualForm[field]} onChange={e => setManualForm({...manualForm, [field]: e.target.value})} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAdminAdjustments}>Save</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => {
                if (confirm('Clear all manual overrides?')) {
                  await setDoc(doc(db, 'users', editingManual.id), { manualSuperStats: null }, { merge: true })
                  showToast('Cleared!', 'info')
                  setEditingManual(null)
                  triggerDataRefresh('all')
                }
              }}>Clear</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingManual(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
