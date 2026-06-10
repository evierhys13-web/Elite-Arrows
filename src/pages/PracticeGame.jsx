import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Breadcrumbs from '../components/Breadcrumbs'
import { PRACTICE_MODES, savePracticeSession, calculatePracticeTokens } from '../utils/practiceService'

export default function PracticeGame() {
  const { modeId } = useParams()
  const navigate = useNavigate()
  const { user, addTokens } = useAuth()
  const { showToast } = useToast()
  const mode = PRACTICE_MODES[Object.keys(PRACTICE_MODES).find(k => PRACTICE_MODES[k].id === modeId)]

  const [gameState, setGameState] = useState({
    target: modeId === 'atc' ? 1 : (modeId === '170' ? 170 : 'Score'),
    dartsThrown: 0,
    score: 0,
    round: 1,
    finished: false,
    history: [],
    startTime: Date.now(),
    endTime: null,
    accuracy: 0
  })

  const [currentInput, setCurrentInput] = useState('')

  const handleInput = (val) => {
    if (val === 'DEL') {
      setCurrentInput(prev => prev.slice(0, -1))
    } else if (val === 'ENTER') {
      processTurn(parseInt(currentInput) || 0)
      setCurrentInput('')
    } else if (currentInput.length < 3) {
      setCurrentInput(prev => prev + val)
    }
  }

  const processTurn = (inputScore) => {
    setGameState(prev => {
      const next = { ...prev }
      next.dartsThrown += 3
      next.history = [{ score: inputScore, target: prev.target, timestamp: Date.now() }, ...prev.history]

      if (modeId === 'atc') {
        const targetsHit = Math.min(3, inputScore)
        const currentTarget = prev.target

        if (currentTarget === 'BULL') {
          if (targetsHit > 0) {
            next.finished = true
            next.endTime = Date.now()
          }
        } else {
          let nextTarget = currentTarget + targetsHit
          if (nextTarget > 20) {
            next.target = 'BULL'
          } else {
            next.target = nextTarget
          }
        }

        // Accuracy for ATC: targets hit vs darts thrown
        // Since we assume 3 darts per turn, and input is targets hit
        const totalTargetsHit = next.finished ? 21 : (typeof next.target === 'number' ? next.target - 1 : 20)
        next.accuracy = (totalTargetsHit / next.dartsThrown) * 100
      } else if (modeId === '170') {
        const remaining = prev.target - inputScore
        if (remaining === 0) {
          next.finished = true
          next.target = 0
          next.endTime = Date.now()
          next.accuracy = (1 / (next.dartsThrown / 3)) * 100 // Successful checkout rate
        } else if (remaining < 2 || remaining > 170) {
          showToast('Bust or invalid score!', 'warning')
        } else {
          next.target = remaining
        }
      } else if (modeId === 'scoring') {
        next.score += inputScore
        next.round += 1
        if (next.round > 10) {
          next.finished = true
          next.endTime = Date.now()
          // Accuracy for scoring could be triple/double hit rate, but here we just have total score
          next.accuracy = (next.score / 1800) * 100 // Relative to perfect score
        }
      }

      return next
    })
  }

  useEffect(() => {
    if (gameState.finished && user?.id) {
      const tokens = calculatePracticeTokens(modeId, gameState)
      savePracticeSession(user.id, user.username, modeId, gameState)
      addTokens(tokens)
      showToast(`Practice Complete! Awarded ${tokens} Elite Tokens.`, 'success')
    }
  }, [gameState.finished, modeId, user?.id, addTokens, showToast])

  if (!mode) return <div className="page">Invalid practice mode</div>

  return (
    <div className="page animate-fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs items={[{ label: 'Practice Hub', path: '/practice' }, { label: mode.name }]} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {modeId === 'atc' ? 'Current Target' : modeId === '170' ? 'Remaining' : `Round ${gameState.round} / 10`}
          </h2>
          <div style={{ fontSize: '6rem', fontWeight: 900, color: 'white' }}>
            {gameState.target}
          </div>
          {modeId === 'scoring' && (
            <div style={{ fontSize: '2rem', color: 'var(--accent-primary)' }}>
              Total: {gameState.score}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '40px', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Darts</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{gameState.dartsThrown}</div>
          </div>
          {modeId === 'scoring' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Avg</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                {gameState.dartsThrown > 0 ? (gameState.score / (gameState.dartsThrown / 3)).toFixed(1) : '0.0'}
              </div>
            </div>
          )}
        </div>

        {gameState.finished ? (
          <div className="card glass animate-bounce-in" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
            <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Session Complete!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Great shooting! Your stats have been saved.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div className="stat-card glass" style={{ padding: '15px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Darts</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{gameState.dartsThrown}</div>
              </div>
              <div className="stat-card glass" style={{ padding: '15px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {Math.floor((gameState.endTime - gameState.startTime) / 1000)}s
                </div>
              </div>
              <div className="stat-card glass" style={{ padding: '15px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{gameState.accuracy.toFixed(1)}%</div>
              </div>
              {modeId === 'scoring' && (
                <div className="stat-card glass" style={{ padding: '15px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Score</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{gameState.score}</div>
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-block" onClick={() => navigate('/practice')}>
              Back to Hub
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div className="card glass" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(0,0,0,0.5)',
                padding: '15px',
                borderRadius: '12px',
                fontSize: '3rem',
                textAlign: 'center',
                color: 'var(--accent-cyan)',
                fontWeight: 'bold',
                marginBottom: '15px',
                border: '2px solid var(--accent-cyan)'
              }}>
                {currentInput || '0'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                  <button
                    key={key}
                    className={`btn ${key === 'ENTER' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: '60px', fontSize: '1.5rem' }}
                    onClick={() => handleInput(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-secondary btn-block" onClick={() => navigate('/practice')}>
              Quit Session
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '200px' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>RECENT THROWS</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gameState.history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span>Round {gameState.history.length - i}</span>
              <span style={{ fontWeight: 'bold' }}>{h.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
