import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, collection, getDocs, addDoc, updateDoc, increment, arrayUnion } from '../firebase'
import { useToast } from '../context/ToastContext'
import Breadcrumbs from '../components/Breadcrumbs'

const CATEGORIES = [
  { id: 'improvement', label: 'Improvement', icon: '🔧' },
  { id: 'feature', label: 'New Feature', icon: '✨' },
  { id: 'rule', label: 'Rule Change', icon: '📜' },
  { id: 'event', label: 'Event Idea', icon: '🎉' },
  { id: 'other', label: 'Other', icon: '💬' },
]

const STATUS_META = {
  open: { label: 'Open', color: 'var(--accent-cyan)' },
  'in progress': { label: 'In Progress', color: 'var(--warning)' },
  planned: { label: 'Planned', color: 'var(--accent-primary)' },
  added: { label: 'Added', color: 'var(--success)' },
  declined: { label: 'Declined', color: 'var(--error)' },
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in progress', label: 'In Progress' },
  { id: 'planned', label: 'Planned' },
  { id: 'added', label: 'Added' },
  { id: 'declined', label: 'Declined' },
]

export default function Suggestions() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [form, setForm] = useState({ category: 'improvement', title: '', message: '' })
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('all')

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'suggestions'))
      setSuggestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) {
      console.error('Failed to load suggestions', e)
      showToast('Failed to load suggestions', 'error')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const votedIds = (user?.id && suggestions.filter(s => (s.voters || []).includes(String(user.id))).map(s => s.id)) || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) {
      showToast('Please add a title and some details', 'error')
      return
    }
    setSubmitting(true)
    try {
      const entry = {
        category: form.category,
        title: form.title.trim(),
        message: form.message.trim(),
        userId: user?.id || '',
        username: user?.username || 'Unknown',
        votes: 0,
        voters: [],
        status: 'open',
        createdAt: new Date().toISOString()
      }
      await addDoc(collection(db, 'suggestions'), entry)
      showToast('Suggestion submitted!', 'success')
      setForm({ category: 'improvement', title: '', message: '' })
      fetchSuggestions()
    } catch (err) {
      console.error(err)
      showToast('Failed to submit suggestion', 'error')
    }
    setSubmitting(false)
  }

  const handleVote = async (s) => {
    if (!user?.id) return
    if (votedIds.includes(s.id)) return
    try {
      await updateDoc(doc(db, 'suggestions', s.id), {
        votes: increment(1),
        voters: arrayUnion(user.id)
      })
      setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, votes: (Number(x.votes) || 0) + 1, voters: [...(x.voters || []), String(user.id)] } : x))
      showToast('Vote added!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Could not vote', 'error')
    }
  }

  const filtered = suggestions
    .filter(s => filter === 'all' || String(s.status || 'open') === filter)
    .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const totalVotes = suggestions.reduce((sum, s) => sum + (Number(s.votes) || 0), 0)

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Suggestion Box', path: '/suggestions' }]} />

      <div className="page-header">
        <h1 className="page-title text-gradient">💡 Suggestion Box</h1>
        <p style={{ color: 'var(--text-muted)' }}>Got an idea to make the league better? Suggest it here, and upvote ideas you want to see.</p>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="glass" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{suggestions.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ideas Submitted</div>
          </div>
          <div className="glass" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--warning)' }}>{totalVotes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Votes</div>
          </div>
          <div className="glass" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success)' }}>{suggestions.filter(s => String(s.status || 'open') === 'added').length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Added</div>
          </div>
        </div>

        <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '16px' }}>Submit an Idea</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label>Category</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setForm({ ...form, category: c.id })}
                  className={`btn btn-sm ${form.category === c.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, minWidth: '110px' }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label>Title</label>
            <input
              type="text"
              className="glass"
              placeholder="Short headline, e.g. 'Add a doubles league'"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              maxLength={80}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Details</label>
            <textarea
              className="glass"
              rows={4}
              placeholder="Explain your idea in a few sentences..."
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              maxLength={600}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Submitting...' : '🚀 Submit Suggestion'}
          </button>
        </form>
      </div>

      <div className="card glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--accent-cyan)', margin: 0 }}>Suggestion Board</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No suggestions here yet. Be the first to share an idea!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(s => {
              const status = STATUS_META[String(s.status || 'open')] || STATUS_META.open
              const cat = CATEGORIES.find(c => c.id === s.category) || CATEGORIES[CATEGORIES.length - 1]
              const voted = votedIds.includes(s.id)
              const isMine = user?.id && String(s.userId) === String(user.id)
              return (
                <div key={s.id} className="glass" style={{ padding: '16px', borderRadius: '14px', border: isMine ? '1px solid var(--accent-cyan)' : '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => handleVote(s)}
                      disabled={voted}
                      title={voted ? 'You voted for this' : 'Upvote this suggestion'}
                      style={{
                        background: voted ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                        color: voted ? '#0a0628' : 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        minWidth: '56px',
                        padding: '10px 8px',
                        cursor: voted ? 'default' : 'pointer',
                        fontWeight: 900,
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ fontSize: '1rem' }}>👍</div>
                      <div>{Number(s.votes) || 0}</div>
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>{s.title}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '8px' }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: status.color, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '8px' }}>{status.label}</span>
                        {isMine && <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>👤 Your idea</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.message}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>by {s.username} • {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}