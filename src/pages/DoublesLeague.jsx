import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContextInternal";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import { db, getDocs, collection } from "../firebase";

export default function DoublesLeague() {
  const { user, getAllUsers, getResults, triggerDataRefresh, forceFetchResults, dataRefreshTrigger } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    fetchDoublesData();
  }, [dataRefreshTrigger]);

  const fetchDoublesData = async () => {
    try {
      const snap = await getDocs(collection(db, 'openLeagueDuos'));
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Error fetching Doubles League data:", e);
    }
  };

  const allUsers = getAllUsers();
  const results = getResults();
  const isSubscribed = user?.isSubscribed === true || user?.isAdmin;

  const doublesStats = useMemo(() => {
    const stats = {};

    teams.forEach(t => {
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
        if (!stats[id]) {
          stats[id] = {
            id,
            teamName: id,
            captainName: '',
            played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0
          };
        }
        const s = stats[id];
        s.played += 1;
        s.legsWon += won;
        s.legsLost += lost;
        if (won > lost) { s.wins += 1; s.points += 3; }
        else if (won < lost) { s.losses += 1; }
        else { s.draws += 1; s.points += 1; }
      };

      updateTeam(t1Id, s1, s2);
      updateTeam(t2Id, s2, s1);
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
          <p style={{ color: 'var(--text-muted)' }}>Official team pairings with assigned team captains and league standings</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Syncing..." : "🔄 Sync"}
          </button>
        </div>
      </div>

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
                <th style={{ width: "60px", textAlign: "center", color: "var(--accent-cyan)" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {doublesStats.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No doubles teams registered yet. Admins can create pairings and assign captains in the Admin panel (Friendly League tab).</td></tr>
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
