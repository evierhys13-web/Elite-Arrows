import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SurveyPopup() {
  const { user, adminData, updateAdminData } = useAuth()
  const [activeSurvey, setActiveSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() = \u003e {
    if (!user || !adminData?.surveys) return

    const pendingSurvey = adminData.surveys.find(s =\u003e {
      if (!s.active) return false

      // Check if user already responded
      const hasResponded = s.responses?.some(r =\u003e r.userId === user.id)
      if (hasResponded) return false

      // Check targeting
      if (s.targetType === 'all') return true
      if (s.targetType === 'specific' \u0026\u0026 s.targetUserIds?.includes(user.id)) return true

      return false
    })

    if (pendingSurvey) {
      setActiveSurvey(pendingSurvey)
      // Initialize answers
      const initial = {}
      pendingSurvey.questions.forEach(q =\u003e {
        initial[q.id] = q.type === 'checkbox' ? [] : ''
      })
      setAnswers(initial)
    } else {
      setActiveSurvey(null)
    }
  }, [user, adminData?.surveys])

  if (!activeSurvey) return null

  const handleSubmit = async (e) =\u003e {
    e.preventDefault()

    // Validate - at least one answer
    const answeredCount = Object.values(answers).filter(a =\u003e
      Array.isArray(a) ? a.length \u003e 0 : a.trim() !== ''
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
        answers: Object.entries(answers).map(([qId, val]) =\u003e ({
          questionId: qId,
          answer: Array.isArray(val) ? val.join(', ') : val
        }))
      }

      const updatedSurveys = adminData.surveys.map(s =\u003e {
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

  const handleSkip = () =\u003e {
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

        {activeSurvey.description \u0026\u0026 (
          <p style={{ fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.6' }}>{activeSurvey.description}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeSurvey.questions.map((q, i) =\u003e (
            <div key={q.id} className="form-group">
              <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
                {i + 1}. {q.text}
              </label>

              {q.type === 'text' \u0026\u0026 (
                <textarea
                  className="glass"
                  value={answers[q.id]}
                  onChange={e =\u003e setAnswers({...answers, [q.id]: e.target.value})}
                  rows={3}
                  placeholder="Your answer..."
                />
              )}

              {q.type === 'radio' \u0026\u0026 (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map(opt =\u003e (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={e =\u003e setAnswers({...answers, [q.id]: e.target.value})}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' \u0026\u0026 (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map(opt =\u003e (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <input
                        type="checkbox"
                        value={opt}
                        checked={answers[q.id]?.includes(opt)}
                        onChange={e =\u003e {
                          const current = answers[q.id] || []
                          const next = e.target.checked
                            ? [...current, opt]
                            : current.filter(o =\u003e o !== opt)
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
