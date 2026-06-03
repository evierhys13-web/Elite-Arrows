import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { DartBot } from '../utils/DartBot'
import Breadcrumbs from '../components/Breadcrumbs'
import ScoliaBoard from '../components/ScoliaBoard'
import { useToast } from '../context/ToastContext'

export default function LiveMatch() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const videoRef = useRef(null)

  // Game State
  const [gameStarted, setGameStarted] = useState(false)
  const [startScore, setStartScore] = useState(501)
  const [isVsBot, setIsVsBot] = useState(true)
  const [botConfig, setBotConfig] = useState({ average: 50, checkout: 20 })

  const [playerScore, setPlayerScore] = useState(501)
  const [botScore, setBotScore] = useState(501)
  const [turn, setTurn] = useState('player') // 'player' or 'bot'
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
    // Check for available cameras
    const getCameras = async () => {
        try {
            // Request permission first to ensure labels are visible (especially for OBS)
            await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {})

            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter(device => device.kind === 'videoinput')
            setAvailableCameras(videoDevices)
            if (videoDevices.length > 0 && !selectedCamera) {
                setSelectedCamera(videoDevices[0].deviceId)
            }
        } catch (e) {
            console.error('Error fetching cameras:', e)
        }
    }
    getCameras()
  }, [])

  const startCamera = async () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop())
    }

    try {
        const constraints = {
            video: {
                deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        }
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setStream(newStream)
        if (videoRef.current) {
            videoRef.current.srcObject = newStream
        }
    } catch (e) {
        showToast('Camera access denied or unavailable', 'error')
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
  }, [useCamera, gameStarted, turn, selectedCamera])

  const startGame = () => {
    setPlayerScore(startScore)
    setBotScore(startScore)
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

  const handleScoreInput = (score) => {
    const val = parseInt(score)
    if (isNaN(val) || val > 180) {
        showToast('Invalid score (max 180)', 'error')
        return
    }

    if (turn === 'player') {
        processTurn('player', val)
    }
  }

  const processTurn = useCallback((who, score) => {
    if (who === 'player') {
        const newScore = playerScore - score
        if (newScore < 0 || newScore === 1) {
            showToast('BUST!', 'warning')
            setHistory(prev => [{ who: 'player', score: 0, result: 'BUST', remaining: playerScore }, ...prev])
        } else {
            setPlayerScore(newScore)
            setHistory(prev => [{ who: 'player', score, remaining: newScore }, ...prev])
            if (newScore === 0) {
                showToast('GAME SHOT! You Win!', 'success')
                setGameStarted(false)
                return
            }
        }
        setTurn('bot')
    } else {
        const newScore = botScore - score
        if (newScore < 0 || newScore === 1) {
            setHistory(prev => [{ who: 'bot', score: 0, result: 'BUST', remaining: botScore }, ...prev])
        } else {
            setBotScore(newScore)
            setHistory(prev => [{ who: 'bot', score, remaining: newScore }, ...prev])
            if (newScore === 0) {
                showToast('Game Shot for the Bot!', 'error')
                setGameStarted(false)
                return
            }
        }
        setTurn('player')
    }
  }, [playerScore, botScore, showToast])

  useEffect(() => {
    if (gameStarted && turn === 'bot' && isVsBot && bot) {
        const runBotTurn = async () => {
            setIsBotThinking(true)
            setLastBotDarts([]) // Clear previous visuals

            const darts = await bot.takeTurn(botScore, (dart, allDarts) => {
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
  }, [turn, gameStarted, isVsBot, bot, botScore, processTurn])

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
                    <select value={isVsBot ? 'bot' : 'human'} onChange={e => setIsVsBot(e.target.value === 'bot')}>
                        <option value="bot">DartBot (AI)</option>
                        <option value="human">Local Human (Pass-and-Play)</option>
                    </select>
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
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.username}</h3>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>{playerScore}</div>
            </div>

            {/* Opponent Card */}
            <div className={`card ${turn === 'bot' ? 'glass active-turn' : 'glass'}`} style={{
                textAlign: 'center',
                padding: '20px',
                border: turn === 'bot' ? '2px solid var(--accent-cyan)' : '1px solid var(--border)',
                background: turn === 'bot' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)'
            }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{isVsBot ? 'DartBot' : 'Player 2'}</h3>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: isBotThinking ? 'var(--accent-cyan)' : 'white' }}>
                    {botScore}
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
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : turn === 'bot' ? (
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
