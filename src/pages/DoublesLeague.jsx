import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContextInternal";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import UserSearchSelect from "../components/UserSearchSelect";
import { db, getDocs, collection, setDoc, deleteDoc, doc } from "../firebase";

const DOUBLES_LEAGUE_DEADLINE = new Date("2026-10-30T00:00:00");

export default function DoublesLeague() {
  const { user, getAllUsers, getResults, triggerDataRefresh, forceFetchResults, dataRefreshTrigger, searchUsers } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'schedule'
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeRemaining = DOUBLES_LEAGUE_DEADLINE - now;

  const formatCountdown = (ms) => {
    if (ms <= 0) return '🚀 Season Live!';
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };
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

    teams.forEach(t => {
      if (!t || !t.id) return;
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

  const generatedSchedule = useMemo(() => {
    if (!teams || teams.length < 2) return [];
    const schedule = [];

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];

        const p1A = allUsers.find(u => String(u.id) === String(teamA.p1Id));
        const p2A = allUsers.find(u => String(u.id) === String(teamA.p2Id));
        const nameA = teamA.teamName || `${p1A?.username || 'P1'} & ${p2A?.username || 'P2'}`;

        const p1B = allUsers.find(u => String(u.id) === String(teamB.p1Id));
        const p2B = allUsers.find(u => String(u.id) === String(teamB.p2Id));
        const nameB = teamB.teamName || `${p1B?.username || 'P1'} & ${p2B?.username || 'P2'}`;

        // Match 1: Team A (Home) vs Team B (Away)
        const homeMatch = results.find(r =>
          (String(r.gameType || '').toLowerCase().includes('doubles') || r.team1Id || r.team2Id) &&
          r.status === 'approved' &&
          String(r.team1Id || r.player1Id) === String(teamA.id) &&
          String(r.team2Id || r.player2Id) === String(teamB.id)
        );

        // Match 2: Team B (Home) vs Team A (Away)
        const awayMatch = results.find(r =>
          (String(r.gameType || '').toLowerCase().includes('doubles') || r.team1Id || r.team2Id) &&
          r.status === 'approved' &&
          String(r.team1Id || r.player1Id) === String(teamB.id) &&
          String(r.team2Id || r.player2Id) === String(teamA.id)
        );

        schedule.push({
          id: `doubles_${teamA.id}_${teamB.id}_home`,
          homeTeam: teamA,
          homeName: nameA,
          awayTeam: teamB,
          awayName: nameB,
          playedMatch: homeMatch,
          isPlayed: Boolean(homeMatch),
          score: homeMatch ? `${homeMatch.score1} - ${homeMatch.score2}` : null
        });

        schedule.push({
          id: `doubles_${teamB.id}_${teamA.id}_away`,
          homeTeam: teamB,
          homeName: nameB,
          awayTeam: teamA,
          awayName: nameA,
          playedMatch: awayMatch,
          isPlayed: Boolean(awayMatch),
          score: awayMatch ? `${awayMatch.score1} - ${awayMatch.score2}` : null
        });
      }
    }
    return schedule;
  }, [teams, results, allUsers]);

  const myTeam = useMemo(() => {
    if (!user) return null;
    return teams.find(t => String(t.p1Id) === String(user.id) || String(t.p2Id) === String(user.id));
  }, [teams, user]);

  const myTeamFixtures = useMemo(() => {
    if (!myTeam) return [];
    return generatedSchedule.filter(f => String(f.homeTeam.id) === String(myTeam.id) || String(f.awayTeam.id) === String(myTeam.id));
  }, [generatedSchedule, myTeam]);

  const selectedTeamMatches = useMemo(() => {
    if (!selectedTeam) return [];
    return results.filter(r =>
      (String(r.gameType || '').toLowerCase().includes('doubles') || r.team1Id || r.team2Id) &&
      r.status === 'approved' &&
      (String(r.team1Id || r.player1Id) === String(selectedTeam.id) || String(r.team2Id || r.player2Id) === String(selectedTeam.id))
    ).sort((a, b) => new Date(b.date || b.submittedAt || 0) - new Date(a.date || a.submittedAt || 0));
  }, [selectedTeam, results]);

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

      {/* COUNTDOWN TIMER CARD */}
      <div className="card glass" style={{ padding: '20px 24px', borderRadius: '18px', marginBottom: '24px', border: '1px solid var(--accent-cyan)', background: 'rgba(56, 189, 248, 0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
          ⏳ Doubles League Registration & Launch Deadline — 00:00 Friday 30th October 2026
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white', letterSpacing: '2px', fontFamily: 'monospace' }}>
          {formatCountdown(timeRemaining)}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', margin: 0 }}>
          Ensure team pairings and captains are created and saved before the deadline!
        </p>
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

      {/* TABS */}
      <div className="division-tabs" style={{ marginBottom: '24px' }}>
        <button
          className={`division-tab ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          🏆 League Standings
        </button>
        <button
          className={`division-tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          🗓️ Schedule & Fixtures ({generatedSchedule.length})
        </button>
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

      {/* TAB: STANDINGS */}
      {activeTab === 'table' && (
        <div className="card glass" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse" }}>
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
                    const isGold = index === 0;
                    const isSilver = index === 1;
                    const isBronze = index === 2;

                    const rowBg = isGold
                      ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.03) 100%)'
                      : isSilver
                      ? 'linear-gradient(90deg, rgba(226, 232, 240, 0.16) 0%, rgba(226, 232, 240, 0.02) 100%)'
                      : isBronze
                      ? 'linear-gradient(90deg, rgba(217, 119, 6, 0.16) 0%, rgba(217, 119, 6, 0.02) 100%)'
                      : 'transparent';

                    const borderLeftColor = isGold ? '#fbbf24' : isSilver ? '#e2e8f0' : isBronze ? '#d97706' : 'transparent';
                    const medalBadge = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : null;

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          background: rowBg,
                          borderLeft: `5px solid ${borderLeftColor}`
                        }}
                        className="table-row-hover"
                        onClick={() => setSelectedTeam(row)}
                      >
                        <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: isGold ? '#fbbf24' : isSilver ? '#e2e8f0' : isBronze ? '#f59e0b' : 'inherit' }}>
                          {medalBadge ? `${medalBadge} ${index + 1}` : index + 1}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 800, color: isGold ? '#fbbf24' : isSilver ? '#e2e8f0' : isBronze ? '#f59e0b' : 'var(--accent-cyan)' }}>
                            {row.teamName} 🔍
                          </div>
                          {row.captainName && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.captainName}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.played}</td>
                        <td style={{ textAlign: 'center' }}>{row.wins}</td>
                        <td style={{ textAlign: 'center' }}>{row.losses}</td>
                        <td style={{ textAlign: 'center', color: legDiff > 0 ? 'var(--success)' : legDiff < 0 ? 'var(--error)' : 'inherit' }}>
                          {legDiff > 0 ? `+${legDiff}` : legDiff}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 900, color: isGold ? '#fbbf24' : 'var(--accent-cyan)' }}>{row.points}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* VERTICAL FIXTURE SCHEDULE LIST AT VERY BOTTOM */}
          <div style={{ marginTop: '32px', padding: '24px', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '12px', fontSize: '1.3rem' }}>
              🗓️ Doubles League Fixtures & Schedule (Home & Away)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Every team plays every opponent 2x (1x Home, 1x Away). Formats: Bo7 Straight In, Double Out 501.
            </p>

            {generatedSchedule.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No fixtures scheduled yet. Need at least 2 registered teams.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {generatedSchedule.map((f, idx) => (
                  <div
                    key={f.id}
                    className="glass"
                    style={{
                      padding: '16px 20px',
                      borderRadius: '14px',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      background: f.isPlayed ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.02)',
                      border: f.isPlayed ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 700, minWidth: '30px' }}>#{idx + 1}</span>
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>🏠 {f.homeName}</span>
                        <span style={{ opacity: 0.6, fontSize: '0.8rem', margin: '0 8px' }}>(Home) vs</span>
                        <span style={{ fontWeight: 800, color: 'white' }}>✈️ {f.awayName}</span>
                        <span style={{ opacity: 0.6, fontSize: '0.8rem', marginLeft: '6px' }}>(Away)</span>
                      </div>
                    </div>

                    <div>
                      {f.isPlayed ? (
                        <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--success)', padding: '6px 12px', borderRadius: '8px', fontWeight: 900, fontSize: '0.9rem' }}>
                          {f.score} (Completed)
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
                          Bo7 501 • Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SCHEDULE & FIXTURES */}
      {activeTab === 'schedule' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${scheduleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScheduleFilter('all')}>All Fixtures ({generatedSchedule.length})</button>
            {myTeam && (
              <button className={`btn btn-sm ${scheduleFilter === 'my' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScheduleFilter('my')}>⭐ My Team ({myTeamFixtures.length})</button>
            )}
            <button className={`btn btn-sm ${scheduleFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScheduleFilter('pending')}>⏳ Pending ({generatedSchedule.filter(s => !s.isPlayed).length})</button>
            <button className={`btn btn-sm ${scheduleFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScheduleFilter('completed')}>✅ Completed ({generatedSchedule.filter(s => s.isPlayed).length})</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {generatedSchedule.length === 0 ? (
              <div className="card glass" style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                No fixtures generated. At least 2 teams are required.
              </div>
            ) : (
              generatedSchedule
                .filter(s => scheduleFilter === 'my' ? (myTeam && (String(s.homeTeam.id) === String(myTeam.id) || String(s.awayTeam.id) === String(myTeam.id))) : scheduleFilter === 'pending' ? !s.isPlayed : scheduleFilter === 'completed' ? s.isPlayed : true)
                .map(f => (
                  <div key={f.id} className="card glass" style={{ padding: '20px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-cyan)' }}>🏠 {f.homeName}</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>(Home)</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>vs</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                        <span>✈️ {f.awayName}</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>(Away)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {f.isPlayed ? (
                        <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--success)' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--success)' }}>{f.score}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px' }}>Completed</div>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.3)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fbbf24' }}>Bo7 • 501</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Pending</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* TEAM PROFILE MODAL */}
      {selectedTeam && (
        <div className="modal-overlay" onClick={() => setSelectedTeam(null)} style={{ padding: '20px', zIndex: 99999 }}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '95vw', padding: '32px', borderRadius: '24px', border: '1px solid var(--accent-cyan)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.8rem' }}>👥 {selectedTeam.teamName}</h2>
                {selectedTeam.captainName && <p style={{ color: 'var(--accent-cyan)', margin: '4px 0 0', fontWeight: 700, fontSize: '0.9rem' }}>{selectedTeam.captainName}</p>}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTeam(null)} style={{ fontSize: '1.2rem', padding: '4px 12px' }}>×</button>
            </div>

            {/* Team Members */}
            {(() => {
              const teamDoc = teams.find(t => String(t.id) === String(selectedTeam.id));
              const p1 = allUsers.find(u => String(u.id) === String(teamDoc?.p1Id));
              const p2 = allUsers.find(u => String(u.id) === String(teamDoc?.p2Id));
              return (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  {p1 && (
                    <Link to={`/profile/${p1.id}`} className="glass" style={{ flex: 1, minWidth: '200px', padding: '14px', borderRadius: '14px', textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '1.8rem' }}>👤</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p1.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{p1.division || 'Player'}</div>
                      </div>
                    </Link>
                  )}
                  {p2 && (
                    <Link to={`/profile/${p2.id}`} className="glass" style={{ flex: 1, minWidth: '200px', padding: '14px', borderRadius: '14px', textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '1.8rem' }}>👤</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p2.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{p2.division || 'Player'}</div>
                      </div>
                    </Link>
                  )}
                </div>
              );
            })()}

            {/* Team Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '28px' }}>
              <div className="glass" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Played</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{selectedTeam.played}</div>
              </div>
              <div className="glass" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--success)' }}>{selectedTeam.wins}</div>
              </div>
              <div className="glass" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Losses</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--error)' }}>{selectedTeam.losses}</div>
              </div>
              <div className="glass" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>+/- Diff</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                  {selectedTeam.legsWon - selectedTeam.legsLost > 0 ? `+${selectedTeam.legsWon - selectedTeam.legsLost}` : selectedTeam.legsWon - selectedTeam.legsLost}
                </div>
              </div>
              <div className="glass" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Pts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>{selectedTeam.points}</div>
              </div>
            </div>

            {/* Team Match History */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--accent-cyan)' }}>🎯 Team Match History ({selectedTeamMatches.length})</h3>
            {selectedTeamMatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No approved doubles matches recorded for this team yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedTeamMatches.map(m => {
                  const isTeam1 = String(m.team1Id || m.player1Id) === String(selectedTeam.id);
                  const yourScore = isTeam1 ? m.score1 : m.score2;
                  const oppScore = isTeam1 ? m.score2 : m.score1;
                  const oppTeamId = isTeam1 ? (m.team2Id || m.player2Id) : (m.team1Id || m.player1Id);
                  const oppTeamDoc = teams.find(t => String(t.id) === String(oppTeamId));
                  const oppP1 = oppTeamDoc ? allUsers.find(u => String(u.id) === String(oppTeamDoc.p1Id)) : null;
                  const oppP2 = oppTeamDoc ? allUsers.find(u => String(u.id) === String(oppTeamDoc.p2Id)) : null;
                  const oppName = oppTeamDoc?.teamName || (oppP1 && oppP2 ? `${oppP1.username} & ${oppP2.username}` : (m.player2 || 'Opponent Team'));
                  const won = yourScore > oppScore;

                  return (
                    <div key={m.id} className="glass" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>vs {oppName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.date || 'Recent Match'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{yourScore} - {oppScore}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '6px', background: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: won ? 'var(--success)' : 'var(--error)' }}>
                          {won ? 'WIN' : 'LOSS'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
