import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, collection, query, where, getDocs, orderBy, limit } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { PRACTICE_MODES } from '../utils/practiceService'

export default function PracticeHub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dailyStats, setDailyStats] = useState({ count: 0, goal: 5 })

  useEffect(() => {
    if (!user?.id) return

    const loadStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const q = query(
          collection(db, 'practiceSessions'),
          where('userId', '==', user.id),
          where('date', '==', today)
        )
        const snap = await getDocs(q)
        setDailyStats(prev => ({ ...prev, count: snap.size }))
      } catch (e) {
        console.error("Failed to load practice stats from Firestore", e)
        // Fallback to local
        const localKey = `practice_sessions_${user.id}`
        const saved = localStorage.getItem(localKey)
        const sessions = saved ? JSON.parse(saved) : []
        if (Array.isArray(sessions)) {
          const today = new Date().toISOString().split('T')[0]
          const todaysSessions = sessions.filter(s => s.date === today)
          setDailyStats(prev => ({ ...prev, count: todaysSessions.length }))
        }
      }
    }
    loadStats()
  }, [user?.id])

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Practice Hub' }]} />

      <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title text-gradient">Practice Hub</h1>
          <p style={{ color: 'var(--text-muted)' }}>Sharpen your skills with dedicated solo drills.</p>
        </div>
        <button className="btn btn-secondary btn-sm glass" onClick={() => navigate('/leaderboards?tab=practice')}>
          🏆 Leaderboards
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {Object.values(PRACTICE_MODES).map(mode => (
          <div key={mode.id} className="card glass" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
            border: '1px solid var(--border)',
            transition: 'transform 0.2s, border-color 0.2s',
            cursor: 'pointer'
          }} onClick={() => navigate(`/practice/${mode.id}`)}>
            <div>
              <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>
                {mode.id === 'atc' ? '🎯' : mode.id === '170' ? '🔥' : '📈'}
              </div>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>{mode.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{mode.description}</p>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {mode.objective}
              </div>
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: '24px' }}>
              Start Session
            </button>
          </div>
        ))}
      </div>

      <div className="card glass" style={{ marginTop: '40px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Daily Practice Goal</h3>
          <span style={{
            padding: '4px 12px',
            background: dailyStats.count >= dailyStats.goal ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)',
            color: dailyStats.count >= dailyStats.goal ? 'var(--success)' : 'var(--text-muted)',
            borderRadius: '99px',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            {dailyStats.count >= dailyStats.goal ? 'COMPLETED' : 'IN PROGRESS'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px' }}>
          <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (dailyStats.count / dailyStats.goal) * 100)}%`,
              height: '100%',
              background: 'var(--accent-cyan)',
              transition: 'width 0.5s ease-out'
            }} />
          </div>
          <span style={{ fontWeight: 'bold' }}>{dailyStats.count}/{dailyStats.goal} Sessions</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px' }}>
          {dailyStats.count >= dailyStats.goal
            ? "Goal achieved! You've earned your 50 bonus Elite Tokens for today."
            : `Complete ${dailyStats.goal} practice sessions today to earn 50 bonus Elite Tokens!`}
        </p>
      </div>
    </div>
  )
}
