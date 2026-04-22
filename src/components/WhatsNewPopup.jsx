import React, { useState, useEffect } from 'react';

const CHANGELOG = [
  {
    version: '2.1.0',
    date: 'April 2026',
    changes: [
      { type: 'feature', title: 'Interactive Onboarding Tour', description: 'New users get a guided tour of the app on first login' },
      { type: 'feature', title: 'What\'s New Popup', description: 'Stay updated with the latest features and improvements' },
      { type: 'feature', title: 'Skeleton Loading States', description: 'Beautiful loading animations while data loads' },
      { type: 'feature', title: 'Entrance Animations', description: 'Smooth animations when navigating between pages' }
    ]
  },
  {
    version: '2.0.0',
    date: 'March 2026',
    changes: [
      { type: 'improvement', title: 'Redesigned UI', description: 'Fresh new look with dark mode by default' },
      { type: 'feature', title: 'Push Notifications', description: 'Get notified about match updates and league news' },
      { type: 'feature', title: 'Elite Tokens', description: 'New rewards currency system' }
    ]
  }
];

const ICONS = {
  feature: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  improvement: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  bugfix: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
};

export function WhatsNewPopup({ isOpen, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('eliteArrowsLastVersionSeen', CHANGELOG[0].version);
    }
    if (onClose) onClose();
  };

  return (
    <>
      <div className="onboarding-overlay" onClick={handleClose} />
      <div className="whats-new-popup">
        <button 
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        
        <h2>
          What's New
          <span className="whats-new-version">v{CHANGELOG[0].version}</span>
        </h2>
        
        {CHANGELOG.map((release) => (
          <div key={release.version} style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '12px',
              color: 'var(--accent-primary)'
            }}>
              <span style={{ fontWeight: '600' }}>v{release.version}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{release.date}</span>
            </div>
            
            {release.changes.map((change, index) => (
              <div key={index} className="whats-new-item">
                <div className="whats-new-icon">
                  {ICONS[change.type]}
                </div>
                <div className="whats-new-content">
                  <h4>{change.title}</h4>
                  <p>{change.description}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)'
        }}>
          <label className="checkbox-group" style={{ fontSize: '0.9rem' }}>
            <input 
              type="checkbox" 
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don't show again</span>
          </label>
          
          <button className="btn btn-primary" onClick={handleClose}>
            Got it!
          </button>
        </div>
      </div>
    </>
  );
}

export function useWhatsNew() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem('eliteArrowsLastVersionSeen');
    const currentVersion = CHANGELOG[0].version;
    
    if (!lastSeen) {
      const hasUser = localStorage.getItem('eliteArrowsCurrentUser');
      if (hasUser) {
        setShowWhatsNew(true);
      }
    }
  }, []);

  return { showWhatsNew };
}

export default WhatsNewPopup;