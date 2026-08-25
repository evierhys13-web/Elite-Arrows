import { useState, useEffect } from 'react'
import { db, collection, query, where, orderBy, getDocs, doc, updateDoc, increment } from '../firebase'
import { useAuth } from '../context/AuthContextInternal'

export default function HighlightReel({ userId, isAdmin = false }) {
  const { user } = useAuth()
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'highlights'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Error fetching highlights:', e)
      }
      setLoading(false)
    }
    if (userId) fetchHighlights()
  }, [userId])

  const handleLike = async (highlightId) => {
    try {
      const ref = doc(db, 'highlights', highlightId)
      await updateDoc(ref, {
        likes: increment(1)
      })
      setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, likes: (h.likes || 0) + 1 } : h))
    } catch (e) {
      console.error(e)
    }
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
        Video Processing...
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>

  if (highlights.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎬</div>
        <p>No high finish videos yet. Submit your best finishes from the "Submit Result" page!</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
      {highlights.map(h => (
        <div key={h.id} className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
            {renderMedia(h)}
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{h.title || 'Darts Highlight'}</h4>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleLike(h.id)}
                style={{ borderRadius: '99px', padding: '4px 12px' }}
              >
                ❤️ {h.likes || 0}
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(h.createdAt).toLocaleDateString()} • {h.type || '180'}
            </div>
          </div>
        </div>
      ))}

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
