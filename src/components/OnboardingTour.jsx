import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to Elite Arrows',
    description: 'Your personal darts league management system. This quick tour will show you the key features to get you started.',
    icon: 'dart'
  },
  {
    title: 'View League Tables',
    description: 'Check out the league standings across all divisions. See where you and other players rank in real-time.',
    icon: 'table'
  },
  {
    title: 'Track Your Stats',
    description: 'Your 3-dart average and win rate are automatically tracked. Update your profile to record your dart counter average.',
    icon: 'stats'
  },
  {
    title: 'Submit Match Results',
    description: 'Record your match results to climb the rankings. Both players can confirm scores for verification.',
    icon: 'result'
  },
  {
    title: 'Join the Community',
    description: 'Subscribe to access chat, tournaments, cups, and rewards. Connect with other league members!',
    icon: 'community'
  }
];

const ICONS = {
  dart: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L12 22M12 2L8 6M12 2L16 6" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  table: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  ),
  stats: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  result: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  community: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
};

export function OnboardingTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('eliteArrowsOnboardingComplete', 'true');
    if (onComplete) onComplete();
  };

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <>
      <div className="onboarding-overlay" onClick={handleSkip} />
      <div className="onboarding-popup">
        <div style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--accent-cyan)' }}>
          {ICONS[step.icon]}
        </div>
        
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        
        <div className="onboarding-steps">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`onboarding-step-indicator ${index === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>
        
        <div className="onboarding-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleSkip}
            >
              Skip
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleNext}
            >
              {currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('eliteArrowsOnboardingComplete');
    const hasUser = localStorage.getItem('eliteArrowsCurrentUser');
    
    if (!completed && hasUser) {
      const userData = JSON.parse(hasUser);
      const createdAt = new Date(userData.createdAt);
      const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceCreation <= 7) {
        setShowOnboarding(true);
      } else {
        setIsComplete(true);
      }
    } else {
      setIsComplete(true);
    }
  }, []);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    setIsComplete(true);
  };

  return { showOnboarding, isComplete, completeOnboarding };
}

export default OnboardingTour;