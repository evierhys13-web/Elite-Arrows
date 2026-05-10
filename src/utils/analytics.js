import { analytics, logEvent } from '../firebase';

/**
 * Logs a match approval event to Firebase Analytics.
 * @param {Object} match - The match result object.
 */
export const logMatchApproved = (match) => {
  if (!analytics) return;

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
  if (!analytics) return;

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
  if (!analytics) return;

  logEvent(analytics, 'page_view', {
    page_name: pageName
  });
};
