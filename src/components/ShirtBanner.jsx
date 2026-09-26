import { Link } from 'react-router-dom'

export default function ShirtBanner() {
  return (
    <Link to="/shirts" style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="glass animate-fade-in-up"
        style={{
          marginBottom: '20px', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
          background: 'linear-gradient(120deg, rgba(236,72,153,0.28), rgba(0,212,255,0.22), rgba(139,92,246,0.26))',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '26px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <div style={{ transition: 'transform 0.2s ease' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white', letterSpacing: '0.3px' }}>
            👕 Elite Arrows Shirts
          </div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>
            Official dart shirt designs — new drops from the community
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.14)', color: 'white', fontWeight: 800, fontSize: '0.8rem',
            padding: '10px 18px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
          }}
        >
          View Designs ➔
        </div>
      </div>
    </Link>
  )
}