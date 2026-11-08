import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, deleteDoc, getDocs, collection } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'
import { compressImageToDataUrl } from '../utils/imageUtils'

const DIVISION_COLORS = {
  'Premier': '#f43f5e',
  'Elite': '#fbbf24',
  'Emerald 1': '#10b981',
  'Emerald 2': '#34d399',
  'Diamond': '#38bdf8',
  'Platinum': '#818cf8'
}

const MEDAL_COLORS = ['#fbbf24', '#94a3b8', '#d97706']
const divColor = (d) => DIVISION_COLORS[d] || 'var(--text-muted)'

export default function JDCChallenge() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const allUsers = getAllUsers() || []
  const [doublesTeams, setDoublesTeams] = useState([])
  const [selectedDivision, setSelectedDivision] = useState('all')

  useEffect(() => {
    const saved = localStorage.getItem('eliteArrowsDoublesTeams')
    if (saved) {
      try { setDoublesTeams(JSON.parse(saved)) } catch (e) {}
    }
    getDocs(collection(db, 'doublesTeams')).then(snap => {
      if (!snap.empty) {
        const tList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setDoublesTeams(tList)
      }
    }).catch(() => {})
  }, [])

  // Filter players competing in singles league or doubles league (with robust fallback)
  const leaguePlayers = useMemo(() => {
    const list = Array.isArray(allUsers) && allUsers.length > 0 ? allUsers : (user ? [user] : [])
    const doublesPlayerIds = new Set()
    doublesTeams.forEach(t => {
      if (t.p1Id) doublesPlayerIds.add(String(t.p1Id))
      if (t.p2Id) doublesPlayerIds.add(String(t.p2Id))
    })

    const filtered = list.filter(u => {
      const inSingles = u.division && u.division !== 'Unassigned' && u.division !== 'Admin'
      const inDoubles = doublesPlayerIds.has(String(u.id))
      return inSingles || inDoubles || String(u.id) === String(user?.id)
    })

    return filtered.length > 0 ? filtered : list
  }, [allUsers, doublesTeams, user])

  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [selectedPlayerModal, setSelectedPlayerModal] = useState(null)
  const [expandedProofImage, setExpandedProofImage] = useState(null)
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null)

  const currentDateStr = new Date().toISOString().split('T')[0]
  const currentMonthKey = currentDateStr.substring(0, 7) // 'YYYY-MM'

  const [submissionForm, setSubmissionForm] = useState({
    score: '',
    dateCompleted: currentDateStr,
    proofImage: ''
  })

  const [manualForm, setManualForm] = useState({
    playerId: '',
    score: '',
    dateCompleted: currentDateStr
  })

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  const fetchSubmissions = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'jdcSubmissions'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setSubmissions(list)
    } catch (e) {
      console.error('Failed to load JDC submissions', e)
    }
  }, [])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleProofImagePick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file, 1200, 0.8)
      setSubmissionForm(prev => ({ ...prev, proofImage: dataUrl }))
      showToast('Proof photo attached!', 'success')
    } catch (err) {
      showToast('Failed to process image: ' + err.message, 'error')
    }
  }

  const handleSubmitScore = async () => {
    if (!user || !user.id) return
    if (submissionForm.score === '') return showToast('Please enter your final JDC score', 'error')

    try {
      const subId = `jdc_sub_${user.id}_${Date.now()}`
      const scoreVal = parseInt(submissionForm.score) || 0
      const dateCompletedVal = submissionForm.dateCompleted || currentDateStr
      const monthKey = dateCompletedVal.substring(0, 7)

      const submissionData = {
        id: subId,
        userId: user.id,
        username: user.username || user.name || 'Player',
        division: user.division || 'Elite',
        score: scoreVal,
        dateCompleted: dateCompletedVal,
        month: monthKey,
        proofImage: submissionForm.proofImage || null,
        submittedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'jdcSubmissions', subId), submissionData)

      const updatedSubs = [...submissions, submissionData]
      setSubmissions(updatedSubs)

      const monthSubs = updatedSubs.filter(s => (s.month || s.dateCompleted?.substring(0, 7)) === monthKey)

      const userBestMap = {}
      monthSubs.forEach(s => {
        if (!userBestMap[s.userId] || s.score > userBestMap[s.userId].score) {
          userBestMap[s.userId] = { userId: s.userId, username: s.username, score: s.score }
        }
      })

      const ranked = Object.values(userBestMap).sort((a, b) => b.score - a.score)
      const myPersonalBest = userBestMap[user.id]?.score || scoreVal
      const myIndex = ranked.findIndex(r => String(r.userId) === String(user.id))
      const rankNum = myIndex !== -1 ? myIndex + 1 : ranked.length

      const getOrdinalSuffix = (n) => {
        const s = ["th", "st", "nd", "rd"],
              v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      }

      setLastSubmissionResult({
        player: user.username || user.name || 'Player',
        score: scoreVal,
        position: getOrdinalSuffix(rankNum),
        personalBest: myPersonalBest,
        dateSubmitted: new Date(dateCompletedVal).toLocaleDateString('en-GB')
      })

      setShowSubmitModal(false)
      setSubmissionForm({ score: '', dateCompleted: currentDateStr, proofImage: '' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      showToast('JDC Challenge submitted successfully!', 'success')
      fetchSubmissions()
    } catch (e) {
      showToast('Failed to submit JDC result: ' + e.message, 'error')
    }
  }

  const handleAdminManualEntry = async () => {
    if (!manualForm.playerId || manualForm.score === '') return showToast('Please select a player and enter a score', 'error')
    const targetUser = allUsers.find(u => String(u.id) === String(manualForm.playerId))
    if (!targetUser) return showToast('Player not found', 'error')

    try {
      const subId = `jdc_sub_${targetUser.id}_${Date.now()}`
      const scoreVal = parseInt(manualForm.score) || 0
      const dateCompletedVal = manualForm.dateCompleted || currentDateStr
      const monthKey = dateCompletedVal.substring(0, 7)

      const submissionData = {
        id: subId,
        userId: targetUser.id,
        username: targetUser.username || targetUser.name || 'Player',
        division: targetUser.division || 'Elite',
        score: scoreVal,
        dateCompleted: dateCompletedVal,
        month: monthKey,
        proofImage: null,
        submittedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'jdcSubmissions', subId), submissionData)
      showToast(`Added JDC score for ${targetUser.username}!`, 'success')
      setShowManualModal(false)
      setManualForm({ playerId: '', score: '', dateCompleted: currentDateStr })
      fetchSubmissions()
    } catch (e) {
      showToast('Failed to save manual score: ' + e.message, 'error')
    }
  }

  const handleDeleteJdcResult = async (userId, username) => {
    if (!window.confirm(`Delete JDC results for ${username}?`)) return
    try {
      const userSubs = submissions.filter(s => String(s.userId) === String(userId))
      for (const sub of userSubs) {
        await deleteDoc(doc(db, 'jdcSubmissions', sub.id))
      }
      try {
        await deleteDoc(doc(db, 'jdcResults', String(userId)))
      } catch (e) {}

      showToast(`Removed JDC results for ${username}`, 'success')
      fetchSubmissions()
    } catch (e) {
      showToast('Failed to remove: ' + e.message, 'error')
    }
  }

  const currentMonthSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const m = s.month || (s.dateCompleted ? s.dateCompleted.substring(0, 7) : '')
      return m === currentMonthKey
    })
  }, [submissions, currentMonthKey])

  const leaderboard = useMemo(() => {
    const bestPerPlayer = {}
    const sortedSubs = [...currentMonthSubmissions].sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0)
      return new Date(b.dateCompleted || b.submittedAt || 0) - new Date(a.dateCompleted || a.submittedAt || 0)
    })

    sortedSubs.forEach(s => {
      if (!bestPerPlayer[s.userId]) {
        bestPerPlayer[s.userId] = {
          id: s.userId,
          username: s.username,
          division: leaguePlayers.find(p => String(p.id) === String(s.userId))?.division || 'Elite',
          bestScore: s.score,
          dateAchieved: s.dateCompleted || s.submittedAt?.split('T')[0] || ''
        }
      }
    })

    let list = leaguePlayers.map(player => {
      const existing = bestPerPlayer[String(player.id)]
      return {
        id: player.id,
        username: player.username || player.name || 'Player',
        division: player.division || 'Elite',
        profilePicture: player.profilePicture || null,
        bestScore: existing ? existing.bestScore : 0,
        dateAchieved: existing ? existing.dateAchieved : '-',
        hasPlayed: !!existing
      }
    }).sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore
      return a.username.localeCompare(b.username)
    })

    if (selectedDivision !== 'all') {
      list = list.filter(p => p.division === selectedDivision)
    }

    return list
  }, [currentMonthSubmissions, leaguePlayers, selectedDivision])

  const divisions = ['all', 'Premier', 'Elite', 'Emerald 1', 'Emerald 2', 'Diamond', 'Platinum']
  const formattedMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  const podiumPlayers = leaderboard.slice(0, 3)

  const renderAvatar = (player, size = 42, ring) => (
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

  const playerSubmissionsList = useMemo(() => {
    if (!selectedPlayerModal) return []
    return submissions
      .filter(s => String(s.userId) === String(selectedPlayerModal.id))
      .sort((a, b) => new Date(b.dateCompleted || b.submittedAt || 0) - new Date(a.dateCompleted || a.submittedAt || 0))
  }, [submissions, selectedPlayerModal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '100px' }} className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'JDC Challenge', path: '/weekly-challenges' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>🎯 JDC Challenge</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Monthly darts challenge for Singles & Doubles League competitors — {formattedMonthName}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
            📝 Submit JDC Result
          </button>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowManualModal(true)}>
              ⚙️ Admin Entry
            </button>
          )}
        </div>
      </div>

      {/* Submission Success Modal Card */}
      {lastSubmissionResult && (
        <div className="card glass animate-fade-in" style={{ padding: '24px', border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ color: 'var(--success)', margin: 0 }}>🎉 JDC Challenge Submitted Successfully</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setLastSubmissionResult(null)}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.95rem' }}>
            <div>Player: <strong>{lastSubmissionResult.player}</strong></div>
            <div>Score: <strong style={{ color: 'var(--accent-cyan)' }}>{lastSubmissionResult.score}</strong></div>
            <div>Current Leaderboard Position: <strong style={{ color: '#fbbf24' }}>{lastSubmissionResult.position}</strong></div>
            <div>Personal Best This Month: <strong>{lastSubmissionResult.personalBest}</strong></div>
            <div>Date Submitted: <strong>{lastSubmissionResult.dateSubmitted}</strong></div>
          </div>
        </div>
      )}

      {/* Feature Description Card */}
      <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>About the JDC Challenge</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              The JDC Challenge is a monthly darts challenge that allows players to test and compare their overall darts ability through a recognised scoring and finishing format.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
            <strong>🎯 Encourage Practice</strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>Test and improve your scoring power and finishing ability.</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
            <strong>🏆 Monthly Leaderboard</strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>Play as many times as you want; only your highest score counts.</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
            <strong>🔄 Resets Monthly</strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>The leaderboard resets at the start of each new month.</p>
          </div>
        </div>
      </div>

      {/* Score Bands Reference Guide Card */}
      <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <h3 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>📊 JDC Score Bands (Division Standards)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Realistic target score ranges corresponding to each league division tier from entry to master level:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { name: 'Platinum', range: '0 – 250 pts', color: '#818cf8', desc: 'Developing scoring & finishing' },
            { name: 'Diamond', range: '251 – 410 pts', color: '#38bdf8', desc: 'Consistent club standard' },
            { name: 'Emerald 2', range: '411 – 560 pts', color: '#34d399', desc: 'Intermediate competitive' },
            { name: 'Emerald 1', range: '561 – 700 pts', color: '#10b981', desc: 'Advanced league player' },
            { name: 'Elite', range: '701 – 830 pts', color: '#fbbf24', desc: 'Top tier county standard' },
            { name: 'Premier', range: '831 – 950 pts', color: '#f43f5e', desc: 'Mastery / elite standard' },
          ].map(band => (
            <div key={band.name} style={{ background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '12px', border: `1px solid ${band.color}44` }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: band.color, marginBottom: '2px' }}>{band.name}</div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', marginBottom: '4px' }}>{band.range}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{band.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Division Filter Tabs */}
      <div className="division-tabs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${selectedDivision === div ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: selectedDivision === div ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
              background: selectedDivision === div ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
              color: selectedDivision === div ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
            onClick={() => setSelectedDivision(div)}
          >
            {div === 'all' ? 'All Divisions' : div}
          </button>
        ))}
      </div>

      {/* Podium Display for Top 3 */}
      {podiumPlayers.length > 0 && selectedDivision === 'all' && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${podiumPlayers.length >= 3 ? 3 : podiumPlayers.length}, 1fr)`,
          gap: '18px', alignItems: 'end', marginBottom: '20px', maxWidth: '760px', marginLeft: 'auto', marginRight: 'auto', width: '100%'
        }}>
          {[podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]].filter(Boolean).map(p => {
            const i = leaderboard.findIndex(x => String(x.id) === String(p.id))
            const first = i === 0
            const second = i === 1
            const medalColor = MEDAL_COLORS[i] || '#cd7f32'
            const height = first ? '180px' : second ? '150px' : '130px'

            return (
              <div key={p.id} className="card glass animate-fade-in" style={{
                padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'space-between', height, border: `2px solid ${medalColor}44`,
                background: first ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255,255,255,0.03)', cursor: 'pointer'
              }} onClick={() => setSelectedPlayerModal(p)}>
                <div style={{ position: 'relative', marginTop: '-24px' }}>
                  {renderAvatar(p, first ? 54 : 46, medalColor)}
                  <span style={{
                    position: 'absolute', bottom: -6, right: -6, background: medalColor, color: '#0b051d',
                    fontSize: '0.7rem', fontWeight: 900, width: '22px', height: '22px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                  }}>{i + 1}</span>
                </div>
                <div style={{ width: '100%', overflow: 'hidden' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.username}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: divColor(p.division), textTransform: 'uppercase' }}>{p.division}</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: p.hasPlayed ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                    {p.hasPlayed ? p.bestScore : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.hasPlayed ? `Achieved: ${p.dateAchieved}` : 'Unplayed'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly Leaderboard Table / List */}
      <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>🏆 Standings — {formattedMonthName}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{leaderboard.length} Competitors (Click player to view submissions & proof)</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No competitors found in this division.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.map((player, idx) => {
              const isMedal = idx < 3
              return (
                <div key={player.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: idx === 0 ? 'rgba(251, 191, 36, 0.12)' : idx === 1 ? 'rgba(156, 163, 175, 0.1)' : idx === 2 ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: idx === 0 ? '1px solid rgba(251, 191, 36, 0.4)' : idx === 1 ? '1px solid rgba(156, 163, 175, 0.3)' : idx === 2 ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }} onClick={() => setSelectedPlayerModal(player)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: isMedal ? MEDAL_COLORS[idx] : 'rgba(255,255,255,0.07)',
                      color: isMedal ? '#0b051d' : 'var(--text-muted)',
                      fontWeight: 900, fontSize: '0.8rem',
                      boxShadow: isMedal ? `0 0 0 2px ${MEDAL_COLORS[idx]}33, 0 3px 10px ${MEDAL_COLORS[idx]}44` : 'none'
                    }}>
                      {idx + 1}
                    </span>
                    {renderAvatar(player, 40, DIVISION_COLORS[player.division])}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {player.username}
                        {String(player.id) === String(user?.id) && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--accent-cyan)', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>YOU</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: divColor(player.division), textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
                        {player.division} {player.hasPlayed && `· Achieved: ${player.dateAchieved}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: player.hasPlayed ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {player.hasPlayed ? `${player.bestScore}` : 'Unplayed'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {player.hasPlayed ? 'Best Score' : 'No attempt'}
                      </div>
                    </div>
                    {isAdmin && player.hasPlayed && (
                      <button
                        className="btn btn-danger btn-xs"
                        style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteJdcResult(player.id, player.username)
                        }}
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Player Submissions Modal */}
      {selectedPlayerModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', overflowY: 'auto' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '550px', padding: '24px', border: '1px solid var(--accent-cyan)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1.3rem' }}>🎯 {selectedPlayerModal.username}'s JDC Submissions</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Division: {selectedPlayerModal.division}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPlayerModal(null)}>✕ Close</button>
            </div>

            {playerSubmissionsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No JDC challenge submissions recorded for this player yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {playerSubmissionsList.map((sub, sIdx) => (
                  <div key={sub.id || sIdx} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date Completed: <strong>{sub.dateCompleted || sub.submittedAt?.split('T')[0]}</strong></span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{sub.score} pts</span>
                    </div>

                    {sub.proofImage ? (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Proof Photo / Score Sheet:</div>
                        <img
                          src={sub.proofImage}
                          alt="Proof"
                          style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '8px', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                          onClick={() => setExpandedProofImage(sub.proofImage)}
                        />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Click image to enlarge</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>No proof photo attached for this submission.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded Proof Image Lightbox Modal */}
      {expandedProofImage && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }} onClick={() => setExpandedProofImage(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button className="btn btn-secondary btn-sm" style={{ position: 'absolute', top: -40, right: 0 }} onClick={() => setExpandedProofImage(null)}>✕ Close</button>
            <img src={expandedProofImage} alt="Expanded Proof" style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
        </div>
      )}

      {/* Challenge Submission Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Submit JDC Challenge Result</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Player Name</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={user?.username || user?.name || 'Player'}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Date Completed *</label>
                <input
                  type="date"
                  className="form-input"
                  value={submissionForm.dateCompleted}
                  onChange={e => setSubmissionForm({ ...submissionForm, dateCompleted: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Final JDC Score *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 782"
                  value={submissionForm.score}
                  onChange={e => setSubmissionForm({ ...submissionForm, score: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Proof Photo / Score Sheet (Optional)</label>
                <input type="file" accept="image/*" onChange={handleProofImagePick} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
                {submissionForm.proofImage && <img src={submissionForm.proofImage} alt="Preview" style={{ width: '100%', height: '100px', objectFit: 'contain', marginTop: '8px', borderRadius: '8px' }} />}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmitScore}>Submit Result</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Manual Entry Modal */}
      {showManualModal && isAdmin && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Admin JDC Score Entry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select League Competitor</label>
                <UserSearchSelect users={leaguePlayers} selectedUserId={manualForm.playerId} onSelect={id => setManualForm({ ...manualForm, playerId: id })} placeholder="Search league competitor..." />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Date Completed</label>
                <input type="date" className="form-input" value={manualForm.dateCompleted} onChange={e => setManualForm({ ...manualForm, dateCompleted: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Final JDC Score</label>
                <input type="number" className="form-input" placeholder="e.g. 782" value={manualForm.score} onChange={e => setManualForm({ ...manualForm, score: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowManualModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: '1' }} onClick={handleAdminManualEntry}>Save Score</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
