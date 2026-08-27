import NewsFeed from '../components/NewsFeed'
import Breadcrumbs from '../components/Breadcrumbs'

export default function News() {
  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[
        { label: 'Home', path: '/home' },
        { label: 'League News', path: '/news' }
      ]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient">League News</h1>
        <p style={{ color: 'var(--text-muted)' }}>Latest announcements and updates from the Elite Arrows community</p>
      </div>

      <div className="news-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <NewsFeed />
      </div>
    </div>
  )
}
