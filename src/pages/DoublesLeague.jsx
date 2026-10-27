import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContextInternal";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import UserSearchSelect from "../components/UserSearchSelect";
import { db, getDocs, collection, setDoc, deleteDoc, doc } from "../firebase";

export default function DoublesLeague() {
  const { user, getAllUsers, getResults, triggerDataRefresh, forceFetchResults, dataRefreshTrigger, searchUsers } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState(() => {
    try {
      const saved = localStorage.getItem('eliteArrowsDoublesTeams');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [duoForm, setDuoForm] = useState({ p1: '', p2: '', teamName: '', captainId: '' });

  useEffect(() => {
    fetchDoublesData();
  }, [dataRefreshTrigger]);

  const fetchDoublesData = async () => {
    try {
      const snap = await getDocs(collection(db, 'openLeagueDuos'));
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (fetched.length > 0) {
        setTeams(fetched);
        localStorage.setItem('eliteArrowsDoublesTeams', JSON.stringify(fetched));
      }
    } catch (e) {
      console.error("Error fetching Doubles League data:", e);
    }
  };

  const allUsers = getAllUsers();
  const results = getResults();
  const isAdmin = Boolean(user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin);
  const isSubscribed = user?.isSubscribed === true || isAdmin;

  const handleAddTeam = async () => {
    if (!duoForm.p1 || !duoForm.p2) return showToast("Select two players", "error");
    if (duoForm.p1 === duoForm.p2) return showToast("Cannot pair a player with themselves", "error");
    const duoId = [duoForm.p1, duoForm.p2].sort().join('_');

    try {
      const newDuo = {
        id: duoId,
        p1Id: duoForm.p1,
        p2Id: duoForm.p2,
        teamName: (duoForm.teamName || '').trim(),
        captainId: duoForm.captainId || duoForm.p1,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'openLeagueDuos', duoId), newDuo, { merge: true });
      const updatedTeams = [...teams.filter(t => t.id !== duoId), newDuo];
      setTeams(updatedTeams);
      localStorage.setItem('eliteArrowsDoublesTeams', JSON.stringify(updatedTeams));
      setDuoForm({ p1: '', p2: '', teamName: '', captainId: '' });
      showToast("Doubles team created and saved permanently!", "success");
      triggerDataRefresh('all');
    } catch (e) {
      showToast("Error creating team: " + e.message, "error");
    }
  };

  const handleRemoveTeam = async (id) => {
    if (!window.confirm("Delete this team pairing?")) return;
    try {
      await deleteDoc(doc(db, 'openLeagueDuos', id));
      const updatedTeams = teams.filter(t => t.id !== id);
      setTeams(updatedTeams);
      localStorage.setItem('eliteArrowsDoublesTeams', JSON.stringify(updatedTeams));
      showToast("Team removed", "info");
      triggerDataRefresh('all');
    } catch (e) {
      showToast("Error removing team: " + e.message, "error");
    }
  };

  const doublesStats = useMemo(() => {
    const stats = {};
    const ignoredTeamIds = new Set([
      'KeW6hb5yCrbq6Ln44FaQcHT6zoy2',
      'gdtszqhfYgVUm1Lln9WKoQRgTRl2',
      'D6CR85NlOWRBjOboHRyc92mTqK33',
      'jlxVub1vmDexgQL7qwtskgw4YXf2',
      'ykROW5kJOBbg93M3weLPaSeyWIC3',
      'HGdkmmfWpRX76xbunsR5ez0Vyfk1'
    ]);

    teams.forEach(t => {
      if (ignoredTeamIds.has(String(t.id)) || String(t.id).split('_').some(id => ignoredTeamIds.has(id))) return;
      const teamId = t.id;
      const p1 = allUsers.find(u => String(u.id) === String(t.p1Id));
      const p2 = allUsers.find(u => String(u.id) === String(t.p2Id));
      const captain = allUsers.find(u => String(u.id) === String(t.captainId || t.p1Id));
      const name = t.teamName || `${p1?.username || 'Player 1'} & ${p2?.username || 'Player 2'}`;

      stats[teamId] = {
        id: teamId,
        teamName: name,
        captainName: captain?.username ? `Captain: ${captain.username}` : '',
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0,
      };
    });

    const doublesResults = results.filter(r => (String(r.gameType || '').toLowerCase().includes('doubles') || r.team1Id || r.team2Id) && r.status === 'approved');

    doublesResults.forEach(r => {
      const t1Id = String(r.team1Id || r.player1Id);
      const t2Id = String(r.team2Id || r.player2Id);
      if (ignoredTeamIds.has(t1Id) || ignoredTeamIds.has(t2Id)) return;

      const s1 = Number(r.score1) || 0;
      const s2 = Number(r.score2) || 0;

      const updateTeam = (id, won, lost) => {
        if (!stats[id]) return;
        const s = stats[id];
        s.played += 1;
        s.legsWon += won;
        s.legsLost += lost;
        if (won > lost) { s.wins += 1; }
        else if (won < lost) { s.losses += 1; }
        else { s.draws += 1; }
      };

      updateTeam(t1Id, s1, s2);
      updateTeam(t2Id, s2, s1);
    });

    Object.values(stats).forEach(s => {
      s.points = s.legsWon;
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.legsWon - a.legsLost;
      const bDiff = b.legsWon - b.legsLost;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.legsWon - a.legsWon;
    });
  }, [results, teams, allUsers]);

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

  return (
    <div className="page animate-fade-in" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Doubles League" }]} />

      <div className="page-header" style={{ marginBottom: "24px", display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: "2.5rem" }}>Doubles League</h1>
          <p style={{ color: 'var(--text-muted)' }}>Format: Bo7 • Straight In, Double Out 501 • Home & Away (2x vs each team)</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdminPanel(!showAdminPanel)}>
              {showAdminPanel ? "Close Admin Panel" : "🛡️ Manage Teams & Captains"}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Syncing..." : "🔄 Sync"}
          </button>
        </div>
      </div>

      {/* RULES CARD */}
      <div className="card glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
        <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>📌 Doubles League Rules & Scoring</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>🎯 <strong>Format:</strong> Best of 7 legs • Straight In, Double Out 501</div>
          <div>🏡 <strong>Fixtures:</strong> Double round-robin (Home & Away vs every team)</div>
          <div>📊 <strong>Scoring:</strong> Every leg won = 1 league point (no bonus win points)</div>
        </div>
      </div>

      {isAdmin && showAdminPanel && (
        <div className="card glass animate-fade-in" style={{ padding: '24px', borderRadius: '20px', marginBottom: '28px', border: '1px solid var(--accent-cyan)' }}>
          <h3 className="card-title" style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>🛡️ Admin: Create Doubles Team & Assign Captain</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Player 1</label>
              <UserSearchSelect users={allUsers} selectedId={duoForm.p1} onSelect={id => setDuoForm({ ...duoForm, p1: id })} label="" onQueryChange={searchUsers} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Player 2</label>
              <UserSearchSelect users={allUsers} selectedId={duoForm.p2} onSelect={id => setDuoForm({ ...duoForm, p2: id })} label="" onQueryChange={searchUsers} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Team Name (Optional)</label>
              <input type="text" className="glass" placeholder="e.g. Bullseye Bandits" value={duoForm.teamName} onChange={e => setDuoForm({ ...duoForm, teamName: e.target.value })} style={{ width: '100%', padding: '12px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Team Captain</label>
              <select className="glass" value={duoForm.captainId} onChange={e => setDuoForm({ ...duoForm, captainId: e.target.value })} style={{ width: '100%', padding: '12px' }}>
                <option value="">Select Captain...</option>
                {duoForm.p1 && <option value={duoForm.p1}>{allUsers.find(u => u.id === duoForm.p1)?.username || 'Player 1'}</option>}
                {duoForm.p2 && duoForm.p2 !== duoForm.p1 && <option value={duoForm.p2}>{allUsers.find(u => u.id === duoForm.p2)?.username || 'Player 2'}</option>}
              </select>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleAddTeam} disabled={!duoForm.p1 || !duoForm.p2}>
            Create Doubles Team
          </button>

          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Existing Teams ({teams.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {teams.map(t => {
                const p1 = allUsers.find(u => String(u.id) === String(t.p1Id));
                const p2 = allUsers.find(u => String(u.id) === String(t.p2Id));
                const captain = allUsers.find(u => String(u.id) === String(t.captainId || t.p1Id));
                return (
                  <div key={t.id} className="glass" style={{ padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{t.teamName || `${p1?.username || 'P1'} & ${p2?.username || 'P2'}`}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>(Captain: {captain?.username || 'None'})</span>
                    </div>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleRemoveTeam(t.id)}>Delete</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)", color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>
                <th style={{ width: "40px", padding: "12px" }}>#</th>
                <th style={{ textAlign: "left", padding: "12px" }}>Team & Captain</th>
                <th style={{ width: "40px", textAlign: "center" }}>P</th>
                <th style={{ width: "40px", textAlign: "center" }}>W</th>
                <th style={{ width: "40px", textAlign: "center" }}>L</th>
                <th style={{ width: "60px", textAlign: "center" }}>+/-</th>
                <th style={{ width: "60px", textAlign: "center", color: "var(--accent-cyan)" }}>Leg Pts</th>
              </tr>
            </thead>
            <tbody>
              {doublesStats.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No doubles teams registered yet. Admins can click <strong>"Manage Teams & Captains"</strong> above to create pairings.</td></tr>
              ) : (
                doublesStats.map((row, index) => {
                  const legDiff = row.legsWon - row.legsLost;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--border)", fontSize: '0.9rem' }}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: index === 0 ? '#fbbf24' : 'inherit' }}>{index + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: 'white' }}>{row.teamName}</div>
                        {row.captainName && <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>{row.captainName}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{row.played}</td>
                      <td style={{ textAlign: 'center' }}>{row.wins}</td>
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
