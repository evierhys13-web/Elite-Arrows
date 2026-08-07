import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, doc, onSnapshot, setDoc, updateDoc, collection, query, where, deleteDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { DartBot } from '../utils/DartBot'
import { Capacitor } from '@capacitor/core'

/* Icons */
const FlipIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h10V4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M20 8l-4 4 4 4" /></svg>
const ZoomInIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
const ZoomOutIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>

/* Components */
const DartboardInput = ({ onDart, onUndo, currentDarts, disabled }) => {
  const [multiplier, setMultiplier] = useState(1)
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
        {numbers.map(n => <button key={n} className="num-btn" onClick={() => handleNumClick(n)} disabled={disabled}>{n}</button>)}
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
        .dart-input-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 380px; }
        .multipliers { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .multi-btn { padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: white; font-weight: 800; cursor: pointer; font-size: 0.8rem; }
        .multi-btn.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.1); }
        .multi-btn.dbl.active { border-color: #22c55e; }
        .multi-btn.trb.active { border-color: #ef4444; }
        .numbers-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .num-btn { aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: white; font-weight: 700; cursor: pointer; transition: 0.1s; font-size: 0.9rem; }
        .num-btn:active { transform: scale(0.9); }
        .num-btn.bull { background: #eab308; color: black; font-weight: 900; }
        .num-btn.miss { background: #334155; }
        .input-footer { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px; }
        .current-turn-darts { display: flex; gap: 6px; }
        .dart-slot { width: 40px; height: 32px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); }
        .dart-slot.filled { color: var(--accent-cyan); border-color: var(--accent-cyan); }
        .undo-btn { padding: 6px 12px; border-radius: 6px; border: none; background: #ef4444; color: white; font-weight: 700; cursor: pointer; font-size: 0.75rem; }
      `}</style>
    </div>
  )
}

const CheckoutSuggestion = ({ score }) => {
  const checkouts = { 170: 'T20, T20, BULL', 167: 'T20, T19, BULL', 164: 'T20, T18, BULL', 161: 'T20, T17, BULL', 160: 'T20, T20, D20', 158: 'T20, T20, D19', 141: 'T20, T19, D12', 121: 'T20, T11, D20', 100: 'T20, D20', 60: 'S20, D20', 40: 'D20', 32: 'D16', 16: 'D8', 8: 'D4', 4: 'D2', 2: 'D1' }
  const suggestion = checkouts[score]
  if (!suggestion) return null
  return (
    <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', padding: '8px 15px', borderRadius: '8px', textAlign: 'center', marginBottom: '10px', fontSize: '0.75rem' }}>
      <span style={{ color: '#22c55e', fontWeight: 800, marginRight: '8px' }}>CHECKOUT:</span>
      <span style={{ color: 'white', fontWeight: 700 }}>{suggestion}</span>
    </div>
  )
}

export default function PlayOnline() {
  const { user, sendGameInvite, updateLiveGame } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('play')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameData, setGameData] = useState(null)

  // Scoring State
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [vPlayerScore, setVPlayerScore] = useState(501)
  const [vOpponentScore, setVOpponentScore] = useState(501)

  const [turn, setTurn] = useState('player')
  const [currentDarts, setCurrentDarts] = useState([])
  const [history, setHistory] = useState([])
  const [bot, setBot] = useState(null)
  const [isOnline, setIsOnline] = useState(false)

  // Lobby State
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [liveGames, setLiveGames] = useState([])
  const [matchConfig, setMatchConfig] = useState({ startScore: 501, legs: 3, mode: 'bot' })

  // Camera State
  const [useCamera, setUseCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isWebAiActive, setIsWebAiActive] = useState(false)
  const videoRef = useRef(null)

  // Initialize camera list
  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (e) { console.error(e) }
  }, [selectedCameraId])

  // End turn logic
  const endTurn = useCallback(async (darts, remaining, isBust = false) => {
    const turnScore = isBust ? 0 : darts.reduce((sum, d) => sum + d.value, 0)
    const entry = { who: user.username, darts, score: turnScore, remaining, userId: user.id }
    const nextHistory = [entry, ...history]

    setHistory(nextHistory)
    setCurrentDarts([])
    setVPlayerScore(remaining)
    setPlayerScore(remaining)

    if (isOnline && gameData?.id) {
      const oppId = gameData.players.find(id => id !== user.id)
      const updates = {
        history: nextHistory,
        [`scores.${user.id}`]: remaining,
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
  }, [user, history, isOnline, gameData?.id, updateLiveGame, showToast])

  // Handle manual input
  const handleDartInput = useCallback(async (dart) => {
    if (turn !== 'player') return
    const nextScore = playerScore - dart.value

    if (nextScore === 0) {
      if (dart.multiplier !== 2) {
        showToast('Must finish on a double!', 'warning')
        return
      }
      setVPlayerScore(0)
      await endTurn([...currentDarts, dart], 0)
      return
    }

    if (nextScore < 2) {
      showToast('BUST!', 'error')
      await endTurn([...currentDarts, dart], playerScore, true)
      return
    }

    const nextDarts = [...currentDarts, dart]
    setVPlayerScore(nextScore)
    setPlayerScore(nextScore)
    setCurrentDarts(nextDarts)

    if (isOnline && gameData?.id) {
      await updateLiveGame(gameData.id, { currentDarts: nextDarts })
    }

    if (nextDarts.length === 3) {
      await endTurn(nextDarts, nextScore)
    }
  }, [turn, playerScore, currentDarts, endTurn, isOnline, gameData?.id, updateLiveGame, showToast])

  // Camera Actions
  const toggleCamera = useCallback(async () => {
    if (useCamera) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setStream(null)
      setUseCamera(false)
      setIsWebAiActive(false)
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
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(s)
        setUseCamera(true)
        if (videoRef.current) videoRef.current.srcObject = s
      } catch (e) { showToast('Camera error: ' + e.message, 'error') }
    }
  }, [useCamera, stream, selectedCameraId, getCameras, showToast])

  const flipCamera = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      if (videoDevices.length < 2) {
        showToast('Only one camera detected', 'info')
        return
      }

      const currentIdx = videoDevices.findIndex(d => d.deviceId === selectedCameraId)
      const nextIdx = (currentIdx + 1) % videoDevices.length
      const nextId = videoDevices[nextIdx].deviceId

      setSelectedCameraId(nextId)
      if (useCamera) {
        if (stream) stream.getTracks().forEach(t => t.stop())
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        setStream(s)
        if (videoRef.current) videoRef.current.srcObject = s
      }
    } catch (e) { showToast('Flip error: ' + e.message, 'error') }
  }, [selectedCameraId, useCamera, stream, showToast])

  const handleCameraChange = useCallback(async (id) => {
    setSelectedCameraId(id)
    if (useCamera) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        setStream(s)
        if (videoRef.current) videoRef.current.srcObject = s
      } catch (e) { showToast('Error: ' + e.message, 'error') }
    }
  }, [useCamera, stream, showToast])

  // AI Scorer Logic
  const launchNativeDetection = useCallback(async () => {
    try {
      const { registerPlugin } = await import('@capacitor/core')
      const DartDetection = registerPlugin('DartDetection')
      await DartDetection.startDetection()
      showToast('AI Auto-Scoring Mode Active', 'info')
    } catch (e) {
      // Fallback: Enable Web-based AI logic
      if (!useCamera) {
        await toggleCamera()
      }
      setIsWebAiActive(true)
      showToast('AI Auto-Scoring (Web) Enabled', 'info')
    }
  }, [useCamera, toggleCamera, showToast])

  const handleUndo = useCallback(async () => {
    if (currentDarts.length === 0) return
    const last = currentDarts[currentDarts.length - 1]
    const ns = playerScore + last.value
    const nd = currentDarts.slice(0, -1)
    setPlayerScore(ns)
    setVPlayerScore(ns)
    setCurrentDarts(nd)
    if (isOnline && gameData?.id) {
      await updateLiveGame(gameData.id, { currentDarts: nd, [`scores.${user.id}`]: ns })
    }
  }, [currentDarts, playerScore, isOnline, gameData?.id, user.id, updateLiveGame])

  const startNewMatch = useCallback((s = 501, mode = 'bot', l = 3) => {
    setPlayerScore(s)
    setOpponentScore(s)
    setVPlayerScore(s)
    setVOpponentScore(s)
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
  }, [showToast])

  const handleChallenge = useCallback(async (p) => {
    showToast(`Inviting ${p.username}...`, 'info')
    const inviteId = await sendGameInvite(p.id, { startScore: matchConfig.startScore, gameFormat: 'bestOf', legsToWin: matchConfig.legs })
    onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
      if (snap.exists() && snap.data().status === 'accepted') {
        setGameData({ id: snap.data().gameId })
        setGameStarted(true)
        setIsOnline(true)
        setActiveTab('play')
        showToast('Accepted!', 'success')
      }
    })
  }, [matchConfig, sendGameInvite, showToast])

  // UI Effects
  useEffect(() => {
    if (gameStarted) document.body.classList.add('fullscreen-match')
    else document.body.classList.remove('fullscreen-match')
    return () => document.body.classList.remove('fullscreen-match')
  }, [gameStarted])

  useEffect(() => {
    if (!user?.id) return
    const presenceRef = doc(db, 'lobbyPresence', user.id)
    setDoc(presenceRef, { userId: user.id, username: user.username, avatar: user.profilePicture || null, lastSeen: new Date().toISOString() }).catch(() => {})
    const timer = setInterval(() => updateDoc(presenceRef, { lastSeen: new Date().toISOString() }).catch(() => {}), 10000)
    return () => { clearInterval(timer); deleteDoc(presenceRef).catch(() => {}) }
  }, [user?.id])

  useEffect(() => {
    const q = query(collection(db, 'lobbyPresence'))
    return onSnapshot(q, (snap) => {
      const now = Date.now()
      setAvailablePlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.id !== user?.id && (now - new Date(p.lastSeen).getTime()) < 30000))
    })
  }, [user?.id])

  useEffect(() => {
    const q = query(collection(db, 'liveGames'), where('status', '==', 'active'))
    return onSnapshot(q, (snap) => setLiveGames(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    const onDetection = (e) => handleDartInput({ value: e.detail.scoreValue, label: e.detail.scoreLabel || 'AI' })
    window.addEventListener('dartDetectionScore', onDetection)
    return () => window.removeEventListener('dartDetectionScore', onDetection)
  }, [handleDartInput])

  // Online Sync
  useEffect(() => {
    if (gameStarted && isOnline && gameData?.id) {
      return onSnapshot(doc(db, 'liveGames', gameData.id), (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setGameData(data)
          const oppId = data.players.find(id => id !== user.id)

          setPlayerScore(data.scores[user.id])
          setVPlayerScore(data.scores[user.id])
          setOpponentScore(data.scores[oppId])
          setVOpponentScore(data.scores[oppId])

          setTurn(data.turn === user.id ? 'player' : 'opponent')
          setHistory(data.history || [])

          if (data.turn !== user.id && data.currentDarts) {
            setCurrentDarts(data.currentDarts)
            const turnSum = data.currentDarts.reduce((s, d) => s + d.value, 0)
            setVOpponentScore(data.scores[oppId] - turnSum)
          }

          if (data.status === 'finished') {
            showToast(data.scores[user.id] === 0 ? 'Match Won!' : 'Match Lost', 'info')
            setGameStarted(false)
          }
        }
      })
    }
  }, [gameStarted, isOnline, gameData?.id, user?.id, showToast])

  // Bot Turn Simulation
  useEffect(() => {
    if (gameStarted && !isOnline && turn === 'opponent' && bot) {
      const run = async () => {
        let rem = opponentScore
        const darts = []
        for (let i = 0; i < 3; i++) {
          await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
          const d = bot.calculateDart(rem, i)
          darts.push(d)
          rem -= d.value
          setVOpponentScore(rem)
          setCurrentDarts([...darts])
          if (rem <= 0) break
        }
        await new Promise(r => setTimeout(r, 800))
        const isBust = rem < 0 || rem === 1
        const ts = isBust ? 0 : darts.reduce((s, d) => s + d.value, 0)
        const fr = isBust ? opponentScore : rem

        setOpponentScore(fr)
        setVOpponentScore(fr)
        setHistory(prev => [{ who: bot.name, darts, score: ts, remaining: fr, userId: 'bot' }, ...prev])
        setCurrentDarts([])

        if (fr === 0) {
          showToast('Bot Wins!', 'error')
          setGameStarted(false)
        } else {
          setTurn('player')
        }
      }
      run()
    }
  }, [turn, bot, gameStarted, isOnline, showToast, opponentScore])

  const oppName = isOnline ? (gameData?.playerNames?.[gameData.players.find(id => id !== user.id)] || 'Opponent') : (bot?.name || 'Bot')
  const oppId = isOnline ? gameData.players.find(id => id !== user.id) : 'bot'

  const getStats = (uid) => {
    const userHistory = history.filter(h => h.userId === uid)
    const dartsThrown = userHistory.reduce((s, h) => s + h.darts.length, 0)
    const totalScored = userHistory.reduce((s, h) => s + h.score, 0)
    const avg = dartsThrown > 0 ? (totalScored / dartsThrown * 3).toFixed(1) : '0.0'
    const last = userHistory.length > 0 ? userHistory[0].score : '-'
    return { avg, last, darts: dartsThrown }
  }

  const myStats = getStats(user.id)
  const oppStats = getStats(oppId)

  return (
    <div className="page match-mode animate-fade-in" style={{ padding: 0, maxWidth: '100vw', overflow: 'hidden', height: '100vh', display: 'flex', background: '#050816' }}>

      {/* Left Sidebar: Stats */}
      <aside style={{ width: '320px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
        <div className={`player-block ${turn === 'player' ? 'active' : ''}`} style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>{user?.username}</div>
          <div style={{ fontSize: '5.5rem', fontWeight: 900, color: turn === 'player' ? 'var(--accent-cyan)' : 'white', lineHeight: 1, margin: '10px 0' }}>{vPlayerScore}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="stat-item"><label>AVG</label><strong>{myStats.avg}</strong></div>
            <div className="stat-item"><label>LAST</label><strong>{myStats.last}</strong></div>
            <div className="stat-item"><label>DARTS</label><strong>{myStats.darts}</strong></div>
          </div>
          {turn === 'player' && <div className="active-glow" />}
        </div>

        <div className={`player-block ${turn === 'opponent' ? 'active' : ''}`} style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>{oppName}</div>
          <div style={{ fontSize: '5.5rem', fontWeight: 900, color: turn === 'opponent' ? 'var(--accent-cyan)' : 'white', lineHeight: 1, margin: '10px 0' }}>{vOpponentScore}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="stat-item"><label>AVG</label><strong>{oppStats.avg}</strong></div>
            <div className="stat-item"><label>LAST</label><strong>{oppStats.last}</strong></div>
            <div className="stat-item"><label>DARTS</label><strong>{oppStats.darts}</strong></div>
          </div>
          {turn === 'opponent' && <div className="active-glow" />}
        </div>
      </aside>

      {/* Main Scoring Area */}
      <main style={{ flex: 1, display: 'flex', height: '100vh' }}>
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <button className="btn btn-danger btn-xs" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, fontWeight: 900 }} onClick={() => { if(window.confirm('Quit match?')) setGameStarted(false) }}>LEAVE MATCH</button>

          <CheckoutSuggestion score={vPlayerScore} />

          <DartboardInput
            onDart={handleDartInput}
            onUndo={handleUndo}
            currentDarts={currentDarts}
            disabled={turn !== 'player'}
          />
        </div>

        {/* Camera Sidebar */}
        <aside style={{ width: '400px', background: 'rgba(0,0,0,0.5)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className={`btn btn-xs flex-1 ${useCamera ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleCamera}>
                {useCamera ? 'CAM OFF' : 'CAM ON'}
              </button>
              <button className={`btn btn-xs flex-1 ${isWebAiActive ? 'btn-success' : 'btn-primary'}`} onClick={launchNativeDetection}>
                {isWebAiActive ? 'AI ACTIVE' : 'AI SCORER'}
              </button>
            </div>

            {useCamera && (
              <select
                className="glass"
                style={{ width: '100%', padding: '8px', fontSize: '0.7rem', borderRadius: '8px' }}
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
              >
                {availableCameras.map(c => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${availableCameras.indexOf(c) + 1}`}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            {useCamera ? (
              <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#000', position: 'relative', aspectRatio: '9/16', border: `2px solid ${isWebAiActive ? 'var(--accent-primary)' : 'var(--accent-cyan)'}`, boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoomLevel})` }} />

                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px', borderRadius: '20px', backdropFilter: 'blur(10px)' }}>
                   <button onClick={() => setZoomLevel(z => Math.max(1, z - 0.2))} className="cam-tool-btn">-</button>
                   <button onClick={() => setZoomLevel(z => Math.min(5, z + 0.2))} className="cam-tool-btn">+</button>
                   <button onClick={flipCamera} className="cam-tool-btn" style={{ fontSize: '0.6rem' }}>FLIP</button>
                </div>

                {isWebAiActive && (
                  <div className="ai-overlay">
                     <div className="scanning-line" />
                     <span>AI TRACKING</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="camera-placeholder">
                <span>CAMERA OFF</span>
              </div>
            )}
          </div>
        </aside>
      </main>

      <style>{`
        body.fullscreen-match .sidebar, body.fullscreen-match .bottom-nav, body.fullscreen-match .mobile-header { display: none !important; }
        body.fullscreen-match .main-content { padding: 0 !important; margin: 0 !important; }
        body.fullscreen-match .app-layout { grid-template-columns: 1fr !important; }

        .stat-item { text-align: center; }
        .stat-item label { display: block; font-size: 0.55rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px; }
        .stat-item strong { display: block; font-size: 1.1rem; color: white; }

        .active-glow { position: absolute; inset: 0; border-left: 4px solid var(--accent-cyan); background: linear-gradient(to right, rgba(0, 212, 255, 0.05), transparent); pointer-events: none; }

        .cam-tool-btn { border: none; background: none; color: white; fontWeight: 900; cursor: pointer; width: 30px; height: 30px; display: flex; alignItems: center; justifyContent: center; }

        .camera-placeholder { width: 100%; height: 100%; borderRadius: 16px; border: 2px dashed var(--border); display: flex; alignItems: center; justifyContent: center; color: var(--text-muted); fontSize: 0.8rem; background: rgba(255,255,255,0.02); }

        .ai-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .ai-overlay span { background: var(--accent-primary); color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; position: absolute; top: 10px; left: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .scanning-line { width: 100%; height: 2px; background: rgba(255, 60, 60, 0.3); position: absolute; top: 0; animation: scan 2s linear infinite; }

        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }

        @media (max-width: 1000px) {
           .match-mode { flex-direction: column !important; overflow-y: auto !important; }
           .match-mode aside { width: 100% !important; flex-direction: row !important; height: auto !important; }
           .match-mode main { flex-direction: column !important; height: auto !important; }
           .match-mode main aside { width: 100% !important; }
           .player-block { flex: 1 !important; border-bottom: none !important; border-right: 1px solid var(--border); }
        }
      `}</style>
    </div>
  )
}
