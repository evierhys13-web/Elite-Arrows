import { useState, useEffect } from 'react'
import { db, storage, collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, limit, ref, uploadBytesResumable, getDownloadURL } from '../firebase'
import { useAuth } from '../context/AuthContextInternal'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function GlobalHighlightReel() {
  const { user, getAllUsers, searchUsers } = useAuth()
  const { showToast } = useToast()
  const allUsers = getAllUsers() || []

  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewImage, setPreviewImage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [form, setForm] = useState({ player: '', title: '', type: 'High Checkout', videoUrl: '' })

  const isAdmin = Boolean(
    user && (
      ADMIN_EMAILS.includes(user?.email?.toLowerCase()) ||
      user.isAdmin || user.isTournamentAdmin || user.isCupAdmin
    )
  )

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'highlights'),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
        const snap = await getDocs(q)
        setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Error fetching global highlights:', e)
      }
      setLoading(false)
    }
    fetchHighlights()
  }, [])

  const handleLike = async (highlightId) => {
    try {
      const ref2 = doc(db, 'highlights', highlightId)
      await updateDoc(ref2, {
        likes: increment(1)
      })
      setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, likes: (h.likes || 0) + 1 } : h))
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this highlight?')) return
    try {
      await deleteDoc(doc(db, 'highlights', id))
      setHighlights(prev => prev.filter(h => h.id !== id))
      showToast('Highlight removed', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return showToast('Video too large (max 50MB)', 'error')

    setUploading(true)
    setUploadProgress(1)
    const hlId = `admin_hl_${Date.now()}`
    const storageRef = ref(storage, `highlights/${hlId}.mp4`)
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on('state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (error) => {
        showToast('Upload failed: ' + error.message, 'error')
        setUploading(false)
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        setForm(prev => ({ ...prev, videoUrl: url }))
        setUploading(false)
        showToast('Video uploaded!', 'success')
      }
    )
  }

  const handleAdd = async () => {
    if (!form.videoUrl || !form.player) return showToast('Player and video required', 'error')
    setSaving(true)
    try {
      const target = allUsers.find(p => p.id === form.player)
      const highlightId = `hl_${Date.now()}`
      const newHighlight = {
        id: highlightId,
        userId: target.id,
        username: target.username,
        title: form.title || `High Finish by ${target.username}`,
        videoUrl: form.videoUrl,
        type: form.type,
        likes: 0,
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'highlights', highlightId), newHighlight)
      setHighlights(prev => [newHighlight, ...prev])
      showToast('Highlight added!', 'success')
      setForm({ player: '', title: '', type: 'High Checkout', videoUrl: '' })
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const renderMedia = (h) => {
    const isLink = h.videoUrl && (h.videoUrl.includes('youtube.com') || h.videoUrl.includes('youtu.be') || h.videoUrl.includes('tiktok.com'))

    if (isLink) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
          <a href={h.videoUrl} target="_blank" rel="noreferrer" style={{ textAlign: 'center', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔗</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>View External Highlight</div>
          </a>
        </div>
      )
    }

    if (h.videoUrl) {
      return (
        <video
          src={h.videoUrl}
          controls
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )
    }

    if (h.imageUrl) {
        return (
            <img
                src={h.imageUrl}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                onClick={() => setPreviewImage(h.imageUrl)}
            />
        )
    }

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Moment Captured
      </div>
    )
  }

  if (loading) return null

  return (
    <div className="card glass animate-fade-in-up stagger-item" style={{ marginBottom: '20px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🎬</span> High Finish Videos
        </h3>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Video'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="glass" style={{ padding: '18px', borderRadius: '12px', marginBottom: '18px', border: '1px solid var(--accent-primary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Player</label>
              <select className="glass" value={form.player} onChange={e => setForm({ ...form, player: e.target.value })}>
                <option value="">Select player...</option>
                {allUsers.filter(u => u.username).map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Type</label>
              <select className="glass" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="180">180</option>
                <option value="High Checkout">High Checkout</option>
                <option value="Match Winning Double">Match Winning Double</option>
                <option value="Epic Comeback">Epic Round</option>
              </select>
            </div>
          </div>
          <input
            className="glass"
            placeholder="Title (e.g. Insane 170 Checkout!)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={{ marginTop: '12px' }}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
            <input type="file" accept="video/mp4,video/*" onChange={handleVideoUpload} style={{ fontSize: '0.8rem' }} />
            {uploading && <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.8rem' }}>{uploadProgress}%</span>}
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: '12px' }}
            onClick={handleAdd}
            disabled={saving || uploading || !form.videoUrl || !form.player}
          >
            {saving ? 'Saving...' : 'Add to Home'}
          </button>
        </div>
      )}

      {highlights.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No highlights yet.</p>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', paddingBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="no-scrollbar">
          {highlights.map(h => (
            <div key={h.id} style={{ minWidth: '240px', maxWidth: '240px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', width: '100%', paddingTop: '100%', background: '#000' }}>
                {renderMedia(h)}
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                  {h.username}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(h.id)}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(220,38,38,0.8)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{h.title || 'Amazing Shot'}</div>
                  <button
                    onClick={() => handleLike(h.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    ❤️ {h.likes || 0}
                  </button>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{h.type || 'Match Clip'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewImage && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
          <button
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', color: 'black', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => setPreviewImage(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
