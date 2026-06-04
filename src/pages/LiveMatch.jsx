import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DartBot } from '../utils/DartBot';
import Breadcrumbs from '../components/Breadcrumbs';
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
  const searchRef = useRef(null);

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
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

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
        setSelectedOpponent(location.state.invitePlayer);
    }
  }, [location.state]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allUsers) return [];
    const q = searchQuery.toLowerCase();
    return allUsers.filter(u =>
      u.id !== user?.id &&
      (u.username?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, allUsers, user?.id]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    if (isOnline && selectedOpponent) {
        setIsWaitingForAccept(true);
        const config = { startScore, gameFormat, legsToWin };
        const inviteId = await sendGameInvite(selectedOpponent.id, config);
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
            const allDarts = [];
            let remaining = opponentScore;
            for (let i = 0; i < 3; i++) {
                await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
                const dart = bot.calculateDart(remaining, i);
                allDarts.push(dart);
                setLastBotDarts([...allDarts]);
                remaining -= dart.value;
                if (remaining <= 0) break;
            }
            setIsBotThinking(false);
            processTurn('bot', allDarts.reduce((a, d) => a + d.value, 0));
        };
        runBot();
    }
  }, [turn, gameStarted, bot, opponentScore, processTurn]);

  if (!gameStarted) {
    return (
        <div className="page animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Match Setup' }]} />

            <div className="setup-hero">
                <h1 className="setup-title">
                    <span className="text-gradient">MATCH SETUP</span>
                </h1>
                <p className="setup-subtitle">Configure your game — choose an opponent, format, and scoring</p>
            </div>

            <div className="setup-layout">
                <div className="setup-card">
                    <div className="setup-card-header">
                        <span className="step-badge">1</span>
                        <span>GAME MODE</span>
                    </div>
                    <div className="setup-option-group">
                        {START_SCORES.map(s => (
                            <button key={s} className={`opt-btn ${startScore === s ? 'active' : ''}`} onClick={() => setStartScore(s)}>
                                <span className="opt-val">{s}</span>
                            </button>
                        ))}
                    </div>

                    <div className="setup-card-header" style={{ marginTop: 28 }}>
                        <span className="step-badge">2</span>
                        <span>OPPONENT</span>
                    </div>
                    <div className="opponent-selector">
                        <button className={`opp-btn ${isVsBot ? 'active' : ''}`} onClick={() => {setIsVsBot(true); setIsOnline(false); setSelectedOpponent(null)}}>
                            <span className="opp-icon">🤖</span>
                            <span className="opp-label">BOT</span>
                            <span className="opp-desc">Play against AI</span>
                        </button>
                        <button className={`opp-btn ${!isVsBot && !isOnline ? 'active' : ''}`} onClick={() => {setIsVsBot(false); setIsOnline(false); setSelectedOpponent(null)}}>
                            <span className="opp-icon">👥</span>
                            <span className="opp-label">LOCAL</span>
                            <span className="opp-desc">Pass & play</span>
                        </button>
                        <button className={`opp-btn ${isOnline ? 'active' : ''}`} onClick={() => {setIsVsBot(false); setIsOnline(true)}}>
                            <span className="opp-icon">🌐</span>
                            <span className="opp-label">ONLINE</span>
                            <span className="opp-desc">Challenge anyone</span>
                        </button>
                    </div>
                </div>

                <div className="setup-card">
                    {isOnline ? (
                        <>
                            <div className="setup-card-header">
                                <span className="step-badge">3</span>
                                <span>SEARCH PLAYER</span>
                            </div>
                            <div className="search-wrap" ref={searchRef}>
                                <input
                                    className="search-input"
                                    type="text"
                                    placeholder="Type a username..."
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); setSelectedOpponent(null); }}
                                    onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                                />
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="search-results">
                                        {searchResults.map(u => (
                                            <button key={u.id} className={`search-result-item ${selectedOpponent?.id === u.id ? 'active' : ''}`} onClick={() => { setSelectedOpponent(u); setSearchQuery(u.username); setShowSearchResults(false); }}>
                                                <div className="search-avatar">{u.username?.[0]?.toUpperCase() || '?'}</div>
                                                <div className="search-info">
                                                    <span className="search-name">{u.username}</span>
                                                    <span className="search-status">Online</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showSearchResults && searchQuery.trim() && searchResults.length === 0 && (
                                    <div className="search-results"><div className="search-empty">No players found</div></div>
                                )}
                                {selectedOpponent && (
                                    <div className="selected-player">
                                        <div className="search-avatar">{selectedOpponent.username?.[0]?.toUpperCase() || '?'}</div>
                                        <span>{selectedOpponent.username}</span>
                                        <button className="clear-btn" onClick={() => { setSelectedOpponent(null); setSearchQuery(''); }}>✕</button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : isVsBot ? (
                        <>
                            <div className="setup-card-header">
                                <span className="step-badge">3</span>
                                <span>SELECT PRO BOT</span>
                            </div>
                            <div className="pro-bot-grid">
                                {DartBot.getProBots().map(p => (
                                    <button key={p.id} className={`pro-bot-btn ${selectedProBot.id === p.id ? 'active' : ''}`} onClick={() => setSelectedProBot(p)}>
                                        <span className="pro-bot-icon">{p.icon}</span>
                                        <span className="pro-bot-name">{p.name}</span>
                                        <span className="pro-bot-stats">{p.avg} · {p.check}%</span>
                                    </button>
                                ))}
                            </div>
                            {selectedProBot.id === 'custom' && (
                                <div className="custom-controls">
                                    <div className="slider-row">
                                        <label>AVERAGE <strong>{customAvg}</strong></label>
                                        <input type="range" min="20" max="110" value={customAvg} onChange={e => setCustomAvg(Number(e.target.value))} />
                                    </div>
                                    <div className="slider-row">
                                        <label>CHECKOUT <strong>{customCheck}%</strong></label>
                                        <input type="range" min="5" max="60" value={customCheck} onChange={e => setCustomCheck(Number(e.target.value))} />
                                    </div>
                                </div>
                            )}
                            {selectedProBot.id !== 'custom' && (
                                <div className="bot-desc">{selectedProBot.desc}</div>
                            )}
                        </>
                    ) : (
                        <div className="local-hint">
                            <span className="local-icon">🎯</span>
                            <p>Pass the device to your opponent when it's their turn. No setup needed.</p>
                        </div>
                    )}

                    <div className="setup-card-header" style={{ marginTop: isOnline ? 28 : 0 }}>
                        <span className="step-badge">{isOnline ? 4 : 3}</span>
                        <span>FORMAT</span>
                    </div>
                    <div className="format-row">
                        {FORMATS.map(f => (
                            <button key={f.id} className={`fmt-btn ${gameFormat === f.id ? 'active' : ''}`} onClick={() => setGameFormat(f.id)}>{f.label}</button>
                        ))}
                    </div>
                    <div className="legs-row">
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                            <button key={n} className={`leg-btn ${legsToWin === n ? 'active' : ''}`} onClick={() => setLegsCount(n)}>{n}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="setup-footer-bar">
                <label className="camera-toggle">
                    <input type="checkbox" checked={useCamera} onChange={e => setUseCamera(e.target.checked)} />
                    <span className={`toggle-track ${useCamera ? 'on' : ''}`}>
                        <span className="toggle-thumb" />
                    </span>
                    <span className="toggle-label">Camera View</span>
                </label>

                {useCamera && (
                    <div className="camera-preview-area">
                        <div className="camera-indicator">
                            <span className={`camera-dot ${stream ? 'active' : 'offline'}`} />
                            {stream ? 'ACTIVE' : 'STARTING...'}
                        </div>
                        {stream && (
                            <div className="camera-mini-preview">
                                <video ref={videoRef} autoPlay playsInline muted />
                            </div>
                        )}
                        <select className="cam-select" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
                            {availableCameras.map(cam => (
                                <option key={cam.deviceId} value={cam.deviceId}>{cam.label || 'Webcam'}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button className="start-btn" onClick={startGame} disabled={isOnline && !selectedOpponent}>
                    {isWaitingForAccept ? 'WAITING FOR ACCEPT...' : (isOnline && selectedOpponent ? `CHALLENGE ${selectedOpponent.username.toUpperCase()}` : 'START MATCH')}
                    <span className="start-arrow">🎯</span>
                </button>
            </div>

            <style>{`
                .setup-hero { text-align: center; margin-bottom: 36px; }
                .setup-title { font-size: 2.4rem; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; }
                .setup-subtitle { color: var(--text-muted); font-size: 0.9rem; }

                .setup-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

                .setup-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 28px; }
                .setup-card-header { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 0.8rem; color: white; letter-spacing: 1.5px; margin-bottom: 16px; }
                .step-badge { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900; }

                .setup-option-group { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .opt-btn { padding: 16px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.2s; text-align: center; }
                .opt-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 0 20px var(--accent-purple-glow); }
                .opt-btn:hover { background: rgba(255,255,255,0.08); }

                .opponent-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .opp-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
                .opp-btn.active { border-color: var(--accent-cyan); background: rgba(56, 189, 248, 0.1); box-shadow: 0 0 16px var(--accent-cyan-glow); }
                .opp-btn:hover { background: rgba(255,255,255,0.08); }
                .opp-icon { font-size: 1.8rem; }
                .opp-label { font-weight: 900; font-size: 0.85rem; color: white; }
                .opp-desc { font-size: 0.6rem; color: var(--text-muted); }

                .search-wrap { position: relative; }
                .search-input { width: 100%; padding: 14px 16px; border-radius: var(--border-radius-md); background: rgba(0,0,0,0.4); border: 1px solid var(--border); color: white; font-size: 0.95rem; outline: none; transition: 0.2s; }
                .search-input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 12px var(--accent-cyan-glow); }
                .search-input::placeholder { color: var(--text-muted); }
                .search-results { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--border-radius-md); overflow: hidden; z-index: 50; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
                .search-result-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: none; background: none; color: white; cursor: pointer; text-align: left; transition: 0.15s; }
                .search-result-item:hover, .search-result-item.active { background: rgba(56, 189, 248, 0.1); }
                .search-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; flex-shrink: 0; }
                .search-info { display: flex; flex-direction: column; }
                .search-name { font-weight: 700; font-size: 0.85rem; }
                .search-status { font-size: 0.65rem; color: var(--success); }
                .search-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
                .selected-player { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid var(--accent-cyan); border-radius: var(--border-radius-md); font-weight: 700; font-size: 0.9rem; }
                .clear-btn { margin-left: auto; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }

                .pro-bot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 260px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; }
                .pro-bot-grid::-webkit-scrollbar { width: 4px; }
                .pro-bot-grid::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 4px; }
                .pro-bot-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
                .pro-bot-btn.active { border-color: var(--accent-cyan); background: rgba(56, 189, 248, 0.12); box-shadow: 0 0 12px var(--accent-cyan-glow); }
                .pro-bot-btn:hover { background: rgba(255,255,255,0.07); }
                .pro-bot-icon { font-size: 1.1rem; }
                .pro-bot-name { font-size: 0.6rem; font-weight: 800; color: white; text-align: center; line-height: 1.1; }
                .pro-bot-stats { font-size: 0.55rem; color: var(--accent-cyan); font-weight: 700; }
                .bot-desc { font-size: 0.7rem; color: var(--text-muted); text-align: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-top: 10px; }
                .custom-controls { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
                .slider-row { display: flex; flex-direction: column; gap: 4px; }
                .slider-row label { font-size: 0.7rem; font-weight: 700; color: var(--accent-cyan); display: flex; justify-content: space-between; }
                .slider-row label strong { color: white; }
                .slider-row input[type=range] { width: 100%; height: 5px; border-radius: 4px; background: var(--border); outline: none; -webkit-appearance: none; appearance: none; }
                .slider-row input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-cyan); cursor: pointer; border: 2px solid white; }

                .local-hint { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
                .local-icon { font-size: 3rem; }

                .format-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
                .fmt-btn { padding: 14px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
                .fmt-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 0 16px var(--accent-purple-glow); }
                .fmt-btn:hover { background: rgba(255,255,255,0.07); }
                .legs-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
                .leg-btn { padding: 12px; border-radius: var(--border-radius-sm); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 0.8rem; }
                .leg-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); }
                .leg-btn:hover { background: rgba(255,255,255,0.07); }

                .setup-footer-bar { display: flex; align-items: center; gap: 20px; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 20px 28px; margin-top: 4px; flex-wrap: wrap; }
                .camera-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
                .toggle-track { width: 44px; height: 24px; border-radius: 12px; background: rgba(255,255,255,0.15); position: relative; transition: 0.25s; flex-shrink: 0; }
                .toggle-track.on { background: var(--accent-cyan); }
                .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: 0.25s; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
                .toggle-track.on .toggle-thumb { left: 22px; }
                .toggle-label { font-weight: 700; font-size: 0.8rem; color: white; }
                .camera-toggle input { display: none; }

                .camera-preview-area { display: flex; align-items: center; gap: 12px; }
                .camera-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px; }
                .camera-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; flex-shrink: 0; }
                .camera-dot.active { background: #00ff88; box-shadow: 0 0 8px #00ff88; animation: pulse-dot 1.5s ease-in-out infinite; }
                .camera-dot.offline { background: #ff8800; box-shadow: 0 0 8px #ff8800; animation: pulse-dot 1s ease-in-out infinite; }
                .camera-mini-preview { border-radius: 8px; overflow: hidden; border: 1px solid var(--accent-cyan); background: #000; max-height: 60px; width: 80px; flex-shrink: 0; }
                .camera-mini-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
                .cam-select { background: rgba(0,0,0,0.4); border: 1px solid var(--border); color: white; padding: 8px 10px; border-radius: var(--border-radius-sm); font-size: 0.7rem; font-weight: 600; max-width: 140px; }

                .start-btn { margin-left: auto; display: flex; align-items: center; gap: 12px; padding: 16px 36px; border-radius: var(--border-radius-md); border: none; background: linear-gradient(135deg, var(--accent-primary), #6344ef); color: white; font-weight: 900; font-size: 1rem; cursor: pointer; transition: 0.25s; box-shadow: 0 8px 24px rgba(129, 140, 248, 0.3); letter-spacing: 1px; white-space: nowrap; }
                .start-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(129, 140, 248, 0.4); }
                .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .start-arrow { font-size: 1.2rem; }

                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                @media (max-width: 900px) {
                    .setup-layout { grid-template-columns: 1fr; }
                    .setup-footer-bar { flex-direction: column; align-items: stretch; }
                    .start-btn { margin-left: 0; justify-content: center; }
                    .camera-preview-area { flex-wrap: wrap; }
                    .pro-bot-grid { grid-template-columns: repeat(3, 1fr); }
                }
            `}</style>
        </div>
    );
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '100%', margin: '0', padding: '0', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
        <div className="match-header">
            <div className={`player-card ${turn === 'player' ? 'active' : ''}`}>
                <div className="player-card-top">
                    <span className="player-name">{user?.username || 'YOU'}</span>
                    <span className="player-badge">{playerLegs} LEG{playerLegs !== 1 ? 'S' : ''}</span>
                </div>
                <div className="player-score">{playerScore}</div>
                {currentTurnDarts.length > 0 && turn === 'player' && (
                    <div className="player-darts">{currentTurnDarts.map((d, i) => <span key={i} className="dart-chip">{d}</span>)}</div>
                )}
                {turn === 'player' && <div className="turn-arrow">◀ YOUR TURN</div>}
            </div>

            <div className="match-divider">
                <span className="vs-text">VS</span>
            </div>

            <div className={`player-card right ${turn !== 'player' ? 'active' : ''}`}>
                <div className="player-card-top">
                    <span className="player-name">{isVsBot ? selectedProBot.name : (selectedOpponent?.username || 'OPPONENT')}</span>
                    <span className="player-badge">{opponentLegs} LEG{opponentLegs !== 1 ? 'S' : ''}</span>
                </div>
                <div className="player-score">{isBotThinking ? <span className="thinking-dots">...</span> : opponentScore}</div>
                {turn !== 'player' && !isBotThinking && <div className="turn-arrow right">◀ THEIR TURN</div>}
                {isBotThinking && <div className="thinking-label">THROWING...</div>}
            </div>
        </div>

        <div className="match-body">
            <div className="match-stage-wrap">
                {turn === 'player' && useCamera ? (
                    <div className="cam-view">
                        <video ref={videoRef} autoPlay playsInline muted style={{ transform: `scale(${zoomLevel})` }} />
                        <div className="cam-hud">
                            <div className="cam-controls">
                                <div className="zoom-group">
                                    <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.min(5, p + 0.5))}} className="cam-btn">+</button>
                                    <span className="zoom-val">{Math.round(zoomLevel * 100)}%</span>
                                    <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.max(1, p - 0.5))}} className="cam-btn">−</button>
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); flipCamera()}} className="cam-btn flip">🔄</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="dart-cards-view">
                        <div className="dart-cards-container">
                            {[0, 1, 2].map(i => {
                                const dart = lastBotDarts[i];
                                const isTreble = dart?.label?.startsWith('T');
                                const isDouble = dart?.label?.startsWith('D');
                                const isBull = dart?.label === 'BULL';
                                const isMiss = dart?.label === 'MISS';
                                const cardClass = isTreble ? 'treble' : isDouble ? 'dbl' : isBull ? 'bull' : isMiss ? 'miss' : '';
                                return (
                                    <div key={i} className={`dart-card ${dart ? 'filled ' + cardClass : 'empty'}`} style={{ animationDelay: `${i * 0.15}s` }}>
                                        {dart ? (
                                            <>
                                                <div className="dart-label">{dart.label}</div>
                                                <div className="dart-value">{dart.value}</div>
                                            </>
                                        ) : (
                                            <div className="dart-placeholder">🎯</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {lastBotDarts.length > 0 && (
                            <div className="dart-total">
                                = {lastBotDarts.reduce((s, d) => s + d.value, 0)}
                            </div>
                        )}
                        {turn === 'bot' && isBotThinking && (
                            <div className="dart-thinking">THROWING...</div>
                        )}
                    </div>
                )}
            </div>

            <aside className="match-sidebar">
                <div className={`scoring-module ${turn !== 'player' ? 'blocked' : ''}`}>
                    <div className="lcd">{currentInput || '0'}</div>
                    <div className="keypad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'DEL', 0, 'ENTER'].map(key => (
                            <button key={key} className={`key ${key === 'ENTER' ? 'enter' : ''} ${key === 'DEL' ? 'del' : ''}`} onClick={() => {
                                if (key === 'DEL') setCurrentInput(p => p.slice(0, -1));
                                else if (key === 'ENTER') handleScoreInput(currentInput);
                                else if (currentInput.length < 3) setCurrentInput(p => p + key);
                            }}>{key}</button>
                        ))}
                    </div>
                </div>

                <div className="history-module">
                    <div className="history-header">
                        <span>SHOT LOG</span>
                        <button className="exit-btn" onClick={() => {if(window.confirm('Quit match?')) setGameStarted(false)}}>EXIT</button>
                    </div>
                    <div className="history-scroll">
                        {history.length === 0 && <div className="history-empty">No throws yet</div>}
                        {history.map((e, i) => (
                            <div key={i} className={`history-row ${e.who}`}>
                                <span className="hw">{e.who === 'player' ? 'YOU' : 'OPP'}</span>
                                <span className="hs">{e.score}{e.result === 'BUST' ? ' 💥' : ''}</span>
                                <span className="hr">{e.remaining}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        </div>

        <style>{`
            .match-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-card); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); flex-shrink: 0; }
            .player-card { flex: 1; padding: 12px 20px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); position: relative; transition: 0.3s; min-width: 0; }
            .player-card.active { border-color: var(--accent-cyan); box-shadow: 0 0 30px var(--accent-cyan-glow), inset 0 0 30px rgba(56, 189, 248, 0.05); background: rgba(56, 189, 248, 0.06); }
            .player-card.right { text-align: right; }
            .player-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
            .player-card.right .player-card-top { justify-content: flex-end; }
            .player-name { font-weight: 900; font-size: 0.85rem; color: white; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .player-badge { font-size: 0.6rem; font-weight: 800; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); white-space: nowrap; }
            .player-score { font-size: 4.5rem; font-weight: 900; line-height: 1; color: white; font-variant-numeric: tabular-nums; }
            .player-card.right .player-score { text-align: right; }
            .player-darts { display: flex; gap: 4px; margin-top: 6px; }
            .player-card.right .player-darts { justify-content: flex-end; }
            .dart-chip { background: var(--accent-cyan); color: black; font-size: 0.6rem; font-weight: 900; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); }
            .turn-arrow { position: absolute; bottom: -10px; left: 0; font-size: 0.6rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px; animation: pulse-arrow 1.5s ease-in-out infinite; }
            .turn-arrow.right { left: auto; right: 0; }
            @keyframes pulse-arrow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            .thinking-dots { animation: blink-dots 1s step-end infinite; }
            @keyframes blink-dots { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
            .thinking-label { font-size: 0.65rem; font-weight: 800; color: var(--warning); letter-spacing: 1px; margin-top: 4px; }

            .match-divider { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
            .vs-text { font-size: 0.7rem; font-weight: 900; color: var(--text-muted); letter-spacing: 2px; }

            .match-body { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; flex: 1; padding: 12px 20px 20px; min-height: 0; overflow: hidden; }

            .match-stage-wrap { border-radius: var(--border-radius-lg); overflow: hidden; background: #000; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; position: relative; }
            .cam-view { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .cam-view video { width: 100%; height: 100%; object-fit: contain; }
            .cam-hud { position: absolute; bottom: 16px; right: 16px; pointer-events: none; }
            .cam-controls { display: flex; gap: 8px; pointer-events: auto; }
            .zoom-group { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border); }
            .cam-btn { width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.08); border: none; color: white; font-weight: 900; font-size: 1.1rem; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: center; }
            .cam-btn:hover { background: rgba(255,255,255,0.15); }
            .cam-btn.flip { font-size: 1rem; }
            .zoom-val { font-size: 0.7rem; font-weight: 800; color: white; min-width: 36px; text-align: center; }
            .dart-cards-view { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 20px; }
            .dart-cards-container { display: flex; gap: 20px; align-items: center; }
            .dart-card { width: 120px; height: 150px; border-radius: 16px; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; animation: card-pop 0.4s ease-out both; }
            .dart-card.filled { border-color: rgba(255,255,255,0.15); background: rgba(15,23,42,0.9); }
            .dart-card.treble { border-color: var(--accent-cyan); box-shadow: 0 0 24px var(--accent-cyan-glow); }
            .dart-card.dbl { border-color: #22c55e; box-shadow: 0 0 24px rgba(34,197,94,0.3); }
            .dart-card.bull { border-color: #eab308; box-shadow: 0 0 24px rgba(234,179,8,0.3); }
            .dart-card.miss { border-color: var(--error); opacity: 0.5; }
            .dart-card.empty { opacity: 0.2; }
            .dart-label { font-size: 1.6rem; font-weight: 900; color: white; }
            .dart-card.treble .dart-label { color: var(--accent-cyan); }
            .dart-card.dbl .dart-label { color: #22c55e; }
            .dart-card.bull .dart-label { color: #eab308; }
            .dart-card.miss .dart-label { color: var(--error); }
            .dart-value { font-size: 2rem; font-weight: 900; color: rgba(255,255,255,0.5); }
            .dart-placeholder { font-size: 1.8rem; opacity: 0.4; }
            .dart-total { font-size: 1.6rem; font-weight: 900; color: rgba(255,255,255,0.7); letter-spacing: 2px; }
            .dart-thinking { font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 2px; animation: pulse-arrow 1.2s ease-in-out infinite; }
            @keyframes card-pop { 0% { transform: scale(0.8) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

            .match-sidebar { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
            .scoring-module { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 20px; transition: 0.3s; }
            .scoring-module.blocked { opacity: 0.25; pointer-events: none; }
            .lcd { background: rgba(0,0,0,0.5); padding: 12px; border-radius: 12px; border: 2px solid var(--accent-cyan); font-size: 3.5rem; font-weight: 900; color: var(--accent-cyan); text-align: center; text-shadow: 0 0 16px var(--accent-cyan-glow); margin-bottom: 12px; font-variant-numeric: tabular-nums; }
            .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .key { height: 58px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: white; font-weight: 800; font-size: 1.3rem; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: center; }
            .key:hover { background: rgba(255,255,255,0.08); }
            .key:active { transform: scale(0.95); }
            .key.enter { background: var(--accent-primary); border-color: var(--accent-primary); color: white; box-shadow: 0 4px 16px var(--accent-purple-glow); }
            .key.enter:hover { background: var(--accent-hover); }
            .key.del { color: var(--text-muted); }

            .history-module { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 16px 20px; min-height: 0; }
            .history-header { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 0.75rem; color: white; letter-spacing: 1px; margin-bottom: 12px; flex-shrink: 0; }
            .exit-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-muted); font-weight: 700; font-size: 0.65rem; cursor: pointer; transition: 0.15s; }
            .exit-btn:hover { background: rgba(239,68,68,0.15); border-color: var(--error); color: var(--error); }
            .history-scroll { flex: 1; overflow-y: auto; }
            .history-empty { text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 30px 0; }
            .history-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-weight: 800; font-size: 0.85rem; }
            .history-row.player .hw { color: var(--accent-cyan); }
            .history-row .hw { width: 36px; font-size: 0.7rem; flex-shrink: 0; }
            .history-row .hs { flex: 1; text-align: center; }
            .history-row .hr { width: 44px; text-align: right; color: var(--text-muted); font-size: 0.75rem; }

            @media (max-width: 1200px) {
                .match-body { grid-template-columns: 1fr; overflow-y: auto; }
                .match-stage-wrap { min-height: 350px; flex-shrink: 0; }
                .match-sidebar { height: auto; }
                .player-score { font-size: 3.2rem; }
                .dart-card { width: 100px; height: 130px; }
                .dart-label { font-size: 1.3rem; }
                .dart-value { font-size: 1.6rem; }
            }
            @media (max-width: 600px) {
                .match-header { padding: 8px 12px; gap: 8px; }
                .player-card { padding: 8px 12px; }
                .player-score { font-size: 2.4rem; }
                .player-name { font-size: 0.7rem; }
                .match-body { padding: 8px 12px 12px; }
                .dart-card { width: 80px; height: 110px; }
                .dart-label { font-size: 1.1rem; }
                .dart-value { font-size: 1.3rem; }
                .dart-cards-container { gap: 10px; }
            }
        `}</style>
    </div>
  );
}
