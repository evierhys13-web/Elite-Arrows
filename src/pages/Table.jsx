import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { derivePlayerStatsFromResults } from "../utils/playerStats";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import { db, doc, setDoc } from "../firebase";

const DIVISION_COLORS = {
  Elite: "#fbbf24",
  Diamond: "#38bdf8",
  Platinum: "#818cf8",
  Gold: "#fcd34d",
  Silver: "#cbd5e1",
  Bronze: "#d97706",
  Overall: "#818cf8",
};

export default function Table() {
  const [activeDivision, setActiveDivision] = useState("Overall");
  const {
    user,
    getAllUsers,
    getFixtures,
    getResults,
    triggerDataRefresh,
    adminData,
    getSeasons,
    forceFetchResults,
    fetchResultsBySeason,
    fetchUsersByDivision,
  } = useAuth();
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState(
    adminData?.currentSeason || "Season 1",
  );
  const [loadingSeason, setLoadingSeason] = useState(true);
  const [hasInitializedSeason, setHasInitializedSeason] = useState(false);

  useEffect(() => {
    const loadSeasonData = async () => {
      setLoadingSeason(true);
      await Promise.all([
        fetchResultsBySeason(selectedSeason),
        fetchUsersByDivision(activeDivision),
      ]);
      setLoadingSeason(false);
    };
    loadSeasonData();
  }, [
    selectedSeason,
    activeDivision,
    fetchResultsBySeason,
    fetchUsersByDivision,
  ]);
  const [editingManual, setEditingManual] = useState(null);
  const [manualForm, setManualForm] = useState({
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    legsWon: 0,
    legsLost: 0,
    division: "",
  });

  const isAdmin = user?.isAdmin === true;

  const divisions = [
    "Overall",
    "Elite",
    "Diamond",
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
  ];
  const seasons = getSeasons();

  useEffect(() => {
    // Ensure selectedSeason is always valid and prioritize Season 1 if currently in May 2026
    const now = new Date();
    const isMay2026 = now.getFullYear() === 2026 && now.getMonth() === 4; // May is 4

    if (adminData?.currentSeason && !hasInitializedSeason) {
      setSelectedSeason(adminData.currentSeason);
      setHasInitializedSeason(true);
    } else if (isMay2026 && !hasInitializedSeason) {
      setSelectedSeason("Season 1");
      setHasInitializedSeason(true);
    }
  }, [adminData?.currentSeason, hasInitializedSeason]);

  const allUsers = getAllUsers();
  const fixtures = getFixtures();
  const results = getResults();

  const activeSeasonDoc = useMemo(
    () => seasons.find((s) => s.name === selectedSeason),
    [seasons, selectedSeason],
  );

  const usersWithCorrectDivisions = useMemo(() => {
    const staged = activeSeasonDoc?.stagedDivisions || {};
    const isLive = selectedSeason === (adminData?.currentSeason || "Season 1");

    return allUsers.map((u) => {
      const uid = String(u.id);
      const effectiveDiv =
        staged[uid] || staged[u.id] || (isLive ? u.division : "Unassigned");

      return {
        ...u,
        division: effectiveDiv || "Unassigned",
      };
    });
  }, [allUsers, activeSeasonDoc, selectedSeason, adminData?.currentSeason]);

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(usersWithCorrectDivisions, results, {
      fixtures,
      adminData,
      leagueOnly: true,
      currentSeason: selectedSeason,
      includePlayoffs: false,
    });
  }, [usersWithCorrectDivisions, results, fixtures, adminData, selectedSeason]);

  const playersInDivision = useMemo(() => {
    const source =
      activeDivision === "Overall"
        ? usersWithCorrectDivisions
        : usersWithCorrectDivisions.filter(
            (u) => u.division === activeDivision,
          );

    return source
      .map((p) => ({
        ...p,
        displayDivision: p.division || "Unassigned",
        stats: playerStats[String(p.id)] || {
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          legsWon: 0,
          legsLost: 0,
          points: 0,
          average: p.threeDartAverage || 0,
        },
      }))
      .filter((p) => {
        if (activeDivision !== "Overall") return true;
        const hasValidDivision =
          p.division && p.division !== "Unassigned" && p.division !== "Admin";
        return p.stats.played > 0 || hasValidDivision;
      })
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points)
          return b.stats.points - a.stats.points;
        const aLegDiff = a.stats.legsWon - a.stats.legsLost;
        const bLegDiff = b.stats.legsWon - b.stats.legsLost;
        if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff;
        if (b.stats.legsWon !== a.stats.legsWon)
          return b.stats.legsWon - a.stats.legsWon;
        return (b.stats.average || 0) - (a.stats.average || 0);
      });
  }, [activeDivision, usersWithCorrectDivisions, playerStats]);

  const handleRefresh = async () => {
    setLoadingSeason(true);
    showToast("Performing Deep Sync with server...", "info");
    try {
      // 1. Force clear result cache to eliminate 'ghost' results
      localStorage.removeItem("eliteArrowsResults");
      localStorage.removeItem("eliteArrowsFixtures");

      // 2. Fresh download
      const ok = await forceFetchResults();

      triggerDataRefresh("all");
      setRefreshKey((prev) => prev + 1);
      showToast(
        ok ? "Table data synced!" : "Sync failed — check connection",
        ok ? "success" : "warning",
      );
    } catch (e) {
      console.error("Table Sync Error:", e);
      showToast("Sync Error", "error");
    }
    setLoadingSeason(false);
  };

  const openManualEditor = (player) => {
    const ms = player.manualStats || {};
    setManualForm({
      played: ms.played ?? player.stats.played,
      wins: ms.wins ?? player.stats.wins,
      draws: ms.draws ?? player.stats.draws,
      losses: ms.losses ?? player.stats.losses,
      points: ms.points ?? player.stats.points,
      legsWon: ms.legsWon ?? player.stats.legsWon,
      legsLost: ms.legsLost ?? player.stats.legsLost,
      division: player.division || "Unassigned",
    });
    setEditingManual(player);
  };

  const saveAdminAdjustments = async () => {
    if (!editingManual) return;
    const targetId = editingManual.id;

    // 1. Handle Division Change
    const newDiv = manualForm.division;
    if (newDiv !== editingManual.division) {
      if (selectedSeason === (adminData?.currentSeason || "Season 1")) {
        // Update live division
        await setDoc(
          doc(db, "users", targetId),
          { division: newDiv },
          { merge: true },
        );
      } else {
        // Update staged division for selected season
        const seasonDoc = seasons.find((s) => s.name === selectedSeason);
        if (seasonDoc) {
          const stagedDivisions = { ...(seasonDoc.stagedDivisions || {}) };
          if (newDiv === "Unassigned") {
            delete stagedDivisions[targetId];
          } else {
            stagedDivisions[targetId] = newDiv;
          }
          await setDoc(
            doc(db, "seasons", seasonDoc.id),
            { stagedDivisions },
            { merge: true },
          );
        }
      }
    }

    // 2. Handle Manual Stats
    const defaultStats = {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      legsWon: 0,
      legsLost: 0,
    };
    const hasChanges = Object.keys(defaultStats).some((k) => {
      const v = Number(manualForm[k]) || 0;
      const existing = (editingManual.manualStats || {})[k];
      return v !== (existing ?? editingManual.stats[k]);
    });

    if (!hasChanges) {
      await setDoc(
        doc(db, "users", targetId),
        { manualStats: null },
        { merge: true },
      );
    } else {
      const payload = {};
      Object.keys(defaultStats).forEach((k) => {
        payload[k] = Number(manualForm[k]) || 0;
      });
      await setDoc(
        doc(db, "users", targetId),
        { manualStats: payload },
        { merge: true },
      );
    }

    showToast("Adjustments saved successfully", "success");
    setEditingManual(null);
    triggerDataRefresh("all");
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div
      className="page animate-fade-in"
      style={{ maxWidth: "1200px", margin: "0 auto" }}
    >
      <Breadcrumbs
        items={[
          { label: "Home", path: "/home" },
          { label: "League Table", path: "/table" },
        ]}
      />

      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              className="page-title text-gradient"
              style={{ fontSize: "2.2rem", marginBottom: "4px" }}
            >
              League Standings
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Season:
              </span>
              <select
                className="glass"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {seasons
                  .filter(
                    (s) =>
                      s.name !== "Season 1" ||
                      adminData?.currentSeason === "Season 1",
                  )
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                {!seasons.find((s) => s.name === "Season 1") &&
                  adminData?.currentSeason === "Season 1" && (
                    <option value="Season 1">Season 1</option>
                  )}
              </select>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm glass"
            onClick={handleRefresh}
            style={{ padding: "8px 12px" }}
          >
            🔄 Sync Data
          </button>
        </div>
      </div>

      <div
        className="division-tabs"
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "8px",
          marginBottom: "20px",
          paddingBottom: "8px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {divisions.map((div) => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? "active" : ""}`}
            onClick={() => setActiveDivision(div)}
            style={{
              whiteSpace: "nowrap",
              padding: "10px 16px",
              fontSize: "0.85rem",
              borderBottom:
                activeDivision === div
                  ? `3px solid ${DIVISION_COLORS[div]}`
                  : "3px solid transparent",
              color: activeDivision === div ? "white" : "rgba(255,255,255,0.6)",
              background:
                activeDivision === div
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div
        className="card glass"
        style={{ padding: "0", borderRadius: "12px", overflow: "hidden" }}
      >
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                }}
              >
                <th
                  style={{
                    width: "28px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  #
                </th>
                <th style={{ textAlign: "left", padding: "12px 4px" }}>
                  Player
                </th>
                <th
                  style={{
                    width: "22px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  P
                </th>
                <th
                  style={{
                    width: "22px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  W
                </th>
                <th
                  style={{
                    width: "22px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  D
                </th>
                <th
                  style={{
                    width: "22px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  L
                </th>
                <th
                  style={{
                    width: "30px",
                    padding: "12px 2px",
                    textAlign: "center",
                  }}
                >
                  +/-
                </th>
                <th style={{ padding: "12px 4px", textAlign: "center", width: "80px" }}>
                  Form
                </th>
                <th
                  style={{
                    width: "35px",
                    padding: "12px 2px",
                    textAlign: "center",
                    color: "var(--accent-cyan)",
                  }}
                >
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingSeason ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div
                      className="spinner"
                      style={{
                        margin: "0 auto 10px",
                        width: "30px",
                        height: "30px",
                      }}
                    ></div>
                    <span style={{ color: "var(--text-muted)" }}>
                      Loading {selectedSeason} data...
                    </span>
                  </td>
                </tr>
              ) : playersInDivision.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No data
                  </td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost;
                  const isPromotion = index < 2 && activeDivision !== "Overall";
                  const isRelegation =
                    index >= playersInDivision.length - 2 &&
                    playersInDivision.length > 4 &&
                    activeDivision !== "Overall" &&
                    activeDivision !== "Development";
                  const isMe = player.id === user?.id;

                  return (
                    <tr
                      key={player.id}
                      style={{
                        background: isMe
                          ? "rgba(217, 70, 239, 0.15)"
                          : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "800",
                          color:
                            index === 0 ? "#fbbf24" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: "10px 8px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link
                          to={`/profile/${player.id}`}
                          style={{
                            textDecoration: "none",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: isMe ? "800" : "600",
                              color: isMe ? "white" : "rgba(255,255,255,0.9)",
                            }}
                          >
                            {player.username}
                            {player.stats.average > 0 && (
                              <span
                                style={{
                                  fontWeight: 400,
                                  color: "rgba(255,255,255,0.4)",
                                  fontSize: "0.7rem",
                                  marginLeft: "6px",
                                }}
                              >
                                ({player.stats.average.toFixed(2)})
                              </span>
                            )}
                          </span>
                          {(isPromotion || isRelegation) && (
                            <span
                              style={{
                                fontSize: "0.5rem",
                                fontWeight: "900",
                                color: isPromotion ? "#10b981" : "#ef4444",
                                letterSpacing: "0.05em",
                              }}
                            >
                              {isPromotion ? "PROMOTION" : "RELEGATION"}
                            </span>
                          )}
                        </Link>
                        {isAdmin && (
                          <span
                            style={{
                              cursor: "pointer",
                              marginLeft: "6px",
                              fontSize: "0.7rem",
                              opacity: 0.6,
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => openManualEditor(player)}
                          >
                            {player.manualStats ? "✏️*" : "✏️"}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 2px" }}>
                        {player.stats.played}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.wins}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.draws}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.losses}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 2px",
                          fontWeight: "700",
                          color:
                            legDiff > 0
                              ? "#10b981"
                              : legDiff < 0
                                ? "#ef4444"
                                : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ padding: "10px 2px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "3px", justifyContent: "center" }}>
                          {(player.stats.form || []).slice(-5).map((f, i) => (
                            <div
                              key={i}
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: f === 'W' ? 'var(--success)' : f === 'L' ? 'var(--error)' : 'var(--text-muted)',
                                boxShadow: f === 'W' ? '0 0 5px var(--success)' : 'none'
                              }}
                              title={f === 'W' ? 'Win' : f === 'L' ? 'Loss' : 'Draw'}
                            />
                          ))}
                          {(!player.stats.form || player.stats.form.length === 0) && (
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 2px",
                          fontWeight: "900",
                          color: "var(--accent-cyan)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {player.stats.points}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "15px",
          flexWrap: "wrap",
          padding: "0 5px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.7rem",
            color: "var(--text-muted)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "2px",
              background: "#10b981",
            }}
          />
          <span>Automatic Promotion</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.7rem",
            color: "var(--text-muted)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "2px",
              background: "#ef4444",
            }}
          />
          <span>Relegation Zone</span>
        </div>
      </div>

      {/* Admin Adjustment Modal (stats & division) */}
      {isAdmin && editingManual && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingManual(null)}
        >
          <div
            className="card glass"
            style={{
              padding: "28px",
              maxWidth: "420px",
              width: "90%",
              border: "1px solid var(--accent-cyan)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "4px" }}>
              Admin Adjustments: {editingManual.username}
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "20px",
              }}
            >
              Updating division for:{" "}
              <strong style={{ color: "var(--accent-cyan)" }}>
                {selectedSeason}
              </strong>
            </p>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label>Division</label>
              <select
                className="glass"
                value={manualForm.division}
                onChange={(e) =>
                  setManualForm({ ...manualForm, division: e.target.value })
                }
                style={{ width: "100%", padding: "10px" }}
              >
                {divisions.map((d) => (
                  <option key={d} value={d === "Overall" ? "Unassigned" : d}>
                    {d === "Overall" ? "Unassigned" : d}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              {[
                "played",
                "wins",
                "draws",
                "losses",
                "points",
                "legsWon",
                "legsLost",
              ].map((field) => (
                <div
                  key={field}
                  className="form-group"
                  style={{ marginBottom: 0 }}
                >
                  <label>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type="number"
                    value={manualForm[field]}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={saveAdminAdjustments}
              >
                Save All Changes
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setEditingManual(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
