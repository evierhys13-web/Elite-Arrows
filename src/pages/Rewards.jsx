export default function Rewards() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rewards</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Practice Milestones</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Consistent practice leads to big rewards!</p>

        <div style={{ display: 'grid', gap: '12px' }}>
          {[
            { name: 'Daily Grinder', requirement: '5 Practice Sessions in 1 day', icon: '🔥', progress: 3, total: 5 },
            { name: 'Weekly Warrior', requirement: 'Practice 5 days in a week', icon: '⚔️', progress: 2, total: 5 },
            { name: 'ATC Master', requirement: 'Score 100% accuracy in ATC', icon: '🎯', progress: 0, total: 1 }
          ].map((milestone, i) => (
            <div key={i} style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '2rem' }}>{milestone.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{milestone.name}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{milestone.requirement}</div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(milestone.progress / milestone.total) * 100}%`, height: '100%', background: 'var(--accent-cyan)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
