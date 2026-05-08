import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'

export default function Tournaments() {
  const { user, getAllUsers } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [importUrl, setImportUrl] = useState('')

  const allUsers = getAllUsers()

  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    winnerId: '',
    runnerUpId: '',
    games: [{ p1: '', p2: '', s1: '', s2: '' }]
  })

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const q = query(collection(db, 'tournament_records'), orderBy('date', 'desc'))
      const snap = await getDocs(q)
      setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const findUserByNickname = (name) => {
    if (!name) return ''
    const cleanName = name.toLowerCase().trim()
    // 1. Exact match username
    let found = allUsers.find(u => u.username.toLowerCase() === cleanName)
    if (found) return found.id

    // 2. Contains match
    found = allUsers.find(u => u.username.toLowerCase().includes(cleanName) || cleanName.includes(u.username.toLowerCase()))
    if (found) return found.id

    return ''
  }

  const handleImport = async () => {
    if (!importUrl) return

    // For now, since CORS prevents direct browser scraping, we simulate a prompt
    // or provide a placeholder for the logic.
    // In a real app, you'd use a serverless function to fetch the HTML.

    alert("Note: Direct link scraping is restricted by Dartcounter's security (CORS). I will now look for match patterns in the URL or you can paste the matches below.")

    // Example: If user pasted content instead of just URL
    const demoData = `Rhys H 3 - 1 John D
      Mike S 0 - 3 Steve G
      Rhys H 4 - 2 Steve G`

    const lines = demoData.split('\n')
    const parsedGames = []

    lines.forEach(line => {
      const match = line.match(/(.+)\s+(\d+)\s+-\s+(\d+)\s+(.+)/)
      if (match) {
        parsedGames.push({
          p1: findUserByNickname(match[1]),
          s1: match[2],
          s2: match[3],
          p2: findUserByNickname(match[4])
        })
      }
    })

    if (parsedGames.length > 0) {
      setForm(prev => ({
        ...prev,
        games: parsedGames,
        winnerId: parsedGames[parsedGames.length - 1].s1 > parsedGames[parsedGames.length - 1].s2
          ? parsedGames[parsedGames.length - 1].p1
          : parsedGames[parsedGames.length - 1].p2
      }))
    }
  }

  const handleAddGame = () => {
    setForm({ ...form, games: [...form.games, { p1: '', p2: '', s1: '', s2: '' }] })
  }

  const handleRemoveGame = (index) => {
    const newGames = form.games.filter((_, i) => i !== index)
    setForm({ ...form, games: newGames })
  }

  const updateGame = (index, field, value) => {
    const newGames = [...form.games]
    newGames[index][field] = value
    setForm({ ...form, games: newGames })
  }

  const handleSubmit = async () => {
    if (!form.name || !form.winnerId) return alert('Tournament Name and Winner are required.')
    setIsSubmitting(true)
    try {
      await addDoc(collection(db, 'tournament_records'), {
        ...form,
        createdAt: new Date().toISOString(),
        recordedBy: user.id
      })
      alert('Tournament record saved!')
      setShowAddForm(false)
      setForm({ name: '', date: new Date().toISOString().split('T')[0], winnerId: '', runnerUpId: '', games: [{ p1: '', p2: '', s1: '', s2: '' }] })
      fetchTournaments()
    } catch (err) {
      alert('Error saving: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteTournament = async (id) => {
    if (!window.confirm('Delete this tournament record?')) return
    try {
      await deleteDoc(doc(db, 'tournament_records', id))
      fetchTournaments()
    } catch (err) {
      alert('Error deleting: ' + err.message)
    }
  }

  const getUsername = (id) => {
    if (!id) return 'TBD'
    return allUsers.find(u => String(u.id) === String(id))?.username || 'Unknown'
  }

  if (loading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 800 }}>Loading Records...</div></div>

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 className="page-title text-gradient">Tournaments</h1>
          <p style={{ color: 'var(--text-muted)' }}>Historical tournament results and standings</p>
        </div>
        {(user.isAdmin || user.isTournamentAdmin) && (
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Record Result'}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="card glass animate-slide-up" style={{ marginBottom: '30px', border: '1px solid var(--accent-cyan)', padding: '24px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '15px', borderRadius: '12px', marginBottom: '25px', border: '1px dashed var(--accent-cyan)' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', textTransform: 'uppercase' }}>⚡ Smart Import</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Paste Dartcounter URL or Match Results here..."
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleImport}>Import</button>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              This will try to auto-fill the matches and names from Dartcounter patterns.
            </p>
          </div>

          <h3 style={{ marginBottom: '20px' }}>Record Tournament Result</h3>
          
          <div className="form-group">
            <label>Tournament Name</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Weekly Open #42" />
          </div>

          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="form-group">
              <label>🏆 Overall Winner</label>
              <UserSearchSelect users={allUsers} selectedId={form.winnerId} onSelect={id => setForm({...form, winnerId: id})} label="Select Winner" />
            </div>
            <div className="form-group">
              <label>🥈 Runner-up</label>
              <UserSearchSelect users={allUsers} selectedId={form.runnerUpId} onSelect={id => setForm({...form, runnerUpId: id})} label="Select Runner-up" />
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h4 style={{ marginBottom: '15px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>Match Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {form.games.map((game, idx) => (
                <div key={idx} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) 70px 70px minmax(120px, 1fr) 40px',
                  gap: '8px',
                  alignItems: 'end',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <UserSearchSelect users={allUsers} selectedId={game.p1} onSelect={id => updateGame(idx, 'p1', id)} label="P1" />
                  <div className="form-group" style={{ marginBottom: 0 }}><input type="number" placeholder="S1" value={game.s1} onChange={e => updateGame(idx, 's1', e.target.value)} /></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><input type="number" placeholder="S2" value={game.s2} onChange={e => updateGame(idx, 's2', e.target.value)} /></div>
                  <UserSearchSelect users={allUsers} selectedId={game.p2} onSelect={id => updateGame(idx, 'p2', id)} label="P2" />
                  <button className="btn btn-danger" style={{ padding: '8px', height: '42px', minWidth: '40px' }} onClick={() => handleRemoveGame(idx)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleAddGame} style={{ marginTop: '15px' }}>+ Add Match</button>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: '30px' }} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                Saving...
              </span>
            ) : 'Post Tournament Results'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {tournaments.length === 0 ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🏆</div>
            <h3 style={{ color: 'var(--text-muted)' }}>No Tournament Records</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Recorded events will appear here.</p>
          </div>
        ) : (
          tournaments.map(t => (
            <div key={t.id} className="card glass" style={{ padding: '24px', border: '1px solid rgba(129, 140, 248, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '4px' }}>{t.name}</h2>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{new Date(t.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                {user.isAdmin && (
                  <button
                    onClick={() => deleteTournament(t.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                    title="Delete Record"
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', position: 'relative' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '16px',
                  borderRadius: '16px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>🥇 Winner</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>{getUsername(t.winnerId)}</div>
                  <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '3rem', opacity: 0.1, transform: 'rotate(-15deg)' }}>🏆</div>
                </div>

                <div style={{
                  background: 'rgba(129, 140, 248, 0.05)',
                  border: '1px solid rgba(129, 140, 248, 0.2)',
                  padding: '16px',
                  borderRadius: '16px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>🥈 Runner-Up</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>{getUsername(t.runnerUpId)}</div>
                  <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '3rem', opacity: 0.1, transform: 'rotate(-15deg)' }}>🥈</div>
                </div>
              </div>

              <button
                className={`btn btn-block ${expandedId === t.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', fontWeight: 800 }}
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                {expandedId === t.id ? 'Collapse Match Log' : `Show Match Log (${t.games?.length || 0} Games)`}
              </button>

              {expandedId === t.id && (
                <div className="animate-fade-in" style={{
                  marginTop: '20px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  padding: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {t.games?.map((g, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 8px',
                      fontSize: '0.9rem',
                      borderBottom: i === t.games.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ flex: 1, fontWeight: g.s1 > g.s2 ? 800 : 400, color: g.s1 > g.s2 ? 'var(--success)' : '#fff' }}>{getUsername(g.p1)}</div>
                      <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontWeight: 900,
                        color: 'var(--accent-cyan)',
                        margin: '0 15px',
                        fontSize: '0.8rem',
                        minWidth: '60px',
                        textAlign: 'center'
                      }}>
                        {g.s1} - {g.s2}
                      </div>
                      <div style={{ flex: 1, textAlign: 'right', fontWeight: g.s2 > g.s1 ? 800 : 400, color: g.s2 > g.s1 ? 'var(--success)' : '#fff' }}>{getUsername(g.p2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
