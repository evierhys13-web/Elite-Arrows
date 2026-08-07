import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, doc, onSnapshot, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs, deleteDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { DartBot } from '../utils/DartBot'

/* Icons */
const FlipIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h10V4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M20 8l-4 4 4 4" /></svg>
const ZoomInIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
const ZoomOutIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>

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

        .input-footer { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; }
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
        .checkout-hint { background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; padding: 10px; border-radius: 8px; text-align: center; margin-bottom: 15px; }
        .checkout-hint .label { color: #22c55e; font-weight: 800; font-size: 0.7rem; margin-right: 8px; }
        .checkout-hint .path { color: white; font-weight: 700; }
      `}</style>
    </div>
  )
}

export default function PlayOnline() {
  const { user, sendGameInvite, acceptGameInvite, updateLiveGame } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Match State
  const [gameStarted, setGameStarted] = useState(false)
  const [gameData, setGameData] = useState(null)
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [turn, setTurn] = useState('player')
  const [currentDarts, setCurrentDarts] = useState([])
  const [history, setHistory] = useState([])
  const [bot, setBot] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isHost, setIsHost] = useState(false)

  // Lobby State
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [isLobbyOpen, setIsLobbyOpen] = useState(false)
  const [isHosting, setIsHosting] = useState(false)

  // Camera State
  const [useCamera, setUseCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)
  const videoRef = useRef(null)

  // Fetch available cameras
  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (e) {
      console.error("Error enumerating devices:", e)
    }
  }

  // Fetch available players for lobby
  useEffect(() => {
    if (!isLobbyOpen) return
    const q = query(collection(db, 'users'), where('isOnline', '==', true))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAvailablePlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.id !== user.id))
    })
    return () => unsubscribe()
  }, [isLobbyOpen, user?.id])

  // Camera Handlers
  const toggleCamera = async () => {
    if (useCamera) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setStream(null)
      setUseCamera(false)
    } else {
      try {
        await getCameras()
        const constraints = {
          video: {
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        }
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(newStream)
        setUseCamera(true)
        if (videoRef.current) videoRef.current.srcObject = newStream
      } catch (e) {
        showToast('Camera error: ' + e.message, 'error')
      }
    }
  }

  const handleCameraChange = async (deviceId) => {
    setSelectedCameraId(deviceId)
    if (useCamera) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        setStream(newStream)
        if (videoRef.current) videoRef.current.srcObject = newStream
      } catch (e) {
        showToast('Error switching camera: ' + e.message, 'error')
      }
    }
  }

  // Real-time Match Sync
  useEffect(() => {
    if (gameStarted && isOnline && gameData?.id) {
      const unsubscribe = onSnapshot(doc(db, 'liveGames', gameData.id), (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setGameData(data)

          const myId = user.id
          const oppId = data.players.find(id => id !== myId)

          setPlayerScore(data.scores[myId])
          setOpponentScore(data.scores[oppId])
          setTurn(data.turn === myId ? 'player' : 'opponent')
          setHistory(data.history || [])

          // Show opponent's live darts
          if (data.turn !== myId && data.currentDarts) {
            setCurrentDarts(data.currentDarts)
          }

          if (data.status === 'finished') {
            const winnerId = data.scores[myId] === 0 ? myId : oppId
            showToast(winnerId === myId ? 'Match Won!' : 'Match Lost', winnerId === myId ? 'success' : 'error')
            setGameStarted(false)
          }
        }
      })
      return () => unsubscribe()
    }
  }, [gameStarted, isOnline, gameData?.id, user?.id])

  const startNewMatch = (startScore = 501, mode = 'bot') => {
    setPlayerScore(startScore)
    setOpponentScore(startScore)
    setTurn('player')
    setCurrentDarts([])
    setHistory([])
    setGameStarted(true)
    setIsOnline(mode === 'online')

    if (mode === 'bot') {
      setBot(new DartBot({ id: 'pro-1', name: 'Practice Bot', targetAverage: 55, checkoutRate: 0.2 }))
    } else {
      setBot(null)
    }
    showToast('Match Started!', 'success')
  }

  const handleHostGame = async (score = 501) => {
    setIsHosting(true)
    // In a real app, you'd create a lobby document and wait for someone to join.
    // For this prototype, we'll just allow inviting.
  }

  const handleChallenge = async (player) => {
    showToast(`Inviting ${player.username}...`, 'info')
    const inviteId = await sendGameInvite(player.id, { startScore: 501, gameFormat: 'bestOf', legsToWin: 3 })

    // Listen for acceptance
    const unsubscribe = onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
      if (snap.exists() && snap.data().status === 'accepted') {
        const gId = snap.data().gameId
        setGameData({ id: gId })
        setGameStarted(true)
        setIsOnline(true)
        setIsLobbyOpen(false)
        showToast('Challenge Accepted!', 'success')
        unsubscribe()
      }
    })
  }

  const handleDartInput = async (dart) => {
    if (turn !== 'player') return

    const scoreAfterDart = playerScore - dart.value

    // Check for win
    if (scoreAfterDart === 0) {
      if (dart.multiplier !== 2) {
        showToast('Must finish on a double!', 'warning')
        return
      }
      setPlayerScore(0)
      const nextDarts = [...currentDarts, dart]
      await endTurn(nextDarts, 0)
      return
    }

    // Check for bust
    if (scoreAfterDart < 2) {
      showToast('BUST!', 'error')
      const nextDarts = [...currentDarts, dart]
      await endTurn(nextDarts, playerScore, true)
      return
    }

    const nextDarts = [...currentDarts, dart]
    setPlayerScore(scoreAfterDart)
    setCurrentDarts(nextDarts)

    if (isOnline) {
      await updateLiveGame(gameData.id, { currentDarts: nextDarts })
    }

    if (nextDarts.length === 3) {
      await endTurn(nextDarts, scoreAfterDart)
    }
  }

  const endTurn = async (darts, remaining, isBust = false) => {
    const turnScore = isBust ? 0 : darts.reduce((sum, d) => sum + d.value, 0)
    const entry = { who: user.username, darts, score: turnScore, remaining, userId: user.id }

    const newHistory = [entry, ...history]
    setHistory(newHistory)
    setCurrentDarts([])

    if (isOnline) {
      const myId = user.id
      const oppId = gameData.players.find(id => id !== myId)
      const updates = {
        history: newHistory,
        [`scores.${myId}`]: remaining,
        turn: oppId,
        currentDarts: [],
        lastDarts: darts
      }
      if (remaining === 0) updates.status = 'finished'
      await updateLiveGame(gameData.id, updates)
    } else {
      if (remaining === 0) {
        showToast('MATCH SHOT!', 'success')
        setGameStarted(false)
      } else {
        setTurn('opponent')
      }
    }
  }

  const handleUndo = async () => {
    if (currentDarts.length === 0) return
    const lastDart = currentDarts[currentDarts.length - 1]
    const nextScore = playerScore + lastDart.value
    const nextDarts = currentDarts.slice(0, -1)

    setPlayerScore(nextScore)
    setCurrentDarts(nextDarts)

    if (isOnline) {
      await updateLiveGame(gameData.id, {
        currentDarts: nextDarts,
        [`scores.${user.id}`]: nextScore
      })
    }
  }

  // Bot Logic
  useEffect(() => {
    if (gameStarted && !isOnline && turn === 'opponent' && bot) {
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
        setHistory(prev => [{ who: bot.name, darts: botDarts, score: turnScore, remaining: finalRemaining, userId: 'bot' }, ...prev])

        if (finalRemaining === 0) {
          showToast('Bot Wins!', 'error')
          setGameStarted(false)
        } else {
          setTurn('player')
        }
      }
      runBot()
    }
  }, [turn, bot, gameStarted, opponentScore, isOnline])

  if (!gameStarted) {
    return (
      <div className="page animate-fade-in">
        <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Play Online' }]} />
        <div className="page-header">
          <h1 className="page-title text-gradient">Play Online</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time matches with dart-by-dart accuracy.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="card glass">
            <h3 style={{ color: 'var(--accent-cyan)' }}>Bot Practice</h3>
            <p style={{ margin: '15px 0', color: 'var(--text-muted)' }}>Sharpen your skills against our AI before heading online.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => startNewMatch(501, 'bot')}>501 Bot</button>
              <button className="btn btn-secondary" onClick={() => startNewMatch(301, 'bot')}>301 Bot</button>
            </div>
          </div>

          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: 'var(--accent-primary)', margin: 0 }}>Online Lobby</h3>
              <button className="btn btn-xs btn-primary" onClick={() => setIsLobbyOpen(!isLobbyOpen)}>{isLobbyOpen ? 'Hide' : 'Open Lobby'}</button>
            </div>

            {isLobbyOpen ? (
              <div className="lobby-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {availablePlayers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No players online right now.</p>
                ) : (
                  availablePlayers.map(p => (
                    <div key={p.id} className="lobby-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="status-dot" style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
                        <span style={{ fontWeight: 700 }}>{p.username}</span>
                      </div>
                      <button className="btn btn-xs btn-primary" onClick={() => handleChallenge(p)}>Challenge</button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Connect with other Elite Arrows players for a real-time match.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentOpponentName = isOnline ? (gameData?.playerNames?.[gameData.players.find(id => id !== user.id)] || 'Opponent') : (bot?.name || 'Bot')

  return (
    <div className="page match-mode animate-fade-in" style={{ padding: 0, maxWidth: '100vw', overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="match-header" style={{ padding: '15px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div className={`player-box ${turn === 'player' ? 'active' : ''}`}>
          <div className="name">{user?.username}</div>
          <div className="score">{playerScore}</div>
          {turn === 'player' && <div className="turn-indicator">Your Turn</div>}
        </div>
        <div className="vs">VS</div>
        <div className={`player-box ${turn === 'opponent' ? 'active' : ''}`}>
          <div className="name">{currentOpponentName}</div>
          <div className="score">{opponentScore}</div>
          {turn === 'opponent' && <div className="turn-indicator">{isOnline ? 'Opponent Throws' : 'Bot Throws'}</div>}
        </div>
      </div>

      <div className="match-main" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0 }}>
        <div className="match-play-area" style={{ padding: '20px', overflowY: 'auto' }}>
          <div className="match-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '10px' }}>
             <button className={`btn btn-xs ${useCamera ? 'btn-danger' : 'btn-primary'}`} onClick={toggleCamera}>
               {useCamera ? 'Disable Camera' : 'Enable Camera'}
             </button>
             {useCamera && (
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                 <select
                    className="glass"
                    style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', maxWidth: '150px' }}
                    value={selectedCameraId}
                    onChange={(e) => handleCameraChange(e.target.value)}
                 >
                   {availableCameras.map(cam => (
                     <option key={cam.deviceId} value={cam.deviceId}>
                       {cam.label || `Camera ${availableCameras.indexOf(cam) + 1}`}
                     </option>
                   ))}
                 </select>
                 <button className="btn btn-xs btn-secondary" onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.2))}><ZoomOutIcon /></button>
                 <button className="btn btn-xs btn-secondary" onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}><ZoomInIcon /></button>
               </div>
             )}
          </div>

          {useCamera && (
            <div className="camera-preview-container" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative', marginBottom: '20px', aspectRatio: '16/9' }}>
               <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoomLevel})` }} />
            </div>
          )}

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
              <div key={i} className={`history-item ${h.userId === user.id ? 'mine' : 'theirs'}`} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                marginBottom: '8px',
                borderLeft: `4px solid ${h.userId === user.id ? 'var(--accent-cyan)' : 'var(--accent-primary)'}`
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{h.who}</div>
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

        <aside className="match-stats-sidebar" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <button className="btn btn-danger btn-block" onClick={() => { if(window.confirm('Quit match?')) setGameStarted(false) }}>Quit Match</button>

          <div style={{ marginTop: '30px', flex: 1 }}>
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Live Statistics</h4>

            <div className="stat-card glass" style={{ marginBottom: '15px', padding: '15px' }}>
               <div className="stat-row">
                 <span>Legs Played</span>
                 <strong>1</strong>
               </div>
               <div className="stat-row">
                 <span>Turn Average</span>
                 <strong>{history.length > 0 ? (history.filter(h => h.userId === user.id).reduce((s, h) => s + h.score, 0) / Math.max(1, history.filter(h => h.userId === user.id).length)).toFixed(1) : '0.0'}</strong>
               </div>
               <div className="stat-row">
                 <span>Highest Score</span>
                 <strong>{history.length > 0 ? Math.max(...history.filter(h => h.userId === user.id).map(h => h.score), 0) : '0'}</strong>
               </div>
            </div>

            <div className="info-tip glass" style={{ padding: '12px', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)' }}>
               💡 Real-time stats help you track your progress throughout the leg. Use the camera to verify your throws if needed!
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .player-box { text-align: center; flex: 1; padding: 15px; border-radius: 12px; transition: 0.3s; position: relative; }
        .player-box.active { background: rgba(0, 212, 255, 0.1); border: 1px solid var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 212, 255, 0.1); }
        .player-box .name { font-weight: 800; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .player-box .score { font-size: 3.5rem; font-weight: 900; color: white; line-height: 1; margin: 5px 0; }
        .player-box.active .score { color: var(--accent-cyan); }
        .player-box .turn-indicator { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: var(--accent-cyan); color: #000; font-size: 0.6rem; font-weight: 900; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
        .vs { font-weight: 900; color: var(--text-muted); margin: 0 30px; font-style: italic; }

        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .stat-row:last-child { border-bottom: none; }
        .stat-row span { color: var(--text-muted); font-size: 0.85rem; }
        .stat-row strong { color: white; font-weight: 800; }

        @media (max-width: 1100px) {
          .match-main { grid-template-columns: 1fr; }
          .match-stats-sidebar { display: none; }
        }
      `}</style>
    </div>
  )
}
