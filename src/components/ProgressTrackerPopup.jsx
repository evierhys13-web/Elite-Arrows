import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function ProgressTrackerPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hasSeen = localStorage.getItem('eliteArrowsProgressTrackerPopupSeen');
    const hasUser = localStorage.getItem('eliteArrowsCurrentUser');

    // Only show for logged in users who haven't seen it yet
    if (hasUser && hasSeen !== 'true') {
      // Delay slightly for better UX after login/load
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('eliteArrowsProgressTrackerPopupSeen', 'true');
    setIsOpen(false);
  };

  const handleGoToTracker = () => {
    localStorage.setItem('eliteArrowsProgressTrackerPopupSeen', 'true');
    setIsOpen(false);
    navigate('/progress-tracker');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 11001 }}>
      <div className="modal-content glass animate-slide-up" style={{ maxWidth: '420px', padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: '72px',
          height: '72px',
          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-primary))',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: 'white',
          boxShadow: '0 8px 24px rgba(0, 212, 255, 0.3)'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        </div>

        <h2 className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px' }}>New Feature!</h2>
        <h3 style={{ fontSize: '1.2rem', color: 'white', marginBottom: '16px' }}>Individual Progress Tracker</h3>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '32px' }}>
          You can now track your daily, weekly, or session-based performance with our new private progress tracker and visualize your improvement with interactive graphs!
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          <button className="btn btn-primary btn-block" style={{ height: '54px', fontSize: '1rem' }} onClick={handleGoToTracker}>
            Open Progress Tracker
          </button>
          <button className="btn btn-secondary btn-block" style={{ height: '48px', fontSize: '0.9rem' }} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProgressTrackerPopup;
