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
  const [showDuoModal, setShowDuoModal] = useState(false);
  const [duoForm, setDuoModal] = useState({ p1: '', p2: '', teamName: '', captainId: '' });

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
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowDuoModal(true)}>
              👥 Manage Duos
            </button>
          )}
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
                            {isAdmin && row.isAdminDefined && (
                              <button
                                onClick={() => handleRemoveSinglesPlayer(row.entryDocId)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.5 }}
                                title="Remove Player"
                              >
                                🗑️
                              </button>
                            )}
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
                            {isAdmin && row.isAdminDefined && (
                              <button
                                onClick={() => handleRemoveDuo(row.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.5 }}
                                title="Remove Duo"
                              >
                                🗑️
                              </button>
                            )}
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

      {showDuoModal && (
        <div className="modal-overlay" onClick={() => setShowDuoModal(false)}>
          <div className="card glass" style={{ maxWidth: '1600px', width: '99%', padding: '50px', height: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-gradient" style={{ marginBottom: '15px', fontSize: '2.8rem' }}>Manage Open League Duos</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '35px' }}>Pair players together to add them to the Doubles Table immediately.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', marginBottom: '25px', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Player 1</label>
                <select
                  className="glass"
                  value={duoForm.p1}
                  onChange={e => setDuoModal({ ...duoForm, p1: e.target.value, captainId: duoForm.captainId === duoForm.p1 ? e.target.value : duoForm.captainId })}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="">Select Player</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Player 2</label>
                <select
                  className="glass"
                  value={duoForm.p2}
                  onChange={e => setDuoModal({ ...duoForm, p2: e.target.value, captainId: duoForm.captainId === duoForm.p2 ? e.target.value : duoForm.captainId })}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="">Select Player</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Team Captain</label>
                <select
                  className="glass"
                  value={duoForm.captainId}
                  onChange={e => setDuoModal({ ...duoForm, captainId: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  disabled={!duoForm.p1 && !duoForm.p2}
                >
                  <option value="">No Captain</option>
                  {duoForm.p1 && <option value={duoForm.p1}>{allUsers.find(u => u.id === duoForm.p1)?.username} (P1)</option>}
                  {duoForm.p2 && <option value={duoForm.p2}>{allUsers.find(u => u.id === duoForm.p2)?.username} (P2)</option>}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Team Name (Optional)</label>
                <input
                  type="text"
                  className="glass"
                  placeholder="e.g. The Bullseyes"
                  value={duoForm.teamName}
                  onChange={e => setDuoModal({ ...duoForm, teamName: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleAddDuo} style={{ padding: '10px 20px' }}>
                ➕ Create Duo
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
              <h4 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', letterSpacing: '0.05em' }}>Active Pairings ({duos.length})</h4>
              {duos.length === 0 ? (
                <p style={{ padding: '60px', textAlign: 'center', opacity: 0.5, background: 'rgba(255,255,255,0.02)', borderRadius: '16px', fontSize: '1.2rem' }}>No manual pairings defined yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {duos.map(d => {
                    const u1 = allUsers.find(u => u.id === d.p1Id);
                    const u2 = allUsers.find(u => u.id === d.p2Id);
                    return (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', transition: 'transform 0.2s' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {d.teamName && <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1.2rem', marginBottom: '4px' }}>{d.teamName}</span>}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: d.teamName ? '0.9rem' : '1.1rem', opacity: d.teamName ? 0.7 : 1, fontWeight: 600 }}>{u1?.username} & {u2?.username}</span>
                            {d.captainId && (
                              <span title={`Captain: ${allUsers.find(u => u.id === d.captainId)?.username}`} style={{ fontSize: '0.9rem' }}>⭐</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveDuo(d.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%', color: 'var(--error)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <button className="btn btn-secondary" style={{ minWidth: '150px' }} onClick={() => setShowDuoModal(false)}>
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
