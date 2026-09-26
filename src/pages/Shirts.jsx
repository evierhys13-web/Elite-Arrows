import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db, collection, getDocs } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'

const DEFAULT_LINK = 'https://www.barbarc.com'

export default function Shirts() {
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchDesigns = async () => {
      try {
        const snap = await getDocs(collection(db, 'shirtDesigns'))
        if (!active) return
        setDesigns(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.visible !== false)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
      } catch (e) {
        console.error('Failed to fetch shirt designs', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchDesigns()
    return () => { active = false }
  }, [])

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Dart Shirts' }]} />

      <div className="page-header" style={{ marginBottom: '28px', textAlign: 'center' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.3rem' }}>
          👕 Elite Arrows Shirts
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '560px', margin: '8px auto 0' }}>
          Official dart shirt designs. Tap a design below to view it and order through our partner store.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>Loading designs…</div>
      ) : designs.length === 0 ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👕</div>
          <h3 style={{ margin: '0 0 6px' }}>New shirt designs coming soon</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            The admin team is working on the next drop. Check back shortly!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
          {designs.map(design => {
            const link = design.linkUrl?.trim() || DEFAULT_LINK
            return (
              <a
                key={design.id}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="glass"
                style={{
                  textDecoration: 'none', borderRadius: '16px', overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer',
                  height: '100%', background: 'rgba(255,255,255,0.02)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,212,255,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {design.imageUrl ? (
                  <div style={{ aspectRatio: '4 / 4.6', overflow: 'hidden', background: '#0b0f1e' }}>
                    <img src={design.imageUrl} alt={design.title || 'Dart shirt design'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  </div>
                ) : (
                  <div style={{ aspectRatio: '4 / 4.6', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(0,212,255,0.12))', fontSize: '3rem' }}>👕</div>
                )}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div style={{ fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>{design.title || 'Elite Arrows Shirt'}</div>
                  {design.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '4px' }}>{design.description}</div>}
                  <div style={{ marginTop: 'auto', alignSelf: 'flex-start', background: 'linear-gradient(135deg, #ec4899, #00d4ff)', color: 'white', fontWeight: 800, fontSize: '0.75rem', padding: '8px 14px', borderRadius: '999px', letterSpacing: '0.3px' }}>
                    View &amp; Order ➔
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Designed by the Elite Arrows community · Ordered via <Link to="/shirts" style={{ color: 'var(--accent-cyan)' }}>{DEFAULT_LINK.replace('https://', '').replace('www.', '')}</Link>
      </div>
    </div>
  )
}