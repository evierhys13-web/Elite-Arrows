import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DartBot } from '../utils/DartBot';
import Breadcrumbs from '../components/Breadcrumbs';
import ScoliaBoard from '../components/ScoliaBoard';
import { useToast } from '../context/ToastContext';
import { db, doc, onSnapshot, updateDoc, arrayUnion } from '../firebase';

const START_SCORES = [101, 301, 501, 701];
const FORMATS = [
  { id: 'bestOf', label: 'Best Of', icon: '🏆' },
  { id: 'firstTo', label: 'First To', icon: '🎯' }
];

const DEFAULT_CUSTOM_AVG = 50;
const DEFAULT_CUSTOM_CHECK = 20;

export default function LiveMatch() {
  const { user, sendGameInvite, allUsers } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Game Setup State
  const [gameStarted, setGameStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [startScore, setStartScore] = useState(501);
  const [isVsBot, setIsVsBot] = useState(true);
  const [gameFormat, setGameFormat] = useState('bestOf');
  const [legsToWin, setLegsCount] = useState(3);
  const [selectedProBot, setSelectedProBot] = useState(DartBot.getProBots()[1]);
  const [customAvg, setCustomAvg] = useState(DEFAULT_CUSTOM_AVG);
  const [customCheck, setCustomCheck] = useState(DEFAULT_CUSTOM_CHECK);

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

    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
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
        streamRef.current = newStream;
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
    if (useCamera) startCamera();
    else if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setStream(null);
    }
    return () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [useCamera, selectedCamera]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

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
    setCurrentInput('');

    if (isVsBot) {
        const isCustom = selectedProBot.id === 'custom';
        const effectiveAvg = isCustom ? customAvg : selectedProBot.avg;
        const effectiveCheck = isCustom ? customCheck : selectedProBot.check;
        setBot(new DartBot({
            id: selectedProBot.id,
            name: selectedProBot.name,
            targetAverage: effectiveAvg,
            checkoutRate: effectiveCheck / 100,
            setupRate: effectiveCheck / 120,
        }));
    }

    showToast('Match Started!', 'info');
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

  if (!gameStarted) {
    return (
        <div className="page animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Match Setup' }]} />

            <div className="card glass pro-setup-card">
                <h1 className="setup-title">PRE-MATCH SETUP</h1>

                <div className="setup-grid">
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
                                <label>SELECT PRO BOT</label>
                                <div className="pro-bot-grid">
                                    {DartBot.getProBots().map(p => (
                                        <button key={p.id} className={`pro-bot-btn ${selectedProBot.id === p.id ? 'active' : ''}`} onClick={() => setSelectedProBot(p)}>
                                            <span className="icon">{p.icon}</span>
                                            <div className="info">
                                                <span className="name">{p.name}</span>
                                                <span className="stats">{p.avg} avg · {p.check}%</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {selectedProBot.id === 'custom' && (
                                    <div className="custom-bot-controls animate-fade-in">
                                        <div className="slider-group">
                                            <label>AVERAGE: <strong>{customAvg}</strong></label>
                                            <input type="range" min="20" max="110" value={customAvg} onChange={e => setCustomAvg(Number(e.target.value))} />
                                        </div>
                                        <div className="slider-group">
                                            <label>CHECKOUT %: <strong>{customCheck}%</strong></label>
                                            <input type="range" min="5" max="60" value={customCheck} onChange={e => setCustomCheck(Number(e.target.value))} />
                                        </div>
                                    </div>
                                )}
                                {selectedProBot.id !== 'custom' && (
                                    <div className="pro-bot-desc">{selectedProBot.desc}</div>
                                )}
                            </section>
                        )}
                    </div>
                </div>

                <div className="setup-footer">
                    <div className="camera-setup-block">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={useCamera} onChange={e => setUseCamera(e.target.checked)} />
                            <div className="checkbox-text">
                                <strong>ENABLE CAMERA VIEW</strong>
                                <small>Camera preview during your turn</small>
                            </div>
                        </label>

                        {useCamera && (
                            <div className="camera-preview-area">
                                <div className="camera-indicator">
                                    <span className={`camera-dot ${stream ? 'active' : 'offline'}`} />
                                    {stream ? 'CAMERA ACTIVE' : 'STARTING CAMERA...'}
                                </div>
                                {stream && (
                                    <div className="camera-mini-preview">
                                        <video ref={videoRef} autoPlay playsInline muted />
                                    </div>
                                )}
                                <select className="glass camera-select animate-fade-in" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
                                    {availableCameras.map(cam => (
                                        <option key={cam.deviceId} value={cam.deviceId}>{cam.label || 'Webcam'}</option>
                                    ))}
                                </select>
                            </div>
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
                .wide-select { width: 100%; border-radius: 12px; padding: 14px; font-weight: 700; color: white; }
                .setup-footer { border-top: 1px solid var(--border); padding-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
                .checkbox-label { display: flex; align-items: center; gap: 15px; cursor: pointer; }
                .checkbox-label input { width: 28px; height: 28px; accent-color: var(--accent-cyan); }
                .confirm-start-btn { background: linear-gradient(135deg, #00d4ff 0%, #0080ff 100%); color: black; font-weight: 900; font-size: 1.4rem; padding: 22px 50px; border-radius: 20px; border: none; cursor: pointer; box-shadow: 0 10px 40px rgba(0, 212, 255, 0.4); }
                .pro-bot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 300px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; }
                .pro-bot-grid::-webkit-scrollbar { width: 4px; }
                .pro-bot-grid::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 4px; }
                .pro-bot-btn { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; text-align: left; transition: 0.2s; }
                .pro-bot-btn.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.12); box-shadow: 0 0 12px var(--accent-cyan-glow); }
                .pro-bot-btn .icon { font-size: 1.2rem; }
                .pro-bot-btn .info { display: flex; flex-direction: column; line-height: 1.2; }
                .pro-bot-btn .name { font-size: 0.7rem; font-weight: 900; color: white; }
                .pro-bot-btn .stats { font-size: 0.6rem; color: var(--accent-cyan); font-weight: 700; }
                .pro-bot-desc { font-size: 0.65rem; color: var(--text-muted); text-align: center; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-top: 8px; }
                .custom-bot-controls { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
                .slider-group { display: flex; flex-direction: column; gap: 4px; }
                .slider-group label { font-size: 0.7rem; margin-bottom: 0; }
                .slider-group label strong { color: white; }
                .slider-group input[type=range] { width: 100%; height: 6px; border-radius: 4px; background: var(--border); outline: none; -webkit-appearance: none; appearance: none; }
                .slider-group input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-cyan); cursor: pointer; border: 2px solid white; }
                .camera-preview-area { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
                .camera-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 1px; }
                .camera-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; display: inline-block; }
                .camera-dot.active { background: #00ff88; box-shadow: 0 0 12px #00ff88; animation: pulse-dot 1.5s ease-in-out infinite; }
                .camera-dot.offline { background: #ff8800; box-shadow: 0 0 12px #ff8800; animation: pulse-dot 1s ease-in-out infinite; }
                .camera-mini-preview { border-radius: 12px; overflow: hidden; border: 2px solid var(--accent-cyan); background: #000; max-height: 160px; }
                .camera-mini-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                @media (max-width: 900px) { .setup-grid { grid-template-columns: 1fr; gap: 30px; } .setup-footer { flex-direction: column; align-items: stretch; } .pro-bot-grid { grid-template-columns: repeat(2, 1fr); } }
            `}</style>
        </div>
    );
  }

  return (
    <div className="page animate-fade-in match-theater-view" style={{ maxWidth: '100%', margin: '0', padding: '10px', height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
        

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
                    <span className="name">{isVsBot ? selectedProBot.name : (selectedFriend?.username || 'OPPONENT')}</span>
                    <span className="legs">LEGS: {opponentLegs}</span>
                </div>
                <div className="score-val">{isBotThinking ? '...' : opponentScore}</div>
            </div>
        </div>

        <div className="match-workspace">
            <div className="match-stage card glass">
                {turn === 'player' && useCamera ? (
                    <div className="live-cam-container">
                        <video ref={videoRef} autoPlay playsInline muted style={{ transform: `scale(${zoomLevel})` }} />
                        <div className="stage-overlay">
                             <div className="hud-controls">
                                <div className="zoom-ctrl">
                                    <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.min(5, p + 0.5))}} className="hud-btn">+</button>
                            <span className="zoom-val">{Math.round(zoomLevel*100)}%</span>
                                     <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.max(1, p - 0.5))}} className="hud-btn">-</button>
                                 </div>
                                  <button onClick={(e) => {e.stopPropagation(); flipCamera()}} className="hud-btn flip">🔄</button>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="scolia-view animate-fade-in">
                        <ScoliaBoard lastDarts={lastBotDarts} size={window.innerWidth < 1200 ? 380 : 550} />
                    </div>
                )}
            </div>

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
            .live-cam-container { width: 100%; height: 100%; position: relative; cursor: crosshair; }
            .live-cam-container video { width: 100%; height: 100%; object-fit: cover; transition: 0.3s; }
            .stage-overlay { position: absolute; inset: 0; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
            .hud-controls { align-self: flex-end; display: flex; gap: 10px; pointer-events: auto; }
            .zoom-ctrl { background: rgba(0,0,0,0.8); padding: 8px; border-radius: 14px; border: 1px solid var(--accent-cyan); display: flex; align-items: center; gap: 15px; }
            .hud-btn { width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); color: white; font-weight: 900; cursor: pointer; }

            .match-controls { display: flex; flex-direction: column; gap: 10px; }
            .scoring-panel { padding: 20px; background: rgba(15, 23, 42, 0.95); display: flex; flex-direction: column; gap: 15px; }
            .scoring-panel.disabled { opacity: 0.2; pointer-events: none; }
            .input-lcd { background: #000; padding: 15px; border-radius: 16px; border: 3px solid var(--accent-cyan); font-size: 4rem; font-weight: 900; color: var(--accent-cyan); text-align: center; text-shadow: 0 0 20px var(--accent-cyan-glow); }
            .pro-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .k-btn { height: 65px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: white; font-weight: 900; font-size: 1.5rem; cursor: pointer; }
            .k-enter { background: var(--accent-cyan); color: black; }

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
