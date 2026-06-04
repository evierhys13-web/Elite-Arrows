import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DartBot } from '../utils/DartBot'
import Breadcrumbs from '../components/Breadcrumbs'
import ScoliaBoard from '../components/ScoliaBoard'
import { useToast } from '../context/ToastContext'
import { db, doc, onSnapshot, updateDoc, arrayUnion } from '../firebase'
import { Capacitor } from '@capacitor/core'

const START_SCORES = [101, 301, 501, 701]
const FORMATS = [
  { id: 'bestOf', label: 'Best Of', icon: '🏆' },
  { id: 'firstTo', label: 'First To', icon: '🎯' }
]
const BOT_LEVELS = [
  { name: 'Amateur', avg: 35, check: 10, icon: '🌱' },
  { name: 'Club', avg: 50, check: 20, icon: '🎯' },
  { name: 'Pro', avg: 75, check: 35, icon: '🔥' },
  { name: 'Elite', avg: 95, check: 50, icon: '👑' }
]

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
  const [gameFormat, setGameFormat] = useState('bestOf')
  const [legsToWin, setLegsCount] = useState(3)
  const [botLevel, setBotLevel] = useState(BOT_LEVELS[1])

  // Online State
  const [onlineGameId, setOnlineGameId] = useState(null)
  const [isWaitingForAccept, setIsWaitingForAccept] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)

  // Live Match State
  const [playerScore, setPlayerScore] = useState(501)
  const [opponentScore, setOpponentScore] = useState(501)
  const [playerLegs, setPlayerLegs] = useState(0)
  const [opponentLegs, setOpponentLegs] = useState(0)
  const [turn, setTurn] = useState('player')
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
    if (location.state && location.state.invitePlayer) {
        setIsVsBot(false)
        setIsOnline(true)
        setSelectedFriend(location.state.invitePlayer)
    }
  }, [location.state])

  const onlineFriends = allUsers.filter(u =>
    u.id !== user?.id &&
    u.isOnline &&
    (user?.friends || []).includes(u.id)
  )

  useEffect(() => {
    const getCameras = async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
        try {
            await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {})
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter(device => device.kind === 'videoinput')
            setAvailableCameras(videoDevices)
            if (videoDevices.length > 0) {
                setSelectedCamera(prev => prev || videoDevices[0].deviceId)
            }
        } catch (e) { console.error(e) }
    }
    getCameras()
  }, [])

  const startCamera = async (forceDeviceId = null) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    const deviceIdToUse = forceDeviceId || selectedCamera
    if (stream) {
        stream.getTracks().forEach(t => t.stop())
        setStream(null)
    }
    if (videoRef.current) videoRef.current.srcObject = null
    await new Promise(r => setTimeout(r, 300))

    try {
        const constraints = {
            video: {
                deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        }
        if (!deviceIdToUse) constraints.video.facingMode = { ideal: 'environment' }
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(newStream)
        if (videoRef.current) videoRef.current.srcObject = newStream
    } catch (e) {
        if (deviceIdToUse) {
            const fallback = await navigator.mediaDevices.getUserMedia({ video: true })
            setStream(fallback)
            if (videoRef.current) videoRef.current.srcObject = fallback
        } else {
            showToast('Camera error: ' + e.message, 'error')
            setUseCamera(false)
        }
    }
  }

  const flipCamera = async () => {
    if (availableCameras.length < 2) return
    const idx = availableCameras.findIndex(c => c.deviceId === selectedCamera)
    const nextId = availableCameras[(idx + 1) % availableCameras.length].deviceId
    setSelectedCamera(nextId)
    await startCamera(nextId)
  }

  useEffect(() => {
    if (useCamera && gameStarted && turn === 'player') startCamera()
    else if (stream) {
        stream.getTracks().forEach(t => t.stop())
        setStream(null)
    }
    return () => stream?.getTracks().forEach(t => t.stop())
  }, [useCamera, gameStarted, turn, selectedCamera])

  const startGame = async () => {
    if (isOnline && (location.state?.invitePlayer || selectedFriend)) {
        const target = location.state?.invitePlayer || selectedFriend
        setIsWaitingForAccept(true)
        const config = { startScore, gameFormat, legsToWin }
        const inviteId = await sendGameInvite(target.id, config)
        onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
            if (snap.exists() && snap.data().status === 'accepted') {
                setOnlineGameId(snap.data().gameId)
                setGameStarted(true)
                setIsWaitingForAccept(false)
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
        setBot(new DartBot({ targetAverage: botLevel.avg, checkoutRate: botLevel.check / 100 }))
    }
    showToast('Match Started!', 'info')
  }

  const processTurn = useCallback((who, score) => {
    const isPlayer = who === 'player'
    let current = isPlayer ? playerScore : opponentScore
    let newScore = current - score

    if (newScore < 0 || newScore === 1) {
        showToast('BUST!', 'warning')
        setHistory(prev => [{ who, score: 0, result: 'BUST', remaining: current }, ...prev])
    } else {
        if (isPlayer) setPlayerScore(newScore)
        else setOpponentScore(newScore)

        setHistory(prev => [{ who, score, remaining: newScore }, ...prev])

        if (newScore === 0) {
            const nextLegs = (isPlayer ? playerLegs : opponentLegs) + 1
            if (isPlayer) setPlayerLegs(nextLegs) else setOpponentLegs(nextLegs)

            if ((gameFormat === 'firstTo' && nextLegs >= legsToWin) ||
                (gameFormat === 'bestOf' && nextLegs > legsToWin / 2)) {
                showToast(`MATCH SHOT! ${isPlayer ? 'You Win' : 'Opponent Wins'}!`, 'success')
                setGameStarted(false)
            } else {
                showToast('LEG SHOT!', 'success')
                setPlayerScore(startScore)
                setOpponentScore(startScore)
            }
            return
        }
    }
    setTurn(isPlayer ? (isVsBot ? 'bot' : 'opponent') : 'player')
  }, [playerScore, opponentScore, playerLegs, opponentLegs, gameFormat, legsToWin, startScore, isVsBot, showToast])

  useEffect(() => {
    if (gameStarted && turn === 'bot' && bot) {
        const runBot = async () => {
            setIsBotThinking(true)
            setLastBotDarts([])
            const darts = await bot.takeTurn(opponentScore, (_, all) => setLastBotDarts([...all]))
            await new Promise(r => setTimeout(r, 1000))
            setIsBotThinking(false)
            processTurn('bot', darts.reduce((a, d) => a + d.value, 0))
        }
        runBot()
    }
  }, [turn, gameStarted, bot, opponentScore, processTurn])

  useEffect(() => {
    const handleNative = (e) => {
        if (gameStarted && turn === 'player' && e.detail) {
            const { scoreLabel, scoreValue } = e.detail
            showToast(`Hit: ${scoreLabel}`, 'info')
            setCurrentInput(prev => Math.min(180, (parseInt(prev || '0') + scoreValue)).toString())
        }
    }
    const handleSubmit = () => {
        if (gameStarted && turn === 'player') {
            showToast('Turn Submitted', 'success')
            processTurn('player', parseInt(currentInput || '0'))
            setCurrentInput('')
        }
    }
    window.addEventListener('dartDetectionScore', handleNative)
    window.addEventListener('dartDetectionSubmit', handleSubmit)
    return () => {
        window.removeEventListener('dartDetectionScore', handleNative)
        window.removeEventListener('dartDetectionSubmit', handleSubmit)
    }
  }, [gameStarted, turn, currentInput, processTurn, showToast])

  if (isWaitingForAccept) {
    return (
        <div className="page">
            <div className="card glass" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ width: '50px', height: '50px', margin: '0 auto 20px' }}></div>
                <h3 style={{ fontWeight: 800 }}>Challenging {selectedFriend?.username}...</h3>
                <button className="btn btn-secondary btn-block" style={{ marginTop: '20px' }} onClick={() => setIsWaitingForAccept(false)}>Cancel</button>
            </div>
        </div>
    )
  }

  if (!gameStarted) {
    return (
        <div className="page animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Live Scoring' }]} />

            <div className="card glass" style={{ padding: '40px', borderRadius: '30px', border: '1px solid var(--accent-cyan)' }}>
                <h1 className="text-gradient" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px', fontWeight: 900 }}>MATCH SETUP</h1>

                <div className="setup-section" style={{ marginBottom: '30px' }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '15px', display: 'block' }}>1. Select Mode</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {START_SCORES.map(s => (
                            <button key={s} className={`btn ${startScore === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStartScore(s)} style={{ fontSize: '1.1rem' }}>{s}</button>
                        ))}
                    </div>
                </div>

                <div className="setup-section" style={{ marginBottom: '30px' }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '15px', display: 'block' }}>2. Opponent</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <button className={`btn ${isVsBot ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {setIsVsBot(true); setIsOnline(false)}} style={{ gap: '5px' }}>🤖 Bot</button>
                        <button className={`btn ${!isVsBot && !isOnline ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {setIsVsBot(false); setIsOnline(false)}} style={{ gap: '5px' }}>👥 Local</button>
                        <button className={`btn ${isOnline ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {setIsVsBot(false); setIsOnline(true)}} style={{ gap: '5px' }}>🌐 Online</button>
                    </div>
                </div>

                {isVsBot && (
                    <div className="setup-section animate-fade-in" style={{ marginBottom: '30px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', marginBottom: '15px', display: 'block' }}>Bot Difficulty</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {BOT_LEVELS.map(lvl => (
                                <button key={lvl.name} className={`btn ${botLevel.name === lvl.name ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBotLevel(lvl)} style={{ justifyContent: 'flex-start', padding: '15px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{lvl.icon}</span>
                                    <div style={{ textAlign: 'left', marginLeft: '10px' }}>
                                        <div style={{ fontSize: '0.9rem' }}>{lvl.name}</div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Avg: {lvl.avg} | Chk: {lvl.check}%</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isOnline && (
                    <div className="setup-section animate-fade-in" style={{ marginBottom: '30px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', marginBottom: '15px', display: 'block' }}>Select Online Friend</label>
                        {onlineFriends.length === 0 ? (
                            <p style={{ color: 'var(--error)', fontSize: '0.8rem', textAlign: 'center' }}>No friends currently online.</p>
                        ) : (
                            <select className="glass" value={selectedFriend?.id || ''} onChange={e => setSelectedFriend(onlineFriends.find(f => f.id === e.target.value))} style={{ width: '100%', height: '50px', borderRadius: '15px' }}>
                                <option value="">-- Choose Player --</option>
                                {onlineFriends.map(f => <option key={f.id} value={f.id}>{f.username} ({f.division})</option>)}
                            </select>
                        )}
                    </div>
                )}

                <div className="setup-section" style={{ marginBottom: '40px' }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '15px', display: 'block' }}>3. Format</label>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                        {FORMATS.map(f => (
                            <button key={f.id} className={`btn ${gameFormat === f.id ? 'btn-primary' : 'btn-secondary'} flex-1`} onClick={() => setGameFormat(f.id)}>{f.icon} {f.label}</button>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                            <button key={n} className={`btn btn-sm ${legsToWin === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLegsCount(n)}>{n}</button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', padding: '15px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '15px', border: '1px solid var(--accent-cyan)' }}>
                    <input type="checkbox" checked={useCamera} onChange={e => setUseCamera(e.target.checked)} style={{ width: '25px', height: '25px', cursor: 'pointer' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>ENABLE LIVE CAMERA / AUTOSCORER</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Show your board and use native detection</div>
                    </div>
                </div>

                <button className="btn btn-primary btn-block" style={{ height: '70px', fontSize: '1.4rem', fontWeight: 900, borderRadius: '20px', boxShadow: '0 10px 30px rgba(124, 92, 252, 0.4)' }} onClick={startGame}>START MATCH</button>
            </div>
        </div>
    )
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1600px', margin: '0 auto', padding: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div className={`card ${turn === 'player' ? 'glass active-turn' : 'glass'}`} style={{ padding: '15px', textAlign: 'center', border: turn === 'player' ? '3px solid var(--accent-cyan)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{user?.username || 'You'}</span>
                    <span style={{ background: 'var(--accent-cyan)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900 }}>LEGS: {playerLegs}</span>
                </div>
                <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{playerScore}</div>
            </div>

            <div className={`card ${turn !== 'player' ? 'glass active-turn' : 'glass'}`} style={{ padding: '15px', textAlign: 'center', border: turn !== 'player' ? '3px solid var(--accent-cyan)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{isVsBot ? 'DartBot' : (selectedFriend?.username || 'Opponent')}</span>
                    <span style={{ background: 'var(--accent-cyan)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900 }}>LEGS: {opponentLegs}</span>
                </div>
                <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{opponentScore}</div>
            </div>
        </div>

        <div className="live-match-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="card glass" style={{ padding: 0, overflow: 'hidden', background: '#000', border: '2px solid var(--accent-cyan)', borderRadius: '24px', position: 'relative', minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {turn === 'player' && useCamera ? (
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoomLevel})` }} />
                            <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 10 }}>
                                <div style={{ background: 'rgba(0,0,0,0.8)', padding: '5px', borderRadius: '12px', border: '1px solid var(--accent-cyan)', display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.2))} className="btn btn-sm">➖</button>
                                    <span style={{ display: 'flex', alignItems: 'center', fontWeight: 900, fontSize: '0.8rem' }}>{Math.round(zoomLevel*100)}%</span>
                                    <button onClick={() => setZoomLevel(prev => Math.min(4, prev + 0.2))} className="btn btn-sm">➕</button>
                                </div>
                                <button onClick={flipCamera} className="btn btn-secondary btn-sm" style={{ background: 'rgba(0,0,0,0.8)' }}>🔄 FLIP</button>
                            </div>
                        </div>
                    ) : turn !== 'player' && isVsBot ? (
                        <div className="animate-fade-in" style={{ padding: '20px', textAlign: 'center' }}>
                            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px' }}>AI IS THROWING...</h4>
                            <ScoliaBoard lastDarts={lastBotDarts} size={500} />
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem' }}>🎯</div>
                            <p>Camera feed or Bot board active here</p>
                        </div>
                    )}
                </div>

                <div className={`card glass ${turn !== 'player' ? 'opacity-30' : ''}`} style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.8)' }}>
                    <div style={{ background: '#000', padding: '15px', borderRadius: '16px', fontSize: '3rem', textAlign: 'center', fontWeight: 900, color: 'var(--accent-cyan)', border: '2px solid var(--accent-cyan)', marginBottom: '20px' }}>
                        {currentInput || '0'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                            <button key={key} className={`btn ${key === 'ENTER' ? 'btn-primary' : 'btn-secondary'}`} style={{ height: '65px', fontSize: '1.4rem', fontWeight: 900 }} onClick={() => {
                                if (key === 'DEL') setCurrentInput(p => p.slice(0, -1))
                                else if (key === 'ENTER') { handleScoreInput(currentInput); setCurrentInput('') }
                                else if (currentInput.length < 3) setCurrentInput(p => p + key)
                            }}>{key}</button>
                        ))}
                    </div>
                    {Capacitor.isNativePlatform() && (
                        <button className="btn btn-primary btn-block" style={{ marginTop: '15px', background: 'linear-gradient(135deg, #FF00E5, #B000FF)', fontWeight: 900 }} onClick={() => Capacitor.Plugins['DartDetection']?.startDetection()}>⚡ AUTOSCORER CAMERA</button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="card glass" style={{ flex: 1, maxHeight: '800px', overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Match Log</h4>
                        <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => {if(window.confirm('Quit?')) setGameStarted(false)}}>QUIT</button>
                    </div>
                    {history.map((e, i) => (
                        <div key={i} style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: 800, color: e.who === 'player' ? 'var(--accent-cyan)' : '#fff' }}>{e.who === 'player' ? 'YOU' : 'OPP'}</span>
                            <span style={{ fontWeight: 900 }}>{e.score} {e.result && `(${e.result})`}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{e.remaining}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <style>{`
            @media (max-width: 1100px) {
                .live-match-main-grid { grid-template-columns: 1fr !important; }
                .card { padding: 15px !important; }
            }
            .active-turn { box-shadow: 0 0 30px var(--accent-cyan-glow) !important; transform: scale(1.01); transition: all 0.3s ease; }
        `}</style>
    </div>
  )
}
