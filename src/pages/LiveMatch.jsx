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

  // Camera & Detection State
  const [useCamera, setUseCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [stream, setStream] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isAutoScoringActive, setIsAutoScoringActive] = useState(false);

  const [boardCalibration, setBoardCalibration] = useState(null);

  const prevFrameRef = useRef(null);
  const cleanFrameRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const stabilityCounterRef = useRef(0);
  const dartDetectedThisTurnRef = useRef(0);
  const detectionPhaseRef = useRef('idle');
  const currentInputRef = useRef('');
  const diagnosticCanvasRef = useRef(null);
  const calibrationRef = useRef(null);
  const calibratedThisSessionRef = useRef(false);
  const calibrationNeededRef = useRef(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

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

  useEffect(() => {
    calibrationRef.current = boardCalibration;
  }, [boardCalibration]);

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
    setCurrentInput('');
    currentInputRef.current = '';
    dartDetectedThisTurnRef.current = 0;
    detectionPhaseRef.current = 'idle';

    const saved = localStorage.getItem('eliteArrowsBoardCalibration');
    setBoardCalibration(saved ? JSON.parse(saved) : { centerX: 50, centerY: 50, radius: 30 });

    if (isVsBot) {
        setBot(new DartBot({ targetAverage: botLevel.avg, checkoutRate: botLevel.check / 100 }));
    }

    if (useCamera && Capacitor.isNativePlatform()) {
        Capacitor.Plugins['DartDetection']?.startDetection();
        setIsAutoScoringActive(true);
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
    currentInputRef.current = '';
    setCurrentTurnDarts([]);
    dartDetectedThisTurnRef.current = 0;
    detectionPhaseRef.current = 'idle';
  }, [processTurn]);

  const autoCalibrate = (gray, PW, PH, darkFraction = 0.30) => {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    const target = gray.length * darkFraction;
    let cumulative = 0, threshold = 0;
    for (let i = 0; i < 256; i++) { cumulative += hist[i]; if (cumulative >= target) { threshold = i; break; } }

    const isDark = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] <= threshold) isDark[i] = 1;
    }

    // Scan entire frame: flood-fill every dark region, keep the best one
    const visited = new Uint8Array(gray.length);
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < gray.length; i++) {
      if (!isDark[i] || visited[i]) continue;

      const q = [i];
      visited[i] = 1;
      let minX = PW, maxX = 0, minY = PH, maxY = 0, pixelCount = 0;
      while (q.length) {
        const p = q.shift();
        const x = p % PW, y = (p / PW) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        pixelCount++;
        if (x > 0 && !visited[p-1] && isDark[p-1]) { visited[p-1] = 1; q.push(p-1); }
        if (x < PW-1 && !visited[p+1] && isDark[p+1]) { visited[p+1] = 1; q.push(p+1); }
        if (y > 0 && !visited[p-PW] && isDark[p-PW]) { visited[p-PW] = 1; q.push(p-PW); }
        if (y < PH-1 && !visited[p+PW] && isDark[p+PW]) { visited[p+PW] = 1; q.push(p+PW); }
      }
      if (pixelCount < 200) continue;

      const cx = ((minX + maxX) / 2 / PW) * 100;
      const cy = ((minY + maxY) / 2 / PH) * 100;
      const radiusH = ((maxX - minX) / 2 / PW) * 100;
      const radiusV = ((maxY - minY) / 2 / PH) * 100;
      const radius = (radiusH + radiusV) / 2;
      if (radius < 8 || radius > 55) continue;

      const distFromCenter = Math.sqrt((cx - 50) ** 2 + (cy - 50) ** 2);
      const circularity = radiusH > 0 ? 1 - Math.abs(radiusH - radiusV) / (radiusH + radiusV) : 0;
      const score = pixelCount * circularity - distFromCenter * 2;

      if (score > bestScore) {
        bestScore = score;
        best = {
          centerX: Math.round(cx * 10) / 10,
          centerY: Math.round(cy * 10) / 10,
          radius: Math.round(radius * 10) / 10,
          radiusH: Math.round(radiusH * 10) / 10,
          radiusV: Math.round(radiusV * 10) / 10
        };
      }
    }
    return best;
  };

  const brightCalibrate = (gray, PW, PH) => {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const target = gray.length * 0.92;
    let cumulative = 0, threshold = 255;
    for (let i = 255; i >= 0; i--) { cumulative += hist[i]; if (cumulative >= target) { threshold = i; break; } }

    let sx = 0, sy = 0, count = 0;
    let minX = PW, maxX = 0, minY = PH, maxY = 0;
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < threshold) continue;
      const x = i % PW, y = (i / PW) | 0;
      sx += x; sy += y; count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (count < 100) return null;

    const cx = (sx / count / PW) * 100;
    const cy = (sy / count / PH) * 100;
    const radiusH = ((maxX - minX) / 2 / PW) * 100;
    const radiusV = ((maxY - minY) / 2 / PH) * 100;
    const radius = (radiusH + radiusV) / 2;
    if (radius < 8 || radius > 55) return null;

    return {
      centerX: Math.round(cx * 10) / 10,
      centerY: Math.round(cy * 10) / 10,
      radius: Math.round(radius * 10) / 10,
      radiusH: Math.round(radiusH * 10) / 10,
      radiusV: Math.round(radiusV * 10) / 10
    };
  };

  // Web JS Analyzer Logic — grayscale downsampled + blob detection + clean baseline
  useEffect(() => {
    if (!gameStarted || !useCamera || turn !== 'player' || Capacitor.isNativePlatform()) return;

    dartDetectedThisTurnRef.current = 0;
    currentInputRef.current = '';
    detectionPhaseRef.current = 'idle';

    const segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const PW = 320, PH = 240;
    const MOTION_THRESH = 8;
    const DART_DIFF_THRESH = 8;
    const STABILITY_FRAMES = 2;
    const FRAMES_WARMUP = 60;
    let warmup = FRAMES_WARMUP;
    let requestRef;

    const pc = document.createElement('canvas');
    pc.width = PW; pc.height = PH;
    const pctx = pc.getContext('2d');

    const gray = new Uint8Array(PW * PH);
    const prevGray = new Uint8Array(PW * PH);
    const cleanGray = new Uint8Array(PW * PH);
    const color = new Uint8Array(PW * PH * 3);
    const prevColor = new Uint8Array(PW * PH * 3);
    const cleanColor = new Uint8Array(PW * PH * 3);
    let hasPrev = false;
    let cleanValid = false;

    const toGray = (img) => {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const idx = i >> 2;
            gray[idx] = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) | 0;
            color[idx * 3] = d[i];
            color[idx * 3 + 1] = d[i+1];
            color[idx * 3 + 2] = d[i+2];
        }
    };

    const countDiff = (a, b, t) => { let n = 0; for (let i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > t) n++; } return n; };

    const drawDiagnostic = (motionPx, diffPx) => {
        const diag = diagnosticCanvasRef.current;
        if (!diag) return;
        const dctx = diag.getContext('2d');
        const id = dctx.createImageData(PW, PH);
        for (let i = 0; i < gray.length; i++) {
            const isDiff = cleanValid && Math.abs(gray[i] - cleanGray[i]) > DART_DIFF_THRESH;
            const isMotion = Math.abs(gray[i] - prevGray[i]) > 12;
            if (isDiff && isMotion) { id.data[i*4]=255; id.data[i*4+1]=255; id.data[i*4+2]=0; }  // yellow = both
            else if (isDiff) { id.data[i*4]=0; id.data[i*4+1]=255; id.data[i*4+2]=0; }            // green = dart
            else if (isMotion) { id.data[i*4]=255; id.data[i*4+1]=0; id.data[i*4+2]=0; }          // red = motion
            else { const v = gray[i]*0.35|0; id.data[i*4]=v; id.data[i*4+1]=v; id.data[i*4+2]=v; }
            id.data[i*4+3] = 255;
        }
        dctx.putImageData(id, 0, 0);
        // Draw calibration board scope ellipse
        const cal = calibrationRef.current || { centerX: 50, centerY: 50, radius: 30 };
        const cx = (cal.centerX / 100) * PW;
        const cy = (cal.centerY / 100) * PH;
        const rhPx = ((cal.radiusH || cal.radius) * 1.3 / 100) * PW;
        const rvPx = ((cal.radiusV || cal.radius) * 1.3 / 100) * PH;
        dctx.strokeStyle = 'cyan';
        dctx.lineWidth = 2;
        dctx.beginPath();
        dctx.ellipse(cx, cy, rhPx, rvPx, 0, 0, Math.PI * 2);
        dctx.stroke();
        // Draw center crosshair
        dctx.strokeStyle = 'red';
        dctx.lineWidth = 1;
        dctx.beginPath();
        dctx.moveTo(cx - 6, cy); dctx.lineTo(cx + 6, cy);
        dctx.moveTo(cx, cy - 6); dctx.lineTo(cx, cy + 6);
        dctx.stroke();
        // Draw motion/diff text
        dctx.fillStyle = 'lime';
        dctx.font = 'bold 10px monospace';
        dctx.fillText(`M:${motionPx} D:${diffPx} ${detectionPhaseRef.current}`, 2, 10);
    };

    const findBlobs = (changed) => {
        const visited = new Uint8Array(PW * PH);
        const blobs = [];
        for (const idx of changed) {
            if (visited[idx]) continue;
            const blob = [];
            const q = [idx];
            visited[idx] = 1;
            while (q.length) {
                const p = q.shift();
                blob.push(p);
                const x = p % PW, y = (p / PW) | 0;
                const isChanged = (ni) => Math.abs(gray[ni] - cleanGray[ni]) > DART_DIFF_THRESH;
                if (x > 0 && !visited[p-1] && isChanged(p-1)) { visited[p-1]=1; q.push(p-1); }
                if (x < PW-1 && !visited[p+1] && isChanged(p+1)) { visited[p+1]=1; q.push(p+1); }
                if (y > 0 && !visited[p-PW] && isChanged(p-PW)) { visited[p-PW]=1; q.push(p-PW); }
                if (y < PH-1 && !visited[p+PW] && isChanged(p+PW)) { visited[p+PW]=1; q.push(p+PW); }
            }
            if (blob.length >= 20) blobs.push(blob);
        }
        return blobs;
    };

    let lastDetectTime = 0;
    let consistentDartCount = 0, consistentDartX = 0, consistentDartY = 0;
    const detectDart = () => {
        if (!cleanValid) return null;
        if (Date.now() - lastDetectTime < 150) return null;

        const { centerX, centerY, radius, radiusH, radiusV } = calibrationRef.current || { centerX: 50, centerY: 50, radius: 30 };
        const isDefaultCal = centerX === 50 && centerY === 50 && radius === 30;
        const scopeMul = isDefaultCal ? 4 : 1.3;
        const ccx = (centerX / 100) * PW;
        const ccy = (centerY / 100) * PH;
        const scopeRad = radiusH && radiusV ? Math.max(radiusH, radiusV) : radius;
        const maxDistPx = ((scopeRad * scopeMul) / 100) * PW;
        const maxDistSq = maxDistPx * maxDistPx;

        const changed = [];
        for (let i = 0; i < gray.length; i++) {
            const x = i % PW, y = (i / PW) | 0;
            const dx = x - ccx, dy = y - ccy;
            if (dx * dx + dy * dy > maxDistSq) continue;
            const dr = Math.abs(color[i*3] - cleanColor[i*3]);
            const dg = Math.abs(color[i*3+1] - cleanColor[i*3+1]);
            const db = Math.abs(color[i*3+2] - cleanColor[i*3+2]);
            if (Math.max(dr, dg, db) > DART_DIFF_THRESH * 2) changed.push(i);
        }
        if (changed.length < 10) return null;

        const blobs = findBlobs(changed);
        if (!blobs.length) return null;

        let best = blobs.reduce((a, b) => b.length > a.length ? b : a);
        if (best.length < 15) return null;

        // Use blob centroid directly (no bottom-portion assumption — angle-invariant)
        let sumX = 0, sumY = 0;
        for (const p of best) { sumX += p % PW; sumY += (p / PW) | 0; }
        const cxPct = (sumX / best.length / PW) * 100;
        const cyPct = (sumY / best.length / PH) * 100;
        lastDetectTime = Date.now();
        return { xPct: cxPct, yPct: cyPct, changedCount: changed.length, blobSize: best.length };
    };

    const calculateWebScore = (x, y) => {
        const { centerX, centerY, radius, radiusH, radiusV } = calibrationRef.current || { centerX: 50, centerY: 50, radius: 30 };
        const rh = radiusH || radius;
        const rv = radiusV || radius;
        const dx = x - centerX;
        const dy = centerY - y;
        // Elliptical distance (1.0 = outer edge of board)
        const relDist = Math.sqrt((dx / rh) ** 2 + (dy / rv) ** 2);
        if (relDist > 1.15) return;

        let sVal = 0, sLab = "";
        if (relDist <= 0.05) { sVal = 50; sLab = "BULL"; }
        else if (relDist <= 0.12) { sVal = 25; sLab = "25"; }
        else {
            // Correct angle for elliptical squish
            const maxR = Math.max(rh, rv);
            const unskewX = dx * (maxR / rh);
            const unskewY = dy * (maxR / rv);
            let angle = Math.atan2(unskewX, unskewY) * (180 / Math.PI);
            angle += 9.0;
            if (angle < 0) angle += 360;
            const idx = Math.floor(angle / 18) % 20;
            const val = segments[idx];
            if (relDist >= 0.95 && relDist <= 1.05) { sVal = val * 2; sLab = `D${val}`; }
            else if (relDist >= 0.60 && relDist <= 0.68) { sVal = val * 3; sLab = `T${val}`; }
            else { sVal = val; sLab = val.toString(); }
        }

        cleanGray.set(gray);
        showToast(`Detected: ${sLab}`, 'success');
        setCurrentTurnDarts(prev => [...prev, sLab]);
        setCurrentInput(prev => {
            const next = (parseInt(prev || '0') + sVal);
            const result = Math.min(180, next).toString();
            currentInputRef.current = result;
            return result;
        });
        dartDetectedThisTurnRef.current++;
    };

    const analyzeFrame = () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
            requestRef = requestAnimationFrame(analyzeFrame);
            return;
        }

        pctx.drawImage(videoRef.current, 0, 0, PW, PH);
        toGray(pctx.getImageData(0, 0, PW, PH));

        // Warmup: let camera AE/AWB settle before any detection
        if (warmup > 0) {
            warmup--;
            prevGray.set(gray);
            prevColor.set(color);
            hasPrev = true;
            requestRef = requestAnimationFrame(analyzeFrame);
            return;
        }

        // Auto-calibrate on game start
        if (!calibratedThisSessionRef.current) {
            calibratedThisSessionRef.current = true;
            let calResult = autoCalibrate(gray, PW, PH, 0.25);
            if (!calResult) calResult = autoCalibrate(gray, PW, PH, 0.35);
            if (!calResult) calResult = autoCalibrate(gray, PW, PH, 0.45);
            if (!calResult) calResult = brightCalibrate(gray, PW, PH);
            if (calResult) {
                calibrationRef.current = calResult;
                localStorage.setItem('eliteArrowsBoardCalibration', JSON.stringify(calResult));
                showToast('Board auto-calibrated!', 'success');
            } else {
                showToast('Board not found. Using default — point camera at board or tap 📐.', 'warning');
            }
        }

        // Re-calibrate on user request
        if (calibrationNeededRef.current) {
            calibrationNeededRef.current = false;
            let calResult = autoCalibrate(gray, PW, PH, 0.25);
            if (!calResult) calResult = autoCalibrate(gray, PW, PH, 0.35);
            if (!calResult) calResult = autoCalibrate(gray, PW, PH, 0.45);
            if (!calResult) calResult = brightCalibrate(gray, PW, PH);
            if (calResult) {
                calibrationRef.current = calResult;
                localStorage.setItem('eliteArrowsBoardCalibration', JSON.stringify(calResult));
                showToast('Board recalibrated!', 'success');
            } else {
                showToast('Calibration failed. Ensure board is visible.', 'warning');
            }
        }

        if (hasPrev) {
            const motionPx = countDiff(gray, prevGray, 12);
            const diffPx = cleanValid ? countDiff(gray, cleanGray, DART_DIFF_THRESH) : 0;

            if (motionPx > MOTION_THRESH) {
                stabilityCounterRef.current = 0;
                if (detectionPhaseRef.current === 'idle') {
                    cleanGray.set(prevGray);
                    cleanColor.set(prevColor);
                    cleanValid = true;
                    detectionPhaseRef.current = 'dart_thrown';
                } else if (detectionPhaseRef.current === 'dart_landed') {
                    detectionPhaseRef.current = 'removing';
                }
            } else {
                stabilityCounterRef.current++;

                if (detectionPhaseRef.current === 'dart_thrown' && stabilityCounterRef.current > STABILITY_FRAMES) {
                    const pos = detectDart();
                    if (!pos) {
                        detectionPhaseRef.current = 'idle';
                        consistentDartCount = 0;
                    } else if (dartDetectedThisTurnRef.current >= 3) {
                        detectionPhaseRef.current = 'dart_landed';
                        consistentDartCount = 0;
                    } else {
                        const samePos = consistentDartCount > 0 &&
                            Math.abs(pos.xPct - consistentDartX) < 3 &&
                            Math.abs(pos.yPct - consistentDartY) < 3;
                        if (samePos) {
                            consistentDartCount++;
                        } else {
                            consistentDartCount = 1;
                            consistentDartX = pos.xPct;
                            consistentDartY = pos.yPct;
                        }
                        if (consistentDartCount >= 2) {
                            consistentDartCount = 0;
                            calculateWebScore(pos.xPct, pos.yPct);
                            detectionPhaseRef.current = 'idle';
                        }
                    }
                }

                if (detectionPhaseRef.current === 'removing' && stabilityCounterRef.current > STABILITY_FRAMES) {
                    detectionPhaseRef.current = 'idle';
                    cleanValid = false;
                    if (dartDetectedThisTurnRef.current >= 3) {
                        handleScoreInput(currentInputRef.current);
                    }
                    dartDetectedThisTurnRef.current = 0;
                    currentInputRef.current = '';
                }
            }

            if (showDiagnostic) drawDiagnostic(motionPx, diffPx);
        }

        prevGray.set(gray);
        prevColor.set(color);
        hasPrev = true;
        requestRef = requestAnimationFrame(analyzeFrame);
    };

    requestRef = requestAnimationFrame(analyzeFrame);
    return () => cancelAnimationFrame(requestRef);
  }, [gameStarted, useCamera, turn, boardCalibration, handleScoreInput, showToast, showDiagnostic]);

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
                                <small>Universal JS Detection (Web/App)</small>
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
                .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .diff-btn { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; text-align: left; }
                .diff-btn.active { border-color: var(--accent-cyan); background: rgba(0, 212, 255, 0.1); }
                .setup-footer { border-top: 1px solid var(--border); padding-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
                .checkbox-label { display: flex; align-items: center; gap: 15px; cursor: pointer; }
                .checkbox-label input { width: 28px; height: 28px; accent-color: var(--accent-cyan); }
                .confirm-start-btn { background: linear-gradient(135deg, #00d4ff 0%, #0080ff 100%); color: black; font-weight: 900; font-size: 1.4rem; padding: 22px 50px; border-radius: 20px; border: none; cursor: pointer; box-shadow: 0 10px 40px rgba(0, 212, 255, 0.4); }
                .camera-preview-area { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
                .camera-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 1px; }
                .camera-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; display: inline-block; }
                .camera-dot.active { background: #00ff88; box-shadow: 0 0 12px #00ff88; animation: pulse-dot 1.5s ease-in-out infinite; }
                .camera-dot.offline { background: #ff8800; box-shadow: 0 0 12px #ff8800; animation: pulse-dot 1s ease-in-out infinite; }
                .camera-mini-preview { border-radius: 12px; overflow: hidden; border: 2px solid var(--accent-cyan); background: #000; max-height: 160px; }
                .camera-mini-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
                .status-top-left { position: absolute; top: 15px; left: 15px; z-index: 10; }
                .status-badge { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: 8px 16px; border-radius: 30px; border: 1px solid var(--border); font-weight: 900; font-size: 0.7rem; color: white; }
                .status-badge.active { border-color: var(--accent-cyan); }
                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                @media (max-width: 900px) { .setup-grid { grid-template-columns: 1fr; gap: 30px; } .setup-footer { flex-direction: column; align-items: stretch; } }
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
                    <span className="name">{isVsBot ? `BOT (${botLevel.name})` : (selectedFriend?.username || 'OPPONENT')}</span>
                    <span className="legs">LEGS: {opponentLegs}</span>
                </div>
                <div className="score-val">{isBotThinking ? '...' : opponentScore}</div>
            </div>
        </div>

        {showDiagnostic && (
            <div className="diagnostic-bar">
                <canvas ref={diagnosticCanvasRef} width="320" height="240" className="diag-canvas" />
                <div className="diag-info">
                    <span>Phase: <strong id="diag-phase">{detectionPhaseRef.current}</strong></span>
                    <span>Darts: <strong>{dartDetectedThisTurnRef.current}/3</strong></span>
                    <span className="diag-hint">Green=dart Red=motion Yellow=both</span>
                </div>
            </div>
        )}
        <div className="match-workspace">
            <div className="match-stage card glass">
                {turn === 'player' && useCamera ? (
                    <div className="live-cam-container">
                        <video ref={videoRef} autoPlay playsInline muted style={{ transform: `scale(${zoomLevel})` }} />
                        <div className="stage-overlay">
                             <div className="status-top-left">
                                <div className="status-badge active">
                                    <span className="camera-dot active" />
                                    AUTO-SCORING ACTIVE
                                </div>
                             </div>
                             <div className="hud-controls">
                                <div className="zoom-ctrl">
                                    <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.min(5, p + 0.5))}} className="hud-btn">+</button>
                            <span className="zoom-val">{Math.round(zoomLevel*100)}%</span>
                                     <button onClick={(e) => {e.stopPropagation(); setZoomLevel(p => Math.max(1, p - 0.5))}} className="hud-btn">-</button>
                                 </div>
                                  <button onClick={(e) => {e.stopPropagation(); flipCamera()}} className="hud-btn flip">🔄</button>
                                  <button onClick={(e) => {e.stopPropagation(); calibrationNeededRef.current = true; showToast('Recalibrating...', 'info')}} className="hud-btn">📐</button>
                                  <button onClick={(e) => {e.stopPropagation(); setShowDiagnostic(p => !p)}} className="hud-btn" style={{opacity: showDiagnostic ? 1 : 0.5}}>🔍</button>
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
            .status-badge { align-self: flex-start; display: flex; align-items: center; gap: 8px; background: rgba(0, 212, 255, 0.2); backdrop-filter: blur(10px); padding: 8px 16px; border-radius: 30px; border: 1px solid var(--accent-cyan); font-weight: 900; font-size: 0.75rem; color: white; }
            .camera-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; display: inline-block; }
            .camera-dot.active { background: #00ff88; box-shadow: 0 0 12px #00ff88; animation: pulse-dot 1.5s ease-in-out infinite; }
            @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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

            .diagnostic-bar { display: flex; align-items: center; gap: 15px; padding: 8px 15px; background: rgba(0,0,0,0.85); border-radius: 12px; margin-bottom: 6px; border: 1px solid #333; }
            .diag-canvas { width: 213px; height: 160px; border-radius: 6px; border: 1px solid #555; image-rendering: pixelated; flex-shrink: 0; }
            .diag-info { display: flex; flex-direction: column; gap: 4px; font-size: 0.7rem; color: #aaa; }
            .diag-info strong { color: white; }
            .diag-hint { font-size: 0.6rem; color: #666; margin-top: 4px; }

            @media (max-width: 1200px) {
                .match-workspace { grid-template-columns: 1fr; overflow-y: auto; }
                .match-stage { height: 450px; flex: none; }
                .match-controls { height: auto; }
            }
        `}</style>
    </div>
  );
}
