import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DartBot } from '../utils/DartBot'
import Breadcrumbs from '../components/Breadcrumbs'
import ScoliaBoard from '../components/ScoliaBoard'
import { useToast } from '../context/ToastContext'
import { db, doc, onSnapshot, updateDoc, arrayUnion } from '../firebase'
import { Capacitor } from '@capacitor/core'

export default function LiveMatch() {
  const { user, sendGameInvite } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const videoRef = useRef(null)

  // Game Setup State
  const [gameStarted, setGameStarted] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [startScore, setStartScore] = useState(501)
  const [isVsBot, setIsVsBot] = useState(true)
  const [gameFormat, setGameFormat] = useState('bestOf') // 'bestOf' or 'firstTo'
  const [legsToWin, setLegsCount] = useState(3)
  const [botConfig, setBotConfig] = useState({ average: 50, checkout: 20 })

  // Online State
  const [onlineGameId, setOnlineGameId] = useState(null)
  const [isWaitingForAccept, setIsWaitingForAccept] = useState(false)

  // Live Match State
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [playerLegs, setPlayerLegs] = useState(0)
  const [opponentLegs, setOpponentLegs] = useState(0)
  const [turn, setTurn] = useState('player') // 'player' or 'bot'/'opponent'
  const [history, setHistory] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [bot, setBot] = useState(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [lastBotDarts, setLastBotDarts] = useState([])

  // Camera State
  const [useCamera, setUseCamera] = useState(false)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [stream, setStream] = useState(null)

  useEffect(() => {
    if (location.state && location.state.invitePlayer) {
        setIsVsBot(false)
        setIsOnline(true)
    }
  }, [location.state])

  useEffect(() => {
    // Check for available cameras
    const getCameras = async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('Camera API not available')
            return
        }

        try {
            // Request permission first to ensure labels are visible (especially for OBS)
            await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {})

            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter(device => device.kind === 'videoinput')
            setAvailableCameras(videoDevices)

            // Only set if not already set to avoid loops
            if (videoDevices.length > 0) {
                setSelectedCamera(prev => prev || videoDevices[0].deviceId)
            }
        } catch (e) {
            console.error('Error fetching cameras:', e)
        }
    }
    getCameras()
  }, [])

  const startCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera API not supported in this browser', 'error')
        return
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop())
    }

    try {
        const constraints = {
            video: {
                deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        }

        // Default to back camera on mobile if nothing selected
        if (!selectedCamera && /Android|iPhone/i.test(navigator.userAgent)) {
            constraints.video.facingMode = { ideal: 'environment' }
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(newStream)

        if (videoRef.current) {
            videoRef.current.srcObject = newStream
        }

        // Update camera list with labels after permission granted
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setAvailableCameras(videoDevices)

        // Lock in the deviceId if we auto-picked one
        if (!selectedCamera && videoDevices.length > 0) {
            const currentTrack = newStream.getVideoTracks()[0]
            const settings = currentTrack.getSettings()
            if (settings.deviceId) setSelectedCamera(settings.deviceId)
        }

    } catch (e) {
        console.error('Camera Error:', e)
        showToast('Camera error: ' + e.message, 'error')
        setUseCamera(false)
    }
  }

  useEffect(() => {
    if (useCamera && gameStarted && turn === 'player') {
        startCamera()
    } else {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
    }

    return () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
        }
    }
  }, [useCamera, gameStarted, turn, selectedCamera])

  useEffect(() => {
    if (onlineGameId && user && user.id) {
        const unsub = onSnapshot(doc(db, 'liveGames', onlineGameId), (snap) => {
            if (snap.exists()) {
                const data = snap.data()
                setPlayerScore(data.scores[user.id] ?? startScore)
                const otherId = data.players.find(id => id !== user.id)
                setOpponentScore(data.scores[otherId] ?? startScore)
                setTurn(data.turn === user.id ? 'player' : 'opponent')
                setHistory(data.history || [])
                setPlayerLegs(data.legs?.[user.id] || 0)
                setOpponentLegs(data.legs?.[otherId] || 0)
                if (data.status === 'finished') {
                    setGameStarted(false)
                    showToast('Game Finished!', 'success')
                }
            }
        })
        return () => unsub()
    }
  }, [onlineGameId, user?.id, showToast, startScore])

  const startGame = async () => {
    if (isOnline && location.state && location.state.invitePlayer) {
        setIsWaitingForAccept(true)
        const config = { startScore, gameFormat, legsToWin }
        const inviteId = await sendGameInvite(location.state.invitePlayer.id, config)

        // Listen for acceptance
        const unsub = onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
            if (snap.exists() && snap.data().status === 'accepted') {
                setOnlineGameId(snap.data().gameId)
                setGameStarted(true)
                setIsWaitingForAccept(false)
                unsub()
            }
        })
        return
    }

    setPlayerScore(startScore)
    setOpponentScore(startScore)
    setPlayerLegs(0)
    setOpponentLegs(0)
    setHistory([])
    setTurn('player')
    setGameStarted(true)
    setLastBotDarts([])
    if (isVsBot) {
        setBot(new DartBot({
            targetAverage: botConfig.average,
            checkoutRate: botConfig.checkout / 100
        }))
    }
    showToast('Match Started! You throw first.', 'info')
  }

  const handleScoreInput = async (score) => {
    const val = parseInt(score)
    if (isNaN(val) || val > 180) {
        showToast('Invalid score (max 180)', 'error')
        return
    }

    if (isOnline && onlineGameId) {
        await processOnlineTurn(val)
    } else {
        processTurn('player', val)
    }
  }

  const processOnlineTurn = async (score) => {
    if (!onlineGameId || !user) return
    const newScore = playerScore - score
    const gameRef = doc(db, 'liveGames', onlineGameId)

    let updates = {
        [`scores.${user.id}`]: (newScore < 0 || newScore === 1) ? playerScore : newScore,
        turn: history.length % 2 === 0 ? user.id : user.id, // simplified logic, actually needs to toggle
        updatedAt: new Date().toISOString(),
        history: arrayUnion({ who: user.id, score, remaining: (newScore < 0 || newScore === 1) ? playerScore : newScore })
    }

    await updateDoc(gameRef, updates)
  }

  const processTurn = useCallback((who, score) => {
    if (who === 'player') {
        let newScore = playerScore - score
        if (newScore < 0 || newScore === 1) {
            showToast('BUST!', 'warning')
            setHistory(prev => [{ who: 'player', score: 0, result: 'BUST', remaining: playerScore }, ...prev])
        } else {
            setPlayerScore(newScore)
            setHistory(prev => [{ who: 'player', score, remaining: newScore }, ...prev])
            if (newScore === 0) {
                const nextLegs = playerLegs + 1
                setPlayerLegs(nextLegs)
                if ((gameFormat === 'firstTo' && nextLegs >= legsToWin) ||
                    (gameFormat === 'bestOf' && nextLegs > legsToWin / 2)) {
                    showToast('MATCH SHOT! You Win!', 'success')
                    setGameStarted(false)
                } else {
                    showToast('LEG SHOT!', 'success')
                    setPlayerScore(startScore)
                    setOpponentScore(startScore)
                }
                return
            }
        }
        setTurn(isVsBot ? 'bot' : 'opponent')
    } else {
        let newScore = opponentScore - score
        if (newScore < 0 || newScore === 1) {
            setHistory(prev => [{ who: who, score: 0, result: 'BUST', remaining: opponentScore }, ...prev])
        } else {
            setOpponentScore(newScore)
            setHistory(prev => [{ who: who, score, remaining: newScore }, ...prev])
            if (newScore === 0) {
                const nextLegs = opponentLegs + 1
                setOpponentLegs(nextLegs)
                if ((gameFormat === 'firstTo' && nextLegs >= legsToWin) ||
                    (gameFormat === 'bestOf' && nextLegs > legsToWin / 2)) {
                    showToast('Game Shot for the Opponent!', 'error')
                    setGameStarted(false)
                } else {
                    showToast('Opponent wins leg!', 'info')
                    setPlayerScore(startScore)
                    setOpponentScore(startScore)
                }
                return
            }
        }
        setTurn('player')
    }
  }, [playerScore, opponentScore, playerLegs, opponentLegs, gameFormat, legsToWin, startScore, isVsBot, showToast])

  useEffect(() => {
    if (gameStarted && turn === 'bot' && isVsBot && bot) {
        const runBotTurn = async () => {
            setIsBotThinking(true)
            setLastBotDarts([]) // Clear previous visuals

            const darts = await bot.takeTurn(opponentScore, (dart, allDarts) => {
                setLastBotDarts([...allDarts]) // Show darts one by one
            })

            const total = darts.reduce((acc, d) => acc + d.value, 0)

            // Brief pause to show the final board state
            await new Promise(r => setTimeout(r, 1000))

            setIsBotThinking(false)
            processTurn('bot', total)
        }
        runBotTurn()
    }
  }, [turn, gameStarted, isVsBot, bot, opponentScore, processTurn])

  useEffect(() => {
    // Autoscorying Listener from Native Bridge
    const handleNativeScore = (e) => {
        if (gameStarted && turn === 'player' && e.detail) {
            const { scoreLabel, scoreValue } = e.detail
            showToast(`Detected: ${scoreLabel}`, 'info')

            setCurrentInput(prev => {
                const currentVal = parseInt(prev || '0')
                const newVal = currentVal + scoreValue
                return isNaN(newVal) ? prev : Math.min(180, newVal).toString()
            })
        }
    }

    window.addEventListener('dartDetectionScore', handleNativeScore)
    return () => window.removeEventListener('dartDetectionScore', handleNativeScore)
  }, [gameStarted, turn, showToast])

  if (isWaitingForAccept) {
    return (
        <div className="page">
            <div className="card glass" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ width: '50px', height: '50px', margin: '0 auto 20px' }}></div>
                <h3>Waiting for {location.state?.invitePlayer?.username || 'player'} to accept...</h3>
                <button className="btn btn-secondary btn-block" style={{ marginTop: '20px' }} onClick={() => setIsWaitingForAccept(false)}>Cancel Challenge</button>
            </div>
        </div>
    )
  }

  if (!gameStarted) {
    return (
        <div className="page animate-fade-in">
            <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Live Match', path: '/live-match' }]} />
            <div className="card glass" style={{ maxWidth: '500px', margin: '40px auto', padding: '30px' }}>
                <h2 className="text-gradient" style={{ textAlign: 'center', marginBottom: '25px' }}>New Live Match</h2>

                <div className="form-group">
                    <label>Game Mode</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`btn ${startScore === 501 ? 'btn-primary' : 'btn-secondary'} flex-1`} onClick={() => setStartScore(501)}>501</button>
                        <button className={`btn ${startScore === 301 ? 'btn-primary' : 'btn-secondary'} flex-1`} onClick={() => setStartScore(301)}>301</button>
                    </div>
                </div>

                <div className="form-group">
                    <label>Opponent</label>
                    <select value={isVsBot ? 'bot' : (isOnline ? 'online' : 'human')} onChange={e => {
                        const val = e.target.value
                        setIsVsBot(val === 'bot')
                        setIsOnline(val === 'online')
                    }}>
                        <option value="bot">DartBot (AI)</option>
                        <option value="human">Local Human (Pass-and-Play)</option>
                        <option value="online">Online Friend (Challenge)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Match Format</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`btn ${gameFormat === 'bestOf' ? 'btn-primary' : 'btn-secondary'} flex-1`} onClick={() => setGameFormat('bestOf')}>Best Of</button>
                        <button className={`btn ${gameFormat === 'firstTo' ? 'btn-primary' : 'btn-secondary'} flex-1`} onClick={() => setGameFormat('firstTo')}>First To</button>
                    </div>
                </div>

                <div className="form-group">
                    <label>{gameFormat === 'bestOf' ? 'Total Legs' : 'Legs to Win'}: {legsToWin}</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                            <button key={n} className={`btn btn-sm ${legsToWin === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLegsCount(n)} style={{ flex: '1 0 50px' }}>{n}</button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={useCamera} onChange={e => setUseCamera(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                        <span>Enable Camera / OBS Feed</span>
                    </label>
                </div>

                {useCamera && availableCameras.length > 0 && (
                    <div className="form-group animate-fade-in">
                        <label>Select Camera Source</label>
                        <select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
                            {availableCameras.map(cam => (
                                <option key={cam.deviceId} value={cam.deviceId}>
                                    {cam.label || `Camera ${cam.deviceId.slice(0, 5)}`}
                                </option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                            On Desktop, select "OBS Virtual Camera" if using OBS.
                        </p>
                    </div>
                )}

                {isVsBot && (
                    <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label>Bot Average: {botConfig.average}</label>
                            <input type="range" min="30" max="100" value={botConfig.average} onChange={e => setBotConfig({...botConfig, average: parseInt(e.target.value)})} />
                        </div>
                        <div className="form-group">
                            <label>Bot Checkout: {botConfig.checkout}%</label>
                            <input type="range" min="5" max="50" value={botConfig.checkout} onChange={e => setBotConfig({...botConfig, checkout: parseInt(e.target.value)})} />
                        </div>
                    </div>
                )}

                <button className="btn btn-primary btn-block" onClick={startGame}>Start Match</button>
            </div>
        </div>
    )
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Player Card */}
            <div className={`card ${turn === 'player' ? 'glass active-turn' : 'glass'}`} style={{
                textAlign: 'center',
                padding: '20px',
                border: turn === 'player' ? '2px solid var(--accent-cyan)' : '1px solid var(--border)',
                background: turn === 'player' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{user?.username || 'You'}</h3>
                    <div style={{ background: 'var(--accent-cyan)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 800 }}>LEGS: {playerLegs}</div>
                </div>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>{playerScore}</div>
            </div>

            {/* Opponent Card */}
            <div className={`card ${turn !== 'player' ? 'glass active-turn' : 'glass'}`} style={{
                textAlign: 'center',
                padding: '20px',
                border: turn !== 'player' ? '2px solid var(--accent-cyan)' : '1px solid var(--border)',
                background: turn !== 'player' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{isVsBot ? 'DartBot' : (location.state?.invitePlayer?.username || 'Player 2')}</h3>
                    <div style={{ background: 'var(--accent-cyan)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 800 }}>LEGS: {opponentLegs}</div>
                </div>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: isBotThinking ? 'var(--accent-cyan)' : 'white' }}>
                    {opponentScore}
                </div>
            </div>
        </div>

        <div className="live-match-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 350px',
            gap: '20px'
        }}>
            {/* Center Area: Camera or Board */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card glass" style={{
                    padding: '0',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--accent-cyan)'
                }}>
                    {turn === 'player' && useCamera ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {availableCameras.length > 1 && (
                                <button
                                    onClick={() => {
                                        const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCamera)
                                        const nextIndex = (currentIndex + 1) % availableCameras.length
                                        setSelectedCamera(availableCameras[nextIndex].deviceId)
                                    }}
                                    style={{
                                        position: 'absolute',
                                        bottom: '10px',
                                        right: '10px',
                                        background: 'rgba(0,0,0,0.6)',
                                        border: '1px solid var(--accent-cyan)',
                                        color: 'white',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        zIndex: 10
                                    }}
                                >
                                    🔄 Flip Camera
                                </button>
                            )}
                        </div>
                    ) : turn !== 'player' && isVsBot ? (
                        <div className="animate-fade-in" style={{ padding: '20px', textAlign: 'center' }}>
                            <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>DartBot is throwing...</h4>
                            <ScoliaBoard lastDarts={lastBotDarts} size={window.innerWidth < 768 ? 250 : 350} />
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                            <p>Camera feed or Bot board will appear here</p>
                        </div>
                    )}
                </div>

                {/* Input Area (Only visible on player turn) */}
                <div className={`card glass ${turn !== 'player' ? 'opacity-50 pointer-events-none' : ''}`} style={{ padding: '20px' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.4)',
                        padding: '15px',
                        borderRadius: '12px',
                        fontSize: '2rem',
                        textAlign: 'center',
                        marginBottom: '20px',
                        fontWeight: 700,
                        border: '1px solid var(--border)'
                    }}>
                        {currentInput || '0'}
                    </div>

                    <div className="keypad" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px'
                    }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                            <button
                                key={key}
                                className={`btn ${key === 'ENTER' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '15px', fontSize: '1.2rem' }}
                                onClick={() => {
                                    if (key === 'DEL') setCurrentInput(prev => prev.slice(0, -1))
                                    else if (key === 'ENTER') {
                                        handleScoreInput(currentInput)
                                        setCurrentInput('')
                                    } else {
                                        if (currentInput.length < 3) setCurrentInput(prev => prev + key)
                                    }
                                }}
                            >
                                {key}
                            </button>
                        ))}
                    </div>

                    {typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && (
                        <button
                            className="btn btn-primary btn-block"
                            style={{ marginTop: '20px', background: 'linear-gradient(135deg, #00d4ff, #0080ff)' }}
                            onClick={() => {
                                Capacitor.Plugins['DartDetection']?.startDetection()
                            }}
                        >
                            🎯 Start Auto-Scoring Camera
                        </button>
                    )}
                </div>
            </div>

            {/* Sidebar Area: Stats & Log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card glass history-panel" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', padding: '20px' }}>
                    <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Match Log</h4>
                    {history.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No turns yet</p>
                    ) : history.map((entry, i) => (
                        <div key={i} style={{
                            padding: '10px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.9rem'
                        }}>
                            <span style={{ color: entry.who === 'player' ? 'var(--accent-cyan)' : 'white', fontWeight: 600 }}>
                                {entry.who === 'player' ? 'YOU' : 'BOT'}
                            </span>
                            <span style={{ fontWeight: 800 }}>{entry.score} {entry.result && `(${entry.result})`}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>rem: {entry.remaining}</span>
                        </div>
                    ))}
                </div>

                <button
                    className="btn btn-secondary btn-block"
                    style={{ opacity: 0.7 }}
                    onClick={() => {
                        if (window.confirm('Quit match?')) setGameStarted(false)
                    }}
                >
                    Quit Match
                </button>
            </div>
        </div>

        <style>{`
            @media (max-width: 768px) {
                .live-match-grid {
                    grid-template-columns: 1fr !important;
                }
                .history-panel {
                    display: none;
                }
            }
            .active-turn {
                border-width: 3px !important;
                box-shadow: 0 0 30px var(--accent-cyan-glow) !important;
            }
        `}</style>
    </div>
  )
}
