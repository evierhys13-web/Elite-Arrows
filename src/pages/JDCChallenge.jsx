import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, getDocs, collection, query, where, orderBy, limit, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'
import { compressImageToDataUrl } from '../utils/imageUtils'

export default function JDCChallenge() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()

  const allUsers = getAllUsers() || []

  const [activeChallenge, setActiveChallenge] = useState(null)
  const [pastChallenges, setPastChallenges] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showManualAddModal, setShowManualAddModal] = useState(false)
  const [manualPlayerId, setManualPlayerId] = useState('')
  const [manualScore, setManualScore] = useState('')

  const [newChallenge, setNewChallenge] = useState({
    weekLabel: 'JDC Challenge 1',
    description: 'JDC Routine: Around the Clock / Shanghai / 121 (Standard JDC Scoring)',
    challengeImage: '',
    reward: 'Elite JDC Trophy & Prize Draw Entry'
  })

  const [submissionForm, setSubmissionForm] = useState({
    score: '',
    p1_180s: '0',
    p1_checkout: '0',
    proofImage: '',
    notes: ''
  })

  const [expandedProofs, setExpandedProofs] = useState({})

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  const fetchChallenges = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'jdcChallenges'), orderBy('createdAt', 'desc')))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (list.length > 0) {
        setActiveChallenge(list[0])
        setPastChallenges(list.slice(1))

        const sSnap = await getDocs(query(collection(db, 'jdcChallengeSubmissions'), where('challengeId', '==', list[0].id)))
        setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else {
        setActiveChallenge(null)
        setPastChallenges([])
        setSubmissions([])
      }
    } catch (e) {
      console.error('Failed to load JDC challenges', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  const handleChallengeImagePick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file, 1200, 0.8)
      setNewChallenge(prev => ({ ...prev, challengeImage: dataUrl }))
      showToast('Challenge image attached!', 'success')
    } catch (err) {
      showToast('Failed to process image: ' + err.message, 'error')
    }
  }

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
    if (!activeChallenge) return
    if (!submissionForm.score) return showToast('Please enter your JDC score', 'error')

    try {
      const subId = `${activeChallenge.id}_${user.id}`
      const submissionData = {
        id: subId,
        challengeId: activeChallenge.id,
        userId: user.id,
        username: user.username || user.name || 'Player',
        score: parseInt(submissionForm.score) || 0,
        '180s': parseInt(submissionForm.p1_180s) || 0,
        checkout: parseInt(submissionForm.p1_checkout) || 0,
        proofImage: submissionForm.proofImage || null,
        notes: submissionForm.notes || '',
        status: 'pending',
        submittedAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'jdcChallengeSubmissions', subId), submissionData, { merge: true })
      showToast('JDC score submitted for review!', 'success')
      setShowSubmitModal(false)
      setSubmissionForm({ score: '', p1_180s: '0', p1_checkout: '0', proofImage: '', notes: '' })

      const sSnap = await getDocs(query(collection(db, 'jdcChallengeSubmissions'), where('challengeId', '==', activeChallenge.id)))
      setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      showToast('Failed to submit score: ' + e.message, 'error')
    }
  }

  const handleApproveSubmission = async (subId) => {
    try {
      await updateDoc(doc(db, 'jdcChallengeSubmissions', subId), { status: 'approved' })
      showToast('Submission approved!', 'success')
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'approved' } : s))
    } catch (e) {
      showToast('Failed to approve: ' + e.message, 'error')
    }
  }

  const handleRejectSubmission = async (subId) => {
    try {
      await updateDoc(doc(db, 'jdcChallengeSubmissions', subId), { status: 'rejected' })
      showToast('Submission rejected', 'info')
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
    } catch (e) {
      showToast('Failed to reject: ' + e.message, 'error')
    }
  }

  const handleManualAddScore = async () => {
    if (!manualPlayerId || !activeChallenge || !manualScore) return showToast('Please select a player and enter a score', 'error')
    const targetUser = allUsers.find(u => String(u.id) === String(manualPlayerId))
    if (!targetUser) return showToast('Player not found', 'error')

    try {
      const subId = `${activeChallenge.id}_${targetUser.id}`
      const submissionData = {
        id: subId,
        challengeId: activeChallenge.id,
        userId: targetUser.id,
        username: targetUser.username || targetUser.name || 'Player',
        score: parseInt(manualScore) || 0,
        '180s': 0,
        checkout: 0,
        proofImage: null,
        manualEntry: true,
        status: 'approved',
        submittedAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'jdcChallengeSubmissions', subId), submissionData, { merge: true })
      showToast(`Added JDC score for ${targetUser.username}!`, 'success')
      setShowManualAddModal(false)
      setManualPlayerId('')
      setManualScore('')
      const sSnap = await getDocs(query(collection(db, 'jdcChallengeSubmissions'), where('challengeId', '==', activeChallenge.id)))
      setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      showToast('Failed to add score: ' + e.message, 'error')
    }
  }

  const handleCreateChallenge = async () => {
    if (!newChallenge.description) return showToast('Challenge description required', 'error')
    try {
      const id = `jdc_${Date.now()}`
      const challengeDoc = {
        id,
        ...newChallenge,
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'jdcChallenges', id), challengeDoc)
      showToast('JDC Challenge created!', 'success')
      setShowCreateModal(false)
      setNewChallenge({ weekLabel: 'JDC Challenge ' + (pastChallenges.length + 2), description: '', challengeImage: '', reward: 'Elite JDC Trophy & Prize Draw Entry' })
      fetchChallenges()
    } catch (e) {
      showToast('Failed to create challenge: ' + e.message, 'error')
    }
  }

  const mySubmission = useMemo(() => {
    return submissions.find(s => String(s.userId) === String(user?.id))
  }, [submissions, user])

  const leaderboard = useMemo(() => {
    return submissions
      .filter(s => s.status === 'approved')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [submissions])

  const pendingSubmissions = useMemo(() => {
    return submissions.filter(s => s.status === 'pending')
  }, [submissions])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '100px' }} className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'JDC Challenge', path: '/weekly-challenges' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>🎯 JDC Challenge</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Submit your JDC routine scores, climb the leaderboard, and win prizes!</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>+ New JDC Challenge</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowManualAddModal(true)}>+ Manual Score Entry</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading JDC Challenge...</div>
      ) : !activeChallenge ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>No Active JDC Challenge</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Check back soon for new JDC routines and challenges!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Active Challenge Details Card */}
          <div className="card glass" style={{ padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase' }}>
                {activeChallenge.weekLabel || 'Active JDC Challenge'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎁 {activeChallenge.reward}</span>
            </div>

            <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '20px', whiteSpace: 'pre-line' }}>{activeChallenge.description}</p>

            {activeChallenge.challengeImage && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={activeChallenge.challengeImage} alt="JDC Challenge" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', display: 'block' }} />
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Your JDC Submission Status:</div>
              {mySubmission ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: mySubmission.status === 'approved' ? 'var(--success)' : mySubmission.status === 'rejected' ? 'var(--error)' : '#fbbf24', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                      {mySubmission.status}
                    </span>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>Score: <strong>{mySubmission.score}</strong></div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSubmitModal(true)}>Update Score</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You haven't submitted a score yet.</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitModal(true)}>Submit Score</button>
                </div>
              )}
            </div>
          </div>

          {/* JDC Leaderboard Card */}
          <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span>🏆 Leaderboard</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{leaderboard.length} Submissions</span>
            </h3>

            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No approved JDC scores yet. Be the first to submit!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {leaderboard.map((item, idx) => (
                  <div key={item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: idx === 0 ? 'rgba(251, 191, 36, 0.1)' : idx === 1 ? 'rgba(156, 163, 175, 0.1)' : idx === 2 ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255,255,255,0.03)',
                    border: idx === 0 ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#d97706' : 'var(--text-muted)', width: '24px' }}>
                        {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.username}</div>
                        {item.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.notes}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{item.score} pts</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>180s: {item['180s'] || 0} | Checkout: {item.checkout || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Review Submissions Section */}
      {isAdmin && pendingSubmissions.length > 0 && (
        <div className="card glass" style={{ padding: '24px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 className="card-title" style={{ color: '#fbbf24', marginBottom: '16px' }}>⏳ Pending JDC Submissions ({pendingSubmissions.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {pendingSubmissions.map(sub => (
              <div key={sub.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{sub.username}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>Score: <strong>{sub.score}</strong></div>
                {sub.proofImage && (
                  <div style={{ marginBottom: '12px' }}>
                    <img src={sub.proofImage} alt="Proof" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setExpandedProofs({ ...expandedProofs, [sub.id]: !expandedProofs[sub.id] })} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-xs" style={{ flex: 1 }} onClick={() => handleApproveSubmission(sub.id)}>Approve</button>
                  <button className="btn btn-danger btn-xs" style={{ flex: 1 }} onClick={() => handleRejectSubmission(sub.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Score Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Submit JDC Challenge Score</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Total JDC Score *</label>
                <input type="number" className="form-input" placeholder="e.g. 520" value={submissionForm.score} onChange={e => setSubmissionForm({ ...submissionForm, score: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>180s</label>
                  <input type="number" className="form-input" value={submissionForm.p1_180s} onChange={e => setSubmissionForm({ ...submissionForm, p1_180s: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>High Checkout</label>
                  <input type="number" className="form-input" value={submissionForm.p1_checkout} onChange={e => setSubmissionForm({ ...submissionForm, p1_checkout: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Proof Screenshot (Optional)</label>
                <input type="file" accept="image/*" onChange={handleProofImagePick} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
                {submissionForm.proofImage && <img src={submissionForm.proofImage} alt="Preview" style={{ width: '100%', height: '100px', objectFit: 'contain', marginTop: '8px', borderRadius: '8px' }} />}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notes / Routine breakdown</label>
                <input type="text" className="form-input" placeholder="e.g. Hit 3 bulls on Shanghai" value={submissionForm.notes} onChange={e => setSubmissionForm({ ...submissionForm, notes: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmitScore}>Submit Score</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create JDC Challenge Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Create New JDC Challenge</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Challenge Title / Week Label</label>
                <input type="text" className="form-input" value={newChallenge.weekLabel} onChange={e => setNewChallenge({ ...newChallenge, weekLabel: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Description & Routine Rules</label>
                <textarea className="form-input" rows={4} value={newChallenge.description} onChange={e => setNewChallenge({ ...newChallenge, description: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Challenge Image / Example</label>
                <input type="file" accept="image/*" onChange={handleChallengeImagePick} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
                {newChallenge.challengeImage && <img src={newChallenge.challengeImage} alt="Preview" style={{ width: '100%', height: '120px', objectFit: 'contain', marginTop: '8px', borderRadius: '8px' }} />}
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Reward / Prize</label>
                <input type="text" className="form-input" value={newChallenge.reward} onChange={e => setNewChallenge({ ...newChallenge, reward: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateChallenge}>Create Challenge</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Score Entry Modal */}
      {showManualAddModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Manual JDC Score Entry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select Player</label>
                <UserSearchSelect users={allUsers} selectedUserId={manualPlayerId} onSelect={setManualPlayerId} placeholder="Search player..." />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>JDC Score</label>
                <input type="number" className="form-input" placeholder="e.g. 480" value={manualScore} onChange={e => setManualScore(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowManualAddModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleManualAddScore}>Add Score</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
