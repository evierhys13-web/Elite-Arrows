import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DartBot } from '../utils/DartBot';
import Breadcrumbs from '../components/Breadcrumbs';
import ScoliaBoard from '../components/ScoliaBoard';
import { useToast } from '../context/ToastContext';
import { db, doc, onSnapshot, updateDoc, arrayUnion } from '../firebase';
import { Capacitor } from '@capacitor/core';

const START_SCORES = [101, 301, 501, 701];
const FORMATS = [
  { id: 'bestOf', label: 'Best Of', icon: '🏆' },
  { id: 'firstTo', label: 'First To', icon: '🎯' }
];
const BOT_LEVELS = [
  { name: 'Amateur', avg: 35, check: 10, icon: '🌱' },
  { name: 'Club', avg: 50, check: 20, icon: '🎯' },
  { name: 'Pro', avg: 75, check: 35, icon: '🔥' },
  { name: 'Elite', avg: 95, check: 50, icon: '👑' }
];

export default function LiveMatch() {
  const { user, sendGameInvite, allUsers } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const videoRef = useRef(null);

  // Game Setup State
  const [gameStarted, setGameStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [startScore, setStartScore] = useState(501);
  const [isVsBot, setIsVsBot] = useState(true);
  const [gameFormat, setGameFormat] = useState('bestOf');
  const [legsToWin, setLegsCount] = useState(3);
  const [botLevel, setBotLevel] = useState(BOT_LEVELS[1]);

  // Online State
  const [onlineGameId, setOnlineGameId] = useState(null);
  const [isWaitingForAccept, setIsWaitingForAccept] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  // Live Match State
  const [playerScore, setPlayerScore] = useState(501);
  const [opponentScore, setOpponentScore] = useState(501);
  const [playerLegs, setPlayerLegs] = useState(0);
  const [opponentLegs, setOpponentLegs] = useState(0);
  const [turn, setTurn] = useState('player');
  const [history, setHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [bot, setBot] = useState(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [lastBotDarts, setLastBotDarts] = useState([]);
  const [currentTurnDarts, setCurrentTurnDarts] = useState([]);

  // Camera State
  const [useCamera, setUseCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [stream, setStream] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isAutoScoringActive, setIsAutoScoringActive] = useState(false);

  // Web Detection State
  const [boardCalibration, setBoardCalibration] = useState(null); // { centerX, centerY, radius }
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationPoint, setCalibrationPoint] = useState(0); // 0: Bull, 1: Outer
  const canvasRef = useRef(null);
  const prevFrameRef = useRef(null);
  const isProcessingRef = useRef(false);
  const stabilityCounterRef = useRef(0);
  const dartDetectedThisTurnRef = useRef(0);

  useEffect(() => {
    if (location.state && location.state.invitePlayer) {
        setIsVsBot(false);
        setIsOnline(true);
        setSelectedFriend(location.state.invitePlayer);
    }
  }, [location.state]);

  const onlineFriends = allUsers.filter(u =>
    u.id !== user?.id &&
    u.isOnline &&
    (user?.friends || []).includes(u.id)
  );

  useEffect(() => {
    const getCameras = async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
        try {
            await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setAvailableCameras(videoDevices);
            if (videoDevices.length > 0) {
                const lastUsed = localStorage.getItem('eliteArrowsPreferredCamera');
                const matched = videoDevices.find(d => d.deviceId === lastUsed);
                setSelectedCamera(matched ? matched.deviceId : videoDevices[0].deviceId);
            }
        } catch (e) { console.error(e); }
    };
    getCameras();
  }, []);

  const startCamera = async (forceDeviceId = null) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const deviceIdToUse = forceDeviceId || selectedCamera;

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    await new Promise(r => setTimeout(r, 200));

    try {
        const constraints = {
            video: {
                deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (e) {
        showToast('Camera error: ' + e.message, 'error');
    }
  };

  const flipCamera = async () => {
    if (availableCameras.length < 2) return;
    const idx = availableCameras.findIndex(c => c.deviceId === selectedCamera);
    const nextId = availableCameras[(idx + 1) % availableCameras.length].deviceId;
    setSelectedCamera(nextId);
    localStorage.setItem('eliteArrowsPreferredCamera', nextId);
    await startCamera(nextId);
  };

  useEffect(() => {
    if (useCamera && gameStarted && turn === 'player') startCamera();
    else if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
    }
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [useCamera, gameStarted, turn, selectedCamera]);

  const startGame = async () => {
    if (isOnline && (location.state?.invitePlayer || selectedFriend)) {
        const target = location.state?.invitePlayer || selectedFriend;
        setIsWaitingForAccept(true);
        const config = { startScore, gameFormat, legsToWin };
        const inviteId = await sendGameInvite(target.id, config);
        onSnapshot(doc(db, 'gameInvites', inviteId), (snap) => {
            if (snap.exists() && snap.data().status === 'accepted') {
                setOnlineGameId(snap.data().gameId);
                setGameStarted(true);
                setIsWaitingForAccept(false);
                if (useCamera && Capacitor.isNativePlatform()) {
                    Capacitor.Plugins['DartDetection']?.startDetection();
                    setIsAutoScoringActive(true);
                }
            }
        });
        return;
    }

    setPlayerScore(startScore);
    setOpponentScore(startScore);
    setPlayerLegs(0);
    setOpponentLegs(0);
    setHistory([]);
    setTurn('player');
    setGameStarted(true);
    setLastBotDarts([]);
    setCurrentTurnDarts([]);
    dartDetectedThisTurnRef.current = 0;

    // Load calibration
    const saved = localStorage.getItem('eliteArrowsBoardCalibration');
    if (saved) setBoardCalibration(JSON.parse(saved));

    if (isVsBot) {
        setBot(new DartBot({ targetAverage: botLevel.avg, checkoutRate: botLevel.check / 100 }));
    }

    if (useCamera && Capacitor.isNativePlatform()) {
        Capacitor.Plugins['DartDetection']?.startDetection();
        setIsAutoScoringActive(true);
    }

    showToast('Match Started!', 'info');
  };

  const handleBoardClick = (e) => {
    if (!calibrating || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (calibrationPoint === 0) {
        setBoardCalibration({ centerX: x, centerY: y, radius: 0 });
        setCalibrationPoint(1);
        showToast('Now tap the outer double 20 wire', 'info');
    } else {
        const dx = x - boardCalibration.centerX;
        const dy = y - boardCalibration.centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        setBoardCalibration({ ...boardCalibration, radius });
        setCalibrating(false);
        setCalibrationPoint(0);
        showToast('Calibration complete! Auto-scoring active.', 'success');
        localStorage.setItem('eliteArrowsBoardCalibration', JSON.stringify({ centerX: boardCalibration.centerX, centerY: boardCalibration.centerY, radius }));
    }
  };

  const processTurn = useCallback((who, score) => {
    const isPlayer = who === 'player';
    let current = isPlayer ? playerScore : opponentScore;
    let newScore = current - score;

    if (newScore < 0 || newScore === 1) {
        showToast('BUST!', 'warning');
        setHistory(prev => [{ who, score: 0, result: 'BUST', remaining: current }, ...prev]);
    } else {
        if (isPlayer) setPlayerScore(newScore);
        else setOpponentScore(newScore);

        setHistory(prev => [{ who, score, remaining: newScore }, ...prev]);

        if (newScore === 0) {
            const nextLegs = (isPlayer ? playerLegs : opponentLegs) + 1;
            if (isPlayer) setPlayerLegs(nextLegs); else setOpponentLegs(nextLegs);

            if ((gameFormat === 'firstTo' && nextLegs >= legsToWin) ||
                (gameFormat === 'bestOf' && nextLegs > legsToWin / 2)) {
                showToast(`MATCH SHOT! ${isPlayer ? 'You Win' : 'Opponent Wins'}!`, 'success');
                setGameStarted(false);
            } else {
                showToast('LEG SHOT!', 'success');
                setPlayerScore(startScore);
                setOpponentScore(startScore);
            }
            return;
        }
    }
    setTurn(isPlayer ? (isVsBot ? 'bot' : 'opponent') : 'player');
  }, [playerScore, opponentScore, playerLegs, opponentLegs, gameFormat, legsToWin, startScore, isVsBot, showToast]);

  const handleScoreInput = useCallback((score) => {
    const val = parseInt(score);
    if (isNaN(val) || val > 180) return;
    processTurn('player', val);
    setCurrentInput('');
    setCurrentTurnDarts([]);
  }, [processTurn]);

  useEffect(() => {
    if (gameStarted && turn === 'bot' && bot) {
        const runBot = async () => {
            setIsBotThinking(true);
            setLastBotDarts([]);
            const darts = await bot.takeTurn(opponentScore, (_, all) => setLastBotDarts([...all]));
            await new Promise(r => setTimeout(r, 1000));
            setIsBotThinking(false);
            processTurn('bot', darts.reduce((a, d) => a + d.value, 0));
        };
        runBot();
    }
  }, [turn, gameStarted, bot, opponentScore, processTurn]);

  useEffect(() => {
    const handleNative = (e) => {
        if (gameStarted && turn === 'player' && e.detail) {
            const { scoreLabel, scoreValue } = e.detail;
            showToast(`Detected: ${scoreLabel}`, 'info');
            setCurrentTurnDarts(prev => [...prev, scoreLabel]);
            setCurrentInput(prev => (parseInt(prev || '0') + scoreValue).toString());
        }
    };
    const handleSubmit = () => {
        if (gameStarted && turn === 'player') {
            showToast('Darts Removed - Auto Submitting', 'success');
            handleScoreInput(currentInput);
        }
    };
    window.addEventListener('dartDetectionScore', handleNative);
    window.addEventListener('dartDetectionSubmit', handleSubmit);
    return () => {
        window.removeEventListener('dartDetectionScore', handleNative);
        window.removeEventListener('dartDetectionSubmit', handleSubmit);
    };
  }, [gameStarted, turn, currentInput, handleScoreInput, showToast]);

  if (isWaitingForAccept) {
    return (
        <div className="page">
            <div className="card glass" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ width: '50px', height: '50px', margin: '0 auto 20px' }}></div>
                <h3 style={{ fontWeight: 800 }}>Challenging Friend...</h3>
                <button className="btn btn-secondary btn-block" style={{ marginTop: '20px' }} onClick={() => setIsWaitingForAccept(false)}>Cancel</button>
            </div>
        </div>
    );
  }

  if (!gameStarted) {
    return (
        <div className="page animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Match Setup' }]} />

            <div className="card glass pro-setup-card">
                <h1 className="setup-title">PRE-MATCH SETUP</h1>

                <div className="setup-grid">
                    {/* Left Column */}
                    <div className="setup-col">
                        <section className="setup-section">
                            <label>1. GAME MODE</label>
                            <div className="setup-btn-group">
                                {START_SCORES.map(s => (
                                    <button key={s} className={`setup-btn ${startScore === s ? 'active' : ''}`} onClick={() => setStartScore(s)}>{s}</button>
                                ))}
                            </div>
                        </section>

                        <section className="setup-section">
                            <label>2. OPPONENT</label>
                            <div className="setup-btn-group">
                                <button className={`setup-btn ${isVsBot ? 'active' : ''}`} onClick={() => {setIsVsBot(true); setIsOnline(false)}}>🤖 BOT</button>
                                <button className={`setup-btn ${!isVsBot && !isOnline ? 'active' : ''}`} onClick={() => {setIsVsBot(false); setIsOnline(false)}}>👥 LOCAL</button>
                                <button className={`setup-btn ${isOnline ? 'active' : ''}`} onClick={() => {setIsVsBot(false); setIsOnline(true)}}>🌐 ONLINE</button>
                            </div>
                        </section>

                        {isOnline && (
                            <section className="setup-section animate-fade-in">
                                <label>CHALLENGE FRIEND</label>
                                <select className="glass wide-select" value={selectedFriend?.id || ''} onChange={e => setSelectedFriend(onlineFriends.find(f => f.id === e.target.value))}>
                                    <option value="">-- Choose Online Friend --</option>
                                    {onlineFriends.map(f => <option key={f.id} value={f.id}>{f.username}</option>)}
                                </select>
                            </section>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="setup-col">
                        <section className="setup-section">
                            <label>3. FORMAT</label>
                            <div className="setup-btn-group split">
                                {FORMATS.map(f => (
                                    <button key={f.id} className={`setup-btn ${gameFormat === f.id ? 'active' : ''}`} onClick={() => setGameFormat(f.id)}>{f.label}</button>
                                ))}
                            </div>
                            <div className="setup-btn-group legs">
                                {[1, 3, 5, 7, 9, 11, 21].map(n => (
                                    <button key={n} className={`setup-btn sm ${legsToWin === n ? 'active' : ''}`} onClick={() => setLegsCount(n)}>{n}</button>
                                ))}
                            </div>
                        </section>

                        {isVsBot && (
                            <section className="setup-section difficulty-section animate-fade-in">
                                <label>BOT LEVEL</label>
                                <div className="diff-grid">
                                    {BOT_LEVELS.map(lvl => (
                                        <button key={lvl.name} className={`diff-btn ${botLevel.name === lvl.name ? 'active' : ''}`} onClick={() => setBotLevel(lvl)}>
                                            <span className="icon">{lvl.icon}</span>
                                            <div className="info">
                                                <span className="name">{lvl.name}</span>
                                                <span className="stats">{lvl.avg} avg</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <div className="setup-footer">
                    <div className="camera-setup-block">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={useCamera} onChange={e => setUseCamera(e.target.checked)} />
                            <div className="checkbox-text">
                                <strong>ENABLE LIVE CAMERA & AUTOSCORER</strong>
                                <small>Use high-performance native detection</small>
                            </div>
                        </label>

                        {useCamera && (
                            <select className="glass camera-select animate-fade-in" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
                                {availableCameras.map(cam => (
                                    <option key={cam.deviceId} value={cam.deviceId}>{cam.label || 'Webcam'}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <button className="confirm-start-btn" onClick={startGame}>START MATCH 🎯</button>
                </div>
            </div>

            <style>{`
                .pro-setup-card { padding: 40px; border-radius: 32px; border: 2px solid var(--accent-cyan); background: rgba(15, 23, 42, 0.98); box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
                .setup-title { text-align: center; color: white; font-weight: 900; letter-spacing: 4px; margin-bottom: 40px; font-size: 1.5rem; opacity: 0.8; }
                .setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-bottom: 40px; }
                .setup-section label { display: block; font-size: 0.7rem; font-weight: 900; color: var(--accent-cyan); margin-bottom: 15px; letter-spacing: 2px; }

                .setup-btn-group { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                .setup-btn-group.split { grid-template-columns: 1fr 1fr; }
                .setup-btn-group.legs { grid-template-columns: repeat(7, 1fr); }

                .setup-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: white; padding: 14px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
                .setup-btn.active { background: var(--accent-cyan); color: black; border-color: white; box-shadow: 0 0 20px var(--accent-cyan-glow); }
                .setup-btn.sm { padding: 10px 5px; font-size: 0.75rem; }

                .wide-select { width: 100%; border-radius: 12px; padding: 14px; font-weight: 700; color: white; }
                .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .diff-btn { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; text-align: left; }
                .diff-btn.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.1); }
                .diff-btn .icon { font-size: 1.5rem; }
                .diff-btn .name { display: block; font-weight: 800; color: white; font-size: 0.9rem; }
                .diff-btn .stats { display: block; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; }

                .setup-footer { border-top: 1px solid var(--border); padding-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
                .checkbox-label { display: flex; align-items: center; gap: 15px; cursor: pointer; }
                .checkbox-label input { width: 28px; height: 28px; accent-color: var(--accent-cyan); }
                .checkbox-text strong { display: block; font-size: 0.9rem; color: white; }
                .checkbox-text small { color: var(--text-muted); font-size: 0.7rem; }
                .camera-select { width: 100%; margin-top: 15px; border-radius: 10px; padding: 10px; }

                .confirm-start-btn { background: linear-gradient(135deg, #00d4ff 0%, #0080ff 100%); color: black; font-weight: 900; font-size: 1.4rem; padding: 22px 50px; border-radius: 20px; border: none; cursor: pointer; box-shadow: 0 10px 40px rgba(0, 212, 255, 0.4); transition: transform 0.2s; }
                .confirm-start-btn:active { transform: scale(0.98); }

                @media (max-width: 900px) {
                    .setup-grid { grid-template-columns: 1fr; gap: 30px; }
                    .setup-footer { flex-direction: column; align-items: stretch; }
                }
            `}</style>
        </div>
    );
  }

  return (
    <div className="page animate-fade-in match-theater-view" style={{ maxWidth: '100%', margin: '0', padding: '10px', height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
        {/* Pro Scoreboard */}
        <div className="match-header-scores">
            <div className={`player-panel ${turn === 'player' ? 'active' : ''}`}>
                <div className="panel-info">
                    <span className="name">{user?.username || 'YOU'}</span>
                    <span className="legs">LEGS: {playerLegs}</span>
                </div>
                <div className="score-val">{playerScore}</div>
                {currentTurnDarts.length > 0 && turn === 'player' && (
                    <div className="turn-darts">
                        {currentTurnDarts.map((d, i) => <span key={i} className="dart-pill">{d}</span>)}
                    </div>
                )}
            </div>

            <div className={`player-panel ${turn !== 'player' ? 'active' : ''}`}>
                <div className="panel-info">
                    <span className="name">{isVsBot ? `BOT (${botLevel.name})` : (selectedFriend?.username || 'OPPONENT')}</span>
                    <span className="legs">LEGS: {opponentLegs}</span>
                </div>
                <div className="score-val">{isBotThinking ? '...' : opponentScore}</div>
            </div>
        </div>

        <div className="match-workspace">
            {/* Main Stage: Camera / Scolia Board */}
            <div className="match-stage card glass">
                {turn === 'player' && useCamera ? (
                    <div className="live-cam-container">
                        <video ref={videoRef} autoPlay playsInline muted style={{ transform: `scale(${zoomLevel})` }} />
                        <div className="stage-overlay">
                             <div className="status-badge">📡 AUTO-SCORING: {isAutoScoringActive ? 'ACTIVE' : 'READY'}</div>
                             <div className="hud-controls">
                                <div className="zoom-ctrl">
                                    <button onClick={() => setZoomLevel(p => Math.min(5, p + 0.5))} className="hud-btn">+</button>
                                    <span className="zoom-val">{Math.round(zoomLevel*100)}%</span>
                                    <button onClick={() => setZoomLevel(p => Math.max(1, p - 0.5))} className="hud-btn">-</button>
                                </div>
                                <button onClick={flipCamera} className="hud-btn flip">🔄</button>
                             </div>
                        </div>
                    </div>
                ) : turn !== 'player' && isVsBot ? (
                    <div className="scolia-view animate-fade-in">
                        <ScoliaBoard lastDarts={lastBotDarts} size={window.innerWidth < 1200 ? 380 : 550} />
                    </div>
                ) : (
                    <div className="empty-stage">
                        <div className="huge-target">🎯</div>
                        <p>Waiting for next player...</p>
                    </div>
                )}
            </div>

            {/* Controls Side */}
            <aside className="match-controls">
                <div className={`scoring-panel card glass ${turn !== 'player' ? 'disabled' : ''}`}>
                    <div className="input-lcd">{currentInput || '0'}</div>
                    <div className="pro-keypad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                            <button key={key} className={`k-btn ${key === 'ENTER' ? 'k-enter' : ''}`} onClick={() => {
                                if (key === 'DEL') setCurrentInput(p => p.slice(0, -1));
                                else if (key === 'ENTER') handleScoreInput(currentInput);
                                else if (currentInput.length < 3) setCurrentInput(p => p + key);
                            }}>{key}</button>
                        ))}
                    </div>
                    {Capacitor.isNativePlatform() && (
                        <button className="recal-btn" onClick={() => Capacitor.Plugins['DartDetection']?.startDetection()}>
                            ⚡ RE-CALIBRATE BOARD
                        </button>
                    )}
                </div>

                <div className="log-panel card glass">
                    <div className="log-header">
                        <span>MATCH HISTORY</span>
                        <button className="quit-btn" onClick={() => {if(window.confirm('Quit?')) setGameStarted(false)}}>EXIT</button>
                    </div>
                    <div className="log-rows">
                        {history.map((e, i) => (
                            <div key={i} className={`log-row ${e.who}`}>
                                <span className="who">{e.who === 'player' ? 'YOU' : 'OPP'}</span>
                                <span className="pts">{e.score}</span>
                                <span className="rem">{e.remaining}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        </div>

        <style>{`
            .match-theater-view .main-content { padding: 0 !important; margin: 0 !important; max-width: 100vw !important; }
            .match-header-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; height: 130px; }
            .player-panel { background: rgba(15, 23, 42, 0.9); border: 2px solid var(--border); border-radius: 20px; padding: 15px; position: relative; transition: 0.3s; display: flex; flex-direction: column; justify-content: center; }
            .player-panel.active { border-color: var(--accent-cyan); box-shadow: 0 0 40px var(--accent-cyan-glow); background: rgba(0, 212, 255, 0.1); }
            .player-panel .name { font-weight: 900; color: var(--accent-cyan); font-size: 0.9rem; letter-spacing: 1px; }
            .player-panel .legs { font-size: 0.7rem; font-weight: 900; background: #000; padding: 2px 8px; border-radius: 5px; }
            .player-panel .score-val { font-size: 5rem; font-weight: 900; line-height: 1; text-align: center; }
            .turn-darts { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; }
            .dart-pill { background: var(--accent-cyan); color: black; font-size: 0.6rem; font-weight: 900; padding: 2px 8px; border-radius: 4px; border: 1px solid white; }

            .match-workspace { display: grid; grid-template-columns: 1.6fr 1fr; gap: 10px; flex: 1; min-height: 0; }
            .match-stage { padding: 0; background: #000; border: 2px solid var(--border); border-radius: 24px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            .live-cam-container { width: 100%; height: 100%; position: relative; }
            .live-cam-container video { width: 100%; height: 100%; object-fit: cover; transition: 0.3s; }
            .stage-overlay { position: absolute; inset: 0; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
            .status-badge { align-self: flex-start; background: rgba(0, 212, 255, 0.2); backdrop-filter: blur(10px); padding: 8px 16px; border-radius: 30px; border: 1px solid var(--accent-cyan); font-weight: 900; font-size: 0.75rem; color: white; }
            .hud-controls { align-self: flex-end; display: flex; gap: 10px; pointer-events: auto; }
            .zoom-ctrl { background: rgba(0,0,0,0.8); padding: 8px; border-radius: 14px; border: 1px solid var(--accent-cyan); display: flex; align-items: center; gap: 15px; }
            .hud-btn { width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); color: white; font-weight: 900; cursor: pointer; }
            .zoom-val { font-size: 0.8rem; font-weight: 900; color: var(--accent-cyan); }

            .match-controls { display: flex; flex-direction: column; gap: 10px; }
            .scoring-panel { padding: 20px; background: rgba(15, 23, 42, 0.95); display: flex; flex-direction: column; gap: 15px; }
            .scoring-panel.disabled { opacity: 0.2; pointer-events: none; }
            .input-lcd { background: #000; padding: 15px; border-radius: 16px; border: 3px solid var(--accent-cyan); font-size: 4rem; font-weight: 900; color: var(--accent-cyan); text-align: center; text-shadow: 0 0 20px var(--accent-cyan-glow); }
            .pro-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .k-btn { height: 65px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: white; font-weight: 900; font-size: 1.5rem; cursor: pointer; }
            .k-enter { background: var(--accent-cyan); color: black; }
            .recal-btn { background: linear-gradient(135deg, #FF00E5, #B000FF); border: none; padding: 15px; border-radius: 12px; color: white; font-weight: 900; font-size: 0.8rem; letter-spacing: 1px; }

            .log-panel { flex: 1; display: flex; flex-direction: column; padding: 20px; min-height: 0; }
            .log-rows { flex: 1; overflow-y: auto; }
            .log-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 800; font-size: 1rem; }
            .log-row.player .who { color: var(--accent-cyan); }
            .log-row .pts { flex: 1; text-align: center; font-size: 1.2rem; }
            .log-row .rem { width: 60px; text-align: right; color: var(--text-muted); font-size: 0.8rem; }

            @media (max-width: 1200px) {
                .match-workspace { grid-template-columns: 1fr; overflow-y: auto; }
                .match-stage { height: 450px; flex: none; }
                .match-controls { height: auto; }
            }
        `}</style>
    </div>
  );
}
