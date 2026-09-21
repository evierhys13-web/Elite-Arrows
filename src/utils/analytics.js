import { analytics, perf, initAnalytics, initPerformance, logEvent, trace, setConsent } from '../firebase';

export const CONSENT_KEY = 'eliteArrowsConsent';

export const hasAnalyticsConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch (e) {
    return false;
  }
};

/**
 * Perform this when the user accepts cookies/analytics.
 * Turns on google-analytics storage + initialises the SDK, so events only
 * arrive after explicit consent.
 */
export const grantAnalyticsConsent = () => {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
    setConsent({ analytics_storage: 'granted', ad_storage: 'denied' });
    initAnalytics();
    initPerformance();
  } catch (e) {
    console.warn('Failed to enable analytics:', e.message);
  }
};

/**
 * Perform this when the user rejects cookies/analytics.
 * Consent stays denied and analytics is never initialised on this device.
 */
export const denyAnalyticsConsent = () => {
  try {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setConsent({ analytics_storage: 'denied', ad_storage: 'denied' });
  } catch (e) {}
};

/** @deprecated Use grantAnalyticsConsent/denyAnalyticsConsent. */
export const setAnalyticsConsent = (granted) => {
  if (granted) grantAnalyticsConsent();
  else denyAnalyticsConsent();
};

/**
 * Creates and starts a Firebase Performance trace.
 * Returns a stop function — call it when the operation completes.
 * Usage:
 *   const stop = startTrace('fetch_results_by_season')
 *   await doSomething()
 *   stop()
 */
export const startTrace = (traceName) => {
  if (!perf) return () => {};
  try {
    const t = trace(perf, traceName);
    t.start();
    return (attributes = {}) => {
      try {
        Object.entries(attributes).forEach(([key, value]) => {
          t.putAttribute(key, String(value));
        });
        t.stop();
      } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
};

/**
 * Logs a match approval event to Firebase Analytics.
 * @param {Object} match - The match result object.
 */
export const logMatchApproved = (match) => {
  if (!analytics || !hasAnalyticsConsent()) return;

  logEvent(analytics, 'match_approved', {
    match_id: match.id,
    player1: match.player1,
    player2: match.player2,
    score: `${match.score1}-${match.score2}`,
    division: match.division,
    game_type: match.gameType,
    season: match.season,
    approved_at: new Date().toISOString()
  });
};

/**
 * Logs a subscription activation event.
 * @param {string} userId - The user ID.
 * @param {string} tier - The subscription tier (standard/premium).
 */
export const logSubscriptionActivated = (userId, tier) => {
  if (!analytics || !hasAnalyticsConsent()) return;

  logEvent(analytics, 'subscription_activated', {
    user_id: userId,
    tier: tier,
    timestamp: new Date().toISOString()
  });
};

/**
 * Logs a page view event (optional, as Firebase usually handles this,
 * but useful for custom tracking).
 */
export const logPageView = (pageName) => {
  if (!analytics || !hasAnalyticsConsent()) return;

  logEvent(analytics, 'page_view', {
    page_name: pageName
  });
};

/**
 * Logs a result submission event.
 */
export const logResultSubmitted = (gameType, division) => {
  if (!analytics || !hasAnalyticsConsent()) return;
  logEvent(analytics, 'result_submitted', {
    game_type: gameType,
    division: division,
    timestamp: new Date().toISOString()
  });
};

/**
 * Logs a user login event.
 */
export const logUserLogin = (userId) => {
  if (!analytics || !hasAnalyticsConsent()) return;
  logEvent(analytics, 'login', {
    user_id: userId,
    method: 'email'
  });
};
