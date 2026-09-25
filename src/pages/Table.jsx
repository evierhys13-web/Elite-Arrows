import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextInternal";
import { derivePlayerStatsFromResults } from "../utils/playerStats";
import { getPlayersWithEffectiveDivisions, getDivisionFilteredResults, LEAGUE_DIVISION_NAMES } from "../utils/leagueStandings";
import Breadcrumbs from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";
import { useSponsorship } from "../context/SponsorshipContext";
import { usePageBackgrounds } from "../context/BackgroundContext";
import { db, doc, setDoc } from "../firebase";

const DIVISION_COLORS = {
  Elite: "#fbbf24",
  Emerald: "#10b981",
  Diamond: "#38bdf8",
  Platinum: "#818cf8",
  Overall: "#818cf8",
};

const DIVISION_CAPTAINS = {
  Elite: "Division Captain: Admin Team",
  Emerald: "Division Captain: Admin Team",
  Diamond: "Division Captain: Admin Team",
  Platinum: "Division Captain: Admin Team",
  Overall: "League Overseer: Admin Team",
};

const DIVISION_FORMAT_LABELS = {
  Elite: "Best of 12 Legs (First to 7 / 6–6 Draw)",
  Emerald: "Best of 10 Legs (First to 6 / 5–5 Draw)",
  Diamond: "Best of 8 Legs (First to 5 / 4–4 Draw)",
  Platinum: "Best of 8 Legs (First to 5 / 4–4 Draw)",
  Overall: "Formats: Elite (BO12) • Emerald (BO10) • Diamond/Platinum (BO8)",
};

