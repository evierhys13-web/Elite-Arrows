import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'

const SURVEY_QUESTIONS = [
  {
    id: 'howJoined',
    question: 'How did you join the league?',
    type: 'select',
    options: ['Invited by a friend', 'Found online', 'Existing member', 'Social media', 'Word of mouth', 'Other']
  },
  {
    id: 'signUpSmooth',
    question: 'How smooth was the sign-up process? (1 = difficult, 10 = very smooth)',
    type: 'scale',
    min: 1,
    max: 10
  },
  {
    id: 'howHear',
    question: 'How did you hear about Elite Arrows?',
    type: 'text',
    placeholder: 'e.g., Google search, Facebook, friend told me...'
  },
  {
    id: 'likeMost',
    question: 'What do you like most about the app?',
    type: 'textarea',
    placeholder: 'Tell us what you enjoy...'
  },
  {
    id: 'improve',
    question: 'What could be improved?',
    type: 'textarea',
    placeholder: 'Any suggestions for improvement...'
  },
  {
    id: 'easyToUse',
    question: 'How easy is the app to use? (1 = difficult, 10 = very easy)',
    type: 'scale',
    min: 1,
    max: 10
  },
  {
    id: 'recommend',
    question: 'Would you recommend Elite Arrows to others?',
    type: 'select',
    options: ['Yes', 'No', 'Maybe']
  },
  {
    id: 'wouldLike',
    question: 'What would you like to see in the app?',
    type: 'textarea',
    placeholder: 'New features, ideas...'
  },
  {
    id: 'changeReplace',
    question: 'Is there anything you would change or replace?',
    type: 'textarea',
    placeholder: 'Features to change or remove...'
  },
  {
    id: 'additional',
    question: 'Any additional feedback?',
    type: 'textarea',
    placeholder: 'Anything else you want to say...'
  },
  {
    id: 'signUpIssues',
    question: 'Why was the sign-up process not great?',
    type: 'textarea',
    placeholder: 'What made signing up difficult...?',
    condition: (responses) => responses.signUpSmooth !== undefined && responses.signUpSmooth < 8
  },
  {
    id: 'appDifficult',
    question: 'What is difficult to use?',
    type: 'textarea',
    placeholder: 'What parts of the app are confusing or hard to use...?',
    condition: (responses) => responses.easyToUse !== undefined && responses.easyToUse < 8
  }
]

export default function SurveyModal({ isOpen, onComplete, onSkip, userId, userName }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load saved responses from localStorage
  useEffect(() => {
    if (isOpen && userId) {
      const saved = localStorage.getItem(`survey_${userId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setResponses(parsed.responses || {})
          setCurrentStep(parsed.currentStep || 0)
        } catch (e) {
          console.error('Failed to load saved survey:', e)
        }
      } else {
        setCurrentStep(0)
        setResponses({})
      }
      setError('')
    }
  }, [isOpen, userId])

  // Save responses to localStorage as user progresses
  useEffect(() => {
    if (userId && Object.keys(responses).length > 0) {
      localStorage.setItem(`survey_${userId}`, JSON.stringify({ responses, currentStep }))
    }
  }, [responses, currentStep, userId])

  // Filter questions based on conditions
  const filteredQuestions = SURVEY_QUESTIONS.filter(q => !q.condition || q.condition(responses))
  const question = filteredQuestions[currentStep]
  const progress = filteredQuestions.length > 0 ? ((currentStep + 1) / filteredQuestions.length) * 100 : 0

  if (!isOpen) return null

  const handleResponse = (value) => {
    setResponses(prev => ({ ...prev, [question.id]: value }))
    setError('')
  }

  const canProceed = () => {
    const value = responses[question.id]
    return value !== undefined && value !== '' && value !== null
  }

  const nextStep = () => {
    if (!canProceed()) {
      setError('Please answer this question to continue')
      return
    }
    
    // Re-filter questions after each answer to include/exclude conditional questions
    const newFilteredQuestions = SURVEY_QUESTIONS.filter(q => !q.condition || q.condition({ ...responses, [question.id]: responses[question.id] }))
    const newQuestionIndex = filteredQuestions.findIndex(q => q.id === question.id)
    
    if (newQuestionIndex < newFilteredQuestions.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      submitSurvey()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const submitSurvey = async () => {
    setSubmitting(true)
    setError('')

    try {
      const surveyData = {
        userId,
        userName,
        responses,
        createdAt: serverTimestamp(),
        completed: true
      }

      await addDoc(collection(db, 'surveys'), surveyData)
      
      // Mark as completed in Firestore (don't block user if this fails)
      try {
        await updateDoc(doc(db, 'users', userId), {
          surveyCompleted: true
        })
      } catch (e) {
        console.error('Failed to update user survey status:', e)
      }

      // Clear saved survey from localStorage
      localStorage.removeItem(`survey_${userId}`)

      onComplete()
    } catch (err) {
      console.error('Survey submit error:', err)
      setError('Failed to submit. Your answers are saved - try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    // Save current progress so user can return later
    if (userId && Object.keys(responses).length > 0) {
      localStorage.setItem(`survey_${userId}`, JSON.stringify({ responses, currentStep }))
    }
    onSkip()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <h2 style={{ margin: 0, color: 'var(--accent-cyan)' }}>
              Feedback Survey
            </h2>
            <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
              {currentStep + 1} / {filteredQuestions.length}
            </span>
          </div>
          <div style={{
            height: '6px',
            background: 'var(--bg-primary)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent-cyan)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            fontSize: '1.1rem',
            fontWeight: '500',
            color: 'var(--text)'
          }}>
            {question.question}
          </label>

          {question.type === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {question.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleResponse(option)}
                  style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    background: responses[question.id] === option ? 'var(--accent-cyan)' : 'var(--bg-primary)',
                    color: responses[question.id] === option ? '#000' : 'var(--text)',
                    border: '2px solid',
                    borderColor: responses[question.id] === option ? 'var(--accent-cyan)' : 'var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {question.type === 'scale' && (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                {Array.from({ length: question.max - question.min + 1 }, (_, i) => question.min + i).map(num => (
                  <button
                    key={num}
                    onClick={() => handleResponse(num)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: responses[question.id] === num ? 'var(--accent-cyan)' : 'var(--bg-primary)',
                      color: responses[question.id] === num ? '#000' : 'var(--text)',
                      border: '2px solid',
                      borderColor: responses[question.id] === num ? 'var(--accent-cyan)' : 'var(--border)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                color: 'var(--text)',
                fontSize: '0.8rem'
              }}>
                <span>1 = Difficult</span>
                <span>10 = Very Easy</span>
              </div>
            </div>
          )}

          {(question.type === 'text' || question.type === 'textarea') && (
            <textarea
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(e.target.value)}
              placeholder={question.placeholder}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                background: 'var(--bg-primary)',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                outline: 'none',
                minHeight: question.type === 'textarea' ? '100px' : 'auto',
                resize: question.type === 'textarea' ? 'vertical' : 'none',
                fontFamily: 'inherit'
              }}
            />
          )}
        </div>

        {error && (
          <div style={{
            padding: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            color: '#ef4444',
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              style={{
                flex: 1,
                padding: '14px',
                background: 'transparent',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '14px',
              background: 'var(--accent-cyan)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? 'Submitting...' : currentStep === filteredQuestions.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Skip for now
          </button>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '16px',
          color: 'var(--text)',
          fontSize: '0.85rem',
          opacity: 0.7
        }}>
          Your progress is saved automatically. You can return to it later in Settings.
        </p>
      </div>
    </div>
  )
}

export { SURVEY_QUESTIONS }