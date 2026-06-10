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
  const [activeDivision, setActiveDivision] = useState('Premier')
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger, adminData, fetchResultsBySeason, forceFetchResults, getSeasons, fetchUsersByDivision } = useAuth()
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadingData, setLoadingData] = useState(false)
  const [editingManual, setEditingManual] = useState(null)
  const [manualForm, setManualForm] = useState({ played: 0, wins: 0, draws: 0, losses: 0, points: 0, legsWon: 0, legsLost: 0 })
  const [selectedSeason, setSelectedSeason] = useState(adminData?.currentSeason || 'Season 1')

  const isAdmin = user?.isAdmin === true

  useEffect(() => {
    const syncData = async () => {
      setLoadingData(true)
      await Promise.all([
        fetchResultsBySeason(selectedSeason),
        fetchUsersByDivision(activeDivision)
      ])
      setLoadingData(false)
    }
    syncData()
  }, [selectedSeason, activeDivision, fetchResultsBySeason, fetchUsersByDivision])

  const seasonsList = getSeasons()

  // All data is derived from AuthContext
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures,
      adminData,
      superLeagueOnly: true,
      currentSeason: selectedSeason,
      includePlayoffs: false
    })
  }, [allUsers, results, fixtures, adminData, selectedSeason, refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const playersInDivision = useMemo(() => {
    const source = allUsers.filter(u => u.superLeagueDivision === activeDivision)

    return source
      .map(p => ({
        ...p,
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0, average: p.threeDartAverage || 0 }
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
    showToast('Refreshing Super League data...', 'info')
    const ok = await forceFetchResults()
    triggerDataRefresh('all')
    setRefreshKey(prev => prev + 1)
    showToast(ok ? 'Standings synced!' : 'Sync failed — using cached data', ok ? 'success' : 'warning')
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
      showToast('Super League adjustments saved!', 'success')
      setEditingManual(null)
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    }
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Super League' }]} />

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.2rem', marginBottom: '4px' }}>Elite Super League</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Season:</span>
              <select
                className="glass"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {seasonsList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh} style={{ padding: '8px 12px' }}>
            🔄 Sync Data
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{ display: 'flex', overflowX: 'auto', gap: '8px', marginBottom: '20px', paddingBottom: '8px' }}>
        {SUPER_DIVISIONS.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
            style={{
              whiteSpace: 'nowrap',
              padding: '10px 16px',
              fontSize: '0.85rem',
              borderBottom: activeDivision === div ? `3px solid ${DIVISION_COLORS[div]}` : '3px solid transparent'
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', textTransform: 'uppercase' }}>
                <th style={{ width: '28px', padding: '12px 2px', textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 4px' }}>Player</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>P</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>W</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>L</th>
                <th style={{ width: '30px', padding: '12px 2px', textAlign: 'center' }}>+/-</th>
                <th style={{ width: '35px', padding: '12px 2px', textAlign: 'center' , color: 'var(--accent-cyan)' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px', width: '30px', height: '30px' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}>Syncing standings...</span>
                  </td>
                </tr>
              ) : playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No players found</td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isMe = player.id === user?.id

                  return (
                    <tr key={player.id} style={{
                      background: isMe ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.8rem'
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontWeight: 600, color: 'white' }}>
                          {player.username}
                          {player.stats.average > 0 && (
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginLeft: '6px' }}>
                              ({player.stats.average.toFixed(2)})
                            </span>
                          )}
                        </span>
                        {isAdmin && (
                          <span
                            style={{ cursor: 'pointer', marginLeft: '6px', fontSize: '0.7rem', opacity: 0.6 }}
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
                      </td>
                      <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                      <td style={{ textAlign: 'center' }}>{player.stats.wins}</td>
                      <td style={{ textAlign: 'center' }}>{player.stats.losses}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '900', color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
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

      {/* Admin Adjustment Modal */}
      {isAdmin && editingManual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingManual(null)}>
          <div className="card glass" style={{ padding: '28px', maxWidth: '420px', width: '90%', border: '1px solid var(--accent-cyan)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '4px' }}>Admin Adjustments: {editingManual.username}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Super League table overrides</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['played', 'wins', 'losses', 'points', 'legsWon', 'legsLost'].map(field => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    type="number"
                    value={manualForm[field]}
                    onChange={e => setManualForm({...manualForm, [field]: e.target.value})}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAdminAdjustments}>Save Changes</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingManual(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
