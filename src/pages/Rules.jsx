import Breadcrumbs from '../components/Breadcrumbs'
import Tooltip from '../components/Tooltip'
import { Link } from 'react-router-dom'

export default function Rules() {
  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Rules' }]} />

      <div className="page-header" style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Rules</h1>
        <p style={{ color: 'var(--text-muted)' }}>Official match guidelines, division formats, and league regulations for Elite Arrows</p>
      </div>

      {/* 1. Division Match Formats & Game Settings */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          🎯 Division Match Formats & Settings
        </h2>

        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.25)' }}>
              <div style={{ color: '#ec4899', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>⚡ Pro League Division</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Best of 15 Legs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>First to 8 wins (No Draws). Filled by the top 6 from Elite each season.</p>
            </div>

            <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
              <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>👑 Elite Division</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Best of 8 Legs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>First to 5 wins, or 4–4 Draw.</p>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>❇️ Emerald Division</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Best of 8 Legs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>First to 5 wins, or 4–4 Draw.</p>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>💎 Diamond Division</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Best of 8 Legs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>First to 5 wins, or 4–4 Draw.</p>
            </div>

            <div style={{ background: 'rgba(226, 232, 240, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.25)' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px' }}>💿 Platinum Division</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Best of 8 Legs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>First to 5 wins, or 4–4 Draw.</p>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>⚙️ Universal Game Rules</h3>
             <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>Start Score:</strong> 501 SIDO (Straight In, Double Out).</li>
                <li><strong>First Throw:</strong> Players must <strong>Bull Up every time</strong> to decide who throws first in all league fixtures.</li>
                <li><strong>Game Timer:</strong> Match scorer/timer must be set to a minimum of <strong>60 seconds</strong>.</li>
                <li><strong>Platform:</strong> Primary league platform is <strong>DartCounter</strong>.</li>
             </ul>
          </div>
        </div>
      </div>

      {/* 2. Fixture Planning, Scheduling & Division Captains */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          💬 Fixture Planning & Division Captains
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🛡️ Division Captains</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Each division has assigned <strong>Division Captains (Admins)</strong> responsible for scheduling overwatch and dispute handling.</li>
              <li>Division Captains are prominently displayed at the top banner of each division's <strong>Standings Table</strong>.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>📅 Match Planning & Non-Responsive Protocol</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Arrange matches through WhatsApp division chats or dedicated planning channels by tagging your opponent (<strong style={{ color: 'var(--accent-cyan)' }}>@theirname</strong>).</li>
              <li><strong>Non-Responsive Opponents:</strong> If an opponent is tagged on <strong>3 separate days</strong> without reply, inform your Division Captain. The captain will issue them a <strong>warning</strong>.</li>
              <li><strong>Late Arrivals:</strong> Provide at least <strong>1 hour notice</strong> if running late. Arriving late without notice results in a <strong>warning</strong>.</li>
              <li><strong>No-Show Rule:</strong> Give your opponent at least <strong>1 hour notice</strong> if you cannot make your fixture. If no notice was given and the match cannot be played, the punctual player must <strong>dispute the no-show with their Division Captain</strong>.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🗓️ Weekly Fixture Requirement</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Every player must play <strong>at least 3 fixtures per week</strong>.</li>
              <li>Fixtures can be played on <strong>any day of the week – weekday or weekend</strong>, as long as you complete <strong>at least 3 games every week</strong>.</li>
              <li>If you have a valid reason for playing fewer than 3 fixtures in a week, you must notify your <strong>Division Captain</strong> and it must be <strong>addressed to all players in your division</strong>.</li>
              <li>Playing <strong>fewer than 3 games in a week without a valid reason</strong> results in a <strong>warning</strong>.</li>
              <li><strong>3 warnings = 1 Strike.</strong></li>
              <li><strong>1 strike</strong> puts you on a <strong>final official warning</strong>; <strong>2 strikes</strong> results in <strong>immediate removal from the league and an official season ban</strong>.</li>
              <li><strong>Serious (major) offences result in an instant ban</strong> (see the Warnings & Strike Policy below).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Camera Setup & In-Game Etiquette */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          📷 Camera Setup & In-Game Etiquette
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>📹 Camera Requirements</h3>
             <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>No Camera = No Game:</strong> Cameras must remain ON at all times during matches. If a camera fails, pause immediately until resolved.</li>
                <li><strong>Camera Setup:</strong> Place camera at <strong>bullseye height</strong> approximately <strong>1 meter away</strong> from the dartboard. Board and darts must be clearly visible.</li>
             </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🎯 Board & Darts Scoring Etiquette</h3>
             <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>High Scores (&gt;100):</strong> Darts scoring over 100 must be pointed out clearly on camera for your opponent.</li>
                <li><strong>Obscured Darts:</strong> If a dart obscures another high-scoring dart, remove the obscuring dart so your opponent can verify the score.</li>
                <li><strong>Checkouts & Doubles:</strong> ALL double finishes (and trebles forming checkouts) must be shown clearly on camera.</li>
                <li><strong>Target Omni Scoring:</strong> Permitted. Any counting errors MUST be rectified BEFORE removing darts from the board. Opponents must have access to camera view.</li>
                <li><strong>🚫 No Practice Throwing:</strong> Throwing practice darts during your opponent's turn is strictly prohibited. You must wait until your opponent enters their score and the camera switches.</li>
             </ul>
          </div>
        </div>
      </div>

      {/* 4. Evaluated Forfeit Policy */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
        <h2 style={{ color: 'var(--warning)', marginBottom: '20px', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', paddingBottom: '10px' }}>
          🏳️ Evaluated Forfeit Policy
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>📊 Forfeit Award Rules (Max Draw Points)</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>When a player forfeits or drops out mid-season, remaining unplayed fixtures award the <strong>maximum points for a draw</strong> in the winner's division, with 0 legs awarded.</li>
              <li>Forfeit awards are per division: <strong>Elite 7</strong> • <strong>Emerald 6</strong> • <strong>Diamond 5</strong> • <strong>Platinum 5</strong> points to the winner (non-offenders).</li>
              <li>The offending player receives 0 points and 0 legs.</li>
              <li><strong>Match Logs & Stats Preserved:</strong> All previously played matches remain logged in Match History/Logs and personal statistics (180s, high checkouts, 3-dart averages) are fully preserved for non-offending opponents.</li>
              <li><strong>Rescheduling Protection:</strong> If a player communicates around match time (±15 mins), the fixture MUST be rescheduled rather than declared an immediate forfeit.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>⚠️ Warnings & Strike Policy</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>3 Warnings</strong> = <strong>1 Strike</strong></li>
              <li>Warnings are issued for <strong>playing fewer than 3 fixtures in a week without a valid reason</strong> (see Weekly Fixture Requirement) plus conduct offences.</li>
              <li><strong>Strike Policy:</strong> Receiving <strong>1 strike</strong> puts you on a <strong>final official warning</strong>. Receiving <strong>2 strikes</strong> results in <strong>immediate removal from the league and an official season ban</strong>.</li>
              <li><strong>Serious offences (cheating, score manipulation, abuse, harassment, rage-quitting) result in an instant ban.</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* 5. In-Game Dispute Resolution & Recording */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          ⚖️ In-Game Dispute Resolution & Recording
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🚨 4-Step In-Game Dispute Sequence</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.9rem' }}>If an issue occurs during a live match, follow this exact sequence:</p>
            <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Screenshot:</strong> Take a screenshot of the issue immediately.</li>
              <li><strong>Pause:</strong> Pause the game immediately.</li>
              <li><strong>In-Game Message:</strong> Message your opponent in-game explaining the issue and screenshot the message.</li>
              <li><strong>Exit & Report:</strong> If unresolved or if the opponent disagrees, exit the game immediately and report to your Division Captain. <em>Do NOT complete the match or argue online.</em></li>
            </ol>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🎥 Game Recording Policy</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Game recording is <strong>optional and not enforced</strong> for standard match play.</li>
              <li>However, video recording is <strong>required to support any formal dispute</strong> raised with a Division Captain or Admin.</li>
              <li>Result submissions must be submitted by the winner within <strong>4 hours</strong> of match completion.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 6. Points System & Standings */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          📊 Scoring & League Points System
        </h2>
        <div style={{ display: 'grid', gap: '20px' }}>
           <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
             League points are earned through <strong>legs won plus match outcome points</strong>:
           </p>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leg Won</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>1 Point</div>
              </div>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--success)' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Win</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>3 Points</div>
              </div>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--warning)' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Draw</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)' }}>1 Point</div>
              </div>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Loss</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>0 Points</div>
              </div>
           </div>
           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
             So it is 1 point per leg won, plus 3 points for a win, 1 point for a draw, and 0 points for a loss. Example (Diamond Division BO8): a 5–3 win awards 5 (legs) + 3 (win) = 8 total points. Forfeit wins award the maximum draw points for your division (see the Evaluated Forfeit Policy).
           </p>
        </div>
      </div>

      {/* 6b. Player of the Month */}
      <div className="card glass" style={{ marginBottom: '24px', padding: '30px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
        <h2 style={{ color: 'var(--warning)', marginBottom: '20px', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', paddingBottom: '10px' }}>
          🏆 Player of the Month
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🗳️ Voting Rules</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Members vote for the <strong>Player of the Month</strong> in each division — the standings leader isn't automatically the winner.</li>
              <li>Every member casts <strong>one vote</strong> per division.</li>
              <li><strong>Vote in Your Own Division Only:</strong> You can only vote for players in <strong>your own division</strong> — you cannot vote for someone in a different division.</li>
              <li>Votes are cast privately through the <strong>Player of the Month</strong> page in the app.</li>
              <li><strong>No Asking, No Begging:</strong> Players must <strong>not ask, beg, or campaign</strong> for votes — this includes tagging members, posting in division WhatsApp groups, or sending private messages asking to be voted for.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'white' }}>🚫 Vote Solicitation Consequences</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Vote solicitation is treated as a <strong>conduct offence</strong> and falls under the <strong>Warnings & Strike Policy</strong>.</li>
              <li><strong>Votes may be disregarded</strong> — any votes gathered through asking or begging can be removed, and the player can be made ineligible for that month's award.</li>
              <li>Repeated offences can result in a <strong>strike</strong>; 2 strikes leads to dismissal from the league, and serious offences result in an instant ban.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 7. Code of Conduct & Subscriptions */}
      <div className="card glass" style={{ marginBottom: '40px', padding: '30px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '20px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '10px' }}>
          🛡️ Code of Conduct & Prize Eligibility
        </h2>
        <div style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
           <p>Elite Arrows maintains a <strong>Zero Tolerance Policy</strong> for the following:</p>
           <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
              <li>Cheating, score manipulation, or intentionally obscuring darts.</li>
              <li>Toxic behavior, bullying, or harassment in public or private channels.</li>
              <li>Intentional disconnection or rage-quitting during live matches.</li>
           </ul>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid var(--error)', marginBottom: '16px' }}>
              <strong style={{ color: 'white' }}>Consequences:</strong> Breaking these rules results in an official warning; <strong>3 warnings = 1 strike</strong>, and <strong>2 strikes</strong> results in dismissal from the league. <strong>Serious offences result in an instant ban.</strong> No second chances — seriously abusive behaviour results in a <strong style={{ color: 'white' }}>permanent community ban until you prove you can behave</strong>.
           </div>
           <p style={{ fontSize: '0.9rem' }}>
              <strong>Respect & Conduct:</strong> See the full guidelines on <Link to="/conduct" style={{ color: 'var(--accent-cyan)' }}>Respect & Conduct</Link> — how we treat each other, how banter should be used, and our zero tolerance on racism and discrimination.
           </p>
<p style={{ fontSize: '0.9rem' }}>
              <strong>Division Titles & Prizes:</strong> There are no automatic promotions between divisions. The <strong>league winner (top 1)</strong> of each division wins a share of the prize pot, announced at the end of the season. The Pro League is filled by the <strong>top 6 Elite players</strong> each season and assigned by the admins.
           </p>
           <p style={{ fontSize: '0.9rem' }}>
              <strong>Prize Eligibility:</strong> To be eligible for season prizes, players must have completed at least <strong>75%</strong> of their division fixtures.
           </p>
        </div>
      </div>
    </div>
  )
}
