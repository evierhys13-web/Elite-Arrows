import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, getDocs, collection, query, where, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function Challenges() {
  const { user, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()

  const [challenges, setChallenges] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(null)

  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', reward: 'Entry into Christmas Giveaway Draw' })
  const [submissionProof, setSubmissionProof] = useState('')

  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin

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
    setNewChallenge({ title: '', description: '', reward: 'Entry into Christmas Giveaway Draw' })
    showToast('Challenge created!', 'success')
  }

  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDimension = 800
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
          canvas.width = image.width * scale
          canvas.height = image.height * scale
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          callback(canvas.toDataURL('image/jpeg', 0.7))
        }
        image.src = reader.result
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitProof = async () => {
    if (!submissionProof || !showSubmitModal) return
    const id = Date.now().toString()
    const submission = {
      id,
      challengeId: showSubmitModal.id,
      challengeTitle: showSubmitModal.title,
      userId: user.id,
      username: user.username,
      proofImage: submissionProof,
      status: 'pending',
      submittedAt: new Date().toISOString()
    }
    await setDoc(doc(db, 'challengeSubmissions', id), submission)
    setSubmissions([...submissions, submission])
    setShowSubmitModal(null)
    setSubmissionProof('')
    showToast('Proof submitted for review!', 'success')
  }

  const handleApproveSubmission = async (sub) => {
    await updateDoc(doc(db, 'challengeSubmissions', sub.id), { status: 'approved' })

    // Also mark user as entered into draw if not already
    await updateDoc(doc(db, 'users', sub.userId), { christmasDrawEntered: true })

    setSubmissions(submissions.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s))
    showToast(`${sub.username} entered into draw!`, 'success')
  }

  const handleDeleteChallenge = async (id) => {
    if (!window.confirm('Delete this challenge?')) return
    await updateDoc(doc(db, 'challenges', id), { _deleted: true })
    setChallenges(challenges.filter(c => c.id !== id))
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {challenges.map(c => {
          const userSub = submissions.find(s => s.challengeId === c.id && s.userId === user.id)
          return (
            <div key={c.id} className="card glass" style={{ borderLeft: userSub?.status === 'approved' ? '4px solid var(--success)' : 'none' }}>
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
          )
        })}
      </div>

      {isAdmin && submissions.filter(s => s.status === 'pending').length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2 className="card-title">Pending Approvals</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} className="card glass" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <img src={s.proofImage} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} onClick={() => window.open(s.proofImage)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{s.username}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Challenge: {s.challengeTitle}</div>
                </div>
                <button className="btn btn-success btn-sm" onClick={() => handleApproveSubmission(s)}>Approve</button>
                <button className="btn btn-danger btn-sm" onClick={async () => { await deleteDoc(doc(db, 'challengeSubmissions', s.id)); setSubmissions(submissions.filter(x => x.id !== s.id)); }}>Reject</button>
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
              <label>Proof Image (DartCounter screenshot, etc.)</label>
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setSubmissionProof)} />
              {submissionProof && <img src={submissionProof} style={{ width: '100%', height: '200px', objectFit: 'contain', marginTop: '10px', borderRadius: '8px' }} />}
            </div>
            <button className="btn btn-primary btn-block" onClick={handleSubmitProof} disabled={!submissionProof}>Submit for Review</button>
          </div>
        </div>
      )}
    </div>
  )
}
