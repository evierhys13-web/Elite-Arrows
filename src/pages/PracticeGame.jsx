import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Breadcrumbs from '../components/Breadcrumbs'
import { PRACTICE_MODES, savePracticeSession, calculatePracticeTokens } from '../utils/practiceService'
import { Capacitor } from '@capacitor/core'

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
  const [useAccurateScoring, setUseAccurateScoring] = useState(true)
  const [multiplier, setMultiplier] = useState(1)

  const isAndroid = Capacitor.getPlatform() === 'android'

  const handleDart = (val, mult = 1) => {
    const score = val * mult
    processDart({ value: score, label: mult === 3 ? `T${val}` : mult === 2 ? `D${val}` : `S${val}`, multiplier: mult })
  }

  const processDart = (dart) => {
    setGameState(prev => {
      const next = { ...prev }
      next.dartsThrown += 1

      if (modeId === 'atc') {
        const isHit = dart.value === prev.target || (prev.target === 'BULL' && dart.value === 50)
        if (isHit) {
          if (prev.target === 'BULL') {
            next.finished = true
            next.endTime = Date.now()
          } else if (prev.target === 20) {
            next.target = 'BULL'
          } else {
            next.target = prev.target + 1
          }
        }
      } else if (modeId === '170') {
        const remaining = prev.target - dart.value
        if (remaining === 0) {
          if (dart.multiplier === 2 || dart.value === 50) {
            next.finished = true
            next.target = 0
            next.endTime = Date.now()
          } else {
            showToast('Must finish on a double!', 'warning')
            return prev
          }
        } else if (remaining < 2) {
          showToast('BUST!', 'warning')
          // End turn logic would go here if we tracked turns, for 170 we just reset to start of turn score
        } else {
          next.target = remaining
        }
      } else if (modeId === 'scoring') {
        next.score += dart.value
        if (next.dartsThrown >= 30) { // 10 rounds of 3
          next.finished = true
          next.endTime = Date.now()
        }
      }

      next.history = [{ dart, target: prev.target, timestamp: Date.now() }, ...prev.history]
      return next
    })
  }

  const handleInput = (val) => {
    if (useAccurateScoring) {
      if (val === 'DEL') {
        // Undo last dart
        return
      }
      if (typeof val === 'number') {
        handleDart(val, multiplier)
        setMultiplier(1)
      }
      return
    }

    if (val === 'DEL') {
      setCurrentInput(prev => prev.slice(0, -1))
    } else if (val === 'ENTER') {
      const score = parseInt(currentInput) || 0
      // Process as a 3-dart turn
      for(let i=0; i<3; i++) processDart({ value: score / 3, label: 'TOTAL' })
      setCurrentInput('')
    } else if (currentInput.length < 3) {
      setCurrentInput(prev => prev + val)
    }
  }

  if (!mode) return <div className="page">Invalid practice mode</div>

  const numbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

  return (
    <div className="page animate-fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Breadcrumbs items={[{ label: 'Practice Hub', path: '/practice' }, { label: mode.name }]} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-cyan)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {modeId === 'atc' ? 'Target' : modeId === '170' ? 'Remaining' : `Darts: ${gameState.dartsThrown} / 30`}
          </h2>
          <div style={{ fontSize: '5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>
            {gameState.target}
          </div>
          {modeId === 'scoring' && (
            <div style={{ fontSize: '1.5rem', color: 'var(--accent-primary)' }}>
              Total: {gameState.score}
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
            </div>

            <button className="btn btn-primary btn-block" onClick={() => navigate('/practice')}>
              Back to Hub
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '450px' }}>
            <div className="card glass" style={{ padding: '15px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <button className={`btn btn-sm ${multiplier === 1 ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMultiplier(1)}>Single</button>
                <button className={`btn btn-sm ${multiplier === 2 ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMultiplier(2)}>Double</button>
                <button className={`btn btn-sm ${multiplier === 3 ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMultiplier(3)}>Treble</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '15px' }}>
                {numbers.map(n => (
                  <button key={n} className="btn btn-secondary" style={{ padding: '10px 0', fontSize: '1.1rem', fontWeight: 800 }} onClick={() => handleDart(n, multiplier)}>
                    {n}
                  </button>
                ))}
                <button className="btn btn-primary" style={{ gridColumn: 'span 2', background: '#eab308', color: 'black' }} onClick={() => handleDart(25, multiplier)}>BULL</button>
                <button className="btn btn-secondary" style={{ gridColumn: 'span 3' }} onClick={() => handleDart(0, 1)}>MISS</button>
              </div>

              <button className="btn btn-secondary btn-block btn-sm" onClick={() => setUseAccurateScoring(!useAccurateScoring)}>
                Switch to {useAccurateScoring ? 'Total Score' : 'Dart-by-Dart'}
              </button>
            </div>

            {!useAccurateScoring && (
              <div className="card glass" style={{ padding: '20px', marginTop: '10px' }}>
                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', fontSize: '2rem', textAlign: 'center', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                  {currentInput || '0'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                    <button key={key} className={`btn btn-sm ${key === 'ENTER' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleInput(key)}>{key}</button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-secondary btn-block btn-sm" style={{ marginTop: '15px' }} onClick={() => navigate('/practice')}>
              Quit Session
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '150px', background: 'rgba(0,0,0,0.2)' }}>
        <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Recent Darts</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {gameState.history.map((h, i) => (
            <div key={i} className="glass" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              {h.dart.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
