import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'

const SUPER_DIVISIONS = ['Premier', 'Pro', 'Amateur']
const DIVISION_COLORS = {
  'Premier': '#fbbf24',
  'Pro': '#38bdf8',
  'Amateur': '#cbd5e1'
}

export default function SuperLeague() {
  const [activeTab, setActiveTab] = useState('table')
  const [activeDivision, setActiveDivision] = useState('Premier')
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger, adminData } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  // Guard: Only admins for now
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())

  if (!isAdmin) {
    return (
      <div className="page glass">
        <h1 className="page-title">Access Restricted</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>The Super League is currently in Private Beta for Admins only.</p>
      </div>
    )
  }

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures,
      adminData,
      superLeagueOnly: true
    })
  }, [allUsers, results, fixtures, adminData, refreshKey])

  const playersInDivision = useMemo(() => {
    const source = allUsers.filter(u => u.superLeagueDivision === activeDivision)

    return source
      .map(p => ({
        ...p,
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0 }
      }))
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        const aLegDiff = a.stats.legsWon - a.stats.legsLost
        const bLegDiff = b.stats.legsWon - b.stats.legsLost
        if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff
        return b.stats.legsWon - a.stats.legsWon
      })
  }, [activeDivision, allUsers, playerStats])

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Super League' }]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>Elite Super League</h1>
        <p style={{ color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem' }}>Admin Beta Access</p>
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
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>D</th>
                    <th style={{ width: '40px', padding: '15px 5px', textAlign: 'center' }}>L</th>
                    <th style={{ width: '50px', padding: '15px 5px', textAlign: 'center' }}>+/-</th>
                    <th style={{ width: '60px', padding: '15px 5px', textAlign: 'center', color: 'var(--accent-cyan)' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {playersInDivision.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No players assigned to {activeDivision} yet.</td>
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
                            <span style={{ fontWeight: 700, color: 'white' }}>{player.username}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{player.stats.wins}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{player.stats.draws}</td>
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
                <li><strong>3 Points</strong> bonus for a Match Win.</li>
              </ul>
            </section>

            <section>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>General Rules</h3>
              <p style={{ color: 'var(--text-muted)' }}>Super League follows the standard Elite Arrows competitive ruleset regarding etiquette, reporting, and disputes. As an elite tier, higher standards of punctuality and sportsmanship are expected.</p>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
