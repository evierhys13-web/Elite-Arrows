import { useState, useEffect } from 'react'
import UserSearchSelect from './UserSearchSelect'
import { compressImageToDataUrl } from '../utils/imageUtils'
import { LEAGUE_DIVISION_NAMES } from '../utils/leagueStandings'

function AssetField({ label, value, uploading, enabled = true, maxDimension = 1600, onUpload, onRemove }) {
  return (
    <div className="glass" style={{ padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
          {value ? <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🖼️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', wordBreak: 'break-all' }}>
            {value ? 'Uploaded' : 'No image'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <label className="btn btn-primary btn-block" style={{ cursor: enabled ? 'pointer' : 'not-allowed', margin: 0, padding: '8px 12px', fontSize: '0.78rem', textAlign: 'center', opacity: enabled ? 1 : 0.5 }}>
          {uploading ? 'Working…' : '⬆ Upload'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={!enabled || uploading}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0]
              if (file && enabled) onUpload(file, maxDimension)
              e.target.value = ''
            }}
          />
        </label>
        {value && (
          <button className="btn btn-block" style={{ background: 'var(--error)', color: 'white', padding: '8px 12px', fontSize: '0.78rem', margin: 0 }} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function ChipList({ label, ids, users, onRemove, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
      {ids.map((id) => {
        const u = users.find((x) => String(x.id) === String(id))
        return (
          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: color || 'rgba(255,255,255,0.08)', fontSize: '0.78rem' }}>
            {u ? u.username : id}
            <button type="button" onClick={() => onRemove(id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}>×</button>
          </span>
        )
      })}
    </div>
  )
}

export default function SponsorshipLeagueEditor({ leagueId, config, assets, allUsers, seasons, saveConfig, saveAssets, removeAssetFields, showToast }) {
  const [draft, setDraft] = useState(null)
  const [prizeImages, setPrizeImages] = useState({})
  const [playerBgs, setPlayerBgs] = useState({})
  const [uploading, setUploading] = useState(null)
  const [pendingBgPlayer, setPendingBgPlayer] = useState('')
  const [newArchive, setNewArchive] = useState({ season: '', champ: '', runnersUp: [], promoted: [], relegated: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft({
      enabled: Boolean(config?.enabled),
      sponsorName: config?.sponsorName || '',
      namingTitle: config?.namingTitle || '',
      sponsorUrl: config?.sponsorUrl || '',
      overlayEnabled: Boolean(config?.overlay?.enabled),
      overlayText: config?.overlay?.text || '',
      overlayPosition: config?.overlay?.position || 'bottom',
      overlayOpacity: typeof config?.overlay?.opacity === 'number' ? config.overlay.opacity : 0.7,
      bannerOpacity: typeof config?.banner?.opacity === 'number' ? config.banner.opacity : 0.5,
      bannerBlur: typeof config?.banner?.blur === 'number' ? config.banner.blur : 0,
      bannerFit: config?.banner?.fit === 'contain' ? 'contain' : 'cover',
      championCaption: config?.champion?.caption || '',
      prizes: {
        title: config?.prizes?.title || '',
        pots: Array.isArray(config?.prizes?.pots) ? config.prizes.pots : [],
      },
      seasonsArchive: Array.isArray(config?.seasonsArchive) ? config.seasonsArchive : [],
    })
    setPrizeImages(assets?.prizeImages || {})
    setPlayerBgs(assets?.playerBackgrounds || {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId])

  if (!draft) return null

  const division = LEAGUE_DIVISION_NAMES[leagueId] || leagueId
  const publicUrl = `${window.location.origin}/league/${leagueId}`
  const seasonOptions = seasons.filter((s) => !s.isArchived).map((s) => s.name)

  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }))

  const uploadAsset = async (file, key, maxDimension) => {
    try {
      setUploading(key)
      const dataUrl = await compressImageToDataUrl(file, { maxDimension: maxDimension, maxBase64: 650000 })
      await saveAssets(leagueId, { [key]: dataUrl })
      showToast('Image uploaded', 'success')
    } catch (e) {
      console.error(e)
      showToast('Upload failed', 'error')
    } finally {
      setUploading(null)
    }
  }

  const removeAsset = (keys) => {
    removeAssetFields(leagueId, keys)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const normalizeNames = (ids) =>
        Object.fromEntries(
          (ids || []).filter(Boolean).map((id) => [
            String(id),
            allUsers.find((u) => String(u.id) === String(id))?.username || String(id),
          ]),
        )
      const archive = (draft.seasonsArchive || []).map((e) => ({
        ...e,
        names: normalizeNames([
          e.champUserId,
          ...(e.runnersUp || []),
          ...(e.promoted || []),
          ...(e.relegated || []),
        ]),
      }))
      await saveConfig(leagueId, {
        enabled: draft.enabled,
        sponsorName: draft.sponsorName,
        namingTitle: draft.namingTitle,
        sponsorUrl: draft.sponsorUrl,
        overlay: {
          enabled: draft.overlayEnabled,
          text: draft.overlayText,
          position: draft.overlayPosition,
          opacity: draft.overlayOpacity,
        },
        banner: {
          opacity: draft.bannerOpacity,
          blur: draft.bannerBlur,
          fit: draft.bannerFit,
        },
        champion: {
          caption: draft.championCaption,
        },
        prizes: {
          title: draft.prizes.title,
          pots: draft.prizes.pots,
        },
        seasonsArchive: archive,
      })
      await saveAssets(leagueId, {
        prizeImages,
        playerBackgrounds: playerBgs,
      })
      showToast('League sponsorship saved', 'success')
    } catch (e) {
      console.error(e)
      showToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updatePot = (index, field, value) => {
    setDraft((d) => {
      const pots = (d.prizes.pots || []).map((p, i) => (i === index ? { ...p, [field]: value } : p))
      return { ...d, prizes: { ...d.prizes, pots } }
    })
  }

  const addPot = () => {
    setDraft((d) => ({ ...d, prizes: { ...d.prizes, pots: [...(d.prizes.pots || []), { label: '', amount: '' }] } }))
  }

  const removePot = (index) => {
    setDraft((d) => ({ ...d, prizes: { ...d.prizes, pots: (d.prizes.pots || []).filter((_, i) => i !== index) } }))
    setPrizeImages((prev) => {
      const next = { ...prev }
      delete next[String(index)]
      return next
    })
  }

  const addArchiveEntry = () => {
    if (!newArchive.season) {
      showToast('Choose a season', 'warning')
      return
    }
    const entry = {
      season: newArchive.season,
      champUserId: newArchive.champ || '',
      runnersUp: newArchive.runnersUp,
      promoted: newArchive.promoted,
      relegated: newArchive.relegated,
    }
    setDraft((d) => ({
      ...d,
      seasonsArchive: [...(d.seasonsArchive || []).filter((e) => e.season !== entry.season), entry],
    }))
    setNewArchive({ season: '', champ: '', runnersUp: [], promoted: [], relegated: [] })
  }

  const removeArchiveEntry = (season) => {
    setDraft((d) => ({ ...d, seasonsArchive: (d.seasonsArchive || []).filter((e) => e.season !== season) }))
  }

  const bindIds = (key) => ({
    users: allUsers,
    selectedId: null,
    onSelect: (id) => setNewArchive((a) => ({ ...a, [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id] })),
  })

  const inputStyle = { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '0.85rem' }

  return (
    <div className="card glass" style={{ padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{division} League Sponsor</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Public page: <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{publicUrl}</a>
          </p>
        </div>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save League'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setField('enabled', e.target.checked)} />
              <span style={{ fontSize: '0.85rem' }}>League page enabled</span>
            </label>
          </div>
          {[
            { field: 'sponsorName', label: 'Sponsor name', placeholder: 'e.g. X-Lite Darts' },
            { field: 'namingTitle', label: 'Naming rights title', placeholder: 'e.g. The X-Lite Elite League' },
            { field: 'sponsorUrl', label: 'Sponsor website link', placeholder: 'https://…' },
          ].map((f) => (
            <div key={f.field}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>{f.label}</label>
              <input style={inputStyle} value={draft[f.field]} placeholder={f.placeholder} onChange={(e) => setField(f.field, e.target.value)} />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>Winner image caption</label>
            <input style={inputStyle} value={draft.championCaption} placeholder="e.g. 2026 Elite Champion" onChange={(e) => setField('championCaption', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <AssetField label="Sponsor logo" value={assets?.sponsorLogo} uploading={uploading === 'sponsorLogo'} maxDimension={600} onUpload={(file) => uploadAsset(file, 'sponsorLogo', 600)} onRemove={() => removeAsset(['sponsorLogo'])} />
            <AssetField label="Champion / winner pic" value={assets?.championImage} uploading={uploading === 'championImage'} maxDimension={900} onUpload={(file) => uploadAsset(file, 'championImage', 900)} onRemove={() => removeAsset(['championImage'])} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>Banner background</div>
            <AssetField label="Banner image" value={assets?.bannerImage} uploading={uploading === 'bannerImage'} maxDimension={1600} onUpload={(file) => uploadAsset(file, 'bannerImage', 1600)} onRemove={() => removeAsset(['bannerImage'])} />
            {assets?.bannerImage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Opacity</span><span>{Math.round(draft.bannerOpacity * 100)}%</span>
                  </label>
                  <input type="range" min="0.1" max="1" step="0.05" value={draft.bannerOpacity} onChange={(e) => setField('bannerOpacity', parseFloat(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Blur</span><span>{draft.bannerBlur}px</span>
                  </label>
                  <input type="range" min="0" max="20" step="1" value={draft.bannerBlur} onChange={(e) => setField('bannerBlur', parseFloat(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Fit</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['cover', 'contain'].map((fitOpt) => (
                      <button key={fitOpt} className={`btn btn-sm ${draft.bannerFit === fitOpt ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setField('bannerFit', fitOpt)}>
                        {fitOpt === 'cover' ? 'Fill' : 'Best fit'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input type="checkbox" checked={draft.overlayEnabled} onChange={(e) => setField('overlayEnabled', e.target.checked)} />
              <span style={{ fontSize: '0.85rem' }}>Show overlay</span>
            </label>
            {draft.overlayEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <AssetField label="Overlay image" value={assets?.overlayImage} uploading={uploading === 'overlayImage'} maxDimension={1000} onUpload={(file) => uploadAsset(file, 'overlayImage', 1000)} onRemove={() => removeAsset(['overlayImage'])} />
                <input style={inputStyle} value={draft.overlayText} placeholder="Overlay text (optional)" onChange={(e) => setField('overlayText', e.target.value)} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['top', 'bottom'].map((pos) => (
                    <button key={pos} className={`btn btn-sm ${draft.overlayPosition === pos ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setField('overlayPosition', pos)}>
                      {pos === 'top' ? 'Top' : 'Bottom'}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Overlay opacity</span><span>{Math.round(draft.overlayOpacity * 100)}%</span>
                  </label>
                  <input type="range" min="0.1" max="1" step="0.05" value={draft.overlayOpacity} onChange={(e) => setField('overlayOpacity', parseFloat(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>Prize pots (custom backgrounds per prize)</div>
            <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="Prizes title (e.g. Season 5 Prize Fund)" value={draft.prizes.title} onChange={(e) => setDraft((d) => ({ ...d, prizes: { ...d.prizes, title: e.target.value } }))} />
            {(draft.prizes.pots || []).map((pot, index) => (
              <div key={index} className="glass" style={{ padding: '10px', borderRadius: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder={`Prize ${index + 1} label (e.g. Winner)`} value={pot.label} onChange={(e) => updatePot(index, 'label', e.target.value)} />
                  <input style={{ ...inputStyle, width: '110px' }} placeholder="Amount" value={pot.amount} onChange={(e) => updatePot(index, 'amount', e.target.value)} />
                  <button className="btn btn-sm" style={{ background: 'var(--error)', color: 'white', margin: 0 }} onClick={() => removePot(index)}>🗑</button>
                </div>
                <AssetField label="Prize background" value={prizeImages[String(index)]} uploading={uploading === `prize-${index}`} maxDimension={800}
                  onUpload={async (file) => {
                    try {
                      setUploading(`prize-${index}`)
                      const dataUrl = await compressImageToDataUrl(file, { maxDimension: 800, maxBase64: 650000 })
                      setPrizeImages((prev) => ({ ...prev, [String(index)]: dataUrl }))
                      showToast('Prize background added', 'success')
                    } catch (e) {
                      showToast('Upload failed', 'error')
                    } finally {
                      setUploading(null)
                    }
                  }}
                  onRemove={() => setPrizeImages((prev) => { const next = { ...prev }; delete next[String(index)]; return next })}
                />
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addPot}>+ Add prize</button>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>Player-specific backgrounds</div>
            {Object.keys(playerBgs).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {Object.entries(playerBgs).map(([uid, image]) => {
                  const u = allUsers.find((x) => String(x.id) === String(uid))
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
                      <img src={image} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover' }} />
                      <span style={{ fontSize: '0.8rem' }}>{u ? u.username : uid}</span>
                      <button type="button" onClick={() => setPlayerBgs((prev) => { const next = { ...prev }; delete next[uid]; return next })} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <UserSearchSelect users={allUsers} selectedId={pendingBgPlayer} onSelect={setPendingBgPlayer} label="Player" placeholder="Pick a player…" />
              <AssetField label="This player's background" value={pendingBgPlayer ? playerBgs[pendingBgPlayer] : null} uploading={uploading === 'playerBg'} maxDimension={400}
                onUpload={async (file) => {
                  if (!pendingBgPlayer) { showToast('Pick a player first', 'warning'); return }
                  try {
                    setUploading('playerBg')
                    const dataUrl = await compressImageToDataUrl(file, { maxDimension: 400, maxBase64: 400000 })
                    setPlayerBgs((prev) => ({ ...prev, [pendingBgPlayer]: dataUrl }))
                    showToast('Player background added', 'success')
                  } catch (e) {
                    showToast('Upload failed', 'error')
                  } finally {
                    setUploading(null)
                  }
                }}
                onRemove={() => pendingBgPlayer && setPlayerBgs((prev) => { const next = { ...prev }; delete next[pendingBgPlayer]; return next })}
                enabled={Boolean(pendingBgPlayer)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: '22px', paddingTop: '20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>Season archive (champion, promoted &amp; relegated)</div>
        {(draft.seasonsArchive || []).map((entry) => {
          const champ = allUsers.find((x) => String(x.id) === String(entry.champUserId || ''))
          return (
            <div key={entry.season} className="glass" style={{ padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--accent-cyan)' }}>{entry.season}</strong>
                <button className="btn btn-sm" style={{ background: 'var(--error)', color: 'white', margin: 0 }} onClick={() => removeArchiveEntry(entry.season)}>Remove</button>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <span>🏆 Champion: <strong>{champ ? champ.username : entry.champUserId || '—'}</strong></span>
                {entry.runnersUp?.length > 0 && <span>🥈 Runners-up: {entry.runnersUp.map((id) => allUsers.find((x) => String(x.id) === String(id))?.username || id).join(', ')}</span>}
                {entry.promoted?.length > 0 && <span>⬆ Promoted: {entry.promoted.map((id) => allUsers.find((x) => String(x.id) === String(id))?.username || id).join(', ')}</span>}
                {entry.relegated?.length > 0 && <span>⬇ Relegated: {entry.relegated.map((id) => allUsers.find((x) => String(x.id) === String(id))?.username || id).join(', ')}</span>}
              </div>
            </div>
          )
        })}

        <div className="glass" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>Season</label>
              <select style={inputStyle} value={newArchive.season} onChange={(e) => setNewArchive((a) => ({ ...a, season: e.target.value }))}>
                <option value="">Choose season…</option>
                {[...new Set([...seasonOptions, ...(draft.seasonsArchive || []).map((e) => e.season)])].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <UserSearchSelect users={allUsers} selectedId={newArchive.champ} onSelect={(id) => setNewArchive((a) => ({ ...a, champ: id }))} label="🏆 Champion" />
              <ChipList ids={newArchive.champ ? [newArchive.champ] : []} users={allUsers} onRemove={() => setNewArchive((a) => ({ ...a, champ: '' }))} color="var(--warning-bg)" />
            </div>
            <div>
              <UserSearchSelect {...bindIds('runnersUp')} label="🥈 Runners-up (click to toggle)" />
              <ChipList ids={newArchive.runnersUp} users={allUsers} onRemove={(id) => setNewArchive((a) => ({ ...a, runnersUp: a.runnersUp.filter((x) => x !== id) }))} />
            </div>
            <div>
              <UserSearchSelect {...bindIds('promoted')} label="⬆ Promoted (click to toggle)" />
              <ChipList ids={newArchive.promoted} users={allUsers} onRemove={(id) => setNewArchive((a) => ({ ...a, promoted: a.promoted.filter((x) => x !== id) }))} color="rgba(16,185,129,0.15)" />
            </div>
            <div>
              <UserSearchSelect {...bindIds('relegated')} label="⬇ Relegated (click to toggle)" />
              <ChipList ids={newArchive.relegated} users={allUsers} onRemove={(id) => setNewArchive((a) => ({ ...a, relegated: a.relegated.filter((x) => x !== id) }))} color="rgba(239,68,68,0.15)" />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={addArchiveEntry}>+ Add archive entry</button>
        </div>
      </div>
    </div>
  )
}