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
  const { user, sendGameInvite, allUsers } = useAuth()
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
  const [selectedFriend, setSelectedFriend] = useState(null)

  useEffect(() => {
    if (location && location.state && location.state.invitePlayer) {
        setIsVsBot(false)
        setIsOnline(true)
        setSelectedFriend(location.state.invitePlayer)
    }
  }, [location])

  const onlineFriends = allUsers.filter(u =>
    u.id !== user?.id &&
    u.isOnline &&
    (user?.friends || []).includes(u.id)
  )

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
  const [zoomLevel, setZoomLevel] = useState(1)

  useEffect(() => {
    if (location && location.state && location.state.invitePlayer) {
        setIsVsBot(false)
        setIsOnline(true)
    }
  }, [location])

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

            if (videoDevices.length > 0) {
                setSelectedCamera(prev => prev || videoDevices[0].deviceId)
            }
        } catch (e) {
            console.error('Error fetching cameras:', e)
        }
    }
    getCameras()
  }, [])

  const startCamera = async (forceDeviceId = null) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera API not supported in this browser', 'error')
        return
    }

    const deviceIdToUse = forceDeviceId || selectedCamera

    // Stop existing tracks first
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop()
        })
        setStream(null)
    }

    // Clear video ref immediately
    if (videoRef.current) {
        videoRef.current.srcObject = null
    }

    // Increased delay for hardware release
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
        const constraints = {
            video: {
                deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        }

        // If no specific ID, try back camera preference
        if (!deviceIdToUse) {
            constraints.video.facingMode = { ideal: 'environment' }
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(newStream)

        if (videoRef.current) {
            videoRef.current.srcObject = newStream
        }

        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setAvailableCameras(videoDevices)

        // Sync local state if device was auto-selected
        const currentTrack = newStream.getVideoTracks()[0]
        const settings = currentTrack.getSettings()
        if (settings && settings.deviceId && !forceDeviceId) {
            setSelectedCamera(settings.deviceId)
        }

    } catch (e) {
        console.error('Camera Error:', e)
        if (deviceIdToUse) {
            console.warn('Retrying without specific deviceId...')
            // One fallback attempt with no ID
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
                setStream(fallbackStream)
                if (videoRef.current) videoRef.current.srcObject = fallbackStream
            } catch (innerE) {
                showToast('Could not access any camera source', 'error')
                setUseCamera(false)
            }
        } else {
            showToast('Camera error: ' + e.message, 'error')
            setUseCamera(false)
        }
    }
  }

  const flipCamera = async () => {
    if (availableCameras.length < 2) return

    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCamera)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    const nextDeviceId = availableCameras[nextIndex].deviceId

    setSelectedCamera(nextDeviceId)
    // Manually trigger restart with the new ID
    await startCamera(nextDeviceId)
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
                if (data && data.scores) {
                    setPlayerScore(data.scores[user.id] ?? startScore)
                    const otherId = data.players?.find(id => id !== user.id)
                    if (otherId) {
                        setOpponentScore(data.scores[otherId] ?? startScore)
                    }
                    setTurn(data.turn === user.id ? 'player' : 'opponent')
                    setHistory(data.history || [])
                    setPlayerLegs(data.legs?.[user.id] || 0)
                    if (otherId) {
                        setOpponentLegs(data.legs?.[otherId] || 0)
                    }
                    if (data.status === 'finished') {
                        setGameStarted(false)
                        showToast('Game Finished!', 'success')
                    }
                }
            }
        })
        return () => unsub()
    }
  }, [onlineGameId, user?.id, showToast, startScore])

  const startGame = async () => {
    if (isOnline && (location.state?.invitePlayer || selectedFriend)) {
        const targetPlayer = location.state?.invitePlayer || selectedFriend
        setIsWaitingForAccept(true)
        const config = { startScore, gameFormat, legsToWin }
        const inviteId = await sendGameInvite(targetPlayer.id, config)

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

    if (isOnline && !selectedFriend) {
        showToast('Please select a friend to challenge', 'error')
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

    const finalScore = (newScore < 0 || newScore === 1) ? playerScore : newScore

    // In a real online game, we'd need to properly toggle turn between players
    // For now, let's assume simple sequential turns based on history

    let updates = {
        [`scores.${user.id}`]: finalScore,
        updatedAt: new Date().toISOString(),
        history: arrayUnion({ who: user.id, score, remaining: finalScore })
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
            setLastBotDarts([])

            const darts = await bot.takeTurn(opponentScore, (dart, allDarts) => {
                setLastBotDarts([...allDarts])
            })

            const total = darts.reduce((acc, d) => acc + d.value, 0)

            await new Promise(r => setTimeout(r, 1000))

            setIsBotThinking(false)
            processTurn('bot', total)
        }
        runBotTurn()
    }
  }, [turn, gameStarted, isVsBot, bot, opponentScore, processTurn])

  useEffect(() => {
    const handleNativeScore = (e) => {
        if (gameStarted && turn === 'player' && e && e.detail) {
            const { scoreLabel, scoreValue } = e.detail
            showToast(`Detected: ${scoreLabel}`, 'info')

            setCurrentInput(prev => {
                const currentVal = parseInt(prev || '0')
                const newVal = currentVal + (parseInt(scoreValue) || 0)
                return isNaN(newVal) ? prev : Math.min(180, newVal).toString()
            })
        }
    }

    const handleNativeSubmit = () => {
        if (gameStarted && turn === 'player') {
            showToast('Turn Submitted Automatically', 'success')
            // Score is already accumulated in currentInput via handleNativeScore
            // Trigger the Enter logic
            handleScoreInput(currentInput)
            setCurrentInput('')
        }
    }

    window.addEventListener('dartDetectionScore', handleNativeScore)
    window.addEventListener('dartDetectionSubmit', handleNativeSubmit)
    return () => {
        window.removeEventListener('dartDetectionScore', handleNativeScore)
        window.removeEventListener('dartDetectionSubmit', handleNativeSubmit)
    }
  }, [gameStarted, turn, currentInput, showToast, handleScoreInput])

  if (isWaitingForAccept) {
    return (
        <div className="page">
            <div className="card glass" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ width: '50px', height: '50px', margin: '0 auto 20px' }}></div>
                <h3>Waiting for {location && location.state && location.state.invitePlayer ? location.state.invitePlayer.username : 'player'} to accept...</h3>
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
                        setSelectedFriend(null)
                    }}>
                        <option value="bot">DartBot (AI)</option>
                        <option value="human">Local Human (Pass-and-Play)</option>
                        <option value="online">Online Friend (Challenge)</option>
                    </select>
                </div>

                {isOnline && !location.state?.invitePlayer && (
                    <div className="form-group animate-fade-in">
                        <label>Select Online Friend</label>
                        {onlineFriends.length === 0 ? (
                            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
                                No friends are currently online.
                            </div>
                        ) : (
                            <select
                                value={selectedFriend?.id || ''}
                                onChange={e => setSelectedFriend(onlineFriends.find(f => f.id === e.target.value))}
                            >
                                <option value="">-- Select a friend --</option>
                                {onlineFriends.map(friend => (
                                    <option key={friend.id} value={friend.id}>
                                        {friend.username} ({friend.division})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

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
                    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        {isVsBot ? 'DartBot' : (selectedFriend?.username || location.state?.invitePlayer?.username || 'Player 2')}
                    </h3>
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
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: `scale(${zoomLevel})`,
                                    transition: 'transform 0.2s ease'
                                }}
                            />

                            <div style={{
                                position: 'absolute',
                                bottom: '15px',
                                left: '15px',
                                right: '15px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                zIndex: 10
                            }}>
                                <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '5px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                    <button onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.2))} className="btn btn-sm" style={{ padding: '8px 12px' }}>➖</button>
                                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{Math.round(zoomLevel * 100)}%</span>
                                    <button onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))} className="btn btn-sm" style={{ padding: '8px 12px' }}>➕</button>
                                </div>

                                {availableCameras.length > 1 && (
                                    <button
                                        onClick={flipCamera}
                                        style={{
                                            background: 'rgba(0,0,0,0.6)',
                                            border: '1px solid var(--accent-cyan)',
                                            color: 'white',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            fontWeight: 700
                                        }}
                                    >
                                        🔄 Flip Camera
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : turn !== 'player' && isVsBot ? (
                        <div className="animate-fade-in" style={{ padding: '20px', textAlign: 'center' }}>
                            <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>DartBot is throwing...</h4>
                            <ScoliaBoard lastDarts={lastBotDarts} size={300} />
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
                                if (Capacitor.Plugins && Capacitor.Plugins['DartDetection']) {
                                    Capacitor.Plugins['DartDetection'].startDetection()
                                }
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
