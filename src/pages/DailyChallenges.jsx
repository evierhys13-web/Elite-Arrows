import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc, getDocs, collection, query, where, orderBy, limit, storage, ref, uploadBytesResumable, getDownloadURL, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function DailyChallenges() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [currentChallenge, setCurrentChallenge] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', date: new Date().toISOString().split('T')[0] })
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
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
  }

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

  const handleVideoSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        showToast('Video is too large (max 50MB)', 'error')
        return
      }
      setVideoFile(file)
      setVideoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmitSubmission = async () => {
    if (!videoFile || !currentChallenge) return
    setLoading(true)
    setUploadProgress(0)

    try {
      const storageRef = ref(storage, `dailyChallengeSubmissions/${user.id}_${Date.now()}_${videoFile.name}`)
      const uploadTask = uploadBytesResumable(storageRef, videoFile)

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          showToast('Upload failed: ' + error.message, 'error')
          setLoading(false)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          const id = Date.now().toString()
          await setDoc(doc(db, 'dailyChallengeSubmissions', id), {
            id,
            challengeId: currentChallenge.id,
            challengeTitle: currentChallenge.title,
            userId: user.id,
            username: user.username,
            videoUrl: downloadURL,
            status: 'pending',
            submittedAt: new Date().toISOString()
          })
          showToast('Challenge video submitted!', 'success')
          setShowSubmitModal(false)
          setVideoFile(null)
          setVideoPreview(null)
          fetchData()
        }
      )
    } catch (e) {
      showToast(e.message, 'error')
      setLoading(false)
    }
  }

  const handleApprove = async (sub) => {
    try {
      await updateDoc(doc(db, 'dailyChallengeSubmissions', sub.id), { status: 'approved' })
      showToast('Submission approved', 'success')
      fetchData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleReject = async (sub) => {
    if (!window.confirm('Reject this submission?')) return
    try {
      await deleteDoc(doc(db, 'dailyChallengeSubmissions', sub.id))
      showToast('Submission rejected', 'success')
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

          {userSub ? (
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: userSub.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: userSub.status === 'approved' ? 'var(--success)' : 'var(--warning)',
              border: `1px solid ${userSub.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                {userSub.status === 'approved' ? '✅' : '⏳'}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {userSub.status === 'approved' ? 'Challenge Completed' : 'Submission Pending Review'}
              </div>
              <p style={{ fontSize: '0.9rem', marginTop: '8px', opacity: 0.8 }}>
                {userSub.status === 'approved' ? 'Great job! You have completed today\'s challenge.' : 'Hang tight! An admin will review your video soon.'}
              </p>
            </div>
          ) : (
            <button className="btn btn-primary btn-block btn-lg" onClick={() => setShowSubmitModal(true)}>
              Submit Video Proof
            </button>
          )}
        </div>
      )}

      {isAdmin && submissions.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2 className="card-title">Submissions for Today</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {submissions.map(s => (
              <div key={s.id} className="card glass">
                <video src={s.videoUrl} controls style={{ width: '100%', borderRadius: '8px', marginBottom: '12px', maxHeight: '200px', background: '#000' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(s.submittedAt).toLocaleTimeString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {s.status === 'pending' ? (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(s)}>Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(s)}>Reject</button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>APPROVED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowSubmitModal(false)}>
          <div className="card glass" style={{ maxWidth: '600px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Submit Video Proof</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Upload a video of you completing: <strong>{currentChallenge?.title}</strong></p>

            <div className="form-group">
              <label>Video File (Max 50MB)</label>
              <input type="file" accept="video/*" onChange={handleVideoSelect} capture="environment" />
            </div>

            {videoPreview && (
              <div style={{ marginBottom: '20px' }}>
                <video src={videoPreview} controls style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', background: '#000' }} />
              </div>
            )}

            {uploadProgress > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent-cyan)', transition: 'width 0.3s ease' }} />
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '5px' }}>Uploading: {Math.round(uploadProgress)}%</p>
              </div>
            )}

            <button className="btn btn-primary btn-block" onClick={handleSubmitSubmission} disabled={!videoFile || loading}>
              {loading ? 'Submitting...' : 'Submit Video'}
            </button>
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
