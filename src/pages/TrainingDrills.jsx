import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import Breadcrumbs from '../components/Breadcrumbs'
import { DRILLS, DRILL_CATEGORIES, getCategory } from '../training/drills'
import { getTrainingProgress, toggleDrillDone } from '../training/progress'

export default function TrainingDrills() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [openDrill, setOpenDrill] = useState(null)
  const progress = getTrainingProgress(user?.id)

  const drills = filter === 'all' ? DRILLS : DRILLS.filter(d => d.category === filter)
  const completedCount = progress.completedDrills.length

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy', path: '/training' }, { label: 'Drill Library' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.9rem' }}>Drill Library</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '560px', lineHeight: '1.6' }}>
            Structured drills for raising your average, each with targets for every level. Tap a drill to expand it, mark it done when you complete it.
          </p>
        </div>
        <Link to="/training" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>← Academy</Link>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All ({DRILLS.length})</button>
        {Object.values(DRILL_CATEGORIES).map(cat => (
          <button key={cat.id} className={`btn btn-sm ${filter === cat.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(cat.id)}>
            {cat.icon} {cat.label} ({DRILLS.filter(d => d.category === cat.id).length})
          </button>
        ))}
        {completedCount > 0 && <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>✓ {completedCount} completed</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {drills.map(drill => {
          const cat = getCategory(drill.category)
          const isDone = progress.completedDrills.includes(drill.id)
          const isOpen = openDrill === drill.id
          return (
            <div key={drill.id} className="card glass" style={{ padding: '0', overflow: 'hidden', border: isDone ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border)' }}>
              <div style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }} onClick={() => setOpenDrill(isOpen ? null : drill.id)}>
                <div style={{ minWidth: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', background: 'rgba(255,255,255,0.06)' }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800 }}>{drill.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: `${cat.color}18`, color: cat.color, border: `1px solid ${cat.color}44` }}>{cat.label}</span>
                    {isDone && <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--success)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{drill.summary}</div>
                </div>
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
              </div>

              {isOpen && (
                <div className="animate-fade-in" style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ paddingTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>How to</div>
                      <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.88rem' }}>
                        {drill.howTo.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>Targets</div>
                      <div style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
                        <div><strong style={{ color: '#4da8da' }}>Beginner:</strong> {drill.targets.beginner}</div>
                        <div><strong style={{ color: '#22c55e' }}>Intermediate:</strong> {drill.targets.intermediate}</div>
                        <div><strong style={{ color: '#fbbf24' }}>Advanced:</strong> {drill.targets.advanced}</div>
                      </div>
                      {drill.targets.professional && <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}><strong style={{ color: '#ef4444' }}>Professional:</strong> {drill.targets.professional}</div>}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px', lineHeight: '1.6' }}><strong>Why it works:</strong> {drill.why}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Source: {drill.coachRef} • ~{drill.minutes} min</span>
                    <button className={`btn btn-sm ${isDone ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleDrillDone(user?.id, drill.id)}>
                      {isDone ? '✓ Done — undo' : 'Mark as done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {drills.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No drills in this category yet.</p>}
      </div>

      <div style={{ marginTop: '28px', textAlign: 'center', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/practice')}>🎯 Open Practice Hub</button>
        <button className="btn btn-secondary" onClick={() => navigate('/training')}>← Back to Academy</button>
      </div>
    </div>
  )
}