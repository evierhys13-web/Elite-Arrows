import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

const chapterStyles = {
  marginTop: '20px',
  padding: '16px',
  background: 'var(--bg-secondary)',
  borderRadius: '12px',
}

const WHATSAPP_LINK = 'https://chat.whatsapp.com/GNaYyJDxzMADbA1ARI1kne'

export default function Guide() {
  const [activeSection, setActiveSection] = useState('getting-started')
  const [openFaq, setOpenFaq] = useState(null)
  const [readComplete, setReadComplete] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isOnboarding = new URLSearchParams(location.search).get('onboarding') === '1'

  useEffect(() => {
    if (!isOnboarding) return
    const onScroll = () => {
      const doc = document.documentElement
      const reached = window.innerHeight + window.scrollY >= doc.scrollHeight - 80
      setReadComplete(reached)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isOnboarding])

  const finishOnboarding = () => {
    try { localStorage.setItem('eliteArrowsGuideRead', '1') } catch (e) { /* ignore */ }
    navigate('/home')
  }

  const sections = [
    { id: 'getting-started', label: 'The Basics', icon: '🎯' },
    { id: 'season', label: 'A Season in 5 Steps', icon: '🗓️' },
    { id: 'divisions', label: 'Divisions', icon: '🏅' },
    { id: 'scoring', label: 'How Scoring Works', icon: '📊' },
    { id: 'results', label: 'Submitting Results', icon: '📲' },
    { id: 'fairplay', label: 'Fair Play & Rules', icon: '⚖️' },
    { id: 'cups', label: 'Cups & Tournaments', icon: '🏆' },
    { id: 'extras', label: 'More Ways to Play', icon: '🎮' },
    { id: 'pass', label: 'Elite Pass', icon: '⭐' },
    { id: 'faq', label: 'Quick FAQ', icon: '❓' }
  ]

  const steps = [
    {
      icon: '🎯',
      title: 'Join & get placed',
      body: 'Create your account and enter your 3-dart average. That places you in a division that matches your level, so every game is a fair game.',
    },
    {
      icon: '🏅',
      title: 'Meet your division',
      body: 'You play one league match against every other player in your division each season. No dodging, no favourites — everyone gets a shot.',
    },
    {
      icon: '📅',
      title: 'Arrange & play',
      body: 'Use the Home screen schedule or chat to agree a time with your opponent. Pick a format, step up to the oche, and play out the legs.',
    },
    {
      icon: '📲',
      title: 'Submit the result',
      body: 'Add the legs won for both players, attach your proof screenshot, and hit submit. An admin checks it and it becomes official.',
    },
    {
      icon: '📈',
      title: 'Watch the table move',
      body: 'Your legs and match bonuses go straight into the league table. Win your division and you\'re promoted — plus Cups, prizes and Hall of Fame glory.',
    },
  ]

  const faqs = [
    {
      q: 'How do I get placed in a division?',
      a: 'When you register you tell us your 3-dart average. Admins use that (and results over time) to place you in the division that fits your level best. It\'s shown on your profile and in the league table.',
    },
    {
      q: 'How many games do I play per season?',
      a: 'One league match against every other player in your division, every season. Cup and friendly matches are separate and are added on top.',
    },
    {
      q: 'What if my opponent never arranges the game?',
      a: 'If a match isn\'t played, nobody wins points — unless you can show you tried to arrange it. Then you get the win and they take the loss. Evidence wins arguments.',
    },
    {
      q: 'What if I can\'t play enough games?',
      a: 'If you don\'t complete the minimum number of league fixtures for your division size, all of your results are voided. So get those games played.',
    },
    {
      q: 'Why do I need to upload proof?',
      a: 'Every league result needs a screenshot as proof. It keeps the competition fair, stops disputes, and helps admins approve results quickly.',
    },
    {
      q: 'What does "result sent" mean?',
      a: 'Your result is waiting for admin approval. Once approved it lands in the records and your stats; if it\'s rejected you can submit the corrected result.',
    },
    {
      q: 'How are cups different from the league?',
      a: 'Cups are knockout tournaments. You pay an entry fee which goes into the prize pot, win your tie to advance through the rounds, and the last player standing takes the pot.',
    },
    {
      q: 'What is the Elite Arrows Pass?',
      a: 'It\'s the full-access subscription. Free members can browse and chat; Pass members can submit results, play league games, enter cups and use almost every feature in the app.',
    },
  ]

  const sectionCards = {
    'getting-started': (
      <div className="card">
        <h2 className="card-title">🎯 The Basics</h2>

        <div style={{ marginTop: '20px' }}>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
            Elite Arrows is a full darts league in your pocket. You play real matches against real people,
            results are checked by admins, and everything feeds into your stats, division and league table —
            season after season.
          </p>
        </div>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>Your First 5 Minutes</h4>
          <ol style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li><strong>Create an account</strong> — your email plus a username is all it takes.</li>
            <li><strong>Enter your 3-dart average</strong> — this is how we find your level.</li>
            <li><strong>Build your profile</strong> — photo, nickname, bio, and link your DartCounter stats if you have them.</li>
            <li><strong>Grab the Elite Pass</strong> — free browsing, full access for members (see the Pass chapter).</li>
            <li><strong>Join the chat</strong> — the official WhatsApp group is right on this page. Say hi 👋</li>
          </ol>
        </div>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>Finding Your Way Around</h4>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
            The sidebar keeps things grouped: <strong>Main League</strong> is where you live (Home, Standings, Schedule, Results),
            <strong> Compete</strong> covers leaderboards, cups and tournaments, <strong>League</strong> is news, rules and the community.
            On mobile, tap the ☰ menu to open it.
          </p>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
          <h4 style={{ color: 'var(--success)' }}>💡 The Golden Rule</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Play your league games, upload proof, and submit results quickly. Every win, draw and leg pushes you up the table — so never leave a result sitting.
          </p>
        </div>
      </div>
    ),

    'season': (
      <div className="card">
        <h2 className="card-title">🗓️ A Season in 5 Steps</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Every season follows the same rhythm. Here's the whole journey, start to finish.
        </p>
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {steps.map((step, i) => (
            <div key={step.title} className="glass" style={{ padding: '16px 18px', borderRadius: '14px', display: 'flex', gap: '16px', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '44px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,212,255,0.15)', border: '2px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent-cyan)' }}>{i + 1}</div>
                {i < steps.length - 1 && <div style={{ width: '2px', flex: 1, background: 'rgba(0,212,255,0.2)', margin: '4px 0' }} />}
              </div>
              <div style={{ paddingBottom: i < steps.length - 1 ? '6px' : '0' }}>
                <div style={{ fontSize: '1.5rem' }}>{step.icon}</div>
                <h4 style={{ margin: '4px 0 6px', color: 'white' }}>{step.title}</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
          <h4 style={{ color: '#fbbf24' }}>🏁 Why not check your fixtures?</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Head to <Link to="/schedule" style={{ color: 'var(--accent-cyan)' }}>Schedule</Link> to see who you still need to play this season and strike up a game time in chat.
          </p>
        </div>
      </div>
    ),

    'divisions': (
      <div className="card">
        <h2 className="card-title">🏅 Divisions</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Divisions keep matches competitive. You're grouped with players of a similar standard, so every game means something.
        </p>

        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: 'var(--accent-cyan)' }}>The Tiers (top to bottom)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[
              { name: 'Elite', color: '#fbbf24', blurb: 'The very best — title favourites and serious machines.' },
              { name: 'Emerald', color: '#34d399', blurb: 'High-flyers just below the top tier, pushing for promotion.' },
              { name: 'Diamond', color: '#38bdf8', blurb: 'The deep middle of the league — where most rivalries live.' },
              { name: 'Platinum', color: '#a78bfa', blurb: 'Where legends are forged while finding your groove.' },
            ].map(tier => (
              <div key={tier.name} className="glass" style={{ padding: '16px', borderRadius: '14px', display: 'flex', gap: '14px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: '10px', height: '48px', borderRadius: '6px', background: tier.color }} />
                <div>
                  <div style={{ fontWeight: 800, color: tier.color }}>{tier.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>{tier.blurb}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>How It Works</h4>
          <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>Your <strong>3-dart average</strong> decides your starting division.</li>
            <li>League games are played <strong>within your division</strong> — one match per opponent per season.</li>
            <li>Finish top and you'll be <strong>promoted</strong>; drop to the bottom and you risk <strong>relegation</strong>.</li>
            <li>Admins can fine-tune placements, and results over time keep everyone honest.</li>
          </ul>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px' }}>Where's mine?</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Check your division on your <Link to="/profile" style={{ color: 'var(--accent-cyan)' }}>profile</Link>, in the
            <Link to="/leaderboards" style={{ color: 'var(--accent-cyan)' }}> leaderboards</Link>, or on the
            <Link to="/standings" style={{ color: 'var(--accent-cyan)' }}> league table</Link>. Think you've been misplaced? Contact an admin.
          </p>
        </div>
      </div>
    ),

    'scoring': (
      <div className="card">
        <h2 className="card-title">📊 How Scoring Works</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          League games are <strong>best of 8 legs</strong> — first to 5 wins the match. Your points come from two things: the legs you win, plus a match bonus.
        </p>

        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
            <thead>
              <tr>
                {['Result', 'Legs Points', 'Match Bonus', 'Total Points'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px', background: 'var(--bg-secondary)', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { r: '5–3 win', legs: '5 points', bonus: '+3', total: '8' },
                { r: '5–4 win', legs: '5 points', bonus: '+3', total: '8' },
                { r: '4–4 draw', legs: '4 points', bonus: '+1', total: '5' },
                { r: '3–5 loss', legs: '3 points', bonus: '+0', total: '3' },
                { r: '0–5 loss', legs: '0 points', bonus: '+0', total: '0' },
              ].map((row, i) => (
                <tr key={row.r} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px', fontWeight: 700 }}>{row.r}</td>
                  <td style={{ padding: '11px', color: 'var(--text-muted)' }}>{row.legs}</td>
                  <td style={{ padding: '11px', color: 'var(--text-muted)' }}>{row.bonus}</td>
                  <td style={{ padding: '11px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
          <h4 style={{ color: 'var(--success)' }}>💡 The Formula</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Legs won + win bonus (win <strong>+3</strong>, draw <strong>+1</strong>, loss <strong>+0</strong>).
            So even a 3–5 defeat earns you 3 points for your legs — every leg you take counts. Groups and stats are tracked in
            <Link to="/statistics" style={{ color: 'var(--accent-cyan)' }}> Statistics</Link>.
          </p>
        </div>
      </div>
    ),

    'results': (
      <div className="card">
        <h2 className="card-title">📲 Submitting Results</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Finished your match? Don't let it sit there. Results go through a quick admin check so the table always stays fair.
        </p>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>The 3-Step Checkout</h4>
          <ol style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>Open <strong>Submit Score</strong> (or the Submit button on your Schedule).</li>
            <li>Pick the match type (League, Cup, Friendly...), your opponent, and both players' <strong>legs won</strong>.</li>
            <li>Add your <strong>proof screenshot</strong>, any extras (180s, checkout, high score), and hit <strong>Submit for Approval</strong>.</li>
          </ol>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: 'var(--accent-cyan)' }}>What Happens Next?</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
                <strong>Pending</strong> <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.85rem' }}>Waiting for admin approval — your Schedule shows "Result Sent".</span>
              </div>
            </div>
            <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                <strong>Approved</strong> <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.85rem' }}>It's official — into the records, stats and league table.</span>
              </div>
            </div>
            <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <strong>Rejected</strong> <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.85rem' }}>Something's off — the fixture reopens so you can submit the correct result.</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
          <h4 style={{ color: '#ef4444' }}>⚠️ Proof Required</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            League results <strong>must</strong> include a screenshot. No proof, no points — it keeps everyone honest and disputes out of the game.
          </p>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px' }}>Wrong result submitted?</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Don't panic — contact an admin. They can reject a pending result or reset an approved one so you can correct it.
          </p>
        </div>
      </div>
    ),

    'fairplay': (
      <div className="card">
        <h2 className="card-title">⚖️ Fair Play & Rules</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          A few simple rules keep the league friendly, fair and moving forward.
        </p>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>When a Match Doesn't Happen</h4>
          <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>Fixture windows exist for a reason — matches should be arranged and played within them.</li>
            <li>No match, no points <strong>unless</strong> one player can show they tried to arrange it. Then they take the win and the inactive player takes the loss.</li>
            <li>Fall below the minimum games for your division size and <strong>all your results are voided</strong>.</li>
          </ul>
        </div>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>Interrupted Matches</h4>
          <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>Technical glitch or something out of your control? Resume from the <strong>last confirmed score</strong>.</li>
            <li>Opponent refuses to continue or bails on purpose? They lose by <strong>default</strong>.</li>
            <li>Score can't be verified by either side? Replay the match <strong>in full, from 0–0</strong>.</li>
          </ul>
        </div>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>The Spirit of the League</h4>
          <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>One match against each opponent per season — it's a league, not a rivalry rematch.</li>
            <li>Proof screenshots for every league result. Always.</li>
            <li>If in doubt, ask an admin. That's what they're here for.</li>
          </ul>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px' }}>Full rules</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            The complete, official rulebook lives in <Link to="/rules" style={{ color: 'var(--accent-cyan)' }}>League Rules</Link>.
          </p>
        </div>
      </div>
    ),

    'cups': (
      <div className="card">
        <h2 className="card-title">🏆 Cups & Tournaments</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          The league is the marathon; Cups are the sprints. Knockout tournaments where the prize pot grows with every entry — and only one name goes on the trophy.
        </p>

        <div style={chapterStyles}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>How a Cup Runs</h4>
          <ol style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '20px', margin: 0 }}>
            <li>Admins open a cup with an <strong>entry fee</strong> and format (starting score + legs per round).</li>
            <li>Pay your fee to enter — it goes straight into the <strong>prize pot</strong>.</li>
            <li>Admins slot everyone into a <strong>bracket</strong> and you're assigned your rounds in <strong>Cup Fixtures</strong> / Schedule.</li>
            <li>Win your tie, advance; win the final, take the pot 🏆.</li>
          </ol>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
          <h4 style={{ color: '#fbbf24' }}>👑 Beyond the Cup</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Champions and winners get immortalised in the <Link to="/hall-of-fame" style={{ color: 'var(--accent-cyan)' }}>Hall of Fame</Link> —
            the legends wall on the Home screen. Be the name everyone's chasing next season.
          </p>
        </div>
      </div>
    ),

    'extras': (
      <div className="card">
        <h2 className="card-title">🎮 More Ways to Play</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          The league is the main event, but there's always something to do in Elite Arrows.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px', marginTop: '20px' }}>
          {[
            { icon: '🤝', title: 'Friendly League', body: 'Open singles and duos against anyone, any time — no pressure, just practice with purpose.' },
            { icon: '🏆', title: 'Champions League', body: 'A step up from the standard league for the elite of the elite.' },
            { icon: '🎯', title: 'Practice Hub', body: 'DartBot can use online play and solo practice modes to sharpen your game between fixtures.' },
            { icon: '⚡', title: 'Daily Challenges', body: 'A little something new every day — complete them, earn recognition, stay sharp.' },
            { icon: '💬', title: 'Community', body: 'Chat with friends, coordinate matches, and hang out in the WhatsApp group on this page.' },
            { icon: '🎁', title: 'Giveaways', body: 'Occasional league giveaways and rewards — keep an eye on news and notifications.' },
          ].map(item => (
            <div key={item.title} className="glass" style={{ padding: '16px', borderRadius: '14px', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ fontSize: '1.6rem' }}>{item.icon}</div>
              <h4 style={{ margin: '8px 0 6px', color: 'white' }}>{item.title}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>{item.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px' }}>Keep an eye on your stats</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Win rate, 180s, high checkouts, doubles — watch it all stack up in
            <Link to="/statistics" style={{ color: 'var(--accent-cyan)' }}> Statistics</Link> and on your profile.
          </p>
        </div>
      </div>
    ),

    'pass': (
      <div className="card">
        <h2 className="card-title">⭐ Elite Arrows Pass</h2>

        <div style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, #f5af19, #f12711)', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>Unlock the full league experience</h3>
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '15px' }}>
            The Pass is your ticket to play. Everything competitive lives behind it.
          </p>
          <Link to="/subscription" className="btn btn-primary" style={{ background: '#fff', color: '#f12711' }}>
            View Plans
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '20px' }}>
          <div className="glass" style={{ padding: '18px', borderRadius: '14px' }}>
            <h4 style={{ color: 'var(--text-muted)', margin: '0 0 10px' }}>👀 Free Member</h4>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '18px', margin: 0 }}>
              <li>✓ View leaderboards, stats & profiles</li>
              <li>✓ Browse the league & community</li>
              <li>✗ Submit results or play league games</li>
              <li>✗ Enter cups or tournaments</li>
            </ul>
          </div>
          <div className="glass" style={{ padding: '18px', borderRadius: '14px', border: '2px solid var(--accent-cyan)' }}>
            <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px' }}>⚡ Elite Pass</h4>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.9', paddingLeft: '18px', margin: 0 }}>
              <li>✓ Submit results & play league games</li>
              <li>✓ Arrange and manage fixtures</li>
              <li>✓ Enter cups, challenges & giveaways</li>
              <li>✓ Full stats, chat & priority support</li>
            </ul>
          </div>
        </div>
      </div>
    ),

    'faq': (
      <div className="card">
        <h2 className="card-title">❓ Quick FAQ</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          The stuff everyone asks. Tap a question to unfold the answer.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          {faqs.map(faq => (
            <div key={faq.q} className="glass" style={{ borderRadius: '12px', overflow: 'hidden', border: openFaq === faq.q ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setOpenFaq(openFaq === faq.q ? null : faq.q)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '15px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}
              >
                {faq.q}
                <span style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem', flexShrink: 0 }}>{openFaq === faq.q ? '−' : '+'}</span>
              </button>
              {openFaq === faq.q && (
                <div style={{ padding: '0 18px 15px', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.7' }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px' }}>Still stuck?</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Reach out through <Link to="/contact" style={{ color: 'var(--accent-cyan)' }}>Contact Us</Link> or visit
            <Link to="/support" style={{ color: 'var(--accent-cyan)' }}> Support</Link> — a real human will get back to you.
          </p>
        </div>
      </div>
    ),
  }

  return (
    <div className="page">
      {isOnboarding && (
        <div className="card animate-fade-in-up" style={{
          marginBottom: '20px',
          border: '2px solid var(--success)',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(0,212,255,0.1))',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📖</div>
            <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0, color: 'var(--success)' }}>Welcome to Elite Arrows!</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '580px', margin: '10px auto 0', lineHeight: '1.6' }}>
              Before you dive in, please <strong style={{ color: '#fff' }}>read through the whole guide below</strong> so you know exactly how the league works — and join the official WhatsApp group so you can arrange your games.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '18px' }}>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25D366', borderColor: '#25D366' }}>
                💬 Join Official WhatsApp
              </a>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '16px auto 0', maxWidth: '520px', lineHeight: '1.6' }}>
              {readComplete ? (
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ You've read the whole guide — scroll down and hit Continue to the App.</span>
              ) : (
                <span>⬇️ Keep scrolling — the <strong style={{ color: '#fff' }}>Continue</strong> button unlocks once you've read the entire guide.</span>
              )}
            </p>
          </div>
        </div>
      )}

      <div
        className="card animate-fade-in-up"
        style={{
          marginBottom: '20px',
          border: '2px solid var(--accent-cyan)',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(251,191,36,0.12))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎯</div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2rem', margin: 0 }}>How The League Works</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '10px auto 0', lineHeight: '1.6' }}>
            No jargon, no homework. Here's everything you need to know about competing in Elite Arrows — from your first sign-in to your first title.
          </p>
        </div>
      </div>

      {isOnboarding ? (
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {sections.map(section => (
              <div key={section.id}>{sectionCards[section.id]}</div>
            ))}
          </div>

          <div className="card glass" style={{
            marginTop: '24px',
            padding: '26px',
            borderRadius: '20px',
            textAlign: 'center',
            border: `2px solid ${readComplete ? 'var(--success)' : 'var(--border)'}`,
            background: readComplete ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎯</div>
            <h3 style={{ margin: '0 0 8px', color: '#fff' }}>You're all set — welcome to the league!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 18px', lineHeight: '1.6', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              Read it all? Now join the WhatsApp group (where everyone arranges games) and enter the app.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25D366', borderColor: '#25D366' }}>
                💬 Join Official WhatsApp
              </a>
              <button
                className="btn btn-primary"
                disabled={!readComplete}
                onClick={finishOnboarding}
                style={{ opacity: readComplete ? 1 : 0.5, cursor: readComplete ? 'pointer' : 'not-allowed', border: 'none' }}
              >
                {readComplete ? '🚀 Continue to the App' : '🔒 Continue to the App'}
              </button>
            </div>
            {!readComplete && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '14px 0 0' }}>
                🔒 This button unlocks once you've scrolled through the whole guide above.
              </p>
            )}
            {readComplete && (
              <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: '14px 0 0', fontWeight: 700 }}>
                ✅ Guide read — you're ready to play!
              </p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ width: '100%', marginBottom: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '15px' }}>
            <h4 style={{ marginBottom: '10px', color: 'var(--accent-cyan)' }}>Jump To</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    padding: '8px 12px',
                    background: activeSection === section.id ? 'var(--accent-cyan)' : 'var(--bg-primary)',
                    color: activeSection === section.id ? '#000' : 'var(--text)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {section.icon} {section.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '300px' }}>
            {sectionCards[activeSection]}
          </div>
        </div>
      )}
    </div>
  )
}