export default function Table() {
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

  const { setActiveDivision: setContextDivision } = usePageBackgrounds();
  const { configs, assets } = useSponsorship();


  const allUsers = getAllUsers();
  const fixtures = getFixtures();
  const results = getResults();

  const [activeDivision, setActiveDivision] = useState("Overall");

  const activeLeagueId = useMemo(() => {
    return Object.keys(LEAGUE_DIVISION_NAMES).find(k => LEAGUE_DIVISION_NAMES[k] === activeDivision);
  }, [activeDivision]);

  const sponsorConfig = activeLeagueId ? configs[activeLeagueId] : null;
  const sponsorAssets = activeLeagueId ? assets[activeLeagueId] : null;
  const isSponsored = sponsorConfig?.enabled;

  useEffect(() => {
    setContextDivision(activeDivision);
    return () => setContextDivision(null);
  }, [activeDivision, setContextDivision]);

  const { showToast } = useToast();

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState(adminData?.currentSeason || "Elite Arrows Season 5");
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getDivisionsForSeason = useCallback(() => {
    // For the current/live season format, use the new division structure
    const isNewStructure = selectedSeason === (adminData?.currentSeason || "Elite Arrows Season 5");
    if (isNewStructure || selectedSeason === "Season 4" || selectedSeason === "Season 5") {
      return ["Overall", "Elite", "Emerald", "Diamond", "Platinum"];
    }
    // Fallback for older seasons
    return ["Overall", "Elite", "Emerald", "Diamond", "Platinum", "Gold", "Silver", "Bronze"];
  }, [selectedSeason, adminData?.currentSeason]);

  const divisions = getDivisionsForSeason();
  const seasons = useMemo(() => getSeasons().filter(s => !s.isArchived), [getSeasons]);

  useEffect(() => {
    if (!hasInitializedSeason) {
      setSelectedSeason(adminData?.currentSeason || "Elite Arrows Season 5");
      setHasInitializedSeason(true);
    }
  }, [hasInitializedSeason]);

  const activeSeasonDoc = useMemo(
    () => seasons.find((s) => s.name === selectedSeason),
    [seasons, selectedSeason],
  );

  const usersWithCorrectDivisions = useMemo(
    () => getPlayersWithEffectiveDivisions(allUsers, activeSeasonDoc, selectedSeason, adminData),
    [allUsers, activeSeasonDoc, selectedSeason, adminData],
  );

  const divisionFilteredResults = useMemo(
    () => getDivisionFilteredResults(results, usersWithCorrectDivisions),
    [results, usersWithCorrectDivisions],
  );

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(usersWithCorrectDivisions, divisionFilteredResults, {
      fixtures,
      adminData,
      leagueOnly: true,
      currentSeason: selectedSeason,
      includePlayoffs: false,
    });
  }, [usersWithCorrectDivisions, divisionFilteredResults, fixtures, adminData, selectedSeason]);

  const playersInDivision = useMemo(() => {
    const source =
      activeDivision === "Overall"
        ? usersWithCorrectDivisions
        : usersWithCorrectDivisions.filter(
            (u) => u.division === activeDivision,
          );

    return source
      .filter(p => {
        // Specifically remove Tom Beaumont from Season 4 standings as requested
        if (selectedSeason === "Season 4" && (p.username === "Tom Beaumont" || p.name === "Tom Beaumont")) {
          return false;
        }
        return true;
      })
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

        // Show all players for Season 4 Overall who are in a division (excluding Unassigned and Admin)
        if (selectedSeason === "Season 4") {
          return p.division && p.division !== "Unassigned" && p.division !== "Admin";
        }

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
  }, [activeDivision, usersWithCorrectDivisions, playerStats, selectedSeason]);

  const archive = useMemo(() => Array.isArray(sponsorConfig?.seasonsArchive) ? sponsorConfig.seasonsArchive : [], [sponsorConfig]);
  const latestWinner = useMemo(() => archive[archive.length - 1], [archive]);
  const nameOf = useCallback((entry, id) => (entry?.names && entry.names[String(id)]) || (playersInDivision.find((p) => String(p.id) === String(id))?.username) || id, [playersInDivision]);
  const accentColor = DIVISION_COLORS[activeDivision] || '#38bdf8';


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
        ok ? "Table data synced!" : "Sync failed â€” check connection",
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
      if (selectedSeason === (adminData?.currentSeason || "Elite Arrows Season 5")) {
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

  const handleNavigate = (e, path) => {
    if (!document.startViewTransition) {
      navigate(path);
      return;
    }
    e.preventDefault();
    document.startViewTransition(() => {
      navigate(path);
    });
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

      {isSponsored && (
        <div className="card glass animate-fade-in" style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          border: `1px solid ${DIVISION_COLORS[activeDivision] || 'var(--border)'}44`,
          background: `linear-gradient(90deg, ${DIVISION_COLORS[activeDivision] || 'var(--accent-cyan)'}11, transparent)`
        }}>
          {sponsorAssets?.sponsorLogo && (
            <img src={sponsorAssets.sponsorLogo} alt="Sponsor" style={{ height: '44px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px' }} />
          )}
          <div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '2px' }}>
              Official Partner of {activeDivision} Division
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
              {sponsorConfig.namingTitle || `${sponsorConfig.sponsorName} ${activeDivision} League`}
            </div>
          </div>
          {sponsorConfig.sponsorUrl && (
            <a href={sponsorConfig.sponsorUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
              Visit Sponsor
            </a>
          )}
        </div>
      )}


      {isSponsored && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {sponsorConfig.prizes?.pots?.length > 0 && (
            <div className="card glass" style={{ borderRadius: '16px', padding: '18px', border: `1px solid ${accentColor}33` }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#fff' }}>🏆 {sponsorConfig.prizes.title || 'Prize Fund'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sponsorConfig.prizes.pots.map((pot, index) => (
                  <div key={index} style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    padding: '14px',
                    background: sponsorAssets?.prizeImages?.[String(index)]
                      ? `linear-gradient(rgba(11,5,29,0.55), rgba(11,5,29,0.75)), url(${sponsorAssets.prizeImages[String(index)]}) center/cover no-repeat`
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${accentColor}33`,
                    color: '#fff',
                  }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#cbd5e1' }}>{pot.label || `Prize ${index + 1}`}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: accentColor }}>{pot.amount || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(latestWinner || sponsorAssets?.championImage) && (
            <div className="card glass" style={{ borderRadius: '16px', padding: '18px', border: `1px solid ${accentColor}33`, position: 'relative', overflow: 'hidden' }}>
              {sponsorAssets?.championImage && (
                <img src={sponsorAssets.championImage} alt="champion" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
              )}
              <div style={{ position: 'relative', marginTop: sponsorAssets?.championImage ? 12 : 0, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem' }}>👑</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: accentColor }}>{latestWinner ? (nameOf(latestWinner, latestWinner.champUserId) || 'Champion') : (sponsorConfig.champion?.caption || `${activeDivision} Champion`)}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{latestWinner?.season || ''}</div>
                {sponsorConfig.champion?.caption && <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>{sponsorConfig.champion.caption}</div>}
              </div>
            </div>
          )}
        </div>
      )}

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
                {selectedSeason}
              </span>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm glass"
            onClick={handleRefresh}
            style={{ padding: "8px 12px" }}
          >
            Sync Data
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
              padding: "12px 26px",
              fontFamily: "'Orbitron', 'Inter', sans-serif",
              fontSize: "0.85rem",
              fontWeight: "700",
              letterSpacing: "0.15em",
              borderRadius: "999px",
              border: "2px solid",
              borderColor: activeDivision === div ? DIVISION_COLORS[div] : "rgba(255,255,255,0.12)",
              color: activeDivision === div ? "#ffffff" : "rgba(255,255,255,0.55)",
              background:
                activeDivision === div
                  ? `linear-gradient(135deg, ${DIVISION_COLORS[div]}55 0%, ${DIVISION_COLORS[div]}22 50%, rgba(168, 85, 247, 0.2) 100%)`
                  : "rgba(0, 0, 0, 0.25)",
              textTransform: "uppercase",
              textShadow: activeDivision === div ? `0 0 14px ${DIVISION_COLORS[div]}` : "none",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: activeDivision === div ? `0 0 22px ${DIVISION_COLORS[div]}88, inset 0 0 14px ${DIVISION_COLORS[div]}44` : "inset 0 0 8px rgba(0,0,0,0.3)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              cursor: "pointer",
              ['--div-color']: DIVISION_COLORS[div]
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 22px ${DIVISION_COLORS[div]}66, inset 0 0 14px ${DIVISION_COLORS[div]}33`; e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => {
              if (activeDivision !== div) { e.currentTarget.style.boxShadow = 'inset 0 0 8px rgba(0,0,0,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }
            }}
          >
            {div}
          </button>
        ))}
      </div>

      {/* Division Captain & Format Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "rgba(10, 6, 40, 0.4)",
          padding: "12px 20px",
          borderRadius: "14px",
          border: `1px solid ${DIVISION_COLORS[activeDivision] || 'rgba(168, 85, 247, 0.4)'}`,
          marginBottom: "16px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.1rem" }}>🛡️</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "white" }}>
            {DIVISION_CAPTAINS[activeDivision] || "Division Captain: Admin Team"}
          </span>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: DIVISION_COLORS[activeDivision] || "var(--accent-cyan)",
          }}
        >
          🎯 {DIVISION_FORMAT_LABELS[activeDivision] || "501 SIDO / Bull Up Every Time"}
        </div>
      </div>

      <div
        className="card glass animate-fade-in"
        style={{
          padding: "0",
          borderRadius: "16px",
          overflow: "hidden",
          background: "rgba(10, 6, 40, 0.4)",
          border: `2px solid ${DIVISION_COLORS[activeDivision] || 'rgba(168, 85, 247, 0.55)'}`,
          boxShadow: `0 20px 80px rgba(0, 0, 0, 0.6), 0 0 45px ${(DIVISION_COLORS[activeDivision] || '#a855f7')}44, 0 0 90px rgba(56, 189, 248, 0.1), inset 0 0 30px ${(DIVISION_COLORS[activeDivision] || '#a855f7')}11, inset 0 0 0 1px rgba(255,255,255,0.06)`
        }}
      >
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  color: "white",
                  fontSize: "0.62rem",
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: `2px solid ${DIVISION_COLORS[activeDivision] || 'rgba(168, 85, 247, 0.35)'}`,
                  textShadow: "0 0 8px rgba(255, 255, 255, 0.3), 0 1px 2px rgba(0, 0, 0, 0.6)"
                }}
              >

                <th
                  style={{
                    width: isMobile ? "22px" : "28px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  #
                </th>
                <th style={{ textAlign: "left", padding: isMobile ? "6px 2px" : "8px 4px" }}>
                  Player
                </th>
                <th
                  style={{
                    width: isMobile ? "16px" : "22px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  P
                </th>
                <th
                  style={{
                    width: isMobile ? "16px" : "22px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  W
                </th>
                <th
                  style={{
                    width: isMobile ? "16px" : "22px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  D
                </th>
                <th
                  style={{
                    width: isMobile ? "16px" : "22px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  L
                </th>
                <th
                  style={{
                    width: isMobile ? "24px" : "30px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                  }}
                >
                  +/-
                </th>
                {!isMobile && (
                  <th style={{ padding: "8px 4px", textAlign: "center", width: "80px" }}>
                    Form
                  </th>
                )}
                <th
                  style={{
                    width: isMobile ? "30px" : "35px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                    color: "#e879f9",
                    textShadow: "0 0 10px rgba(232, 121, 249, 0.9)",
                  }}
                >
                  Avg
                </th>
                <th
                  style={{
                    width: isMobile ? "30px" : "35px",
                    padding: isMobile ? "6px 1px" : "8px 2px",
                    textAlign: "center",
                    color: "#7dd3fc",
                    textShadow: "0 0 10px rgba(56, 189, 248, 0.9)",
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
                    colSpan={isMobile ? 9 : 10}
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
                    colSpan={isMobile ? 9 : 10}
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

                  // Updated rules for Season 4+
                  const useNewRules = selectedSeason === "Season 4" || selectedSeason === "Season 5" || selectedSeason === (adminData?.currentSeason || "Elite Arrows Season 5");

                  const isPromotion = useNewRules
                    ? (index < 3 && activeDivision !== "Overall" && activeDivision !== "Elite")
                    : (index < 2 && activeDivision !== "Overall");

                  const isRelegation = useNewRules
                    ? (index >= playersInDivision.length - 3 && playersInDivision.length > 6 && activeDivision !== "Overall" && activeDivision !== "Platinum")
                    : (index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== "Overall" && activeDivision !== "Development");

                  const isPrizeWinner = index < 2 && activeDivision !== "Overall";
                  const isMe = player.id === user?.id;

                  const handleNavigate = (e, path) => {
    if (!document.startViewTransition) {
      navigate(path);
      return;
    }
    e.preventDefault();
    document.startViewTransition(() => {
      navigate(path);
    });
  };

  return (
                    <tr
                      key={player.id}
                      style={{
                        background: isMe
                          ? "linear-gradient(90deg, rgba(217, 70, 239, 0.22) 0%, rgba(217, 70, 239, 0.08) 100%)"
                          : "transparent",
                        boxShadow: isMe ? "inset 4px 0 0 0 var(--accent-primary), inset 0 0 25px rgba(217, 70, 239, 0.15)" : "none",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        fontSize: "0.78rem",
                        transition: "background 0.2s ease"
                      }}
                    >
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "900",
                          color:
                            index === 0 ? "#fbbf24" : index === 1 ? "#c0c0c0" : index === 2 ? "#cd7f32" : "rgba(255,255,255,0.7)",
                          textShadow: index < 3 ? `0 0 12px ${["#fbbf24", "#c0c0c0", "#cd7f32"][index]}` : "none",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: isMobile ? "5px 6px" : "7px 8px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link
                          to={`/match-log?playerId=${player.id}`}
                          style={{
                            textDecoration: "none",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <span
                            className="vt-player-name"
                            style={{
                              fontWeight: isMe ? "800" : "600",
                              fontSize: isMobile ? "0.72rem" : "0.8rem",
                              color: isMe ? "white" : "rgba(255,255,255,0.95)",
                              textShadow: isMe ? "0 0 12px rgba(217, 70, 239, 0.6)" : "0 0 8px rgba(255,255,255,0.15)",
                            }}
                          >
                            {player.username}
                            {player.stats.average > 0 && (
                              <span
                                style={{
                                  fontWeight: 400,
                                  color: "rgba(255,255,255,0.4)",
                                  fontSize: "0.62rem",
                                  marginLeft: "6px",
                                }}
                              >
                                ({player.stats.average.toFixed(2)})
                              </span>
                            )}
                          </span>
                          {(isPromotion || isRelegation || isPrizeWinner) && (
                            <span
                              style={{
                                fontSize: "0.5rem",
                                fontWeight: "900",
                                color: isRelegation ? "#ef4444" : (isPrizeWinner ? "#fbbf24" : "#10b981"),
                                letterSpacing: "0.05em",
                              }}
                            >
                              {isRelegation
                                ? "RELEGATION"
                                : (isPrizeWinner
                                    ? (isPromotion ? "PRIZE + PROMOTION" : "PRIZE")
                                    : "PROMOTION")}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td style={{ textAlign: "center", padding: isMobile ? "4px 1px" : "7px 2px" }}>
                        {player.stats.played}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.wins}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.draws}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {player.stats.losses}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
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
                      {!isMobile && (
                        <td style={{ padding: "7px 2px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "3px", justifyContent: "center" }}>
                            {(player.stats.form || []).slice(-5).map((f, i) => (
                              <div
                                key={i}
                                style={{
                                  width: "7px",
                                  height: "7px",
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
                      )}
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
                          fontWeight: "800",
                          color: "#e879f9",
                          fontSize: "0.75rem",
                          textShadow: "0 0 10px rgba(232, 121, 249, 0.8)",
                        }}
                      >
                        {player.stats.average > 0 ? player.stats.average.toFixed(2) : '-'}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: isMobile ? "4px 1px" : "7px 2px",
                          fontWeight: "900",
                          color: "#7dd3fc",
                          fontSize: "0.85rem",
                          textShadow: "0 0 12px rgba(56, 189, 248, 0.8)",
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
