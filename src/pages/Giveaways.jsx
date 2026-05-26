import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, getDocs, collection, deleteDoc, updateDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function Giveaways() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [giveaways, setGiveaways] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [newGiveaway, setNewGiveaway] = useState({ title: '', description: '', steps: '', drawDate: '' })

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  }, [user])

  useEffect(() => {
    fetchGiveaways()
    if (isAdmin) {
       const fetchAllData = async () => {
         try {
           const [usersSnap, subSnap, chalSnap] = await Promise.all([
             getDocs(collection(db, 'users')),
             getDocs(collection(db, 'challengeSubmissions')),
             getDocs(collection(db, 'challenges'))
           ])

           const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
           const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
           const activeChals = chalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => !c._deleted)

           const enteredUsers = users.filter(u => {
             const userApprovedSubChallengeIds = new Set(
               subs.filter(s => s.userId === u.id && s.status === 'approved').map(s => s.challengeId)
             )
             return activeChals.length > 0 && userApprovedSubChallengeIds.size >= activeChals.length
           })

           setEntries(enteredUsers)
         } catch (e) { console.error(e) }
       }
       fetchAllData()
    }
  }, [isAdmin])

  const fetchGiveaways = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'giveaways'))
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setGiveaways(data.filter(g => !g._deleted))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleCreateGiveaway = async () => {
    if (!newGiveaway.title || !newGiveaway.description) {
      showToast('Title and Description are required', 'error')
      return
    }
    try {
      const id = Date.now().toString()
      const giveaway = {
        ...newGiveaway,
        id,
        isActive: true,
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'giveaways', id), giveaway)
      setGiveaways([...giveaways, giveaway])
      setShowCreateModal(false)
      setNewGiveaway({ title: '', description: '', steps: '', drawDate: '' })
      showToast('Giveaway posted!', 'success')
    } catch (e) {
      showToast('Error creating giveaway: ' + e.message, 'error')
    }
  }

  const handleDeleteGiveaway = async (id) => {
    if (!window.confirm('Delete this giveaway?')) return
    await updateDoc(doc(db, 'giveaways', id), { _deleted: true })
    setGiveaways(giveaways.filter(g => g.id !== id))
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Giveaways', path: '/giveaways' }]} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title text-gradient">Giveaways</h1>
          <p style={{ color: 'var(--text-muted)' }}>Exclusive rewards for the community!</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Create Giveaway</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {giveaways.length === 0 && !loading && (
          <div className="card glass" style={{ textAlign: 'center', padding: '60px' }}>
             <p style={{ color: 'var(--text-muted)' }}>No active giveaways at the moment. Check back soon!</p>
          </div>
        )}

        {giveaways.map(g => (
          <div key={g.id} className="card glass" style={{ overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))', padding: '2px' }}>
              <div className="glass" style={{ padding: '24px', borderRadius: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h2 className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 900 }}>{g.title}</h2>
                  {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteGiveaway(g.id)}>🗑️</button>}
                </div>

                <p style={{ margin: '20px 0', fontSize: '1.1rem', lineHeight: '1.6' }}>{g.description}</p>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--accent-cyan)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Steps to Enter:</h3>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>
                    {g.steps}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 800 }}>
                    <span>🗓️ Draw Date:</span>
                    <span>{g.drawDate || 'To be announced'}</span>
                  </div>
                  <div className="admin-badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && entries.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2 className="card-title">Christmas Draw Entries ({entries.length})</h2>
          <div className="card glass">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {entries.map(e => (
                <div key={e.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{e.username}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.division || 'Member'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="card glass" style={{ maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 className="card-title">New Giveaway</h3>
            <div className="form-group">
              <label>Giveaway Name</label>
              <input value={newGiveaway.title} onChange={e => setNewGiveaway({...newGiveaway, title: e.target.value})} placeholder="e.g. Christmas 2026 Mega Draw" />
            </div>
            <div className="form-group">
              <label>Prize/Description</label>
              <textarea value={newGiveaway.description} onChange={e => setNewGiveaway({...newGiveaway, description: e.target.value})} rows={3} placeholder="What can people win?" />
            </div>
            <div className="form-group">
              <label>Steps to Enter (One per line)</label>
              <textarea value={newGiveaway.steps} onChange={e => setNewGiveaway({...newGiveaway, steps: e.target.value})} rows={5} placeholder="1. Complete the 'Hit a 180' challenge&#10;2. Have an active Elite Pass&#10;3. Join the WhatsApp community" />
            </div>
            <div className="form-group">
              <label>Draw Date</label>
              <input type="text" value={newGiveaway.drawDate} onChange={e => setNewGiveaway({...newGiveaway, drawDate: e.target.value})} placeholder="e.g. Dec 25th, 2026" />
            </div>
            <button className="btn btn-primary btn-block" onClick={handleCreateGiveaway}>Launch Giveaway</button>
          </div>
        </div>
      )}
    </div>
  )
}
