import { useState, useEffect } from 'react'
import { db, collection, query, orderBy, getDocs, doc, updateDoc, increment, limit } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function GlobalHighlightReel() {
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewImage, setPreviewImage] = useState(null)

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
        Moment Captured
      </div>
    )
  }

  if (loading) return null

  if (highlights.length === 0) return null

  return (
    <div className="card glass animate-fade-in-up stagger-item" style={{ marginBottom: '20px', padding: '24px' }}>
      <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>🎬</span> Community Highlights
      </h3>

      <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', paddingBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="no-scrollbar">
        {highlights.map(h => (
          <div key={h.id} style={{ minWidth: '240px', maxWidth: '240px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '100%', background: '#000' }}>
              {renderMedia(h)}
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                {h.username}
              </div>
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
