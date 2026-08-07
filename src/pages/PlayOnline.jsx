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
  const checkouts = { 170: 'T20, T20, BULL', 167: 'T20, T19, BULL', 164: 'T20, T18, BULL', 161: 'T20, T17, BULL', 160: 'T20, T20, D20', 158: 'T20, T20, D19', 141: 'T20, T19, D12', 121: 'T20, T11, D20', 100: 'T20, D20', 60: 'S20, D20', 40: 'D20', 32: 'D16', 16: 'D8', 8: 'D4', 4: 'D2', 2: 'D1' }
  const suggestion = checkouts[score]
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
  const { user, sendGameInvite, updateLiveGame } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('play')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameData, setGameData] = useState(null)
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [turn, setTurn] = useState('player')
  const [currentDarts, setCurrentDarts] = useState([])
  const [history, setHistory] = useState([])
  const [bot, setBot] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [liveGames, setLiveGames] = useState([])
  const [matchConfig, setMatchConfig] = useState({ startScore: 501, legs: 3, mode: 'bot' })
  const [useCamera, setUseCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)
  const videoRef = useRef(null)
  const isAndroid = Capacitor.getPlatform() === 'android'

  const endTurn = useCallback(async (darts, remaining, isBust = false) => {
    const turnScore = isBust ? 0 : darts.reduce((sum, d) => sum + d.value, 0)
    const entry = { who: user.username, darts, score: turnScore, remaining, userId: user.id }
    const nextHistory = [entry, ...history]
    setHistory(nextHistory)
    setCurrentDarts([])
    if (isOnline && gameData?.id) {
      const oppId = gameData.players.find(id => id !== user.id)
      const updates = { history: nextHistory, [`scores.${user.id}`]: remaining, turn: oppId, currentDarts: [], lastDarts: darts }
      if (remaining === 0) updates.status = 'finished'
      await updateLiveGame(gameData.id, updates)
    } else {
      if (remaining === 0) { showToast('MATCH SHOT!', 'success'); setGameStarted(false) }
      else setTurn('opponent')
    }
  }, [user, history, isOnline, gameData?.id, updateLiveGame, showToast])

  const handleDartInput = useCallback(async (dart) => {
    if (turn !== 'player') return
    const nextScore = playerScore - dart.value
    if (nextScore === 0) {
      if (dart.multiplier !== 2) { showToast('Must finish on a double!', 'warning'); return }
      setPlayerScore(0)
      await endTurn([...currentDarts, dart], 0)
      return
    }
    if (nextScore < 2) { showToast('BUST!', 'error'); await endTurn([...currentDarts, dart], playerScore, true); return }
    const nextDarts = [...currentDarts, dart]
    setPlayerScore(nextScore)
    setCurrentDarts(nextDarts)
    if (isOnline && gameData?.id) await updateLiveGame(gameData.id, { currentDarts: nextDarts })
    if (nextDarts.length === 3) await endTurn(nextDarts, nextScore)
  }, [turn, playerScore, currentDarts, endTurn, isOnline, gameData?.id, updateLiveGame, showToast])

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

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) setSelectedCameraId(videoDevices[0].deviceId)
    } catch (e) { console.error(e) }
  }

  const toggleCamera = async () => {
    if (useCamera) { if (stream) stream.getTracks().forEach(t => t.stop()); setStream(null); setUseCamera(false) }
    else {
      try {
        await getCameras()
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } })
        setStream(s); setUseCamera(true)
        if (videoRef.current) videoRef.current.srcObject = s
      } catch (e) { showToast('Camera error: ' + e.message, 'error') }
    }
  }

  const handleCameraChange = async (id) => {
    setSelectedCameraId(id)
    if (useCamera) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } } })
        setStream(s); if (videoRef.current) videoRef.current.srcObject = s
      } catch (e) { showToast('Error: ' + e.message, 'error') }
    }
  }

  useEffect(() => {
    if (gameStarted && isOnline && gameData?.id) {
      return onSnapshot(doc(db, 'liveGames', gameData.id), (snap) => {
        if (snap.exists()) {
          const data = snap.data(); setGameData(data)
          const oppId = data.players.find(id => id !== user.id)
          setPlayerScore(data.scores[user.id]); setOpponentScore(data.scores[oppId])
          setTurn(data.turn === user.id ? 'player' : 'opponent'); setHistory(data.history || [])
          if (data.turn !== user.id && data.currentDarts) setCurrentDarts(data.currentDarts)
          if (data.status === 'finished') { showToast(data.scores[user.id] === 0 ? 'Match Won!' : 'Match Lost', 'info'); setGameStarted(false) }
        }
      })
    }
  }, [gameStarted, isOnline, gameData?.id, user?.id, showToast])

  const startNewMatch = (s = 501, mode = 'bot', l = 3) => {
    setPlayerScore(s); setOpponentScore(s); setTurn('player'); setCurrentDarts([]); setHistory([]); setGameStarted(true); setIsOnline(mode === 'online')
    if (mode === 'bot') setBot(new DartBot({ id: 'pro-1', name: 'Practice Bot', targetAverage: 55, checkoutRate: 0.2 }))
    else setBot(null)
    showToast('Match Started!', 'success')
  }

  const handleChallenge = async (p) => {
    showToast(`Inviting ${p.username}...`, 'info')
    const inviteId = await sendGameInvite(p.id, { startScore: matchConfig.startScore, gameFormat: 'bestOf', legsToWin: matchConfig.legs })
    onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
      if (snap.exists() && snap.data().status === 'accepted') {
        setGameData({ id: snap.data().gameId }); setGameStarted(true); setIsOnline(true); setActiveTab('play'); showToast('Accepted!', 'success')
      }
    })
  }

  const handleUndo = async () => {
    if (currentDarts.length === 0) return
    const last = currentDarts[currentDarts.length - 1]; const ns = playerScore + last.value; const nd = currentDarts.slice(0, -1)
    setPlayerScore(ns); setCurrentDarts(nd)
    if (isOnline && gameData?.id) await updateLiveGame(gameData.id, { currentDarts: nd, [`scores.${user.id}`]: ns })
  }

  useEffect(() => {
    if (gameStarted && !isOnline && turn === 'opponent' && bot) {
      const run = async () => {
        await new Promise(r => setTimeout(r, 1500)); let rem = opponentScore; const darts = []
        for (let i = 0; i < 3; i++) {
          const d = bot.calculateDart(rem, i); darts.push(d); rem -= d.value
          if (rem <= 0) break
          await new Promise(r => setTimeout(r, 800))
        }
        const isBust = rem < 0 || rem === 1; const ts = isBust ? 0 : darts.reduce((s, d) => s + d.value, 0); const fr = isBust ? opponentScore : rem
        setOpponentScore(fr); setHistory(prev => [{ who: bot.name, darts, score: ts, remaining: fr, userId: 'bot' }, ...prev])
        if (fr === 0) { showToast('Bot Wins!', 'error'); setGameStarted(false) } else setTurn('player')
      }
      run()
    }
  }, [turn, bot, gameStarted, opponentScore, isOnline, showToast])

  if (!gameStarted) {
    return (
      <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Play Online' }]} />
        <div className="dart-counter-header" style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
           <button className={`tab-btn ${activeTab === 'play' ? 'active' : ''}`} onClick={() => setActiveTab('play')}>Play</button>
           <button className={`tab-btn ${activeTab === 'lobby' ? 'active' : ''}`} onClick={() => setActiveTab('lobby')}>Lobby ({availablePlayers.length})</button>
           <button className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Games ({liveGames.length})</button>
        </div>

        {activeTab === 'play' && (
          <div className="setup-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
            <div className="setup-card card glass">
              <h2 className="text-gradient" style={{ marginBottom: '20px' }}>Match Setup</h2>
              <div className="setup-section"><label>Opponent Type</label>
                <div className="toggle-group" style={{ marginBottom: '20px' }}>
                  <button className={matchConfig.mode === 'bot' ? 'active' : ''} onClick={() => setMatchConfig({...matchConfig, mode: 'bot'})}>DartBot</button>
                  <button className={matchConfig.mode === 'online' ? 'active' : ''} onClick={() => setActiveTab('lobby')}>Friend / Online</button>
                </div>
              </div>
              <div className="setup-section"><label>Starting Score</label>
                <div className="toggle-group">{[101, 301, 501, 701].map(s => <button key={s} className={matchConfig.startScore === s ? 'active' : ''} onClick={() => setMatchConfig({...matchConfig, startScore: s})}>{s}</button>)}</div>
              </div>
              <div className="setup-section" style={{ marginTop: '20px' }}><label>Legs (Best of)</label>
                <div className="toggle-group">{[1, 3, 5, 7, 9].map(l => <button key={l} className={matchConfig.legs === l ? 'active' : ''} onClick={() => setMatchConfig({...matchConfig, legs: l})}>{l}</button>)}</div>
              </div>
              <div className="setup-section" style={{ marginTop: '30px' }}><button className="btn btn-primary btn-block btn-lg" onClick={() => startNewMatch(matchConfig.startScore, 'bot', matchConfig.legs)}>Start Match vs Bot</button></div>
            </div>
            <div className="quick-stats-card card glass"><h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Pro Features</h3>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}><li>✅ Accurate Dart-by-Dart scoring</li><li>✅ Multi-camera support with zoom</li><li>✅ Real-time opponent sync</li><li>✅ Detailed turn history</li></ul>
            </div>
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="lobby-view"><div className="card glass"><h2 style={{ color: 'var(--accent-primary)', marginBottom: '20px' }}>Active Players</h2>
            <div className="player-list">{availablePlayers.length === 0 ? <p style={{ textAlign: 'center', padding: '40px' }}>Waiting for other players...</p> : availablePlayers.map(p => (
              <div key={p.id} className="player-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}><div className="avatar-ring" style={{ width: '40px', height: '40px' }}><div className="avatar-inner">{p.avatar ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.username || '?')[0].toUpperCase()}</div></div><span style={{ fontWeight: 800 }}>{p.username}</span></div>
                <button className="btn btn-primary btn-sm" onClick={() => handleChallenge(p)}>Challenge</button>
              </div>
            ))}</div>
          </div></div>
        )}

        {activeTab === 'live' && (
          <div className="live-games-view"><div className="card glass"><h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px' }}>Live Matches</h2>
            <div className="games-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {liveGames.length === 0 ? <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No live games.</p> : liveGames.map(g => (
                <div key={g.id} className="live-game-card card glass"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span style={{ fontWeight: 800 }}>{g.playerNames[g.players[0]]}</span><span style={{ color: 'var(--accent-cyan)', fontWeight: 900 }}>{g.scores[g.players[0]]}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 800 }}>{g.playerNames[g.players[1]]}</span><span style={{ color: 'var(--accent-cyan)', fontWeight: 900 }}>{g.scores[g.players[1]]}</span></div>
                  <button className="btn btn-secondary btn-block btn-sm" style={{ marginTop: '15px' }} onClick={() => { setGameData(g); setGameStarted(true); setIsOnline(true); }}>Watch</button>
                </div>
              ))}
            </div>
          </div></div>
        )}

        <style>{`
           .tab-btn { background: none; border: none; color: var(--text-muted); font-weight: 800; font-size: 1.1rem; cursor: pointer; padding: 10px 20px; transition: 0.3s; position: relative; }
           .tab-btn.active { color: var(--accent-cyan); }
           .tab-btn.active::after { content: ''; position: absolute; bottom: 0; left: 20px; right: 20px; height: 3px; background: var(--accent-cyan); border-radius: 2px; }
           .setup-section label { display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; margin-bottom: 10px; }
           .toggle-group { display: flex; gap: 10px; flex-wrap: wrap; }
           .toggle-group button { flex: 1; min-width: 60px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
           .toggle-group button.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.1); box-shadow: 0 0 15px rgba(0, 212, 255, 0.1); }
        `}</style>
      </div>
    )
  }

  const oppName = isOnline ? (gameData?.playerNames?.[gameData.players.find(id => id !== user.id)] || 'Opponent') : (bot?.name || 'Bot')

  return (
    <div className="page match-mode animate-fade-in" style={{ padding: 0, maxWidth: '100vw', overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="match-header" style={{ padding: '15px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
        <div className={`player-box ${turn === 'player' ? 'active' : ''}`}><div className="name">{user?.username}</div><div className="score">{playerScore}</div>{turn === 'player' && <div className="turn-indicator">Your Turn</div>}</div>
        <div className="vs">VS</div>
        <div className={`player-box ${turn === 'opponent' ? 'active' : ''}`}><div className="name">{oppName}</div><div className="score">{opponentScore}</div>{turn === 'opponent' && <div className="turn-indicator">{isOnline ? 'Opponent Throws' : 'Bot Throws'}</div>}</div>
        <button className="btn btn-danger btn-xs" style={{ position: 'absolute', top: '15px', right: '20px', padding: '8px 12px', fontSize: '0.65rem', fontWeight: 900 }} onClick={() => { if(window.confirm('Quit match?')) setGameStarted(false) }}>LEAVE MATCH</button>
      </div>
      <div className="match-main" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0 }}>
        <div className="match-play-area" style={{ padding: '20px', overflowY: 'auto' }}>
          <div className="match-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '10px' }}>
             <button className={`btn btn-xs ${useCamera ? 'btn-danger' : 'btn-primary'}`} onClick={toggleCamera}>{useCamera ? 'Disable Camera' : 'Enable Camera'}</button>
             {isAndroid && <button className="btn btn-xs btn-primary" onClick={launchNativeDetection}>🎥 Launch AI Scorer</button>}
             {useCamera && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
               <select className="glass" style={{ fontSize: '0.7rem', padding: '4px 8px' }} value={selectedCameraId} onChange={(e) => handleCameraChange(e.target.value)}>{availableCameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>)}</select>
               <button className="btn btn-xs btn-secondary" onClick={() => setZoomLevel(p => Math.max(1, p - 0.2))}><ZoomOutIcon /></button>
               <button className="btn btn-xs btn-secondary" onClick={() => setZoomLevel(p => Math.min(3, p + 0.2))}><ZoomInIcon /></button>
             </div>}
          </div>
          {useCamera && <div className="camera-preview-container" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '20px', aspectRatio: '16/9' }}><video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoomLevel})` }} /></div>}
          <CheckoutSuggestion score={playerScore} /><DartboardInput onDart={handleDartInput} onUndo={handleUndo} currentDarts={currentDarts} disabled={turn !== 'player'} />
          <div className="history-list" style={{ marginTop: '30px' }}>{history.map((h, i) => (
            <div key={i} className={`history-item ${h.userId === user.id ? 'mine' : 'theirs'}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${h.userId === user.id ? 'var(--accent-cyan)' : 'var(--accent-primary)'}` }}>
              <div><div style={{ fontWeight: 800 }}>{h.who}</div><div style={{ fontSize: '0.7rem' }}>{h.darts.map(d => d.label).join(', ')}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 900 }}>{h.score}</div><div style={{ fontSize: '0.7rem' }}>Left: {h.remaining}</div></div>
            </div>
          ))}</div>
        </div>
        <aside className="match-stats-sidebar" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '20px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Live Statistics</h4>
          <div className="stat-card glass" style={{ padding: '15px' }}>
            <div className="stat-row"><span>Turn Average</span><strong>{history.length > 0 ? (history.filter(h => h.userId === user.id).reduce((s, h) => s + h.score, 0) / Math.max(1, history.filter(h => h.userId === user.id).length)).toFixed(1) : '0.0'}</strong></div>
            <div className="stat-row"><span>Highest Score</span><strong>{history.length > 0 ? Math.max(...history.filter(h => h.userId === user.id).map(h => h.score), 0) : '0'}</strong></div>
          </div>
        </aside>
      </div>
      <style>{`
        body.fullscreen-match .sidebar, body.fullscreen-match .bottom-nav, body.fullscreen-match .mobile-header { display: none !important; }
        body.fullscreen-match .main-content { padding: 0 !important; margin: 0 !important; }
        body.fullscreen-match .app-layout { grid-template-columns: 1fr !important; }
        .player-box { text-align: center; flex: 1; padding: 15px; border-radius: 12px; transition: 0.3s; position: relative; }
        .player-box.active { background: rgba(0, 212, 255, 0.1); border: 1px solid var(--accent-cyan); }
        .player-box .score { font-size: 3.5rem; font-weight: 900; color: white; }
        .player-box.active .score { color: var(--accent-cyan); }
        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        @media (max-width: 1100px) { .match-main { grid-template-columns: 1fr; } .match-stats-sidebar { display: none; } .match-header { padding-right: 120px !important; } }
      `}</style>
    </div>
  )
}
