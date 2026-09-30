import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, getDocs, collection, query, where, orderBy, limit, deleteDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function DailyChallenges() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()

  const [currentChallenge, setCurrentChallenge] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')

  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', date: new Date().toISOString().split('T')[0] })
  const [previewImage, setPreviewImage] = useState(null)

  const [lbRange, setLbRange] = useState(7)
  const [lbDays, setLbDays] = useState([])
  const [lbLoading, setLbLoading] = useState(false)
  const [expandedDay, setExpandedDay] = useState(null)

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const cSnap = await getDocs(query(collection(db, 'dailyChallenges'), where('date', '==', today), limit(1)))
      if (!cSnap.empty) {
        setCurrentChallenge({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() })

        const sSnap = await getDocs(query(collection(db, 'dailyChallengeSubmissions'), where('challengeId', '==', cSnap.docs[0].id)))
        setSubmissions(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } else {
        // Look for the most recent one if today's is missing
        const recentSnap = await getDocs(query(collection(db, 'dailyChallenges'), orderBy('date', 'desc'), limit(1)))
        if (!recentSnap.empty) {
          setCurrentChallenge({ id: recentSnap.docs[0].id, ...recentSnap.docs[0].data() })
          const sSnap = await getDocs(query(collection(db, 'dailyChallengeSubmissions'), where('challengeId', '==', recentSnap.docs[0].id)))
          setSubmissions(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        }
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    const loadLeaderboard = async () => {
      setLbLoading(true)
      try {
        const cSnap = await getDocs(query(collection(db, 'dailyChallenges'), orderBy('date', 'desc'), limit(30)))
        const recent = cSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

        const windowDays = recent.slice(0, lbRange)
        const ids = windowDays.map(d => d.id)

        const allSubs = []
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10)
          if (!chunk.length) continue
          const sSnap = await getDocs(query(collection(db, 'dailyChallengeSubmissions'), where('challengeId', 'in', chunk)))
          sSnap.docs.forEach(d => allSubs.push({ id: d.id, ...d.data() }))
        }

        if (cancelled) return
        setLbDays(windowDays.map(d => ({ ...d, subs: allSubs.filter(s => s.challengeId === d.id) })))
      } catch (e) {
        console.error(e)
        if (!cancelled) setLbDays([])
      }
      if (!cancelled) setLbLoading(false)
    }
    loadLeaderboard()
    return () => { cancelled = true }
  }, [lbRange])

  const lbBoard = useMemo(() => {
    const counts = new Map()
    lbDays.forEach(d => {
      d.subs.filter(s => s.status === 'approved').forEach(s => {
        const prev = counts.get(s.userId) || { userId: s.userId, username: s.username, count: 0 }
        prev.count += 1
        if (s.username) prev.username = s.username
        counts.set(s.userId, prev)
      })
    })
    return [...counts.values()].sort((a, b) => b.count - a.count || String(a.username).localeCompare(String(b.username)))
  }, [lbDays])

  const myLbEntry = useMemo(
    () => lbBoard.find(p => p.userId === user?.id),
    [lbBoard, user]
  )
  const myRank = useMemo(
    () => (myLbEntry ? lbBoard.findIndex(p => p.userId === user.id) + 1 : null),
    [lbBoard, myLbEntry, user]
  )

  const myStreaks = useMemo(() => {
    const isDone = d => d.subs.some(s => s.userId === user?.id && s.status === 'approved')
    let current = 0
    for (const d of lbDays) {
      if (isDone(d)) current += 1
      else break
    }
    let best = 0
    let run = 0
    for (const d of lbDays) {
      if (isDone(d)) { run += 1; best = Math.max(best, run) }
      else run = 0
    }
    const pending = lbDays.filter(d => d.subs.some(s => s.userId === user?.id && s.status !== 'approved')).length
    return { current, best, pending }
  }, [lbDays, user])

  const myDayStatus = useCallback((d) => {
    const mine = d.subs.filter(s => s.userId === user?.id)
    if (mine.some(s => s.status === 'approved')) return 'approved'
    if (mine.length > 0) return 'pending'
    return 'none'
  }, [user])

  const handleCreateChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) return
    setLoading(true)
    try {
      const id = newChallenge.date
      await setDoc(doc(db, 'dailyChallenges', id), {
        ...newChallenge,
        createdAt: new Date().toISOString()
      })
      showToast('Daily challenge set for ' + newChallenge.date, 'success')
      setShowCreateModal(false)
      fetchData()
    } catch (e) {
      showToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleAddCompletion = async (playerId) => {
    if (!currentChallenge || !playerId) return
    const player = getAllUsers().find(u => u.id === playerId)
    if (!player) return
    if (submissions.some(s => s.userId === playerId && s.status === 'approved')) {
      showToast('Already marked as completed', 'error')
      return
    }
    try {
      const id = `${playerId}_${currentChallenge.id}`
      await setDoc(doc(db, 'dailyChallengeSubmissions', id), {
        id,
        challengeId: currentChallenge.id,
        challengeTitle: currentChallenge.title,
        userId: playerId,
        username: player.username,
        status: 'approved',
        submittedAt: new Date().toISOString(),
        addedBy: user.username || user.email
      })
      showToast(`${player.username} marked as completed`, 'success')
      setSelectedPlayerId('')
      fetchData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleRemoveCompletion = async (sub) => {
    if (!window.confirm(`Remove ${sub.username}'s completion?`)) return
    try {
      await deleteDoc(doc(db, 'dailyChallengeSubmissions', sub.id))
      showToast('Completion removed', 'success')
      fetchData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const userSub = submissions.find(s => s.userId === user.id)

  if (showCreateModal && isAdmin) {
    return (
      <div className="page animate-fade-in">
        <Breadcrumbs items={[
          { label: 'Home', path: '/home' },
          { label: 'Daily Challenges', path: '/daily-challenges', onClick: () => setShowCreateModal(false) },
          { label: 'Set Challenge' }
        ]} />

        <div className="page-header">
          <h1 className="page-title text-gradient">Set Daily Challenge</h1>
          <p style={{ color: 'var(--text-muted)' }}>Configure the challenge for players to complete.</p>
        </div>

        <div className="card glass" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="form-group">
            <label style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Challenge Title</label>
            <input
              style={{ fontSize: '1.1rem', padding: '12px' }}
              value={newChallenge.title}
              onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
              placeholder="e.g. 3 Darts in Single 20"
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Description</label>
            <textarea
              style={{ fontSize: '1.1rem', padding: '12px' }}
              value={newChallenge.description}
              onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
              placeholder="Explain what the player needs to do..."
              rows={8}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Date</label>
            <input
              type="date"
              style={{ fontSize: '1.1rem', padding: '12px' }}
              value={newChallenge.date}
              onChange={e => setNewChallenge({...newChallenge, date: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
            <button className="btn btn-primary" style={{ flex: 2, padding: '15px', fontSize: '1.1rem' }} onClick={handleCreateChallenge} disabled={loading}>
              {loading ? 'Setting...' : 'Set Challenge'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Daily Challenges', path: '/daily-challenges' }]} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title text-gradient">Daily Challenge</h1>
          <p style={{ color: 'var(--text-muted)' }}>Complete today's challenge and upload your video proof!</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Set Daily Challenge</button>
        )}
      </div>

      {!currentChallenge ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: 'var(--text-muted)' }}>No challenge set for today yet.</h2>
          <p>Check back later or ask an admin!</p>
        </div>
      ) : (
        <div className="card glass" style={{ borderLeft: userSub?.status === 'approved' ? '4px solid var(--success)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h2 style={{ color: 'var(--accent-cyan)', margin: 0 }}>{currentChallenge.title}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
              {currentChallenge.date}
            </div>
          </div>
          <p style={{ fontSize: '1.1rem', marginBottom: '24px', lineHeight: '1.6' }}>{currentChallenge.description}</p>

          {userSub && userSub.status === 'approved' ? (
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--success)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Challenge Completed
              </div>
              <p style={{ fontSize: '0.9rem', marginTop: '8px', opacity: 0.8 }}>
                Great job! You have completed today's challenge.
              </p>
            </div>
          ) : (
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Not Completed Yet
              </div>
              <p style={{ fontSize: '0.9rem', marginTop: '8px', opacity: 0.8 }}>
                Complete the challenge and confirm it in the WhatsApp chat. An admin will mark you as completed.
              </p>
            </div>
          )}
        </div>
      )}

      {currentChallenge && submissions.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <div className="card glass">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              Players Who Completed This Challenge ({submissions.filter(s => s.status === 'approved').length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {submissions.filter(s => s.status === 'approved').map(s => (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '10px'
                }}>
                  <div style={{ fontSize: '1.2rem' }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(s.submittedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
            {submissions.filter(s => s.status === 'approved').length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No completions yet. Be the first!</p>
            )}
          </div>
        </div>
      )}

      <div className="card glass" style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Daily Leaderboard</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[7, 14, 30].map(r => (
              <button
                key={r}
                className={`btn btn-sm ${lbRange === r ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                onClick={() => setLbRange(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '18px' }}>
          Track your daily completions over the last {lbRange} days.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
          {[
            { label: 'Completed', value: `${myLbEntry?.count || 0}/${lbDays.length}`, color: 'var(--success)' },
            { label: 'Current Streak', value: `${myStreaks.current}d`, color: 'var(--warning)' },
            { label: 'Best Streak', value: `${myStreaks.best}d`, color: 'var(--accent-cyan)' },
            { label: 'Your Rank', value: myRank ? `#${myRank}` : '—', color: 'var(--accent-cyan)' }
          ].map(s => (
            <div key={s.label} style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 800 }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, marginTop: '4px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <h4 style={{ fontSize: '0.9rem', margin: '0 0 10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Standings
        </h4>
        {lbLoading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Loading leaderboard...</p>
        ) : lbBoard.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No approved completions in this period yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {lbBoard.slice(0, 25).map((p, i) => {
              const isMe = p.userId === user?.id
              return (
                <div key={p.userId} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                  borderRadius: '10px',
                  background: isMe ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isMe ? 'rgba(34,211,238,0.35)' : 'var(--border)'}`
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                    background: i < 3 ? ['#fbbf24', '#94a3b8', '#d97706'][i] : 'rgba(255,255,255,0.07)',
                    color: i < 3 ? '#0b051d' : 'var(--text-muted)',
                    fontWeight: 900, fontSize: '0.75rem'
                  }}>{i + 1}</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username}
                    {isMe && <span style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', marginLeft: '6px' }}>YOU</span>}
                  </div>
                  <div style={{ marginLeft: 'auto', fontWeight: 900, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                    {p.count}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <h4 style={{ fontSize: '0.9rem', margin: '24px 0 10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Your Daily Record
        </h4>
        {lbLoading ? (
          <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>Loading...</p>
        ) : lbDays.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>No daily challenges have been set yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lbDays.map(d => {
              const st = myDayStatus(d)
              const approved = d.subs.filter(s => s.status === 'approved')
              const isOpen = expandedDay === d.id
              const badge = st === 'approved'
                ? { icon: '✅', label: 'Completed', color: 'var(--success)', bg: 'rgba(16,185,129,0.12)', bd: 'rgba(16,185,129,0.3)' }
                : st === 'pending'
                  ? { icon: '⏳', label: 'Pending', color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.3)' }
                  : { icon: '❌', label: 'Not submitted', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', bd: 'var(--border)' }
              return (
                <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                  <div
                    onClick={() => setExpandedDay(isOpen ? null : d.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '1rem' }}>{badge.icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}{approved.length} completed
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: badge.color, background: badge.bg, border: `1px solid ${badge.bd}`,
                      padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap'
                    }}>{badge.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '12px 0 8px' }}>{d.description}</p>
                      {approved.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Nobody has completed this one yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {approved.map(s => (
                            <span key={s.id} style={{ fontSize: '0.78rem', padding: '3px 9px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                              ✅ {s.username}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isAdmin && currentChallenge && (
        <div style={{ marginTop: '40px' }}>
          <h2 className="card-title">Completed Today ({submissions.filter(s => s.status === 'approved').length})</h2>
          <div className="card glass" style={{ marginBottom: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Add a player who completed the challenge</label>
              <UserSearchSelect
                users={getAllUsers()}
                selectedId={selectedPlayerId}
                onSelect={handleAddCompletion}
                placeholder="Search players to mark as completed..."
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {submissions.filter(s => s.status === 'approved').map(s => (
              <div key={s.id} className="card glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.username}</div>
                  {s.addedBy && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>added by {s.addedBy}</div>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveCompletion(s)}>Remove</button>
              </div>
            ))}
            {submissions.filter(s => s.status === 'approved').length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No completions added yet.</p>
            )}
          </div>
        </div>
      )}

      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'pointer'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}
          />
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'white',
              color: 'black',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => setPreviewImage(null)}
          >×</button>
        </div>
      )}
    </div>
  )
}
