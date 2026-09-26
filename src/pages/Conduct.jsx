import Breadcrumbs from '../components/Breadcrumbs'
import { Link } from 'react-router-dom'

export default function Conduct() {
  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Respect & Conduct' }]} />

      <div className="page-header" style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>Respect & Conduct</h1>
        <p style={{ color: 'var(--text-muted)' }}>How we treat each other — members and admins alike — so our community stays friendly for everyone</p>
      </div>

      {/* 1. The Golden Rule */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          🤝 Respect Everyone, Always
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
              Elite Arrows is built on one simple rule: <strong style={{ color: 'white' }}>treat every member exactly how you want to be treated</strong> — whether that's on the oche, in the WhatsApp groups, or in the app. Every player, every admin, every level. Competition is the point, disrespect never is.
            </p>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px', marginTop: '8px' }}>
              <li>Celebrate your wins, cheer people on, and shake the loss off — win or lose, the respect stays the same.</li>
              <li>Newer players deserve the same courtesy as league champions. Every darter started somewhere.</li>
              <li>If you have a problem with someone, keep it private and calm — take it to the admins, not into the group chats.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Banter Guidelines */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          😄 Banter: Have It, Keep It Friendly
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '12px' }}>
              A good wind-up before a match is part of the fun — <strong style={{ color: 'white' }}>as long as it's clearly banter</strong>. The rule of thumb: if the boot were on the other foot, would you be laughing too?
            </p>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>✅ Good Banter</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px', marginBottom: '14px' }}>
              <li>Playful digs about choke-outs, lost checkouts, or that one 26 in a worldie of a leg.</li>
              <li>Funny post-match messages in good spirits — and only when both sides can smile about it.</li>
              <li>Friendly rivalry between divisions and clubs. Bring it on.</li>
            </ul>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>❌ Not Banter (Never Acceptable)</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Insults aimed at a person rather than their darts.</li>
              <li>Targeting the same player again and again until it stops being funny.</li>
              <li>Banter that carries on after someone says "that's enough" — a no always means no.</li>
              <li>Winding a player up mid-match in a way that tilts or upsets them.</li>
            </ul>
          </div>
          <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🛑 Know When The Joke Stops</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
              Banter is only banter while <strong style={{ color: 'white' }}>both players are enjoying it</strong>. The moment someone says they're not comfortable, you drop it immediately — no "it was just a joke", no excuses. Continuing after being asked to stop turns banter into bullying, and that is a conduct offence.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Zero Tolerance */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '20px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '10px' }}>
          🚫 Zero Tolerance: Racism, Discrimination & Abuse
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '12px' }}>
              Elite Arrows has a <strong style={{ color: 'white' }}>zero tolerance policy on any form of discrimination or abuse</strong>. There is no "level" to it, no "it was only a joke", and no second chances on this list:
            </p>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Racism</strong> — any racial slur, stereotype, or racial "joke", in any form and in any channel.</li>
              <li><strong>Discrimination</strong> — on the basis of race, religion, nationality, gender, sexuality, age, or disability.</li>
              <li><strong>Harassment & bullying</strong> — targeting, mocking, threatening, or ganging up on any member.</li>
              <li><strong>Abusive or threatening language</strong> — directed at players, admins, or anyone in the community.</li>
              <li><strong>Sharing offensive or inappropriate content</strong> — in chats, the app, or in game messages.</li>
            </ul>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>⚖️ Consequences</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Racist, discriminatory, or seriously abusive behaviour results in <strong>instant removal from the league and an official season ban</strong> — no warning, no strike required.</li>
              <li>Other conduct offences (bullying, harassment, toxic behaviour) follow the <strong>Warnings & 1-Strike policy</strong>: 2 warnings = 1 strike, and 1 strike = <strong>immediate removal from the league + season ban</strong>.</li>
              <li>Repeat offenders are removed at the admins' discretion.</li>
              <li><strong>No second chances:</strong> If any of the above happens, the offender is <strong>permanently banned from the community until they prove they can behave</strong>. Returning is only possible after demonstrating good behaviour to the admins — and any repeat offence during that period ends it for good.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Respect Towards Admins */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          🛡️ Respect Towards Admins & Division Captains
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '12px' }}>
              Admins and Division Captains volunteer their time so the league runs smoothly. They aren't your enemy — they're the ones sorting fixtures, disputes, and keeping things fair. Treat them with the same respect you want back.
            </p>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Be patient:</strong> Decision-makers are often juggling dozens of players. Allow reasonable time for a response — chasing is fine, hounding is not.</li>
              <li><strong>Disagree respectfully:</strong> You can question a decision, but do it calmly and privately. Yelling, cussing out, or bad-mouthing admins in group chats is a conduct offence.</li>
              <li><strong>No abuse, ever:</strong> Insulting, threatening, or harassing an admin or captain is treated as seriously as abusing a fellow player.</li>
            </ul>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🚨 How To Report A Problem</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Experiencing or witnessing abuse? Report it to a <strong>Division Captain</strong> or an <strong>Admin</strong> in private.</li>
              <li>Include screenshot evidence where possible — it makes action much faster.</li>
              <li>You can also raise it via the <Link to="/suggestions" style={{ color: 'var(--accent-cyan)' }}>Suggestion Box</Link> in the app.</li>
              <li>Reports are handled privately and thoroughly. Nobody should feel silenced for speaking up.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 5. Sportsmanship */}
      <div className="card glass" style={{ marginBottom: '40px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          🎯 Match-Day Sportsmanship
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Shake it off:</strong> A lost match is a lost match — congratulate your opponent, learn, and come back stronger.</li>
              <li><strong>No gloating:</strong> Rubbing a win in someone's face repeatedly is poor sportsmanship, even after close games.</li>
              <li><strong>No rage:</strong> Rage-quitting, slamming the board, or abusing opponents over a defeat is a conduct offence.</li>
              <li><strong>Be on time:</strong> Respect your opponent's schedule — show up, communicate early if you're late, and honour agreed times.</li>
              <li><strong>Fair over winning:</strong> Playing fairly and honestly beats winning by bending the rules. Cheating, score manipulation, or hiding darts from camera is an instant offence.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}