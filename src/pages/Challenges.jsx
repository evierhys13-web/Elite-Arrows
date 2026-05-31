import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, getDocs, collection, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function Challenges() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [challenges, setChallenges] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(null)

  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', reward: 'Entry into Christmas Giveaway Draw', challengeImage: '' })
  const [submissionProofs, setSubmissionProofs] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const cSnap = await getDocs(collection(db, 'challenges'))
      const cData = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setChallenges(cData.filter(c => !c._deleted))

      const sSnap = await getDocs(collection(db, 'challengeSubmissions'))
      setSubmissions(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleCreateChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) return
    const id = Date.now().toString()
    const challenge = {
      ...newChallenge,
      id,
      isActive: true,
      createdAt: new Date().toISOString()
    }
    await setDoc(doc(db, 'challenges', id), challenge)
    setChallenges([...challenges, challenge])
    setShowCreateModal(false)
    setNewChallenge({ title: '', description: '', reward: 'Entry into Christmas Giveaway Draw', challengeImage: '' })
    showToast('Challenge created!', 'success')
  }

  const handleImageUpload = (e, mode = 'submission') => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const processFile = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const image = new Image()
          image.onload = () => {
            const canvas = document.createElement('canvas')
            const maxDimension = 1200
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
            canvas.width = image.width * scale
            canvas.height = image.height * scale
            const ctx = canvas.getContext('2d')
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.7))
          }
          image.src = reader.result
        }
        reader.readAsDataURL(file)
      })
    }

    if (mode === 'submission') {
      const promises = Array.from(files).map(processFile)
      Promise.all(promises).then(results => {
        setSubmissionProofs(prev => [...prev, ...results])
      })
    } else if (mode === 'challenge') {
      processFile(files[0]).then(result => {
        setNewChallenge(prev => ({ ...prev, challengeImage: result }))
      })
    }
  }

  const handleSubmitProof = async () => {
    if (submissionProofs.length === 0 || !showSubmitModal) return
    const id = Date.now().toString()
    const submission = {
      id,
      challengeId: showSubmitModal.id,
      challengeTitle: showSubmitModal.title,
      userId: user.id,
      username: user.username,
      proofImages: submissionProofs,
      status: 'pending',
      submittedAt: new Date().toISOString()
    }
    await setDoc(doc(db, 'challengeSubmissions', id), submission)
    setSubmissions([...submissions, submission])
    setShowSubmitModal(null)
    setSubmissionProofs([])
    showToast('Proof submitted for review!', 'success')
  }

  const handleApproveSubmission = async (sub) => {
    try {
      await updateDoc(doc(db, 'challengeSubmissions', sub.id), { status: 'approved' })

      const updatedSubmissions = submissions.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s)
      setSubmissions(updatedSubmissions)

      const userApprovedChallengeIds = new Set(
        updatedSubmissions
          .filter(s => s.userId === sub.userId && s.status === 'approved')
          .map(s => s.challengeId)
      )
      const activeChallengesCount = challenges.length

      if (userApprovedChallengeIds.size >= activeChallengesCount && activeChallengesCount > 0) {
        await updateDoc(doc(db, 'users', sub.userId), { christmasDrawEntered: true })
        showToast(`${sub.username} completed ALL ${activeChallengesCount} challenges and entered the draw!`, 'success')
      } else {
        showToast(`${sub.username} progress: ${userApprovedChallengeIds.size}/${activeChallengesCount} challenges`, 'success')
      }
    } catch (e) {
      showToast('Error approving submission: ' + e.message, 'error')
    }
  }

  const handleDeleteChallenge = async (id) => {
    if (!window.confirm('Delete this challenge?')) return
    await updateDoc(doc(db, 'challenges', id), { _deleted: true })
    setChallenges(challenges.filter(c => c.id !== id))
  }

  const removeSubmissionProof = (index) => {
    setSubmissionProofs(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Challenges', path: '/challenges' }]} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title text-gradient">Community Challenges</h1>
          <p style={{ color: 'var(--text-muted)' }}>Complete challenges to enter the Christmas Giveaway!</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Create Challenge</button>
        )}
      </div>

      {(() => {
        const userApprovedSubChallengeIds = new Set(
          submissions.filter(s => s.userId === user.id && s.status === 'approved').map(s => s.challengeId)
        )
        const progress = challenges.length > 0 ? (userApprovedSubChallengeIds.size / challenges.length) * 100 : 0

        return (
          <div className="card glass" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-cyan)', marginBottom: '16px' }}>🎁 Christmas Giveaway Progress</h3>
            <div style={{ height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-cyan)', transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ fontSize: '0.9rem', textAlign: 'center' }}>
              {userApprovedSubChallengeIds.size === challenges.length && challenges.length > 0
                ? "🎉 You've completed all challenges! You're in the draw."
                : `Complete all ${challenges.length} challenges to enter the draw! (${userApprovedSubChallengeIds.size}/${challenges.length})`}
            </p>
          </div>
        )
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {challenges.map(c => {
          const userSub = submissions.find(s => s.challengeId === c.id && s.userId === user.id)
          return (
            <div key={c.id} className="card glass" style={{ borderLeft: userSub?.status === 'approved' ? '4px solid var(--success)' : 'none', padding: 0, overflow: 'hidden' }}>
              {c.challengeImage && (
                <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }} onClick={() => setPreviewImage(c.challengeImage)}>
                  <img src={c.challengeImage} alt={c.title} style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '400px' }} />
                </div>
              )}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ color: 'var(--accent-cyan)' }}>{c.title}</h3>
                  {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteChallenge(c.id)}>🗑️</button>}
                </div>
                <p style={{ margin: '12px 0', color: 'var(--text-primary)' }}>{c.description}</p>
                <div className="glass" style={{ padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <strong>🏆 Reward:</strong> {c.reward}
                </div>

                {userSub ? (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: userSub.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: userSub.status === 'approved' ? 'var(--success)' : 'var(--warning)',
                    fontWeight: 700,
                    textAlign: 'center'
                  }}>
                    {userSub.status === 'approved' ? '✅ COMPLETED & ENTERED' : '⏳ PENDING REVIEW'}
                  </div>
                ) : (
                  <button className="btn btn-primary btn-block" onClick={() => setShowSubmitModal(c)}>Submit Proof</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isAdmin && submissions.filter(s => s.status === 'pending').length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2 className="card-title">Pending Approvals</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} className="card glass">
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', marginBottom: '15px', paddingBottom: '10px' }}>
                  {(s.proofImages || (s.proofImage ? [s.proofImage] : [])).map((img, idx) => (
                    <img key={idx} src={img} style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setPreviewImage(img)} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{s.username}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Challenge: {s.challengeTitle}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleApproveSubmission(s)}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Reject?')) return; await deleteDoc(doc(db, 'challengeSubmissions', s.id)); setSubmissions(submissions.filter(x => x.id !== s.id)); }}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="card glass" style={{ maxWidth: '450px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 className="card-title">Create Challenge</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={newChallenge.title} onChange={e => setNewChallenge({...newChallenge, title: e.target.value})} placeholder="e.g. Hit a 180" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={newChallenge.description} onChange={e => setNewChallenge({...newChallenge, description: e.target.value})} placeholder="Describe the challenge..." />
            </div>
            <div className="form-group">
              <label>Challenge Image (Optional Example)</label>
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'challenge')} />
              {newChallenge.challengeImage && (
                <img src={newChallenge.challengeImage} style={{ width: '100%', height: '150px', objectFit: 'contain', marginTop: '10px', borderRadius: '8px' }} />
              )}
            </div>
            <button className="btn btn-primary btn-block" onClick={handleCreateChallenge}>Post Challenge</button>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(null)}>
          <div className="card glass" style={{ maxWidth: '450px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 className="card-title">Submit Proof</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Challenge: {showSubmitModal.title}</p>
            <div className="form-group">
              <label>Proof Images (DartCounter screenshot, etc. - can select multiple)</label>
              <input type="file" accept="image/*" multiple onChange={e => handleImageUpload(e, 'submission')} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginTop: '10px' }}>
                {submissionProofs.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img src={img} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                    <button
                      onClick={() => removeSubmissionProof(idx)}
                      style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer' }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-block" onClick={handleSubmitProof} disabled={submissionProofs.length === 0}>Submit for Review</button>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 2000,
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
