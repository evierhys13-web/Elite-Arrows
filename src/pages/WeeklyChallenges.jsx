import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, getDocs, collection, query, where, orderBy, limit, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'
import { compressImageToDataUrl } from '../utils/imageUtils'

export default function WeeklyChallenges() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()

  const [activeChallenge, setActiveChallenge] = useState(null)
  const [pastChallenges, setPastChallenges] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [proofImage, setProofImage] = useState('')
  const [submitting, setSubmitting] = useState('')

  const [newChallenge, setNewChallenge] = useState({
    weekLabel: 'Week 1',
    description: '',
    challengeImage: '',
    reward: 'Elite Trophy & Weekly Prize Draw Entry'
  })

  const [expandedProofs, setExpandedProofs] = useState({})

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  const fetchChallenges = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'weeklyChallenges'), orderBy('createdAt', 'desc')))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (list.length > 0) {
        setActiveChallenge(list[0])
        setPastChallenges(list.slice(1))

        const sSnap = await getDocs(query(collection(db, 'weeklyChallengeSubmissions'), where('challengeId', '==', list[0].id)))
        setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else {
        setActiveChallenge(null)
        setPastChallenges([])
        setSubmissions([])
      }
    } catch (e) {
      console.error('Failed to load weekly challenges', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  const handleImagePick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file, 1200, 0.8)
      setProofImage(dataUrl)
      showToast('Proof screenshot attached!', 'success')
    } catch (err) {
      showToast('Failed to process image: ' + err.message, 'error')
    }
  }

  const handleChallengeImagePick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file, 1200, 0.8)
      setNewChallenge(prev => ({ ...prev, challengeImage: dataUrl }))
      showToast('Challenge image attached!', 'success')
    } catch (err) {
      showToast('Failed to process challenge image: ' + err.message, 'error')
    }
  }

  const handleSubmitProof = async () => {
    if (!proofImage || !activeChallenge) return showToast('Please attach proof screenshot', 'error')
    setSubmitting('submitting')
    try {
      const subId = `${activeChallenge.id}_${user.id}`
      const submissionData = {
        id: subId,
        challengeId: activeChallenge.id,
        userId: user.id,
        username: user.username,
        proofImage,
        status: 'pending',
        submittedAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'weeklyChallengeSubmissions', subId), submissionData, { merge: true })
      showToast('Weekly challenge proof submitted for review!', 'success')
      setShowSubmitModal(false)
      setProofImage('')
      const sSnap = await getDocs(query(collection(db, 'weeklyChallengeSubmissions'), where('challengeId', '==', activeChallenge.id)))
      setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      showToast('Submission failed: ' + e.message, 'error')
    } finally {
      setSubmitting('')
    }
  }

  const handleApproveSubmission = async (subId) => {
    try {
      await updateDoc(doc(db, 'weeklyChallengeSubmissions', subId), { status: 'approved' })
      showToast('Submission approved!', 'success')
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'approved' } : s))
    } catch (e) {
      showToast('Failed to approve: ' + e.message, 'error')
    }
  }

  const handleRejectSubmission = async (subId) => {
    try {
      await updateDoc(doc(db, 'weeklyChallengeSubmissions', subId), { status: 'rejected' })
      showToast('Submission rejected', 'info')
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
    } catch (e) {
      showToast('Failed to reject: ' + e.message, 'error')
    }
  }

  const handleCreateChallenge = async () => {
    if (!newChallenge.description) return showToast('Challenge description required', 'error')
    try {
      const id = `week_${Date.now()}`
      const challengeDoc = {
        id,
        ...newChallenge,
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'weeklyChallenges', id), challengeDoc)
      showToast('Weekly Challenge created!', 'success')
      setShowCreateModal(false)
      setNewChallenge({ weekLabel: 'Week ' + (pastChallenges.length + 2), description: '', challengeImage: '', reward: 'Elite Trophy & Weekly Prize Draw Entry' })
      fetchChallenges()
    } catch (e) {
      showToast('Failed to create challenge: ' + e.message, 'error')
    }
  }

  const mySubmission = useMemo(() => {
    return submissions.find(s => String(s.userId) === String(user?.id))
  }, [submissions, user])

  const approvedCompletedCount = useMemo(() => {
    return submissions.filter(s => s.status === 'approved').length
  }, [submissions])

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Weekly Challenges', path: '/weekly-challenges' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ margin: 0 }}>🏆 Weekly Challenges</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
            Complete this week's darting challenge, upload your DartCounter screenshot proof, and compete for rewards!
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            + Create Weekly Challenge
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading weekly challenges...</div>
      ) : activeChallenge ? (
        <div className="card glass" style={{ padding: '28px', borderRadius: '16px', border: '1px solid rgba(251,191,36,0.3)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {activeChallenge.weekLabel || 'Active Week'}
              </span>
            </div>
            <div style={{ background: 'rgba(0, 212, 255, 0.1)', color: 'var(--accent-cyan)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700 }}>
              🎁 {activeChallenge.reward || 'Weekly Reward'}
            </div>
          </div>

          {activeChallenge.challengeImage && (
            <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={activeChallenge.challengeImage} alt="Challenge" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
            </div>
          )}

          <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: '1.6', fontSize: '1rem', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
            {activeChallenge.description}
          </p>

          <div className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Your Status:</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '4px' }}>
                {mySubmission ? (
                  mySubmission.status === 'approved' ? (
                    <span style={{ color: 'var(--success)' }}>✅ Completed & Verified</span>
                  ) : mySubmission.status === 'rejected' ? (
                    <span style={{ color: 'var(--error)' }}>❌ Proof Rejected (Resubmit below)</span>
                  ) : (
                    <span style={{ color: 'var(--warning)' }}>⏳ Pending Admin Review</span>
                  )
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Not Submitted Yet</span>
                )}
              </div>
            </div>

            <div>
              {!mySubmission || mySubmission.status === 'rejected' ? (
                <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
                  📸 Submit Proof Screenshot
                </button>
              ) : mySubmission.status === 'pending' ? (
                <button className="btn btn-secondary" onClick={() => setShowSubmitModal(true)}>
                  🔄 Update Proof
                </button>
              ) : (
                <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.9rem' }}>🎉 Well Done! You earned this week's entry.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card glass" style={{ textAlign: 'center', padding: '50px', borderRadius: '16px', marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>No active weekly challenge set yet.</h3>
          {isAdmin && (
            <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={() => setShowCreateModal(true)}>
              Create First Weekly Challenge
            </button>
          )}
        </div>
      )}

      {/* Submissions / Hall of Completed Members */}
      <div className="card glass" style={{ padding: '24px', borderRadius: '16px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'white' }}>
          🏅 Completed This Week ({approvedCompletedCount})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {submissions.filter(s => s.status === 'approved').map(sub => (
            <div key={sub.id} className="glass" style={{ padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{sub.username}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--success)' }}>Verified {new Date(sub.submittedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {approvedCompletedCount === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1' }}>No verified completions yet this week. Be the first!</p>
          )}
        </div>
      </div>

      {/* Admin Review Section */}
      {isAdmin && submissions.length > 0 && (
        <div className="card glass" style={{ padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: '#f87171' }}>
            🛡️ Admin Review: Weekly Submissions ({submissions.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.map(sub => (
              <div key={sub.id} className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{sub.username}</div>
                  <div style={{ fontSize: '0.75rem', color: sub.status === 'approved' ? 'var(--success)' : sub.status === 'rejected' ? 'var(--error)' : 'var(--warning)', fontWeight: 700 }}>
                    Status: {sub.status.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Submitted: {new Date(sub.submittedAt).toLocaleString()}</div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {sub.proofImage && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedProofs(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                    >
                      {expandedProofs[sub.id] ? 'Hide Proof' : '🖼️ View Proof'}
                    </button>
                  )}
                  {sub.status !== 'approved' && (
                    <button className="btn btn-success btn-sm" onClick={() => handleApproveSubmission(sub.id)}>Approve</button>
                  )}
                  {sub.status !== 'rejected' && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleRejectSubmission(sub.id)}>Reject</button>
                  )}
                </div>

                {expandedProofs[sub.id] && sub.proofImage && (
                  <div style={{ width: '100%', marginTop: '10px' }}>
                    <img src={sub.proofImage} alt="Proof" style={{ width: '100%', maxWidth: '400px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Proof Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '28px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px' }}>Submit Weekly Proof</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Upload a clear screenshot of your DartCounter match or achievement showing you completed this week's challenge.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Proof Screenshot</label>
              <input type="file" accept="image/*" onChange={handleImagePick} className="glass" style={{ width: '100%', padding: '10px' }} />
              {proofImage && (
                <div style={{ marginTop: '12px' }}>
                  <img src={proofImage} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmitProof} disabled={!proofImage || submitting}>
                {submitting ? 'Submitting...' : 'Send for Review'}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Challenge Modal (Admin) */}
      {showCreateModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
          <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '32px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Create New Weekly Challenge</h3>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Week Label</label>
              <input className="glass" placeholder="e.g. Week 1 (Oct 5 - Oct 11)" value={newChallenge.weekLabel} onChange={e => setNewChallenge({ ...newChallenge, weekLabel: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Challenge Image / Banner</label>
              <input type="file" accept="image/*" onChange={handleChallengeImagePick} className="glass" style={{ width: '100%', padding: '10px' }} />
              {newChallenge.challengeImage && (
                <div style={{ marginTop: '10px' }}>
                  <img src={newChallenge.challengeImage} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Description & Rules</label>
              <textarea className="glass" rows={5} placeholder="Detailed instructions for players..." value={newChallenge.description} onChange={e => setNewChallenge({ ...newChallenge, description: e.target.value })} style={{ width: '100%', padding: '10px' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Reward / Prize</label>
              <input className="glass" placeholder="e.g. £20 Prize Pool Entry" value={newChallenge.reward} onChange={e => setNewChallenge({ ...newChallenge, reward: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateChallenge}>Publish Challenge</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
