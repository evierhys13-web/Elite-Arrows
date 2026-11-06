import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, getDocs, collection, query, orderBy, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'
import { compressImageToDataUrl } from '../utils/imageUtils'

export default function JDCChallenge() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()

  const allUsers = getAllUsers() || []

  const [doublesTeams, setDoublesTeams] = useState([])

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

  // Filter players competing in singles league or doubles league
  const leaguePlayers = useMemo(() => {
    const doublesPlayerIds = new Set()
    doublesTeams.forEach(t => {
      if (t.p1Id) doublesPlayerIds.add(String(t.p1Id))
      if (t.p2Id) doublesPlayerIds.add(String(t.p2Id))
    })

    return allUsers.filter(u => {
      const inSingles = u.division && u.division !== 'Unassigned' && u.division !== 'Admin'
      const inDoubles = doublesPlayerIds.has(String(u.id))
      return inSingles || inDoubles
    })
  }, [allUsers, doublesTeams])

  const [jdcResults, setJdcResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualPlayerId, setManualPlayerId] = useState('')
  const [manualScore, setManualScore] = useState('')
  const [manual180s, setManual180s] = useState('0')
  const [manualCheckout, setManualCheckout] = useState('0')

  const [submissionForm, setSubmissionForm] = useState({
    score: '',
    p1_180s: '0',
    p1_checkout: '0',
    proofImage: '',
    notes: ''
  })

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  const fetchJdcResults = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'jdcResults'))
      const resultsMap = {}
      snap.docs.forEach(d => {
        resultsMap[d.id] = { id: d.id, ...d.data() }
      })
      setJdcResults(resultsMap)
    } catch (e) {
      console.error('Failed to load JDC results', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJdcResults()
  }, [fetchJdcResults])

  const handleProofImagePick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file, 1200, 0.8)
      setSubmissionForm(prev => ({ ...prev, proofImage: dataUrl }))
      showToast('Proof screenshot attached!', 'success')
    } catch (err) {
      showToast('Failed to process proof image: ' + err.message, 'error')
    }
  }

  const handleSubmitScore = async () => {
    if (!user || !user.id) return
    if (submissionForm.score === '') return showToast('Please enter your JDC Challenge score', 'error')

    try {
      const resultId = String(user.id)
      const data = {
        userId: user.id,
        username: user.username || user.name || 'Player',
        division: user.division || 'Elite',
        score: parseInt(submissionForm.score) || 0,
        '180s': parseInt(submissionForm.p1_180s) || 0,
        checkout: parseInt(submissionForm.p1_checkout) || 0,
        proofImage: submissionForm.proofImage || null,
        notes: submissionForm.notes || '',
        updatedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'jdcResults', resultId), data, { merge: true })
      showToast('JDC Challenge result submitted successfully!', 'success')
      setShowSubmitModal(false)
      setSubmissionForm({ score: '', p1_180s: '0', p1_checkout: '0', proofImage: '', notes: '' })
      fetchJdcResults()
    } catch (e) {
      showToast('Failed to submit JDC result: ' + e.message, 'error')
    }
  }

  const handleManualEntry = async () => {
    if (!manualPlayerId || manualScore === '') return showToast('Please select a player and enter a score', 'error')
    const targetUser = allUsers.find(u => String(u.id) === String(manualPlayerId))
    if (!targetUser) return showToast('Player not found', 'error')

    try {
      const resultId = String(targetUser.id)
      const data = {
        userId: targetUser.id,
        username: targetUser.username || targetUser.name || 'Player',
        division: targetUser.division || 'Elite',
        score: parseInt(manualScore) || 0,
        '180s': parseInt(manual180s) || 0,
        checkout: parseInt(manualCheckout) || 0,
        proofImage: null,
        notes: 'Admin manual entry',
        updatedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'jdcResults', resultId), data, { merge: true })
      showToast(`JDC score updated for ${targetUser.username}!`, 'success')
      setShowManualModal(false)
      setManualPlayerId('')
      setManualScore('')
      setManual180s('0')
      setManualCheckout('0')
      fetchJdcResults()
    } catch (e) {
      showToast('Failed to save manual score: ' + e.message, 'error')
    }
  }

  // Build full leaderboard including ONLY league players (singles and doubles league)
  const leaderboard = useMemo(() => {
    return leaguePlayers.map(player => {
      const res = jdcResults[String(player.id)] || {}
      return {
        id: player.id,
        username: player.username || player.name || 'Player',
        division: player.division || 'Elite',
        profilePicture: player.profilePicture || null,
        score: res.score !== undefined ? Number(res.score) : 0,
        hasPlayed: res.score !== undefined,
        '180s': res['180s'] || 0,
        checkout: res.checkout || 0,
        proofImage: res.proofImage || null,
        notes: res.notes || '',
        updatedAt: res.updatedAt || null
      }
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.username.localeCompare(b.username)
    })
  }, [leaguePlayers, jdcResults])

  const myResult = jdcResults[String(user?.id)]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '100px' }} className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'JDC Challenge', path: '/weekly-challenges' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>🎯 JDC Challenge Leaderboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Official JDC Challenge standings for Singles & Doubles League competitors!</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => {
            if (myResult) {
              setSubmissionForm({
                score: String(myResult.score ?? ''),
                p1_180s: String(myResult['180s'] ?? '0'),
                p1_checkout: String(myResult.checkout ?? '0'),
                proofImage: myResult.proofImage || '',
                notes: myResult.notes || ''
              })
            }
            setShowSubmitModal(true)
          }}>
            {myResult ? '✏️ Update My Result' : '➕ Submit My JDC Result'}
          </button>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowManualModal(true)}>
              ⚙️ Admin Entry
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card glass" style={{ padding: '20px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="card-title" style={{ margin: '0 0 6px', color: 'var(--accent-cyan)' }}>JDC Routine & Rules</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Complete the official JDC Routine, submit your score, and compete against all Singles & Doubles League competitors on the live leaderboard!
            </p>
          </div>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>League Competitors</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{leaguePlayers.length}</div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Card */}
      <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏆 Live Standings</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Updated in real-time</span>
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No league competitors found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.map((player, idx) => (
              <div key={player.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: '14px',
                background: idx === 0 ? 'rgba(251, 191, 36, 0.12)' : idx === 1 ? 'rgba(156, 163, 175, 0.1)' : idx === 2 ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255,255,255,0.03)',
                border: idx === 0 ? '1px solid rgba(251, 191, 36, 0.4)' : idx === 1 ? '1px solid rgba(156, 163, 175, 0.3)' : idx === 2 ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 900,
                    color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#d97706' : 'var(--text-muted)',
                    width: '32px',
                    textAlign: 'center'
                  }}>
                    {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {player.username}
                      {String(player.id) === String(user?.id) && (
                        <span style={{ fontSize: '0.65rem', background: 'var(--accent-cyan)', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Division: <strong style={{ color: 'var(--text)' }}>{player.division}</strong> | Singles & Doubles Competitor
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: player.hasPlayed ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {player.hasPlayed ? `${player.score} pts` : 'Unplayed'}
                    </div>
                    {player.hasPlayed && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        180s: {player['180s']} | Checkout: {player.checkout}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit / Update Score Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Submit JDC Challenge Result</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Total JDC Score *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 520"
                  value={submissionForm.score}
                  onChange={e => setSubmissionForm({ ...submissionForm, score: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>180s</label>
                  <input
                    type="number"
                    className="form-input"
                    value={submissionForm.p1_180s}
                    onChange={e => setSubmissionForm({ ...submissionForm, p1_180s: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>High Checkout</label>
                  <input
                    type="number"
                    className="form-input"
                    value={submissionForm.p1_checkout}
                    onChange={e => setSubmissionForm({ ...submissionForm, p1_checkout: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Proof Screenshot (Optional)</label>
                <input type="file" accept="image/*" onChange={handleProofImagePick} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
                {submissionForm.proofImage && <img src={submissionForm.proofImage} alt="Preview" style={{ width: '100%', height: '100px', objectFit: 'contain', marginTop: '8px', borderRadius: '8px' }} />}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notes / Breakdown</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Completed routine cleanly"
                  value={submissionForm.notes}
                  onChange={e => setSubmissionForm({ ...submissionForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmitScore}>Save Result</button>
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
                <UserSearchSelect users={leaguePlayers} selectedUserId={manualPlayerId} onSelect={setManualPlayerId} placeholder="Search league competitor..." />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>JDC Score</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 480"
                  value={manualScore}
                  onChange={e => setManualScore(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>180s</label>
                  <input type="number" className="form-input" value={manual180s} onChange={e => setManual180s(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Checkout</label>
                  <input type="number" className="form-input" value={manualCheckout} onChange={e => setManualCheckout(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowManualModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleManualEntry}>Save Score</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
