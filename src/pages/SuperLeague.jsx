import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { db, doc, setDoc } from '../firebase'

const SUPER_DIVISIONS = ['Premier', 'Pro', 'Amateur']
const DIVISION_COLORS = {
  'Premier': '#fbbf24',
  'Pro': '#38bdf8',
  'Amateur': '#cbd5e1'
}

export default function SuperLeague() {
  const [activeTab, setActiveTab] = useState('table')
  const [activeDivision, setActiveDivision] = useState('Premier')
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger, adminData, fetchResultsBySeason, forceFetchResults } = useAuth()
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadingData, setLoadingData] = useState(false)
  const [editingManual, setEditingManual] = useState(null)
  const [manualForm, setManualForm] = useState({ played: 0, wins: 0, losses: 0, points: 0, legsWon: 0, legsLost: 0 })

  const isAdmin = user?.isAdmin === true || user?.isTournamentAdmin === true || user?.isCupAdmin === true

  useEffect(() => {
    const syncData = async () => {
      setLoadingData(true)
      try {
        if (forceFetchResults) await forceFetchResults()
        const currentSeason = adminData?.currentSeason || 'Season 1'
        await fetchResultsBySeason(currentSeason)
      } catch (e) {
        console.error("Sync error", e)
      } finally {
        setLoadingData(false)
      }
    }
    syncData()
  }, [adminData?.currentSeason, fetchResultsBySeason, forceFetchResults])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  // All data is derived from AuthContext
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures,
      adminData,
      superLeagueOnly: true,
      currentSeason: null // Show all Super League games regardless of season label
    })
  }, [allUsers, results, fixtures, adminData, refreshKey])

  const playersInDivision = useMemo(() => {
    const source = allUsers.filter(u => u.superLeagueDivision === activeDivision)

    return source
      .map(p => ({
        ...p,
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0, average: 0 }
      }))
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        const aLegDiff = a.stats.legsWon - a.stats.legsLost
        const bLegDiff = b.stats.legsWon - b.stats.legsLost
        if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff
        if (b.stats.legsWon !== a.stats.legsWon) return b.stats.legsWon - a.stats.legsWon
        return (b.stats.average || 0) - (a.stats.average || 0)
      })
  }, [activeDivision, allUsers, playerStats])

  const handleRefresh = async () => {
    setLoadingData(true)
    showToast('Performing deep sync with server...', 'info')

    try {
      const ok = await forceFetchResults()
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
      showToast(ok ? 'Super League standings updated!' : 'Sync completed with cache', 'success')
    } catch (e) {
      showToast('Sync failed: ' + e.message, 'error')
    } finally {
      setLoadingData(false)
    }
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Super League' }]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Elite Super League</h1>
            <p style={{ color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem' }}>Premier Darts Competition</p>
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh} style={{ padding: '8px 12px' }}>
            🔄 Sync Data
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{ marginBottom: '24px' }}>
        <button className={`division-tab ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>Standing Table</button>
        <button className={`division-tab ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>Rules & Info</button>
      </div>

      {activeTab === 'table' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
            {SUPER_DIVISIONS.map(div => (
              <button
                key={div}
                className={`btn btn-sm ${activeDivision === div ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveDivision(div)}
                style={{ borderRadius: '99px', minWidth: '100px', borderColor: activeDivision === div ? DIVISION_COLORS[div] : 'var(--border)' }}
              >
                {div}
              </button>
            ))}
          </div>

          <div className="card glass" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '15px 10px' }}>Player</th>
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>P</th>
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>W</th>
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>L</th>
                    <th style={{ width: '50px', padding: '15px 5px', textAlign: 'center' }}>+/-</th>
                    <th style={{ width: '60px', padding: '15px 5px', textAlign: 'center' , color: 'var(--accent-cyan)' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '60px' }}>
                        <div className="spinner" style={{ margin: '0 auto 10px', width: '30px', height: '30px' }}></div>
                        <span style={{ color: 'var(--text-muted)' }}>Syncing Super League standings...</span>
                      </td>
                    </tr>
                  ) : playersInDivision.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No players assigned to {activeDivision} yet.</td>
                    </tr>
                  ) : (
                    playersInDivision.map((player, index) => {
                      const legDiff = player.stats.legsWon - player.stats.legsLost
                      const isMe = player.id === user?.id

                      return (
                        <tr key={player.id} style={{
                          background: isMe ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          <td style={{ textAlign: 'center', fontWeight: '900', color: index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '15px 10px' }}>
                            <span style={{ fontWeight: 700, color: 'white' }}>
                              {player.username}
                              {player.stats.average > 0 && (
                                <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginLeft: '6px' }}>
                                  ({player.stats.average.toFixed(2)})
                                </span>
                              )}
                            </span>
                            {isAdmin && (
                              <span
                                style={{ cursor: 'pointer', marginLeft: '10px', fontSize: '0.75rem', opacity: 0.6 }}
                                onClick={() => {
                                  const ms = player.manualSuperStats || {}
                                  setManualForm({
                                    played: ms.played ?? player.stats.played,
                                    wins: ms.wins ?? player.stats.wins,
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
                          </td>
                          <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{player.stats.wins}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{player.stats.losses}</td>
                          <td style={{ textAlign: 'center', fontWeight: '800', color: legDiff > 0 ? 'var(--success)' : legDiff < 0 ? 'var(--error)' : 'white' }}>
                            {legDiff > 0 ? `+${legDiff}` : legDiff}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '900', color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>
                            {player.stats.points}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'rules' && (
        <div className="card glass animate-slide-up">
          <h2 className="text-gradient" style={{ marginBottom: '24px' }}>Super League Regulations</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Match Format</h3>
              <p style={{ color: 'var(--text-muted)' }}>All Super League matches are contested as <strong>First to 6 Legs</strong>. A player must reach 6 legs to win the match. No draws are permitted.</p>
            </section>

            <section>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Camera Requirements</h3>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', padding: '15px', borderRadius: '12px', color: 'var(--warning)', fontWeight: 600 }}>
                ⚠️ MANDATORY: All Super League matches MUST use a camera. No exceptions.
              </div>
            </section>

            <section>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Point System</h3>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', listStyleType: 'disc' }}>
                <li><strong>1 Point</strong> per leg won.</li>
                <li><strong>No additional points</strong> for a Match Win (Legs Only).</li>
              </ul>
            </section>

            <section>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>General Rules</h3>
              <p style={{ color: 'var(--text-muted)' }}>Super League follows the standard Elite Arrows competitive ruleset regarding etiquette, reporting, and disputes. As an elite tier, higher standards of punctuality and sportsmanship are expected.</p>
            </section>
          </div>
        </div>
      )}

      {/* Admin Adjustment Modal */}
      {isAdmin && editingManual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setEditingManual(null)}>
          <div className="card glass" style={{ padding: '28px', maxWidth: '420px', width: '90%', border: '1px solid var(--accent-cyan)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '4px' }}>Super League Adjustments: {editingManual.username}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Override statistics for the Super League table only.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['played', 'wins', 'losses', 'points', 'legsWon', 'legsLost'].map(field => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    type="number"
                    value={manualForm[field]}
                    className="glass"
                    onChange={e => setManualForm({...manualForm, [field]: parseInt(e.target.value) || 0})}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={async () => {
                  try {
                    const defaultStats = { played: 0, wins: 0, losses: 0, points: 0, legsWon: 0, legsLost: 0 }
                    const hasChanges = Object.keys(defaultStats).some(k => {
                      const v = Number(manualForm[k]) || 0
                      const existing = (editingManual.manualSuperStats || {})[k]
                      return v !== (existing ?? editingManual.stats[k])
                    })

                    if (!hasChanges) {
                      await setDoc(doc(db, 'users', editingManual.id), { manualSuperStats: null }, { merge: true })
                    } else {
                      await setDoc(doc(db, 'users', editingManual.id), { manualSuperStats: manualForm }, { merge: true })
                    }
                    showToast('Super League adjustments saved!', 'success')
                    setEditingManual(null)
                    triggerDataRefresh('all')
                  } catch (e) {
                    showToast('Error: ' + e.message, 'error')
                  }
                }}
              >
                Save Changes
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingManual(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
