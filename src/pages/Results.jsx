import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { getMatchApprover } from '../context/AuthHelpers'
import { db, setDoc, getDocs, doc, collection, addDoc } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import { derivePlayerStatsFromResults, getPersistedPlayerStats } from '../utils/playerStats'
import { normalizeDivisionName } from '../utils/leagueStandings'
import { useToast } from '../context/ToastContext'
import { SkeletonList } from '../components/Skeleton'
import PullToRefresh from '../components/PullToRefresh'

export default function Results() {
  const { user, getAllUsers, getResults, triggerDataRefresh, notifyAdmins, loading, fetchMoreResults, getSeasons, adminData, getAuditLogs } = useAuth()

  const allResults = getResults() || []

  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('approved')
  const [fetchingMore, setFetchingMore] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [expandedProofs, setExpandedProofs] = useState({})

  const toggleProof = (id) => {
    setExpandedProofs(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getApproverName = (result) => {
    return getMatchApprover(result, getAllUsers() || [], getAuditLogs());
  }
  const [typeFilter, setTypeFilter] = useState('all')
  const [divisionFilter, setDivisionFilter] = useState('all')

  useEffect(() => {
    const loadInitial = async () => {
      setFetchingMore(true)
      await fetchMoreResults()
      setFetchingMore(false)
    }
    loadInitial()
  }, [fetchMoreResults])
  
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isSubscribed = user?.isSubscribed === true || isAdmin

  // Only show results from the current season onwards. Anything dated before the
  // season start belongs to a previous season and stays in the Admin archive.
  const resultsCutoff = useMemo(() => {
    const current = String(adminData?.currentSeason || '').trim()
    const seasons = typeof getSeasons === 'function' ? getSeasons() : []
    const match = (seasons || []).find(s => String(s.name || '').trim() === current && s.startDate)
    const start = match?.startDate || '2026-10-01T00:00:00'
    const parsed = new Date(start)
    return Number.isNaN(parsed.getTime()) ? new Date('2026-10-01T00:00:00') : parsed
  }, [adminData?.currentSeason, getSeasons])

  const isSinglesLeagueResult = (r) => {
    const gt = String(r.gameType || 'League').toLowerCase()
    return gt === 'league' || gt === 'singles league' || gt === 'super league'
  }
  const isDoublesLeagueResult = (r) => {
    const gt = String(r.gameType || '').toLowerCase()
    return gt.includes('doubles') || Boolean(r.team1Id) || Boolean(r.team2Id)
  }
  const isCupResult = (r) => r.gameType === 'Cup' || Boolean(r.cupId)
  const isPlayoffResult = (r) => {
    const gt = String(r.gameType || '').toLowerCase()
    return gt.includes('playoff')
  }
  const isFriendlyLeagueResult = (r) => {
    const gt = String(r.gameType || '').toLowerCase()
    return gt.includes('friendly league')
  }

  // Only December 2026 results get the festive card design. Older results are
  // still shown, but keep the standard card styling they had before the season.
  const isFestiveResult = (r) => {
    const resDate = new Date(r.date || r.submittedAt || 0)
    if (Number.isNaN(resDate.getTime())) {
      const seasonLabel = String(r.season || '').toLowerCase()
      return seasonLabel.includes('season 8') || seasonLabel.includes('festive')
    }
    return resDate >= new Date('2026-12-01T00:00:00') && resDate <= new Date('2026-12-31T23:59:59')
  }

  const filteredResults = allResults.filter(r => {
    const resultDate = new Date(r.date || r.submittedAt || 0)
    const isStandalone = isDoublesLeagueResult(r) || isFriendlyLeagueResult(r) || isCupResult(r) || isPlayoffResult(r)
    if (!isStandalone && !Number.isNaN(resultDate.getTime()) && resultDate < resultsCutoff) return false

    if (typeFilter !== 'all') {
      if (typeFilter === 'league' && !isSinglesLeagueResult(r)) return false
      if (typeFilter === 'doubles' && !isDoublesLeagueResult(r)) return false
      if (typeFilter === 'cup' && !isCupResult(r)) return false
      if (typeFilter === 'open' && !isFriendlyLeagueResult(r)) return false
    }
    // Cups / Doubles / Playoffs aren't tied to a singles division, so a division filter must not hide them.
    if (divisionFilter !== 'all' && !isCupResult(r) && !isDoublesLeagueResult(r) && !isPlayoffResult(r)) {
      if (normalizeDivisionName(r.division) !== divisionFilter) return false
    }
    return true
  })

  const approvedResults = filteredResults.filter(r => String(r.status).toLowerCase() === 'approved').sort((a, b) => new Date(b.date || b.submittedAt) - new Date(a.date || a.submittedAt))
  const pendingResults = filteredResults.filter(r => String(r.status).toLowerCase() === 'pending').sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))

  const handleApprove = async (resultId) => {
    if (!confirm('Approve this match result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) return
      const targetId = res.firestoreId || String(resultId)
      const updated = { ...res, status: 'approved', approvedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', targetId), updated, { merge: true })
      triggerDataRefresh('results')
      showToast('Result Approved', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleReject = async (resultId) => {
    if (!confirm('Reject this match result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) return
      const targetId = res.firestoreId || String(resultId)
      const updated = { ...res, status: 'rejected', updatedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', targetId), updated, { merge: true })
      triggerDataRefresh('results')
      showToast('Result Rejected', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDispute = async (result) => {
    const reason = prompt("Please enter the reason for your dispute (e.g. 'Wrong score', 'I didn't play this'):")
    if (!reason) return

    try {
      await addDoc(collection(db, 'disputes'), {
        resultId: result.id,
        reporterId: user.id,
        reporterName: user.username,
        reason,
        status: 'open',
        timestamp: new Date().toISOString()
      })

      await notifyAdmins('Result Disputed', `${user.username} disputed a result: "${reason}"`, {
        type: 'dispute',
        resultId: result.id
      })

      showToast('Dispute submitted to admins.', 'success')
    } catch (e) { showToast('Dispute failed: ' + e.message, 'error') }
  }

  const renderResultCard = (result, isPending = false) => {
    const isWinner1 = result.score1 > result.score2
    const isWinner2 = result.score2 > result.score1
    const isMe = result.player1Id === user?.id || result.player2Id === user?.id
    const festive = isFestiveResult(result)

    return (
      <div key={result.id} className="card glass animate-fade-in" style={{
        padding: festive ? '0' : '20px',
        marginBottom: festive ? '20px' : '16px',
        ...(festive ? {
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(135deg, rgba(26, 11, 11, 0.95), rgba(11, 41, 28, 0.95), rgba(26, 11, 11, 0.95))',
          border: '5px solid',
          borderImage: 'linear-gradient(90deg, #ef4444, #34d399, #fbbf24, #38bdf8, #ec4899, #ef4444) 1',
          animation: 'tinselShimmer 3s ease-in-out infinite',
          boxShadow: '0 20px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(239, 68, 68, 0.6), 0 0 90px rgba(16, 185, 129, 0.5), inset 0 0 40px rgba(251, 191, 36, 0.35)'
        } : {
          background: isMe ? 'rgba(124, 92, 252, 0.05)' : 'var(--bg-card)',
          border: isMe ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)'
        })
      }}>
        {/* Snowfall Effect */}
        {festive && (
          <>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
              {['❄', '❅', '❆', '❄', '❅', '❆', '❄', '❅'].map((flake, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: '-20px',
                  left: `${(i * 12.5) + 4}%`,
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: `${Math.random() * 10 + 10}px`,
                  animation: `snowFall ${Math.random() * 3 + 4}s linear infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}>
                  {flake}
                </div>
              ))}
            </div>

            {/* Realistic Glowing Christmas Lights across top of card */}
            <div style={{ position: 'relative', background: 'rgba(5, 10, 8, 0.85)', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden', zIndex: 11 }}>
              <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, padding: '0 6px' }}>
                {['#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#ec4899', '#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#ec4899'].map((color, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '2px', height: '4px', background: 'rgba(255,255,255,0.4)' }} />
                    <div style={{
                      width: '10px',
                      height: '14px',
                      borderRadius: '50% 50% 45% 45%',
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${color}, 0 0 12px ${color}`,
                      animation: `twinkleBulb 1.2s ease-in-out infinite`,
                      animationDelay: `${idx * 0.12}s`
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Snow Accumulation Drifts */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '14px', background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 12 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '14px', background: 'linear-gradient(0deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 12 }} />

            {/* Christmas Watermark */}
            <div style={{ position: 'absolute', right: '15px', bottom: '20px', fontSize: '6rem', opacity: 0.04, pointerEvents: 'none', userSelect: 'none', zIndex: 2 }}>🎄</div>
          </>
        )}

        <div style={festive ? { padding: '20px 24px', position: 'relative', zIndex: 3 } : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {result.gameType}{!isCupResult(result) && !isDoublesLeagueResult(result) && ` • ${result.division || 'Unassigned'}`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {result.date ? new Date(result.date).toLocaleDateString() : 'Unknown date'}
            </div>
          </div>

          {result.sets1 !== undefined && result.sets2 !== undefined && isCupResult(result) && (
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '12px' }}>
              Sets: {result.sets1} - {result.sets2}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: isWinner1 ? 'white' : 'var(--text-muted)' }}>{result.player1}</div>
              {isWinner1 && <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 900 }}>WINNER</div>}
            </div>
            <div style={{
              background: festive ? 'rgba(0,0,0,0.4)' : 'var(--bg-primary)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '1.5rem',
              fontWeight: 900,
              display: 'flex',
              gap: '12px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
              ...(festive ? { border: '1px solid rgba(255,255,255,0.08)' } : {})
            }}>
              <span style={{ color: isWinner1 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{result.score1}</span>
              <span style={{ color: 'var(--border)' }}>-</span>
              <span style={{ color: isWinner2 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{result.score2}</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: isWinner2 ? 'white' : 'var(--text-muted)' }}>{result.player2}</div>
              {isWinner2 && <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 900 }}>WINNER</div>}
            </div>
          </div>

          {result.forfeit && (
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: '#fbbf24', fontWeight: 900 }}>
              🏳️ FORFEIT WIN — Max Draw Points (Elite 7, Emerald 6, Diamond 5, Platinum 5), No Legs Played
            </div>
          )}

          {(result.player1Stats || result.player2Stats) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              paddingTop: '15px',
              borderTop: `1px solid ${festive ? 'rgba(255,255,255,0.1)' : 'var(--border)'}`,
              fontSize: '0.8rem'
            }}>
              <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                {result.player1Stats?.['180s'] > 0 && <span style={{ color: '#fbbf24', marginRight: '8px' }}>★ {result.player1Stats['180s']}x180</span>}
                HC: <span style={{ color: 'white' }}>{result.player1Stats?.highestCheckout || 0}</span>
              </div>
              <div style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                HC: <span style={{ color: 'white' }}>{result.player2Stats?.highestCheckout || 0}</span>
                {result.player2Stats?.['180s'] > 0 && <span style={{ color: '#fbbf24', marginLeft: '8px' }}>{result.player2Stats['180s']}x180 ★</span>}
              </div>
            </div>
          )}

          {/* Proof of Result */}
          {(result.proofImage || result.proofVideo || result.hasProofImage) && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Verification Proof:
                </p>
                {result.proofImage && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.65rem', padding: '4px 10px', height: 'auto' }}
                    onClick={() => toggleProof(result.id)}
                  >
                    {expandedProofs[result.id] ? 'Hide Proof' : 'View Proof'}
                  </button>
                )}
              </div>

              {expandedProofs[result.id] && result.proofImage && (
                <div className="animate-fade-in" style={{ width: '100%', marginBottom: '10px' }}>
                  <img
                    src={result.proofImage}
                    alt="Match Proof"
                    style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {result.proofVideo && (
                <video
                  src={result.proofVideo}
                  controls
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '5px' }}
                />
              )}

              {!result.proofImage && !result.proofVideo && result.hasProofImage && (
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Proof attached (Legacy Reference)
                </div>
              )}
            </div>
          )}

          {result.status === 'approved' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '10px', fontWeight: 700 }}>
              ✓ Approved by: <span style={{ color: 'var(--accent-cyan)' }}>{getApproverName(result)}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {isMe && !isPending && (
              <button className="btn btn-secondary btn-sm btn-block" style={{ color: 'var(--error)' }} onClick={() => handleDispute(result)}>Dispute Result</button>
            )}
            {isPending && isAdmin && (
              <>
                <button className="btn btn-primary btn-sm btn-block" onClick={() => handleApprove(result.id)}>Approve</button>
                <button className="btn btn-danger btn-sm btn-block" onClick={() => handleReject(result.id)}>Reject</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleManualRefresh = async () => {
    triggerDataRefresh('all')
  }

  if (!isSubscribed) {
    return (
      <div className="page animate-fade-in">
        <div className="page-header"><h1 className="page-title">League Results</h1></div>
        <div className="card glass" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ marginBottom: '10px' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Please subscribe to the Elite Arrows Pass to view full match history and stats.</p>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>View Passes</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <PullToRefresh onRefresh={handleManualRefresh}>
        <div className="page-header" style={{ marginBottom: '30px' }}>
          <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Results</h1>
          <p style={{ color: 'var(--text-muted)' }}>Official scores and player statistics</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'league', label: 'Singles League' },
            { id: 'doubles', label: 'Doubles League' },
            { id: 'cup', label: 'Cups' },
            { id: 'open', label: 'Friendly League' }
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-sm ${typeFilter === f.id ? 'btn-primary' : 'btn-secondary glass'}`}
              onClick={() => setTypeFilter(f.id)}
              style={{ borderRadius: '20px', padding: '8px 16px', whiteSpace: 'nowrap' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
          {[
            { id: 'all', label: 'All Divisions' },
            { id: 'Premier', label: 'Premier' },
            { id: 'Elite', label: 'Elite' },
            { id: 'Emerald 1', label: 'Emerald 1' },
            { id: 'Emerald 2', label: 'Emerald 2' },
            { id: 'Diamond', label: 'Diamond' },
            { id: 'Platinum', label: 'Platinum' }
          ].map(f => (
            <button
              key={f.id}
              className={`btn btn-sm ${divisionFilter === f.id ? 'btn-primary' : 'btn-secondary glass'}`}
              onClick={() => setDivisionFilter(f.id)}
              style={{ borderRadius: '20px', padding: '8px 16px', whiteSpace: 'nowrap' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="division-tabs" style={{ marginBottom: '24px' }}>
            <button className={`division-tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>Approved</button>
            <button className={`division-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
              Pending {pendingResults.length > 0 && <span style={{ marginLeft: '6px', background: 'white', color: 'black', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendingResults.length}</span>}
            </button>
          </div>
        )}

        <div className="results-container">
          <style>{`
            @keyframes snowFall {
              0% { top: -20px; opacity: 0; transform: translateX(0); }
              15% { opacity: 0.9; }
              85% { opacity: 0.9; }
              100% { top: 100%; opacity: 0.2; transform: translateX(35px); }
            }
            @keyframes twinkleBulb {
              0%, 100% { opacity: 0.35; transform: scale(0.9); box-shadow: 0 0 3px currentColor; }
              50% { opacity: 1; transform: scale(1.15); box-shadow: 0 0 12px currentColor, 0 0 24px currentColor; }
            }
            @keyframes tinselShimmer {
              0% { filter: hue-rotate(0deg) brightness(1) drop-shadow(0 0 15px rgba(239,68,68,0.7)); }
              50% { filter: hue-rotate(25deg) brightness(1.35) drop-shadow(0 0 28px rgba(16,185,129,0.9)); }
              100% { filter: hue-rotate(0deg) brightness(1) drop-shadow(0 0 15px rgba(239,68,68,0.7)); }
            }
          `}</style>

          {loading ? (
            <SkeletonList items={5} />
          ) : activeTab === 'pending' ? (
            pendingResults.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No results awaiting review.</p> :
            pendingResults.map(r => renderResultCard(r, true))
          ) : (
            approvedResults.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No match history found.</p> :
            <>
              {approvedResults.map(r => renderResultCard(r, false))}
              <button
                className="btn btn-secondary btn-block"
                disabled={fetchingMore}
                onClick={async () => {
                  setFetchingMore(true)
                  await fetchMoreResults()
                  setFetchingMore(false)
                }}
                style={{ marginTop: '20px', marginBottom: '40px' }}
              >
                {fetchingMore ? 'Loading...' : 'Load Older Results'}
              </button>
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
