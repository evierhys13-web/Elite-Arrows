import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, doc, onSnapshot, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { DartBot } from '../utils/DartBot'

/* Components */
const DartboardInput = ({ onDart, onUndo, currentDarts, disabled }) => {
  const [multiplier, setMultiplier] = useState(1) // 1: Single, 2: Double, 3: Treble

  const numbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

  const handleNumClick = (num) => {
    if (disabled) return
    const label = multiplier === 3 ? `T${num}` : multiplier === 2 ? `D${num}` : `S${num}`
    onDart({ value: num * multiplier, label, multiplier })
    setMultiplier(1)
  }

  const handleBull = () => {
    if (disabled) return
    const value = multiplier === 2 ? 50 : 25
    const label = multiplier === 2 ? 'D-BULL' : 'S-BULL'
    onDart({ value, label, multiplier })
    setMultiplier(1)
  }

  const handleMiss = () => {
    if (disabled) return
    onDart({ value: 0, label: 'MISS', multiplier: 0 })
    setMultiplier(1)
  }

  return (
    <div className="dart-input-grid">
      <div className="multipliers">
        <button className={`multi-btn ${multiplier === 1 ? 'active' : ''}`} onClick={() => setMultiplier(1)}>Single</button>
        <button className={`multi-btn dbl ${multiplier === 2 ? 'active' : ''}`} onClick={() => setMultiplier(2)}>Double</button>
        <button className={`multi-btn trb ${multiplier === 3 ? 'active' : ''}`} onClick={() => setMultiplier(3)}>Treble</button>
      </div>

      <div className="numbers-grid">
        {numbers.map(n => (
          <button key={n} className="num-btn" onClick={() => handleNumClick(n)} disabled={disabled}>{n}</button>
        ))}
        <button className="num-btn bull" onClick={handleBull} disabled={disabled}>BULL</button>
        <button className="num-btn miss" onClick={handleMiss} disabled={disabled}>0</button>
      </div>

      <div className="input-footer">
        <div className="current-turn-darts">
          {Array(3).fill(null).map((_, i) => (
            <div key={i} className={`dart-slot ${currentDarts[i] ? 'filled' : ''}`}>
              {currentDarts[i]?.label || '-'}
            </div>
          ))}
        </div>
        <button className="undo-btn" onClick={onUndo} disabled={currentDarts.length === 0 || disabled}>Undo</button>
      </div>

      <style>{`
        .dart-input-grid { display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 400px; margin: 0 auto; }
        .multipliers { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .multi-btn { padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: white; font-weight: 800; cursor: pointer; }
        .multi-btn.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.1); box-shadow: 0 0 10px var(--accent-cyan-glow); }
        .multi-btn.dbl.active { border-color: #22c55e; background: rgba(34, 197, 129, 0.1); }
        .multi-btn.trb.active { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .numbers-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .num-btn { aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: white; font-weight: 700; cursor: pointer; transition: 0.1s; }
        .num-btn:active { transform: scale(0.9); }
        .num-btn.bull { background: #eab308; color: black; font-weight: 900; }
        .num-btn.miss { background: #334155; }

        .input-footer { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; borderRadius: 12px; }
        .current-turn-darts { display: flex; gap: 8px; }
        .dart-slot { width: 45px; height: 35px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: var(--text-muted); }
        .dart-slot.filled { color: var(--accent-cyan); border-color: var(--accent-cyan); }
        .undo-btn { padding: 8px 16px; border-radius: 6px; border: none; background: #ef4444; color: white; font-weight: 700; cursor: pointer; }
      `}</style>
    </div>
  )
}

const CheckoutSuggestion = ({ score }) => {
  const getSuggestion = (s) => {
    if (s > 170 || s < 2) return null
    // Simple lookup for common checkouts
    const checkouts = {
      170: 'T20, T20, BULL',
      167: 'T20, T19, BULL',
      164: 'T20, T18, BULL',
      161: 'T20, T17, BULL',
      160: 'T20, T20, D20',
      158: 'T20, T20, D19',
      141: 'T20, T19, D12',
      121: 'T20, T11, D20',
      100: 'T20, D20',
      60: 'S20, D20',
      40: 'D20',
      32: 'D16',
      16: 'D8',
      8: 'D4',
      4: 'D2',
      2: 'D1'
    }
    return checkouts[s] || 'No suggestion'
  }

  const suggestion = getSuggestion(score)
  if (!suggestion) return null

  return (
    <div className="checkout-hint">
      <span className="label">CHECKOUT:</span>
      <span className="path">{suggestion}</span>
      <style>{`
        .checkout-hint { background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; padding: 10px; borderRadius: 8px; text-align: center; margin-bottom: 15px; }
        .checkout-hint .label { color: #22c55e; font-weight: 800; font-size: 0.7rem; margin-right: 8px; }
        .checkout-hint .path { color: white; font-weight: 700; }
      `}</style>
    </div>
  )
}

