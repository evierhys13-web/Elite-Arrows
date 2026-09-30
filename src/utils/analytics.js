import { initAnalytics, initPerformance, setAnalyticsConsent as consentViaSdk, fireAnalyticsEvent, safeTrace, getAnalyticsRef } from '../firebaseAnalytics';

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
export const grantAnalyticsConsent = async () => {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
    await consentViaSdk({ analytics_storage: 'granted', ad_storage: 'denied' });
    await initAnalytics();
    await initPerformance();
  } catch (e) {
    console.warn('Failed to enable analytics:', e.message);
  }
};

/**
 * Perform this when the user rejects cookies/analytics.
 * Consent stays denied and analytics is never initialised on this device.
 */
export const denyAnalyticsConsent = async () => {
  try {
    localStorage.setItem(CONSENT_KEY, 'denied');
    await consentViaSdk({ analytics_storage: 'denied', ad_storage: 'denied' });
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
export const startTrace = (traceName) => safeTrace(traceName);

const hasAnalytics = () => Boolean(getAnalyticsRef() && hasAnalyticsConsent());

/**
 * Logs a match approval event to Firebase Analytics.
 * @param {Object} match - The match result object.
 */
export const logMatchApproved = (match) => {
  if (!hasAnalytics()) return;

  fireAnalyticsEvent('match_approved', {
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
  if (!hasAnalytics()) return;

  fireAnalyticsEvent('subscription_activated', {
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
  if (!hasAnalytics()) return;

  fireAnalyticsEvent('page_view', {
    page_name: pageName
  });
};

/**
 * Logs a result submission event.
 */
export const logResultSubmitted = (gameType, division) => {
  if (!hasAnalytics()) return;
  fireAnalyticsEvent('result_submitted', {
    game_type: gameType,
    division: division,
    timestamp: new Date().toISOString()
  });
};

/**
 * Logs a user login event.
 */
export const logUserLogin = (userId) => {
  if (!hasAnalytics()) return;
  fireAnalyticsEvent('login', {
    user_id: userId,
    method: 'email'
  });
};

/**
 * Logs a custom "listen_start" event to Firebase Analytics.
 * @param {string} trackName - Name of the track (default: "Elite Arrows Intro")
 * @param {string} genre - Category / Genre (default: "Sports")
 * @param {number} durationSeconds - Duration in seconds (default: 180)
 */
export const logListenStart = (
  trackName = 'Elite Arrows Intro',
  genre = 'Sports',
  durationSeconds = 180
) => {
  if (!hasAnalytics()) return;

  fireAnalyticsEvent('listen_start', {
    track_name: trackName,
    genre: genre,
    duration_seconds: durationSeconds
  });
};

