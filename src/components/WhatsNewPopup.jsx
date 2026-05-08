import React, { useState, useEffect } from 'react';

const CHANGELOG = [
  {
    version: '2.2.0',
    date: 'May 2026',
    changes: [
      { type: 'feature', title: 'League Analytics', description: 'Deep dive into division performance with real-time scoring charts and distribution data.' },
      { type: 'feature', title: 'Match Proposals', description: 'Challenge other players directly from their profiles with specific dates and times.' },
      { type: 'feature', title: 'Division Filters', description: 'Easily find and connect with players in your own division or scout others.' },
      { type: 'improvement', title: 'Season Management', description: 'Centralized active season control and better tools for league admins.' }
    ]
  },
  {
    version: '2.1.0',
    date: 'April 2026',
    changes: [
      { type: 'feature', title: 'Interactive Onboarding Tour', description: 'New users get a guided tour of the app on first login' },
      { type: 'feature', title: 'What\'s New Popup', description: 'Stay updated with the latest features and improvements' },
      { type: 'feature', title: 'Skeleton Loading States', description: 'Beautiful loading animations while data loads' },
      { type: 'feature', title: 'Entrance Animations', description: 'Smooth animations when navigating between pages' }
    ]
  }
];

const ICONS = {
  feature: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  improvement: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
};

export function WhatsNewPopup({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleClose = () => {
    localStorage.setItem('eliteArrowsLastVersionSeen', CHANGELOG[0].version);
    if (onClose) onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }}>
      <div className="modal-content glass animate-slide-up" style={{ maxWidth: '480px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'var(--success-bg)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--success)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h2 className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>What's New</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>May 2026 Update • v{CHANGELOG[0].version}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
          {CHANGELOG[0].changes.map((change, index) => (
            <div key={index} style={{ display: 'flex', gap: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: change.type === 'feature' ? 'var(--accent-cyan)' : 'var(--accent-primary)',
                flexShrink: 0
              }}>
                {ICONS[change.type]}
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '4px', color: 'white' }}>{change.title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{change.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-block" style={{ height: '54px', fontSize: '1rem' }} onClick={handleClose}>
          Awesome, Let's Go!
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

export function useWhatsNew() {
  const checkShouldShow = () => {
    const lastSeen = localStorage.getItem('eliteArrowsLastVersionSeen');
    const hasUser = localStorage.getItem('eliteArrowsCurrentUser');
    return hasUser && lastSeen !== CHANGELOG[0].version;
  };
  
  const [showWhatsNew, setShowWhatsNew] = useState(checkShouldShow);

  useEffect(() => {
    setShowWhatsNew(checkShouldShow());
  }, []);

  return { showWhatsNew, refreshWhatsNew: () => setShowWhatsNew(true) };
}

export default WhatsNewPopup;
