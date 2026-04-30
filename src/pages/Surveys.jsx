import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { SURVEY_QUESTIONS } from '../components/SurveyModal'

export default function Surveys() {
  const { user } = useAuth()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSurvey, setSelectedSurvey] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    loadSurveys()
  }, [])

  const loadSurveys = async () => {
    try {
      setError('')
      const q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const surveyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setSurveys(surveyData)
    } catch (err) {
      console.error('Error loading surveys:', err)
      setError('Survey results could not be loaded. Please check the Firestore rules have been deployed.')
    } finally {
      setLoading(false)
    }
  }

  const getQuestionText = (id) => {
    const q = SURVEY_QUESTIONS.find(q => q.id === id)
    return q ? q.question : id
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRecommendStats = () => {
    const stats = { Yes: 0, No: 0, Maybe: 0 }
    surveys.forEach(s => {
      if (s.responses?.recommend && stats[s.responses.recommend] !== undefined) {
        stats[s.responses.recommend]++
      }
    })
    return stats
  }

  const getAverageRating = (questionId) => {
    const values = surveys
      .map(s => s.responses?.[questionId])
      .filter(v => typeof v === 'number')
    if (values.length === 0) return 'N/A'
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    return avg.toFixed(1)
  }

  const recommendStats = getRecommendStats()
  const totalSurveys = surveys.length

  if (!user?.isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Access Denied</h1>
        </div>
        <div className="card">
          <p>You must be an admin to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Survey Results</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
            {totalSurveys}
          </div>
          <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Total Responses</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>
            {recommendStats.Yes}
          </div>
          <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Would Recommend</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
            {getAverageRating('signUpSmooth')}
          </div>
          <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Avg Sign-up (1-10)</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
            {getAverageRating('easyToUse')}
          </div>
          <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Avg Ease (1-10)</div>
        </div>
      </div>

      {surveys.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Would Recommend Breakdown</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Object.entries(recommendStats).map(([key, value]) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {value}
                </div>
                <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{key}</div>
                <div style={{ color: 'var(--text)', fontSize: '0.8rem', opacity: 0.7 }}>
                  ({totalSurveys > 0 ? Math.round(value / totalSurveys * 100) : 0}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>All Responses</h3>
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <p style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>
            {error}
          </p>
        ) : surveys.length === 0 ? (
          <p style={{ color: 'var(--text)', textAlign: 'center', padding: '40px' }}>
            No survey responses yet. Survey will appear here once users complete it.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {surveys.map(survey => (
              <div 
                key={survey.id}
                style={{
                  padding: '16px',
                  background: 'var(--bg-primary)',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedSurvey(selectedSurvey?.id === survey.id ? null : survey)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>{survey.userName}</strong>
                    <div style={{ color: 'var(--text)', fontSize: '0.85rem', opacity: 0.7 }}>
                      {formatDate(survey.createdAt)}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '6px 12px', 
                    background: survey.responses?.recommend === 'Yes' ? '#22c55e' : 
                               survey.responses?.recommend === 'Maybe' ? '#eab308' : '#ef4444',
                    borderRadius: '20px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}>
                    {survey.responses?.recommend || 'N/A'}
                  </div>
                </div>
                
                {selectedSurvey?.id === survey.id && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    {SURVEY_QUESTIONS.map(q => (
                      <div key={q.id} style={{ marginBottom: '12px' }}>
                        <div style={{ color: 'var(--text)', fontSize: '0.85rem', marginBottom: '4px' }}>
                          {q.question}
                        </div>
                        <div style={{ 
                          color: 'var(--accent-cyan)', 
                          fontWeight: '500',
                          background: 'var(--bg-secondary)',
                          padding: '8px 12px',
                          borderRadius: '6px'
                        }}>
                          {survey.responses?.[q.id] || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
