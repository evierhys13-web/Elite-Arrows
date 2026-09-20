export const SUPPORTED_PAGES = [
  { key: 'home', label: 'Home', group: 'Main', paths: ['/home'] },

  { key: 'table', label: 'League Table', group: 'League & Results', paths: ['/table'] },
  { key: 'results', label: 'Results', group: 'League & Results', paths: ['/results'] },
  { key: 'match-log', label: 'Match Log', group: 'League & Results', paths: ['/match-log'] },
  { key: 'submit-result', label: 'Submit Result', group: 'League & Results', paths: ['/submit-result'] },
  { key: 'statistics', label: 'Statistics', group: 'League & Results', paths: ['/analytics', '/statistics'] },
  { key: 'open-league', label: 'Open League', group: 'League & Results', paths: ['/open-league'] },

  { key: 'cup-fixtures', label: 'Cup Fixtures', group: 'Cups & Tournaments', paths: ['/cup-fixtures'] },
  { key: 'cups', label: 'Cups', group: 'Cups & Tournaments', paths: ['/cups'] },
  { key: 'tournaments', label: 'Tournaments', group: 'Cups & Tournaments', paths: ['/tournaments'] },

  { key: 'training', label: 'Training', group: 'Training & Practice', paths: ['/training'] },
  { key: 'practice', label: 'Practice', group: 'Training & Practice', paths: ['/practice'] },
  { key: 'progress-tracker', label: 'Progress Tracker', group: 'Training & Practice', paths: ['/progress-tracker'] },
  { key: 'challenges', label: 'Challenges', group: 'Training & Practice', paths: ['/challenges'] },
  { key: 'daily-challenges', label: 'Daily Challenges', group: 'Training & Practice', paths: ['/daily-challenges'] },

  { key: 'chat', label: 'Chat', group: 'Social', paths: ['/chat'] },
  { key: 'players', label: 'Players', group: 'Social', paths: ['/players'] },
  { key: 'leaderboards', label: 'Leaderboards', group: 'Social', paths: ['/leaderboards'] },
  { key: 'hall-of-fame', label: 'Hall of Fame', group: 'Social', paths: ['/hall-of-fame'] },
  { key: 'live-match', label: 'Live Match', group: 'Social', paths: ['/live-match'] },
  { key: 'play-online', label: 'Play Online', group: 'Social', paths: ['/play-online'] },

  { key: 'subscription', label: 'Subscription', group: 'Pass & Money', paths: ['/subscription'] },
  { key: 'rewards', label: 'Rewards', group: 'Pass & Money', paths: ['/rewards'] },
  { key: 'donations', label: 'Donations', group: 'Pass & Money', paths: ['/donations'] },
  { key: 'giveaways', label: 'Giveaways', group: 'Pass & Money', paths: ['/giveaways'] },

  { key: 'news', label: 'News', group: 'Info', paths: ['/news'] },
  { key: 'guide', label: 'Guide', group: 'Info', paths: ['/guide'] },
  { key: 'rules', label: 'Rules', group: 'Info', paths: ['/rules'] },
  { key: 'suggestions', label: 'Suggestion Box', group: 'Info', paths: ['/suggestions'] },
  { key: 'contact', label: 'Contact', group: 'Info', paths: ['/contact'] },
  { key: 'support', label: 'Support', group: 'Info', paths: ['/support'] },
  { key: 'privacy-policy', label: 'Privacy Policy', group: 'Info', paths: ['/privacy-policy'] },
  { key: 'install', label: 'Install', group: 'Info', paths: ['/install'] },

  { key: 'profile', label: 'Profile', group: 'Account', paths: ['/profile'] },
  { key: 'settings', label: 'Settings', group: 'Account', paths: ['/settings'] },
  { key: 'notifications', label: 'Notifications', group: 'Account', paths: ['/notifications'] },
  { key: 'delete-account', label: 'Delete Account', group: 'Account', paths: ['/delete-account'] },

  { key: 'admin', label: 'Admin', group: 'Admin', paths: ['/admin'] },
  { key: 'season-management', label: 'Season Management', group: 'Admin', paths: ['/season-management'] },
  { key: 'seed-data', label: 'Seed Data', group: 'Admin', paths: ['/seed-data'] },

  { key: 'auth', label: 'Login / Signup', group: 'Flow', paths: ['/auth'] },
  { key: 'welcome', label: 'Welcome', group: 'Flow', paths: ['/welcome'] }
]

export function matchPageKey(pathname) {
  const p = pathname || '/'
  for (const page of SUPPORTED_PAGES) {
    for (const prefix of page.paths) {
      if (p === prefix || p.startsWith(prefix + '/')) return page.key
    }
  }
  return null
}

export const PAGE_BACKGROUND_GROUPS = ['Main', 'League & Results', 'Cups & Tournaments', 'Training & Practice', 'Social', 'Pass & Money', 'Info', 'Account', 'Admin', 'Flow']