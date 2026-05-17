import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SurveyPopup() {
  const { user, adminData, updateAdminData } = useAuth()
  const [activeSurvey, setActiveSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!user || !adminData?.surveys) return

    const pendingSurvey = adminData.surveys.find(s => {
      if (!s.active) return false

      // Check if user already responded
      const hasResponded = s.responses?.some(r => r.userId === user.id)
      if (hasResponded) return false

      // Check targeting
      if (s.targetType === 'all') return true
      if (s.targetType === 'specific' && s.targetUserIds?.includes(user.id)) return true

      return false
    })

    if (pendingSurvey) {
      setActiveSurvey(pendingSurvey)
      // Initialize answers
      const initial = {}
      pendingSurvey.questions.forEach(q => {
        initial[q.id] = q.type === 'checkbox' ? [] : ''
      })
      setAnswers(initial)
    } else {
      setActiveSurvey(null)
    }
  }, [user, adminData?.surveys])

  if (!activeSurvey) return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate - at least one answer
    const answeredCount = Object.values(answers).filter(a =>
      Array.isArray(a) ? a.length > 0 : String(a).trim() !== ''
    ).length

    if (answeredCount === 0) {
      alert('Please answer at least one question.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = {
        userId: user.id,
        username: user.username,
        submittedAt: new Date().toISOString(),
        answers: Object.entries(answers).map(([qId, val]) => ({
          questionId: qId,
          answer: Array.isArray(val) ? val.join(', ') : val
        }))
      }

      const updatedSurveys = adminData.surveys.map(s => {
        if (s.id === activeSurvey.id) {
          return { ...s, responses: [...(s.responses || []), response] }
        }
        return s
      })

      await updateAdminData({ surveys: updatedSurveys })
      setActiveSurvey(null)
    } catch (error) {
      alert('Failed to submit survey: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    // Optionally track skips so they don't see it again this session
    setActiveSurvey(null)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1900 }}>
      <div className="modal-content glass animate-slide-up" style={{ maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 className="text-gradient" style={{ margin: 0 }}>League Survey</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>{activeSurvey.title}</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleSkip} style={{ padding: '4px 10px' }}>Skip</button>
        </div>

        {activeSurvey.description && (
          <p style={{ fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.6' }}>{activeSurvey.description}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeSurvey.questions.map((q, i) => (
            <div key={q.id} className="form-group">
              <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
                {i + 1}. {q.text}
              </label>

              {q.type === 'text' && (
                <textarea
                  className="glass"
                  value={answers[q.id]}
                  onChange={e => setAnswers({...answers, [q.id]: e.target.value})}
                  rows={3}
                  placeholder="Your answer..."
                />
              )}

              {q.type === 'radio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={e => setAnswers({...answers, [q.id]: e.target.value})}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <input
                        type="checkbox"
                        value={opt}
                        checked={answers[q.id]?.includes(opt)}
                        onChange={e => {
                          const current = answers[q.id] || []
                          const next = e.target.checked
                            ? [...current, opt]
                            : current.filter(o => o !== opt)
                          setAnswers({...answers, [q.id]: next})
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
            style={{ marginTop: '12px', padding: '16px' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Responses'}
          </button>
        </form>
      </div>
    </div>
  )
}