export default function PlayOnline() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Match State
  const [gameStarted, setGameStarted] = useState(false)
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [turn, setTurn] = useState('player')
  const [currentDarts, setCurrentDarts] = useState([])
  const [history, setHistory] = useState([])
  const [bot, setBot] = useState(null)

  // Lobby State
  const [onlineMatches, setOnlineGame] = useState([])

  const startNewMatch = (startScore = 501, vsBot = true) => {
    setPlayerScore(startScore)
    setOpponentScore(startScore)
    setTurn('player')
    setCurrentDarts([])
    setHistory([])
    setGameStarted(true)

    if (vsBot) {
      setBot(new DartBot({
        id: 'pro-1',
        name: 'Practice Bot',
        targetAverage: 55,
        checkoutRate: 0.2
      }))
    } else {
      setBot(null)
    }
    showToast('Match Started!', 'success')
  }

  const handleDartInput = (dart) => {
    if (turn !== 'player') return

    const scoreAfterDart = playerScore - dart.value

    // Check for win
    if (scoreAfterDart === 0) {
      if (dart.multiplier !== 2) {
        showToast('Must finish on a double!', 'warning')
        return
      }
      setPlayerScore(0)
      setCurrentDarts(prev => [...prev, dart])
      endTurn([...currentDarts, dart], 0)
      return
    }

    // Check for bust
    if (scoreAfterDart < 2) {
      showToast('BUST!', 'error')
      endTurn([...currentDarts, dart], playerScore, true)
      return
    }

    const nextDarts = [...currentDarts, dart]
    setPlayerScore(scoreAfterDart)
    setCurrentDarts(nextDarts)

    if (nextDarts.length === 3) {
      endTurn(nextDarts, scoreAfterDart)
    }
  }

  const endTurn = (darts, remaining, isBust = false) => {
    const turnScore = isBust ? 0 : darts.reduce((sum, d) => sum + d.value, 0)
    const entry = { who: 'player', darts, score: turnScore, remaining }

    setHistory(prev => [entry, ...prev])
    setCurrentDarts([])

    if (remaining === 0) {
      showToast('MATCH SHOT!', 'success')
      setGameStarted(false)
      return
    }

    setTurn('opponent')
  }

  const handleUndo = () => {
    if (currentDarts.length === 0) return
    const lastDart = currentDarts[currentDarts.length - 1]
    setPlayerScore(prev => prev + lastDart.value)
    setCurrentDarts(prev => prev.slice(0, -1))
  }

  // Bot Logic
  useEffect(() => {
    if (gameStarted && turn === 'opponent' && bot) {
      const runBot = async () => {
        await new Promise(r => setTimeout(r, 1500))
        let remaining = opponentScore
        const botDarts = []

        for (let i = 0; i < 3; i++) {
          const dart = bot.calculateDart(remaining, i)
          botDarts.push(dart)
          remaining -= dart.value
          if (remaining <= 0) break
          await new Promise(r => setTimeout(r, 800))
        }

        const isBust = remaining < 0 || remaining === 1
        const turnScore = isBust ? 0 : botDarts.reduce((sum, d) => sum + d.value, 0)
        const finalRemaining = isBust ? opponentScore : remaining

        setOpponentScore(finalRemaining)
        setHistory(prev => [{ who: 'opponent', darts: botDarts, score: turnScore, remaining: finalRemaining }, ...prev])

        if (finalRemaining === 0) {
          showToast('Bot Wins!', 'error')
          setGameStarted(false)
        } else {
          setTurn('player')
        }
      }
      runBot()
    }
  }, [turn, bot, gameStarted, opponentScore])

  if (!gameStarted) {
    return (
      <div className="page animate-fade-in">
        <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Play Online' }]} />
        <div className="page-header">
          <h1 className="page-title text-gradient">Play Online</h1>
          <p style={{ color: 'var(--text-muted)' }}>Experience accurate dart-by-dart scoring.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="card glass">
            <h3 style={{ color: 'var(--accent-cyan)' }}>Local Practice</h3>
            <p style={{ margin: '15px 0', color: 'var(--text-muted)' }}>Test the new accurate scoring system against our DartBot.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => startNewMatch(501)}>501 Match</button>
              <button className="btn btn-secondary" onClick={() => startNewMatch(301)}>301 Match</button>
            </div>
          </div>

          <div className="card glass" style={{ opacity: 0.7 }}>
            <h3 style={{ color: 'var(--accent-primary)' }}>Online Lobby</h3>
            <p style={{ margin: '15px 0', color: 'var(--text-muted)' }}>Coming soon: Real-time matches with other Elite Arrows players.</p>
            <button className="btn btn-secondary btn-block" disabled>Join Lobby</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page match-mode animate-fade-in" style={{ padding: 0, maxWidth: '100vw', overflow: 'hidden' }}>
      <div className="match-header" style={{ padding: '20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className={`player-box ${turn === 'player' ? 'active' : ''}`}>
          <div className="name">{user?.username || 'You'}</div>
          <div className="score">{playerScore}</div>
        </div>
        <div className="vs">VS</div>
        <div className={`player-box ${turn === 'opponent' ? 'active' : ''}`}>
          <div className="name">{bot ? bot.name : 'Opponent'}</div>
          <div className="score">{opponentScore}</div>
        </div>
      </div>

      <div className="match-main" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', height: 'calc(100vh - 150px)' }}>
        <div className="match-play-area" style={{ padding: '20px', overflowY: 'auto' }}>
          <CheckoutSuggestion score={playerScore} />

          <DartboardInput
            onDart={handleDartInput}
            onUndo={handleUndo}
            currentDarts={currentDarts}
            disabled={turn !== 'player'}
          />

          <div className="history-list" style={{ marginTop: '30px' }}>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '10px' }}>Match History</h4>
            {history.map((h, i) => (
              <div key={i} className={`history-item ${h.who}`} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                marginBottom: '8px',
                borderLeft: `4px solid ${h.who === 'player' ? 'var(--accent-cyan)' : 'var(--accent-primary)'}`
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{h.who === 'player' ? 'YOU' : 'BOT'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.darts.map(d => d.label).join(', ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: 'white' }}>{h.score}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Left: {h.remaining}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="match-stats-sidebar" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '20px' }}>
          <button className="btn btn-danger btn-block" onClick={() => { if(window.confirm('Quit match?')) setGameStarted(false) }}>Quit Match</button>

          <div style={{ marginTop: '30px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Live Stats</h4>
            <div className="stat-row">
              <span>Avg</span>
              <strong>{history.length > 0 ? (history.filter(h => h.who === 'player').reduce((s, h) => s + h.score, 0) / history.filter(h => h.who === 'player').length).toFixed(1) : '0.0'}</strong>
            </div>
            <div className="stat-row">
              <span>First 9</span>
              <strong>{history.length > 0 ? (history.filter(h => h.who === 'player').slice(-3).reduce((s, h) => s + h.score, 0) / Math.min(3, history.filter(h => h.who === 'player').length)).toFixed(1) : '0.0'}</strong>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .player-box { text-align: center; flex: 1; padding: 10px; borderRadius: 12px; transition: 0.3s; }
        .player-box.active { background: rgba(0, 212, 255, 0.1); border: 1px solid var(--accent-cyan); }
        .player-box .name { font-weight: 800; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
        .player-box .score { font-size: 3rem; font-weight: 900; color: white; }
        .player-box.active .score { color: var(--accent-cyan); }
        .vs { font-weight: 900; color: var(--text-muted); margin: 0 20px; }

        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .stat-row span { color: var(--text-muted); font-size: 0.85rem; }
        .stat-row strong { color: white; }

        @media (max-width: 900px) {
          .match-main { grid-template-columns: 1fr; }
          .match-stats-sidebar { display: none; }
        }
      `}</style>
    </div>
  )
}
