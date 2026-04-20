import { useAuth } from '../context/AuthContext'

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const formatTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function NewsFeed() {
  const { user, getNews, deleteNews, togglePinNews } = useAuth()
  const news = getNews()
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin

  if (news.length === 0) return null

  const pinned = news.filter(n => n.pinned)
  const unpinned = news.filter(n => !n.pinned)

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
          <path d="M18 2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12z" />
          <line x1="12" y1="6" x2="12" y2="16" />
          <line x1="8" y1="11" x2="16" y2="11" />
        </svg>
        Announcements
      </h2>

      {[...pinned, ...unpinned].map((item) => (
        <div
          key={item.id}
          style={{
            background: item.pinned ? 'rgba(124, 92, 252, 0.08)' : 'var(--bg-card)',
            border: item.pinned ? '1px solid rgba(124, 92, 252, 0.3)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>{item.title}</h3>
                {item.pinned && (
                  <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
                    <PinIcon />
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {item.authorName} &middot; {formatTime(item.createdAt)}
              </p>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => togglePinNews(item.id, item.pinned)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    color: item.pinned ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.75rem'
                  }}
                  title={item.pinned ? 'Unpin' : 'Pin'}
                >
                  <PinIcon />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this announcement?')) {
                      deleteNews(item.id)
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    color: 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.75rem'
                  }}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {item.message}
          </p>
        </div>
      ))}
    </div>
  )
}
