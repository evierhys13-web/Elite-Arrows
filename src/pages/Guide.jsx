import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Guide() {
  const [activeSection, setActiveSection] = useState('getting-started')

  const sections = [
    { id: 'getting-started', label: 'Getting Started', icon: '🎯' },
    { id: 'subscription', label: 'Subscription', icon: '⭐' },
    { id: 'fixtures', label: 'Fixtures', icon: '📅' },
    { id: 'results', label: 'Results', icon: '🏆' },
    { id: 'cups', label: 'Cups & Tournaments', icon: '🎯' },
    { id: 'league', label: 'League Games', icon: '📊' },
    { id: 'tokens', label: 'Tokens & Rewards', icon: '💰' },
    { id: 'profile', label: 'Profile & Stats', icon: '👤' }
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Elite Arrows Guide</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
          Everything you need to know about using Elite Arrows
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ 
          minWidth: '200px',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '15px',
          height: 'fit-content'
        }}>
          <h4 style={{ marginBottom: '10px', color: 'var(--accent-cyan)' }}>Quick Links</h4>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                marginBottom: '5px',
                background: activeSection === section.id ? 'var(--accent-cyan)' : 'transparent',
                color: activeSection === section.id ? '#000' : 'var(--text)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {section.icon} {section.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          
          {activeSection === 'getting-started' && (
            <div className="card">
              <h2 className="card-title">🎯 Getting Started</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Welcome to Elite Arrows!</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Elite Arrows is your personal darts league management app. Track your stats, 
                  compete in leagues, enter tournaments, and climb the leaderboards!
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Your First Steps</h4>
                <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li><strong>Set up your profile</strong> - Add your details and profile picture</li>
                  <li><strong>Get assigned to a division</strong> - Admins will place you in the appropriate league division</li>
                  <li><strong>Subscribe for full access</strong> - Unlock all features with Elite Arrows Pass</li>
                  <li><strong>Start playing!</strong> - Create fixtures, submit results, and earn tokens</li>
                </ol>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Navigation</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Use the sidebar on the left to navigate between different sections of the app.
                  On mobile, tap the hamburger menu (☰) to open navigation.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'subscription' && (
            <div className="card">
              <h2 className="card-title">⭐ Elite Arrows Pass</h2>
              
              <div style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, #f5af19, #f12711)', borderRadius: '12px', textAlign: 'center' }}>
                <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>Upgrade to Elite Arrows Pass</h3>
                <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '15px' }}>
                  Unlock all features and compete in the full league experience!
                </p>
                <Link to="/subscription" className="btn btn-primary" style={{ background: '#fff', color: '#f12711' }}>
                  View Plans
                </Link>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Free Tier (Basic)</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>✓ View leaderboards and stats</li>
                  <li>✓ View other players' profiles</li>
                  <li>✓ Basic chat access</li>
                  <li>✗ Cannot create fixtures</li>
                  <li>✗ Cannot submit results</li>
                  <li>✗ Cannot join cups/tournaments</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Elite Arrows Pass (Full Access)</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>✓ Create and manage fixtures</li>
                  <li>✓ Submit game results</li>
                  <li>✓ Participate in league games</li>
                  <li>✓ Enter cup tournaments</li>
                  <li>✓ Earn tokens and rewards</li>
                  <li>✓ Access to games and challenges</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'fixtures' && (
            <div className="card">
              <h2 className="card-title">📅 Fixtures</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>What are Fixtures?</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Fixtures are scheduled matches between you and other players. You can create 
                  Friendly or League fixtures and invite opponents to play.
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Creating a Fixture</h4>
                <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Go to <strong>Fixtures</strong> page</li>
                  <li>Click <strong>+ Create Fixture</strong></li>
                  <li>Select game type (Friendly or League)</li>
                  <li>Choose your opponent</li>
                  <li>Pick a date and time</li>
                  <li>Click <strong>Send Challenge</strong></li>
                </ol>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Fixture Tabs</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>My Fixtures</strong> - All your fixtures in one place</li>
                  <li><strong>Upcoming</strong> - Accepted fixtures ready to play</li>
                  <li><strong>Pending</strong> - Incoming challenges awaiting your response</li>
                  <li><strong>Sent</strong> - Challenges you've sent to others</li>
                  <li><strong>Cup Fixtures</strong> - Your cup tournament matches</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
                <h4 style={{ color: 'var(--success)' }}>💡 Pro Tip</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  After accepting a fixture, click "Submit Result" to record your game and earn tokens!
                </p>
              </div>
            </div>
          )}

          {activeSection === 'results' && (
            <div className="card">
              <h2 className="card-title">🏆 Results</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Submitting Results</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  After playing a match, submit your result through the app. Results are sent to 
                  admins for approval before being added to the leaderboard.
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>How to Submit</h4>
                <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Go to <strong>Fixtures</strong> page</li>
                  <li>Find your accepted fixture in <strong>Upcoming</strong></li>
                  <li>Click <strong>Submit Result</strong></li>
                  <li>Enter legs won for both players</li>
                  <li>Add optional stats (180s, checkout %, high score)</li>
                  <li>For League games: upload proof screenshot</li>
                  <li>Click <strong>Submit for Approval</strong></li>
                </ol>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Result Status</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>Pending</strong> - Awaiting admin approval</li>
                  <li><strong>Approved</strong> - Added to records and stats</li>
                  <li><strong>Rejected</strong> - Admin denied (you'll be notified)</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'cups' && (
            <div className="card">
              <h2 className="card-title">🎯 Cups & Tournaments</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>What are Cups?</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Cup tournaments are knockout competitions where players compete to win the prize pot.
                  Admins create cups with entry fees, and players are randomly placed in a bracket.
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Cup Format</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>Entry Fee</strong> - Paid to enter the tournament</li>
                  <li><strong>Prize Pot</strong> - Total of all entry fees (goes to winner)</li>
                  <li><strong>Rounds</strong> - Knockout rounds (Round 1 → Final)</li>
                  <li><strong>Format</strong> - Starting score and best of legs per round</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>How Cup Fixtures Work</h4>
                <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Admin creates a cup and selects players</li>
                  <li>Fixtures appear in your <strong>Cup Fixtures</strong> tab</li>
                  <li><strong>Propose a date/time</strong> for your match</li>
                  <li>Opponent accepts or counters your proposal</li>
                  <li>Once accepted, <strong>Submit Result</strong> after playing</li>
                  <li>Winner advances to the next round</li>
                </ol>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', borderLeft: '4px solid #ffc107' }}>
                <h4 style={{ color: '#ffc107' }}>⏳ Scheduling</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  If your opponent proposes a time you can't make, use the <strong>Counter</strong> 
                  button to suggest an alternative date.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'league' && (
            <div className="card">
              <h2 className="card-title">📊 League Games</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>About League Games</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  League games are competitive matches played within your division. Each player 
                  plays one match against every other player in their division per season.
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>League Rules</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Best of 8 legs (First to 5 to win)</li>
                  <li>You can only play each opponent once per season</li>
                  <li>Proof screenshot required when submitting</li>
                  <li>Results affect your league table position</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Division System</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Players are grouped into divisions (Division 1, 2, 3, etc.). Top performers 
                  get promoted to higher divisions, while lower performers get relegated.
                </p>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                <h4 style={{ color: '#ef4444' }}>⚠️ Important</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  You must upload a screenshot as proof for all League game results. 
                  This helps prevent disputes and ensures fair competition.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'tokens' && (
            <div className="card">
              <h2 className="card-title">💰 Tokens & Rewards</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>What are Tokens?</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Tokens are earned by winning games and can be spent in the Rewards shop 
                  on various perks and prizes.
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Earning Tokens</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>+50 tokens</strong> - Win any game</li>
                  <li><strong>+100 tokens</strong> - Win a League match</li>
                  <li><strong>+200 tokens</strong> - Win a Cup tournament</li>
                  <li><strong>Bonus tokens</strong> - Achievements and milestones</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Rewards Shop</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Visit the <Link to="/rewards" style={{ color: 'var(--accent-cyan)' }}>Rewards</Link> page 
                  to spend your tokens on:
                </p>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Custom profile badges</li>
                  <li>Profile customizations</li>
                  <li>Special achievements</li>
                  <li>Premium features (coming soon)</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Leaderboards</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Check the <Link to="/leaderboards" style={{ color: 'var(--accent-cyan)' }}>Leaderboards</Link> 
                  to see who's earned the most tokens!
                </p>
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="card">
              <h2 className="card-title">👤 Profile & Stats</h2>
              
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Your Profile</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Your profile shows your stats, division, achievements, and game history. 
                  Other players can view your profile to see how you stack up!
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Profile Stats</h4>
                <ul style={{ color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>Win Rate</strong> - Percentage of games won</li>
                  <li><strong>180s</strong> - Maximum scores hit</li>
                  <li><strong>High Checkout</strong> - Highest score finished on</li>
                  <li><strong>Double %</strong> - Success rate on double finishes</li>
                  <li><strong>Form</strong> - Recent match results</li>
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Updating Your Profile</h4>
                <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                  <li>Go to <strong>Settings</strong> page</li>
                  <li>Update your username, bio, or profile picture</li>
                  <li>Changes save automatically</li>
                </ol>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ color: 'var(--accent-cyan)' }}>Game History</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Visit <Link to="/match-log" style={{ color: 'var(--accent-cyan)' }}>Match Log</Link> 
                  to see your complete game history and detailed stats!
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
