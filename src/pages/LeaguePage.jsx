import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db, doc, onSnapshot } from '../firebase'
import { useSponsorship } from '../context/SponsorshipContext'
import { LEAGUE_DIVISION_KEYS, LEAGUE_DIVISION_NAMES, DIVISION_COLORS } from '../utils/leagueStandings'

export default function LeaguePage() {
  const { leagueId } = useParams()
  const { configs, assets, loading: sponsorshipLoading } = useSponsorship()

  const valid = LEAGUE_DIVISION_KEYS.includes(leagueId)
  const config = configs[leagueId] || {}
  const asset = assets[leagueId] || {}
  const division = LEAGUE_DIVISION_NAMES[leagueId] || leagueId
  const accent = DIVISION_COLORS[division] || '#38bdf8'

  const [digest, setDigest] = useState(null)
  const [digestLoading, setDigestLoading] = useState(true)

  useEffect(() => {
    if (!valid) return
    let unsub
    try {
      unsub = onSnapshot(doc(db, 'leaguePagesDigest', leagueId), (snap) => {
        setDigest(snap.data() || null)
        setDigestLoading(false)
      }, (err) => {
        console.warn('league digest listener error:', err)
        setDigestLoading(false)
      })
    } catch (e) {
      console.warn('league digest init error:', e)
      setDigestLoading(false)
    }
    return () => { if (unsub) unsub() }
  }, [leagueId, valid])

  if (!valid) {
    return (
      <div className="page animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <h1 className="page-title text-gradient">League not found</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>This league page doesn't exist.</p>
        <Link to="/home" className="btn btn-primary btn-sm">Back home</Link>
      </div>
    )
  }

  const sponsored = Boolean(config.enabled)
  const playerBgs = asset.playerBackgrounds || {}
  const archive = Array.isArray(config.seasonsArchive) ? config.seasonsArchive : []
  const latestWinner = archive[archive.length - 1]
  const standings = Array.isArray(digest?.standings) ? digest.standings : []
  const nameOf = (entry, id) => (entry?.names && entry.names[String(id)]) || (standings.find((s) => String(s.id) === String(id))?.username) || id

  const rowBackground = (playerId) => playerBgs[String(playerId)]

  if (sponsorshipLoading) {
    return (
      <div className="page animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading league page…</p>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 0 60px' }}>
      {/* BANNER */}
      <div style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        minHeight: '220px',
        background: asset.bannerImage
          ? `url(${asset.bannerImage}) center/cover no-repeat`
          : 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)',
        border: `1px solid ${accent}66`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        margin: '16px 16px 24px'
      }}>
        {asset.bannerImage && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(11, 5, 29, ${typeof config.banner?.opacity === 'number' ? 1 - config.banner.opacity : 0.5})`,
            backdropFilter: config.banner?.blur ? `blur(${config.banner.blur}px)` : undefined,
          }} />
        )}
        {config.overlay?.enabled && (
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            top: config.overlay.position === 'top' ? 0 : undefined,
            bottom: config.overlay.position === 'bottom' ? 0 : undefined,
            padding: '10px 18px',
            background: `rgba(11, 5, 29, ${typeof config.overlay.opacity === 'number' ? config.overlay.opacity : 0.7})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            zIndex: 2,
          }}>
            {asset.overlayImage && <img src={asset.overlayImage} alt="" style={{ height: '42px', maxWidth: '120px', objectFit: 'contain' }} />}
            {config.overlay.text && <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', textAlign: 'center' }}>{config.overlay.text}</span>}
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 2, padding: '28px 24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {asset.sponsorLogo && <img src={asset.sponsorLogo} alt="sponsor logo" style={{ height: '56px', maxWidth: '150px', objectFit: 'contain', borderRadius: '10px' }} />}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-cyan)' }}>
                Sponsors League
              </div>
              <h1 style={{ margin: '4px 0', fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                {sponsored && config.namingTitle ? config.namingTitle : `${division} League`}
              </h1>
              {sponsored && config.sponsorName && (
                <div style={{ color: '#e2e8f0', fontSize: '0.9rem', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
                  Sponsored by <strong style={{ color: accent }}>{config.sponsorName}</strong>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', flexWrap: 'wrap' }}>
            {sponsored && config.sponsorUrl && (
              <a href={config.sponsorUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                Visit {config.sponsorName || 'Sponsor'}
              </a>
            )}
            <Link to="/home" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>← Elite Arrows</Link>
          </div>
        </div>
      </div>

      {(config.prizes?.pots?.length > 0 || latestWinner) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '0 16px', marginBottom: '24px' }}>
          {config.prizes?.pots?.length > 0 && (
            <div className="glass" style={{ borderRadius: '16px', padding: '18px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>🏆 {config.prizes.title || 'Prize Fund'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {config.prizes.pots.map((pot, index) => (
                  <div key={index} style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    padding: '14px',
                    background: asset.prizeImages?.[String(index)]
                      ? `linear-gradient(rgba(11,5,29,0.55), rgba(11,5,29,0.75)), url(${asset.prizeImages[String(index)]}) center/cover no-repeat`
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${accent}33`,
                    color: '#fff',
                  }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#cbd5e1' }}>{pot.label || `Prize ${index + 1}`}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: accent }}>{pot.amount || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestWinner && (
            <div className="glass" style={{ borderRadius: '16px', padding: '18px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              {asset.championImage && (
                <img src={asset.championImage} alt="champion" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
              )}
              <div style={{ position: 'relative', marginTop: asset.championImage ? 12 : 0, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem' }}>👑</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: accent }}>{nameOf(latestWinner, latestWinner.champUserId) || 'Champion'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{latestWinner.season}</div>
                {config.champion?.caption && <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>{config.champion.caption}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STANDINGS */}
      <div className="glass" style={{ borderRadius: '16px', padding: '20px 16px', margin: '0 16px 24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{division} Standings</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {digest?.season ? `${digest.season} · ` : ''}Updated {digest?.updatedAt ? 'recently' : '—'}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', padding: '10px 8px', width: '40px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '10px 8px' }}>PLAYER</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>P</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>W</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>D</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>L</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>+/-</th>
                <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--accent-cyan)' }}>PTS</th>
                <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--accent-primary)' }}>AVG</th>
              </tr>
            </thead>
            <tbody>
              {digestLoading ? (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading standings…</td></tr>
              ) : standings.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No standings yet — check back soon.</td></tr>
              ) : standings.map((row, index) => {
                const bg = rowBackground(row.id)
                return (
                  <tr key={row.id} style={{ background: bg ? `linear-gradient(90deg, rgba(11,5,29,0.82), rgba(11,5,29,0.92)), url(${bg}) center/cover` : index % 2 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 800, color: accent }}>{index + 1}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                          background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                          fontSize: '0.8rem', border: `2px solid ${index < 3 && row.played > 0 ? accent : 'var(--border)'}`,
                        }}>
                          {row.profilePicture ? (
                            <img src={row.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (row.username || row.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <strong style={{ color: 'var(--text-primary)' }}>{row.username || row.name || '—'}</strong>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{row.played}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--success)' }}>{row.wins}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{row.draws}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--error)' }}>{row.losses}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{row.legDiff > 0 ? `+${row.legDiff}` : row.legDiff}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{row.points}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{(row.average || 0).toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PREVIOUS SEASONS */}
      {archive.length > 0 && (
        <div className="glass" style={{ borderRadius: '16px', padding: '20px 16px', margin: '0 16px 24px', border: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '1.15rem' }}>📜 Previous Seasons</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[...archive].reverse().map((entry) => (
              <div key={entry.season} className="glass" style={{ borderRadius: '12px', padding: '14px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontWeight: 800, color: accent, marginBottom: '6px' }}>{entry.season}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {entry.champUserId && <span>🏆 <strong>{nameOf(entry, entry.champUserId)}</strong></span>}
                  {entry.runnersUp?.length > 0 && <span>🥈 {entry.runnersUp.map((id) => nameOf(entry, id)).join(', ')}</span>}
                  {entry.promoted?.length > 0 && <span>⬆ Promoted: <strong style={{ color: 'var(--success)' }}>{entry.promoted.map((id) => nameOf(entry, id)).join(', ')}</strong></span>}
                  {entry.relegated?.length > 0 && <span>⬇ Relegated: <strong style={{ color: 'var(--error)' }}>{entry.relegated.map((id) => nameOf(entry, id)).join(', ')}</strong></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 16px' }}>
        Powered by <strong>Elite Arrows</strong> · {standings.length} players · {division} Division
      </div>
    </div>
  )
}