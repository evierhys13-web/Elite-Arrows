import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'

const DIVISION_COLORS = {
  'Elite': '#fbbf24',
  'Diamond': '#38bdf8',
  'Platinum': '#818cf8',
  'Gold': '#fcd34d',
  'Silver': '#cbd5e1',
  'Bronze': '#d97706',
  'Development': '#4ade80',
  'Overall': '#818cf8'
}

export default function Table() {
  const [activeDivision, setActiveDivision] = useState('Overall')
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger, adminData, getSeasons, forceFetchResults } = useAuth()
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSeason, setSelectedSeason] = useState(adminData?.currentSeason || 'Season 1')
  const [hasInitializedSeason, setHasInitializedSeason] = useState(false)

  const divisions = ['Overall', 'Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']
  const seasons = getSeasons()

  useEffect(() => {
    // Ensure selectedSeason is always valid and prioritize Season 1 if currently in May 2026
    const now = new Date()
    const isMay2026 = now.getFullYear() === 2026 && now.getMonth() === 4 // May is 4

    if (adminData?.currentSeason && !hasInitializedSeason) {
      setSelectedSeason(adminData.currentSeason)
      setHasInitializedSeason(true)
    } else if (isMay2026 && !hasInitializedSeason) {
      setSelectedSeason('Season 1')
      setHasInitializedSeason(true)
    }
  }, [adminData?.currentSeason, hasInitializedSeason])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures,
      adminData,
      leagueOnly: true,
      currentSeason: selectedSeason,
      includePlayoffs: false
    })
  }, [allUsers, results, fixtures, adminData, refreshKey, selectedSeason])

  const playersInDivision = useMemo(() => {
    const source = activeDivision === 'Overall'
      ? allUsers
      : allUsers.filter(u => u.division === activeDivision)

    return source
      .map(p => ({
        ...p,
        displayDivision: p.division || 'Unassigned',
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0, average: p.threeDartAverage || 0 }
      }))
      .filter(p => {
        // Always show players in specific division views
        if (activeDivision !== 'Overall') return true;

        // In Overall view, show anyone who has played OR has been assigned a valid league division
        const hasValidDivision = p.division && p.division !== 'Unassigned' && p.division !== 'Admin';
        return p.stats.played > 0 || hasValidDivision;
      })
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
    triggerDataRefresh('all')
    setRefreshKey(prev => prev + 1)
    showToast('Refreshing table data...', 'info')
    const ok = await forceFetchResults()
    setRefreshKey(prev => prev + 1)
    showToast(ok ? 'Table data synced!' : 'Sync failed — using cached data', ok ? 'success' : 'warning')
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Table', path: '/table' }]} />

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.2rem', marginBottom: '4px' }}>League Standings</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Season:</span>
               <select
                 className="glass"
                 value={selectedSeason}
                 onChange={e => setSelectedSeason(e.target.value)}
                 style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}
               >
                 {seasons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                 {!seasons.find(s => s.name === 'Season 1') && <option value="Season 1">Season 1</option>}
               </select>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh} style={{ padding: '8px 12px' }}>
            🔄 Sync Data
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        marginBottom: '20px',
        paddingBottom: '8px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
            style={{
              whiteSpace: 'nowrap',
              padding: '10px 16px',
              fontSize: '0.85rem',
              borderBottom: activeDivision === div ? `3px solid ${DIVISION_COLORS[div]}` : '3px solid transparent',
              color: activeDivision === div ? 'white' : 'rgba(255,255,255,0.6)',
              background: activeDivision === div ? 'rgba(255,255,255,0.1)' : 'transparent'
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', textTransform: 'uppercase' }}>
                <th style={{ width: '28px', padding: '12px 2px', textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 4px' }}>Player</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>P</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>W</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>D</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>L</th>
                <th style={{ width: '30px', padding: '12px 2px', textAlign: 'center' }}>+/-</th>
                <th style={{ width: '35px', padding: '12px 2px', textAlign: 'center', color: 'var(--accent-cyan)' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data</td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isPromotion = index < 2 && activeDivision !== 'Overall'
                  const isRelegation = index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== 'Overall'
                  const isMe = player.id === user?.id

                  return (
                    <tr key={player.id} style={{
                      background: isMe ? 'rgba(217, 70, 239, 0.15)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.8rem'
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '10px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/profile/${player.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: isMe ? '800' : '600', color: isMe ? 'white' : 'rgba(255,255,255,0.9)' }}>
                            {player.username}
                            {player.stats.average > 0 && (
                              <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginLeft: '6px' }}>
                                ({player.stats.average.toFixed(2)})
                              </span>
                            )}
                          </span>
                          {(isPromotion || isRelegation) && (
                            <span style={{ fontSize: '0.5rem', fontWeight: '900', color: isPromotion ? '#10b981' : '#ef4444', letterSpacing: '0.05em' }}>
                              {isPromotion ? 'PROMOTION' : 'RELEGATION'}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 2px' }}>{player.stats.played}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.wins}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.draws}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.losses}</td>
                      <td style={{
                        textAlign: 'center',
                        padding: '10px 2px',
                        fontWeight: '700',
                        color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'
                      }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', fontWeight: '900', color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
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

      <div style={{ marginTop: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '0 5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
          <span>Automatic Promotion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
          <span>Relegation Zone</span>
        </div>
      </div>
    </div>
  )
}
