import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, collection, query, getDocs, orderBy, limit } from '../firebase'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'

const DIVISION_COLORS = {
  'Elite': '#fbbf24',
  'Emerald': '#10b981',
  'Diamond': '#38bdf8',
  'Platinum': '#818cf8'
}

const MEDAL_COLORS = ['#fbbf24', '#94a3b8', '#d97706']
const MEDAL_EMOJIS = ['🥇', '🥈', '🥉']

const avgColor = (a) => {
  if (!(a > 0)) return 'var(--text-muted)'
  if (a >= 65) return '#10b981'
  if (a >= 55) return '#fbbf24'
  if (a >= 45) return '#f97316'
  return '#ef4444'
}

const divColor = (d) => DIVISION_COLORS[d] || 'var(--text-muted)'

export default function Leaderboards() {
  const { user, getAllUsers, getFixtures, getResults, dataRefreshTrigger, adminData, forceFetchResults, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedDivision, setSelectedDivision] = useState('all')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'practice' ? 'practice' : 'league')
  const [isSyncing, setIsSyncing] = useState(false)
  const [practiceLeaderboard, setPracticeLeaderboard] = useState([])
  const [hallOfFame, setHallOfFame] = useState([])

  useEffect(() => {
    const fetchPracticeData = async () => {
      try {
        const q = query(collection(db, 'practiceLeaderboard'), orderBy('score', 'desc'), limit(50))
        const snap = await getDocs(q)
        setPracticeLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Error fetching practice leaderboard:', e)
      }
    }
    if (activeTab === 'practice') fetchPracticeData()
  }, [activeTab, refreshKey])

  useEffect(() => {
    const fetchHallOfFame = async () => {
      try {
        const snap = await getDocs(collection(db, 'hallOfFame'))
        setHallOfFame(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) { console.error('Error fetching hall of fame:', e) }
    }
    fetchHallOfFame()
  }, [refreshKey])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const currentSeasonName = adminData?.currentSeason || 'Elite Arrows Season 5'

  const playerStats = useMemo(() => derivePlayerStatsFromResults(allUsers, results, {
    fixtures, adminData, leagueOnly: true, currentSeason: currentSeasonName, includePlayoffs: false
  }), [allUsers, results, fixtures, adminData, currentSeasonName, refreshKey])

  const divisions = ['all', 'Elite', 'Emerald', 'Diamond', 'Platinum']

  const leagueBoard = useMemo(() => {
    let list = Object.values(playerStats).filter(p => p.played > 0)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.legDiff - a.legDiff)
    if (selectedDivision !== 'all') list = list.filter(p => p.division === selectedDivision)
    return list
  }, [playerStats, selectedDivision])

  const board180s = useMemo(() => {
    let list = Object.values(playerStats).filter(p => p.played > 0 && p['180s'] > 0)
      .sort((a, b) => b['180s'] - a['180s'] || b.played - a.played)
    if (selectedDivision !== 'all') list = list.filter(p => p.division === selectedDivision)
    return list
  }, [playerStats, selectedDivision])

  const boardCheckouts = useMemo(() => {
    let list = Object.values(playerStats).filter(p => p.played > 0 && p.highestCheckout > 0)
      .sort((a, b) => b.highestCheckout - a.highestCheckout || b.played - a.played)
    if (selectedDivision !== 'all') list = list.filter(p => p.division === selectedDivision)
    return list
  }, [playerStats, selectedDivision])

  const top180s = useMemo(() =>
    Object.values(playerStats).reduce((max, p) => (!max || p['180s'] > max['180s']) ? p : max, null)
  , [playerStats])

  const topCheckout = useMemo(() =>
    Object.values(playerStats).reduce((max, p) => (!max || p.highestCheckout > max.highestCheckout) ? p : max, null)
  , [playerStats])

  const pointsLeader = leagueBoard[0] || null

  const honoursList = useMemo(() => {
    const curated = hallOfFame.map(h => {
      const u = allUsers.find(user => user.id === h.userId)
      return { ...h, profilePicture: u?.profilePicture }
    })
    if (curated.length > 0) return curated.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
    const list = []
    if (!Array.isArray(allUsers)) return list
    allUsers.forEach(u => {
      if (u.trophies && Array.isArray(u.trophies)) {
        u.trophies.forEach(t => list.push({ ...t, username: u.username, userId: u.id, profilePicture: u.profilePicture }))
      }
    })
    return list.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
  }, [allUsers, hallOfFame])

  const myRank = useMemo(() => {
    if (!user?.id) return null
    const idx = leagueBoard.findIndex(p => String(p.id) === String(user.id))
    return idx >= 0 ? idx + 1 : null
  }, [leagueBoard, user?.id])

  const podiumPlayers = useMemo(() => {
    if (activeTab === 'practice') return []
    const list = activeTab === '180s' ? board180s : activeTab === 'checkouts' ? boardCheckouts : leagueBoard
    return list.slice(0, 3)
  }, [activeTab, leagueBoard, board180s, boardCheckouts])

  const podiumValue = (p) => activeTab === 'league' ? p.points : activeTab === '180s' ? p['180s'] : p.highestCheckout
  const podiumSub = (p) => activeTab === 'league'
    ? `${p.wins}W · ${p.losses}L · ${p.played} games`
    : activeTab === '180s'
      ? `${p.average > 0 ? p.average.toFixed(1) : '—'} avg · ${p.played} games`
      : `${p['180s']} x 180s · ${p.played} games`

  const renderAvatar = (player, size = 36, ring) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: `linear-gradient(135deg, ${ring || '#d946ef'}, var(--accent-cyan))`,
      border: '2.5px solid rgba(255,255,255,0.14)', boxShadow: '0 0 0 3px rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.35)'
    }}>
      {player?.profilePicture
        ? <img src={player.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 800, fontSize: `${Math.round(size * 0.4)}px`, color: '#0b051d' }}>
            {(player?.username || '?').charAt(0).toUpperCase()}
          </div>}
    </div>
  )

  const renderPlayerCell = (player, medal) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate(`/statistics/${player.id}`)}>
      {renderAvatar(player, 38, medal || DIVISION_COLORS[player.division])}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{player.username}</div>
        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: divColor(player.division), textTransform: 'uppercase', letterSpacing: '0.06em' }}>{player.division}</div>
      </div>
    </div>
  )

  const rankBadge = (i) => {
    const isMedal = i < 3
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '34px', height: '34px', borderRadius: '50%',
        background: isMedal ? MEDAL_COLORS[i] : 'rgba(255,255,255,0.07)',
        color: isMedal ? '#0b051d' : 'var(--text-muted)',
        fontWeight: 900, fontSize: '0.8rem',
        boxShadow: isMedal ? `0 0 0 2px ${MEDAL_COLORS[i]}33, 0 3px 10px ${MEDAL_COLORS[i]}44` : 'none'
      }}>{i + 1}</span>
    )
  }

  const renderPodium = () => {
    if (podiumPlayers.length === 0) return null
    const order = podiumPlayers.length >= 3 ? [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]] : podiumPlayers
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${podiumPlayers.length >= 3 ? 3 : podiumPlayers.length}, 1fr)`,
        gap: '18px', alignItems: 'end', marginBottom: '28px', maxWidth: '760px', marginLeft: 'auto', marginRight: 'auto'
      }}>
        {order.map(p => {
          const i = podiumPlayers.findIndex(x => String(x.id) === String(p.id))
          const first = i === 0
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                className="card glass"
                onClick={() => navigate(`/statistics/${p.id}`)}
                style={{
                  width: '100%', maxWidth: 250, padding: first ? '34px 20px 28px' : '24px 18px', textAlign: 'center',
                  borderRadius: '22px', cursor: 'pointer',
                  border: `1px solid ${MEDAL_COLORS[i]}${first ? '99' : '44'}`,
                  background: first
                    ? 'linear-gradient(180deg, rgba(251,191,36,0.16), rgba(15,23,42,0.55))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.5))',
                  transform: first ? 'translateY(-16px)' : undefined,
                  boxShadow: first ? '0 20px 45px -14px rgba(251,191,36,0.45)' : '0 10px 28px -12px rgba(0,0,0,0.6)',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{MEDAL_EMOJIS[i]}</div>
                <div style={{ margin: '0 auto 12px' }}>{renderAvatar(p, first ? 84 : 68)}</div>
                <div style={{ fontWeight: 800, fontSize: first ? '1.1rem' : '0.95rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.username}</div>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: divColor(p.division), textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{p.division} Division</div>
                <div style={{ fontSize: first ? '2rem' : '1.55rem', fontWeight: 900, color: MEDAL_COLORS[i], marginTop: '10px', lineHeight: 1 }}>{podiumValue(p)}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {activeTab === 'league' ? 'Points' : activeTab === '180s' ? 'Maxes' : 'Checkout'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>{podiumSub(p)}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const spotCard = ({ icon, title, name, value, unit, color, sub }) => (
    <div className="card glass" style={{
      padding: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderRadius: '20px',
      border: `1px solid ${color}44`, background: `linear-gradient(160deg, ${color}1c, rgba(15,23,42,0.5))`
    }}>
      <div style={{ position: 'absolute', top: '14px', left: '16px', fontSize: '0.62rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ fontSize: '2.6rem', margin: '18px 0 8px' }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'TBD'}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 900, color, marginTop: '2px', lineHeight: 1.2 }}>{value ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{unit}</span></div>
      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>
    </div>
  )

  const tableHead = (
    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      <th style={{ padding: '12px 8px' }}>Rank</th>
      <th style={{ padding: '12px 8px' }}>Player</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Pts</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }}>W-L</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }} title="3-Dart Average">Avg</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }} title="Highest Checkout">HC</th>
      <th style={{ padding: '12px 8px', textAlign: 'center' }} title="Number of 180s">180s</th>
    </tr>
  )

  const renderLeagueTable = () => {
    const isUser = (player) => user?.id && String(player.id) === String(user.id)
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>🏆 Performance Table</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>Current live season — {currentSeasonName}</p>
          </div>
        </div>
        {myRank && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', marginBottom: '14px', borderRadius: '14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.35)', fontSize: '0.82rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📍</span>
            <span>You're currently <strong style={{ color: 'var(--accent-cyan)' }}>#{myRank}</strong> in the {selectedDivision === 'all' ? 'Overall' : selectedDivision} standings.</span>
          </div>
        )}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {leagueBoard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>No matches recorded in the current season yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse' }}>
              <thead>{tableHead}</thead>
              <tbody>
                {leagueBoard.map((player, i) => {
                  const you = isUser(player)
                  return (
                    <tr key={player.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem',
                        background: you ? 'rgba(56,189,248,0.08)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => { if (!you) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!you) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '12px 8px' }}>{rankBadge(i)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderPlayerCell(player, MEDAL_COLORS[i])}
                          {you && <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: '99px', background: 'rgba(56,189,248,0.2)', color: 'var(--accent-cyan)', border: '1px solid rgba(56,189,248,0.4)' }}>YOU</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: 'var(--accent-cyan)' }}>{player.points}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--success)' }}>{player.wins}</span>-<span style={{ color: 'var(--error)' }}>{player.losses}</span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.played}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: avgColor(player.average) }}>
                        {player.average > 0 ? `${player.average.toFixed(1)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player.highestCheckout > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {player.highestCheckout > 0 ? player.highestCheckout : '—'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player['180s'] > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {player['180s'] || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </>
    )
  }

  const render180sTable = () => (
    <>
      <div style={{ marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>💯 Most 180s</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', marginBottom: 0 }}>Maxes so far in the current live season</p>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {board180s.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}><p style={{ color: 'var(--text-muted)' }}>No 180s recorded yet.</p></div>
        ) : (
          <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={{ padding: '12px 8px' }}>Rank</th>
                <th style={{ padding: '12px 8px' }}>Player</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>180s</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }} title="3-Dart Average">Avg</th>
              </tr>
            </thead>
            <tbody>
              {board180s.map((player, i) => (
                <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '12px 8px' }}>{rankBadge(i)}</td>
                  <td style={{ padding: '12px 8px' }}>{renderPlayerCell(player, MEDAL_COLORS[i])}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: '#fbbf24', fontSize: '1.05rem' }}>{player['180s']}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.played}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: avgColor(player.average) }}>
                    {player.average > 0 ? player.average.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )

  const renderCheckoutsTable = () => (
    <>
      <div style={{ marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>🐟 Highest Checkouts</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', marginBottom: 0 }}>Best single finishes in the current live season</p>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {boardCheckouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}><p style={{ color: 'var(--text-muted)' }}>No checkouts recorded yet.</p></div>
        ) : (
          <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={{ padding: '12px 8px' }}>Rank</th>
                <th style={{ padding: '12px 8px' }}>Player</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Best CO</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>180s</th>
              </tr>
            </thead>
            <tbody>
              {boardCheckouts.map((player, i) => (
                <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '12px 8px' }}>{rankBadge(i)}</td>
                  <td style={{ padding: '12px 8px' }}>{renderPlayerCell(player, MEDAL_COLORS[i])}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: 'var(--accent-cyan)', fontSize: '1.05rem' }}>{player.highestCheckout}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.played}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player['180s'] > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                    {player['180s'] || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )

  const practiceUsers = useMemo(() =>
    practiceLeaderboard.map(e => ({ ...e, user: allUsers.find(u => u.username === e.username) }))
  , [practiceLeaderboard, allUsers])

  const renderPracticeTable = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>🎯 Practice Drills Leaderboard</h3>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {practiceUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: 'var(--text-muted)' }}>No practice sessions recorded yet.</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/practice')}>Go to Practice Hub</button>
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={{ padding: '12px 8px' }}>Rank</th>
                <th style={{ padding: '12px 8px' }}>Player</th>
                <th style={{ padding: '12px 8px' }}>Drill</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Score/Acc</th>
              </tr>
            </thead>
            <tbody>
              {practiceUsers.map((entry, index) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '12px 8px' }}>{rankBadge(index)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => entry.user ? navigate(`/statistics/${entry.user.id}`) : navigate('/practice')}>
                      {renderAvatar(entry.user || { username: entry.username }, 36)}
                      <div style={{ fontWeight: 700 }}>{entry.username}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: entry.modeId === 'atc' ? 'var(--accent-cyan)' : entry.modeId === '170' ? '#ef4444' : '#fbbf24' }}>
                      {entry.modeId === 'atc' ? '🍀 Around Clock' : entry.modeId === '170' ? '💯 170 Drill' : '🎯 Scoring'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: 'var(--accent-primary)', fontSize: '1rem' }}>
                    {entry.modeId === 'atc' ? `${entry.accuracy?.toFixed(1)}%` : entry.modeId === '170' ? `${entry.dartsThrown} darts` : entry.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Leaderboards' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '26px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.6rem' }}>🏆</span>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.2rem', margin: 0 }}>League Honours & Rankings</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Celebrating our champions, top scorers and finest finishes</p>
        </div>
        <button
          className="btn btn-secondary glass"
          disabled={isSyncing}
          onClick={async () => {
            setIsSyncing(true)
            showToast?.('Syncing latest leaderboard data...', 'info')
            try {
              if (forceFetchResults) {
                await forceFetchResults()
                showToast?.('Rankings synchronized!', 'success')
              } else {
                triggerDataRefresh('all')
                setRefreshKey(prev => prev + 1)
                showToast('Data refreshed!', 'success')
              }
            } catch (err) {
              showToast?.('Sync failed. Please reload.', 'error')
            } finally {
              setIsSyncing(false)
            }
          }}
          style={{ padding: '8px 18px', borderRadius: '99px', fontSize: '0.8rem', minWidth: '80px' }}
        >
          {isSyncing ? '…' : '↻ Sync'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '32px' }}>
        {spotCard({ icon: '👑', title: 'Points Leader', name: pointsLeader?.username, value: pointsLeader?.points, unit: 'pts', color: '#fbbf24', sub: pointsLeader ? `${pointsLeader.wins}W · ${pointsLeader.losses}L · ${pointsLeader.played} games` : 'No matches yet this season' })}
        {spotCard({ icon: '💯', title: 'Season 180s Leader', name: top180s?.username, value: top180s?.['180s'], unit: 'maxes', color: '#38bdf8', sub: 'Current live season' })}
        {spotCard({ icon: '🐟', title: 'Highest Checkout', name: topCheckout?.username, value: topCheckout?.highestCheckout, unit: 'finish', color: '#10b981', sub: topCheckout?.division ? `${topCheckout.division} Division` : '—' })}
      </div>

      {activeTab !== 'practice' && (
        <div className="division-tabs" style={{ marginBottom: '22px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { key: 'league', label: '🏆 League Rankings' },
            { key: '180s', label: '💯 Most 180s' },
            { key: 'checkouts', label: '🐟 Highest Checkouts' },
          ].map(tab => (
            <button key={tab.key} className={`division-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)} style={{ fontSize: '0.78rem', padding: '10px 18px' }}>
              {tab.label}
            </button>
          ))}
          <button className={`division-tab ${activeTab === 'practice' ? 'active' : ''}`} onClick={() => setActiveTab('practice')} style={{ fontSize: '0.78rem', padding: '10px 18px' }}>
            🎯 Practice Drills
          </button>
        </div>
      )}

      {activeTab !== 'practice' && (
        <div className="division-tabs" style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {divisions.map(div => (
            <button key={div} className={`division-tab ${selectedDivision === div ? 'active' : ''}`} onClick={() => setSelectedDivision(div)} style={{ fontSize: '0.72rem', padding: '8px 16px' }}>
              {div === 'all' ? '⭐ All Divisions' : div}
            </button>
          ))}
        </div>
      )}

      {/* PODIUM */}
      {activeTab !== 'practice' && renderPodium()}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '32px', alignItems: 'start' }} className="leaderboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card glass" style={{ padding: '24px', borderRadius: '22px' }}>
            {activeTab === 'league' && renderLeagueTable()}
            {activeTab === '180s' && render180sTable()}
            {activeTab === 'checkouts' && renderCheckoutsTable()}
            {activeTab === 'practice' && renderPracticeTable()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card glass" style={{ padding: '24px', borderRadius: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>🏅 Hall of Fame</h3>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => navigate('/hall-of-fame')}>Full Page</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Historical league and cup winners</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {honoursList.length > 0 ? honoursList.map((honour, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.05))', border: '1px solid rgba(251,191,36,0.4)' }}>
                    {honour.icon || '🏆'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{honour.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>{honour.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{honour.season}</div>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No honours recorded yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card glass" style={{ padding: '26px', borderRadius: '22px', background: 'linear-gradient(150deg, rgba(56, 189, 248, 0.14), rgba(129, 140, 248, 0.1))', border: '1px solid rgba(129,140,248,0.3)' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', marginTop: 0 }}>✨ Earn Your Spot</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Win your division league or any official cup tournament to have your name permanently etched in the Elite Arrows Hall of Fame.
            </p>
            <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: '16px' }} onClick={() => navigate('/cups')}>View Active Cups</button>
          </div>
        </div>
      </div>

      <style>{`
        .leaderboard-grid > div { min-width: 0; }
        .leaderboard-grid .card { min-width: 0; max-width: 100%; }
        @media (max-width: 900px) {
          .leaderboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}