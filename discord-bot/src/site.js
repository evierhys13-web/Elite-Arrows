// Central map of the Elite Arrows site so the Discord server can mirror every
// page. setup.js uses these for channel topics; index.js uses them for /links.

export const SITE_URL = 'https://elitearrowsapp.web.app'
export const APPLICATIONS_URL = 'https://elite-arrows-applications.vercel.app/'
export const MERCH_URL = 'https://elite-arrows-merch.vercel.app'

// Mirrors src/components/Sidebar.jsx navigation groups, tagged with the site path.
export const SITE_SECTIONS = [
  {
    name: 'Main League',
    items: [
      { label: 'Submit Score', path: '/submit-result' },
      { label: 'Standings', path: '/table' },
      { label: 'Schedule', path: '/match-log' },
      { label: 'Results', path: '/results' }
    ]
  },
  {
    name: 'Compete',
    items: [
      { label: 'Leaderboards', path: '/leaderboards' },
      { label: 'Cups', path: '/cups' },
      { label: 'Tournaments', path: '/tournaments' },
      { label: 'Hall of Fame', path: '/hall-of-fame' },
      { label: 'Player of the Month', path: '/player-of-month' },
      { label: 'Statistics', path: '/statistics' },
      { label: 'Practice Hub', path: '/practice' },
      { label: 'Darts Academy', path: '/training' },
      { label: 'Progress Tracker', path: '/progress-tracker' }
    ]
  },
  {
    name: 'League',
    items: [
      { label: 'League News', path: '/news' },
      { label: 'League Rules', path: '/rules' },
      { label: 'How The League Works', path: '/guide' },
      { label: 'Friendly League', path: '/open-league' },
      { label: 'Daily Challenges', path: '/daily-challenges' },
      { label: 'Players', path: '/players' },
      { label: 'Suggestion Box', path: '/suggestions' },
      { label: 'Giveaways', path: '/giveaways' }
    ]
  },
  {
    name: 'Account',
    items: [
      { label: 'Elite Pass', path: '/subscription' },
      { label: 'My Profile', path: '/profile' },
      { label: 'Notifications', path: '/notifications' },
      { label: 'Settings', path: '/settings' },
      { label: 'Install App', path: '/install' },
      { label: 'Donations', path: '/donations' }
    ]
  },
  {
    name: 'Help',
    items: [
      { label: 'Contact Us', path: '/contact' },
      { label: 'Support', path: '/support' },
      { label: 'Privacy Policy', path: '/privacy-policy' }
    ]
  }
]

// Every Elite Arrows page on the site, for the full /links index.
export const ALL_PAGES = SITE_SECTIONS.flatMap(section =>
  section.items.map(item => ({ ...item, section: section.name }))
)

export function pageUrl(path) {
  return `${SITE_URL}${path}`
}