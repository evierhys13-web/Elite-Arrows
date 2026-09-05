import { useState } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import { TIPS } from '../training/tips'
import { getCoach } from '../training/coaches'

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'consistency', label: 'Consistency', icon: '🎯' },
  { id: 'scoring', label: 'Scoring', icon: '📈' },
  { id: 'finishing', label: 'Finishing', icon: '🔥' },
  { id: 'checkouts', label: 'Checkouts', icon: '🧠' },
  { id: 'pressure', label: 'Pressure', icon: '🧊' },
  { id: 'mindset', label: 'Mindset', icon: '🧘' },
  { id: 'equipment', label: 'Equipment', icon: '🎒' }
]

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))

export default function TrainingTips() {
  const [filter, setFilter] = useState('all')
  const tips = filter === 'all' ? TIPS : TIPS.filter(t => t.category === filter)

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy', path: '/training' }, { label: 'Coach Tips' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.9rem' }}>Coach Tips</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '560px', lineHeight: '1.6' }}>
            {TIPS.length} verified tips from named coaches and professionals — each with an action step you can take today.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} className={`btn btn-sm ${filter === cat.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(cat.id)}>
            {cat.icon} {cat.label} {cat.id !== 'all' && `(${TIPS.filter(t => t.category === cat.id).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tips.map(tip => {
          const coach = getCoach(tip.coachId)
          return (
            <div key={tip.id} className="card glass" style={{ padding: '20px 22px', borderLeft: `3px solid ${coach.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{CATEGORY_LABEL[tip.category] || tip.category}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: coach.accent }}>{coach.name}</strong> • ✓ Verified
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{tip.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.7', marginBottom: '10px' }}>{tip.body}</p>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--accent-cyan)' }}>Action step: </strong>{tip.actionStep}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}