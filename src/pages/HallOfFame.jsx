import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, getDocs, collection, deleteDoc, updateDoc, addDoc } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import UserSearchSelect from '../components/UserSearchSelect'
import Breadcrumbs from '../components/Breadcrumbs'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

export default function HallOfFame() {
  const { user, getAllUsers, getSeasons, adminData, searchUsers } = useAuth()
  const { showToast } = useToast()

  const allUsers = getAllUsers() || []

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ player: '', name: '', icon: '🏆', season: '', visible: true })
  const [saving, setSaving] = useState(false)

  const isAdmin = Boolean(
    user && (
      ADMIN_EMAILS.includes(user?.email?.toLowerCase()) ||
      user.isAdmin || user.isTournamentAdmin || user.isCupAdmin
    )
  )

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const snap = await getDocs(collection(db, 'hallOfFame'))
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Failed to fetch Hall of Fame', e)
        showToast('Failed to load Hall of Fame', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchEntries()
  }, [])

  const logAudit = async (action, details) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        adminId: user.id,
        adminName: user.username,
        action,
        details,
        timestamp: new Date().toISOString()
      })
    } catch (e) { console.error('Audit log failed', e) }
  }

  const curated = useMemo(() =>
    entries
      .filter(e => isAdmin || e.visible !== false)
      .sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
      .map(h => {
        const u = allUsers.find(u => u.id === h.userId)
        return { ...h, profilePicture: h.profilePicture ?? u?.profilePicture }
      }),
  [entries, isAdmin, allUsers])

  const fallbackChampions = useMemo(() => {
    if (curated.length > 0 || loading) return []
    const list = []
    if (!Array.isArray(allUsers)) return list
    allUsers.forEach(u => {
      if (u.trophies && Array.isArray(u.trophies)) {
        u.trophies.forEach(t => {
          list.push({
            id: `${u.id}_${t.awardedAt || t.name}`,
            userId: u.id,
            username: u.username,
            name: t.name,
            icon: t.icon,
            season: t.season,
            awardedAt: t.awardedAt,
            profilePicture: u.profilePicture
          })
        })
      }
    })
    return list.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
  }, [curated.length, loading, allUsers])

  const displayList = curated.length > 0 ? curated : fallbackChampions

  const groupedBySeason = useMemo(() => {
    const groups = {}
    displayList.forEach(entry => {
      const key = entry.season || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [displayList])

  const handleAdd = async () => {
    if (!form.player || !form.name.trim()) return showToast('Player and Achievement title are required', 'error')
    const target = allUsers.find(p => p.id === form.player)
    if (!target) return showToast('Selected player not found', 'error')

    setSaving(true)
    try {
      const entry = {
        userId: target.id,
        username: target.username,
        name: form.name.trim(),
        icon: form.icon || '🏆',
        season: form.season || adminData?.currentSeason || 'Season 1',
        visible: form.visible,
        awardedAt: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'hallOfFame'), entry)
      setEntries(prev => [...prev, { id: docRef.id, ...entry }])
      await logAudit('ADD_HALL_OF_FAME', `Added ${target.username} to Hall of Fame: ${entry.name}`)
      showToast('Added to Hall of Fame!', 'success')
      setForm({ player: '', name: '', icon: '🏆', season: '', visible: true })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleVisibility = async (entry) => {
    try {
      await updateDoc(doc(db, 'hallOfFame', entry.id), { visible: !entry.visible })
      setEntries(prev => prev.map(h => h.id === entry.id ? { ...h, visible: !entry.visible } : h))
      showToast(`Entry ${entry.visible ? 'hidden' : 'visible'}`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleRemove = async (entry) => {
    if (!window.confirm(`Remove "${entry.name}" for ${entry.username} from the Hall of Fame?`)) return
    try {
      await deleteDoc(doc(db, 'hallOfFame', entry.id))
      setEntries(prev => prev.filter(h => h.id !== entry.id))
      await logAudit('REMOVE_HALL_OF_FAME', `Removed Hall of Fame entry: ${entry.username} - ${entry.name}`)
      showToast('Entry removed', 'info')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (!user) {
    return (
      <div className="page glass">
        <div style={{ padding: '60px', textAlign: 'center' }}>Please sign in to view the Hall of Fame.</div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Hall of Fame' }]} />

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
        <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0 }}>Hall of Fame</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          The greatest achievements in Elite Arrows history
        </p>
      </div>

      {isAdmin && (
        <div className="card glass" style={{ marginBottom: '24px', border: '1px solid var(--accent-primary)' }}>
          <h3 className="card-title" style={{ color: 'var(--accent-cyan)' }}>➕ Add Achievement</h3>
          <UserSearchSelect
            users={allUsers}
            selectedId={form.player}
            onSelect={id => setForm({ ...form, player: id })}
            label="Select Player"
            onQueryChange={searchUsers}
          />
          <input
            className="glass"
            placeholder="Achievement Title (e.g. Season 1 Champion)"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ marginTop: '15px' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <input
              className="glass"
              placeholder="Icon (emoji)"
              value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })}
            />
            <select
              className="glass"
              value={form.season}
              onChange={e => setForm({ ...form, season: e.target.value })}
            >
              <option value="">Season...</option>
              {(typeof getSeasons === 'function' ? getSeasons() : []).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.visible}
              onChange={e => setForm({ ...form, visible: e.target.checked })}
            />
            Visible to all players
          </label>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: '15px' }}
            disabled={saving}
            onClick={handleAdd}
          >
            {saving ? 'Adding...' : 'Add to Hall of Fame'}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList items={4} />
      ) : displayList.length === 0 ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎖️</div>
          <p style={{ color: 'var(--text-muted)' }}>No honours recorded yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Win your division league or any official cup tournament to be etched into history.
          </p>
        </div>
      ) : (
        groupedBySeason.map(([season, seasonEntries]) => (
          <div key={season} className="card glass" style={{ marginBottom: '24px' }}>
            <h3 className="card-title" style={{ color: '#fbbf24' }}>{season}</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px',
              marginTop: '14px'
            }}>
              {seasonEntries.map(entry => (
                <div key={entry.id} style={{ position: 'relative' }}>
                  <Link to={`/profile/${entry.userId}`} style={{ textDecoration: 'none' }}>
                    <div className="glass" style={{
                      padding: '18px 10px',
                      textAlign: 'center',
                      borderRadius: '14px',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: entry.visible === false ? 0.5 : 1
                    }}>
                      {entry.profilePicture ? (
                        <img src={entry.profilePicture} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: '1.8rem' }}>{entry.icon || '🏆'}</div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.username}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700, lineHeight: 1.3 }}>{entry.name}</div>
                      {entry.visible === false && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800, textTransform: 'uppercase' }}>Hidden</span>
                      )}
                    </div>
                  </Link>
                  {isAdmin && curated.some(c => c.id === entry.id) && (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                      <button
                        className={`btn btn-sm ${entry.visible === false ? 'btn-secondary' : 'btn-success'}`}
                        style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                        onClick={() => handleToggleVisibility(entry)}
                      >
                        {entry.visible === false ? 'Show' : 'Hide'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                        onClick={() => handleRemove(entry)}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
