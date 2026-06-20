import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import { isOpenLeagueResult, isOpenLeagueDoublesResult } from "../utils/leagueResults";
import { getLeaguePoints } from "../utils/leagueScoring";
import { db, doc, setDoc, deleteDoc, getDocs, collection } from "../firebase";

const OPEN_LEAGUE_LAUNCH_DATE = new Date("2026-07-01T00:00:00");

export default function OpenLeague() {
  const [activeTab, setActiveTab] = useState("singles");
  const { user, getAllUsers, getResults, triggerDataRefresh, forceFetchResults } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const [duos, setDuos] = useState([]);
  const [singlesPlayers, setSinglesPlayers] = useState([]);

  useEffect(() => {
    fetchOpenLeagueData();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOpenLeagueData = async () => {
    try {
      const [duoSnap, singlesSnap] = await Promise.all([
        getDocs(collection(db, 'openLeagueDuos')),
        getDocs(collection(db, 'openLeagueSingles'))
      ]);
      setDuos(duoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSinglesPlayers(singlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Error fetching Open League data:", e);
    }
  };

  const handleRemoveSinglesPlayer = async (id) => {
    if (!window.confirm("Remove this player from the Open League table? Their results will still exist.")) return;
    try {
      await deleteDoc(doc(db, 'openLeagueSingles', id));
      setSinglesPlayers(singlesPlayers.filter(p => p.id !== id));
      showToast("Player removed from table", "info");
    } catch (e) {
      showToast("Error removing player", "error");
    }
  };

  const handleAddDuo = async () => {
    if (!duoForm.p1 || !duoForm.p2) return showToast("Please select two players", "error");
    if (duoForm.p1 === duoForm.p2) return showToast("Cannot pair a player with themselves", "error");

    const duoId = [duoForm.p1, duoForm.p2].sort().join('_');
    const exists = duos.find(d => d.id === duoId);
    if (exists) return showToast("This duo already exists", "warning");

    try {
      const newDuo = {
        id: duoId,
        p1Id: duoForm.p1,
        p2Id: duoForm.p2,
        teamName: duoForm.teamName.trim(),
        captainId: duoForm.captainId,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'openLeagueDuos', duoId), newDuo);
      setDuos([...duos, newDuo]);
      setDuoModal({ p1: '', p2: '', teamName: '', captainId: '' });
      showToast("Duo added to table", "success");
    } catch (e) {
      showToast("Error adding duo", "error");
    }
  };

  const handleRemoveDuo = async (id) => {
    if (!window.confirm("Remove this duo? Results will still exist but they won't show if they have no matches.")) return;
    try {
      await deleteDoc(doc(db, 'openLeagueDuos', id));
      setDuos(duos.filter(d => d.id !== id));
      showToast("Duo removed", "info");
    } catch (e) {
      showToast("Error removing duo", "error");
    }
  };

  const isLocked = now < OPEN_LEAGUE_LAUNCH_DATE;
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin;
  const timeRemaining = OPEN_LEAGUE_LAUNCH_DATE - now;

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const allUsers = getAllUsers();
  const results = getResults();

  if (isLocked && !isAdmin) {
    return (
      <div className="page animate-fade-in" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Open League</h1>
        <div className="card glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Coming Soon</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>The Open League will launch on 1st July 2026.</p>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '12px' }}>
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>
    );
  }

  const singlesStats = useMemo(() => {
    const stats = {};

    // Initialize with pre-defined singles players from admin
    singlesPlayers.forEach(p => {
      const user = allUsers.find(u => String(u.id) === String(p.userId));
      stats[p.id] = {
        id: p.userId,
        username: user?.username || "Unknown",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0,
        form: [],
        isAdminDefined: true,
        entryDocId: p.id
      };
    });

    const openResults = results.filter(r => isOpenLeagueResult(r) && r.status === 'approved');

    openResults.forEach(r => {
      const p1Id = String(r.player1Id);
      const p2Id = String(r.player2Id);
      const s1 = Number(r.score1) || 0;
      const s2 = Number(r.score2) || 0;

      const updateStats = (id, won, lost) => {
        if (!stats[id]) {
          const user = allUsers.find(u => String(u.id) === id);
          stats[id] = {
            id,
            username: user?.username || "Unknown",
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            legsWon: 0,
            legsLost: 0,
            points: 0,
            form: []
          };
        }
        const s = stats[id];
        s.played += 1;
        s.legsWon += won;
        s.legsLost += lost;
        const pts = getLeaguePoints(won, lost, { isOpenLeague: true });
        s.points += pts;
        if (won > lost) { s.wins += 1; s.form.push('W'); }
        else if (won < lost) { s.losses += 1; s.form.push('L'); }
        else { s.draws += 1; s.form.push('D'); }
      };

      updateStats(p1Id, s1, s2);
      updateStats(p2Id, s2, s1);
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.legsWon - a.legsLost;
      const bDiff = b.legsWon - b.legsLost;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.legsWon - a.legsWon;
    });
  }, [results, allUsers]);

  const doublesStats = useMemo(() => {
    const stats = {};

    // Initialize with pre-defined duos from admin
    duos.forEach(d => {
      const u1 = allUsers.find(u => String(u.id) === String(d.p1Id));
      const u2 = allUsers.find(u => String(u.id) === String(d.p2Id));
      stats[d.id] = {
        id: d.id,
        teamName: d.teamName,
        captainId: d.captainId,
        name: `${u1?.username || 'Unknown'} & ${u2?.username || 'Unknown'}`,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0,
        form: [],
        isAdminDefined: true
      };
    });

    const openResults = results.filter(r => isOpenLeagueDoublesResult(r) && r.status === 'approved');

    openResults.forEach(r => {
      const t1Ids = [String(r.player1Id), String(r.player2Id)].sort();
      const t2Ids = [String(r.player3Id), String(r.player4Id)].sort();
      const t1Key = t1Ids.join('_');
      const t2Key = t2Ids.join('_');

      const s1 = Number(r.score1) || 0;
      const s2 = Number(r.score2) || 0;

      const updateStats = (key, ids, won, lost) => {
        if (!stats[key]) {
          const u1 = allUsers.find(u => String(u.id) === ids[0]);
          const u2 = allUsers.find(u => String(u.id) === ids[1]);
          stats[key] = {
            id: key,
            name: `${u1?.username || 'Unknown'} & ${u2?.username || 'Unknown'}`,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            legsWon: 0,
            legsLost: 0,
            points: 0,
            form: []
          };
        }
        const s = stats[key];
        s.played += 1;
        s.legsWon += won;
        s.legsLost += lost;
        const pts = getLeaguePoints(won, lost, { isOpenLeague: true });
        s.points += pts;
        if (won > lost) { s.wins += 1; s.form.push('W'); }
        else if (won < lost) { s.losses += 1; s.form.push('L'); }
        else { s.draws += 1; s.form.push('D'); }
      };

      updateStats(t1Key, t1Ids, s1, s2);
      updateStats(t2Key, t2Ids, s2, s1);
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.legsWon - a.legsLost;
      const bDiff = b.legsWon - b.legsLost;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.legsWon - a.legsWon;
    });
  }, [results, allUsers, duos]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await forceFetchResults();
      triggerDataRefresh("all");
      showToast("Data synced!", "success");
    } catch (e) {
      showToast("Sync failed", "error");
    }
    setLoading(false);
  };

  if (isLocked && !isAdmin) {
    return (
      <div className="page animate-fade-in" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Open League</h1>
        <div className="card glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Coming Soon</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>The Open League will launch on 1st July 2026.</p>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '12px' }}>
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>
    );
  }

  const tableData = activeTab === "singles" ? singlesStats : doublesStats;

  return (
    <div className="page animate-fade-in" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Open League", path: "/open-league" }]} />

      <div className="page-header" style={{ marginBottom: "24px", display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: "2.5rem" }}>Open League</h1>
          <p style={{ color: 'var(--text-muted)' }}>Free for all players. Win: 3pts, Draw: 1pt, Loss: -1pt.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Syncing..." : "🔄 Sync"}
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{ marginBottom: '20px' }}>
        <button className={`division-tab ${activeTab === "singles" ? "active" : ""}`} onClick={() => setActiveTab("singles")}>
          Singles Table
        </button>
        <button className={`division-tab ${activeTab === "doubles" ? "active" : ""}`} onClick={() => setActiveTab("doubles")}>
          Doubles Table
        </button>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)", color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>
                <th style={{ width: "40px", padding: "12px" }}>#</th>
                <th style={{ textAlign: "left", padding: "12px" }}>{activeTab === "singles" ? "Player" : "Duo"}</th>
                <th style={{ width: "40px", textAlign: "center" }}>P</th>
                <th style={{ width: "40px", textAlign: "center" }}>W</th>
                <th style={{ width: "40px", textAlign: "center" }}>D</th>
                <th style={{ width: "40px", textAlign: "center" }}>L</th>
                <th style={{ width: "60px", textAlign: "center" }}>+/-</th>
                <th style={{ width: "60px", textAlign: "center", color: "var(--accent-cyan)" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results yet.</td></tr>
              ) : (
                tableData.map((row, index) => {
                  const legDiff = row.legsWon - row.legsLost;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--border)", fontSize: '0.9rem' }}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: index === 0 ? '#fbbf24' : 'inherit' }}>{index + 1}</td>
                      <td style={{ padding: '12px' }}>
                        {activeTab === "singles" ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Link to={`/profile/${row.id}`} style={{ textDecoration: 'none', color: 'white', fontWeight: 600 }}>{row.username}</Link>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {row.teamName && <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1rem' }}>{row.teamName}</span>}
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: row.teamName ? '0.75rem' : '0.9rem', opacity: row.teamName ? 0.7 : 1 }}>{row.name}</span>
                                {row.captainId && (
                                  <span title="Team Captain" style={{ fontSize: '0.7rem', cursor: 'help' }}>⭐</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{row.played}</td>
                      <td style={{ textAlign: 'center' }}>{row.wins}</td>
                      <td style={{ textAlign: 'center' }}>{row.draws}</td>
                      <td style={{ textAlign: 'center' }}>{row.losses}</td>
                      <td style={{ textAlign: 'center', color: legDiff > 0 ? 'var(--success)' : legDiff < 0 ? 'var(--error)' : 'inherit' }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--accent-cyan)' }}>{row.points}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
