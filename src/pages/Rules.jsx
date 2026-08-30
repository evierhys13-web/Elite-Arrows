import Breadcrumbs from '../components/Breadcrumbs'
import Tooltip from '../components/Tooltip'

export default function Rules() {
  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Rules' }]} />

      <div className="page-header" style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Rules</h1>
        <p style={{ color: 'var(--text-muted)' }}>Everything you need to know about playing in Elite Arrows</p>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Standard Match Format</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>🎯 Game Settings</h3>
             <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>Format:</strong> Best of 8 legs (First to 5 or 4-4 Draw).</li>
                <li><strong>Start Score:</strong> 501.</li>
                <li><strong>Finish:</strong> Straight In, Double Out.</li>
                <li><strong>Platform:</strong> Primarily played on <strong>DartCounter</strong>.</li>
             </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>📷 Visual Requirements (Strict)</h3>
             <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li><strong>CAM:</strong> Must be ON at all times during league games.</li>
                <li><strong>Visibility:</strong> The board and darts must be clearly visible to your opponent.</li>
                <li><strong>Omni:</strong> The use of Omni is optional, but traditional camera use is mandatory.</li>
             </ul>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>League Fixtures & Forfeits</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>⚠️ Unplayed Games</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>If you do not play <strong>all of your games</strong> in the season, you will be <strong>instantly relegated</strong> and given a <strong>final warning ban</strong>.</li>
              <li>If you <strong>forfeit the season</strong>, the same applies.</li>
              <li>The only exception is if an <strong>admin has been notified</strong> and given a <strong>good reason</strong> beforehand.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>🗓️ Re-scheduling Games</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Re-scheduling games is allowed if <strong>both players agree</strong> and an <strong>admin is notified</strong>.</li>
              <li>Admin approval is <strong>not required</strong> — as long as both players agree, the re-schedule is valid.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>💬 Arranging Games</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Fixtures should be arranged through the <strong>WhatsApp Division group chats</strong> so there is a <strong>record</strong> if a no-show or dispute arises.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>🤝 One Match Per Opponent</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Each opponent is faced <strong>once per season</strong> in league fixtures.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>🏳️ Forfeit Rule (Fixed Result for Unplayed Fixtures)</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>If a player <strong>forfeits the remainder of their fixtures</strong>, all completed matches remain <strong>valid and unchanged</strong>.</li>
              <li>Any <strong>unplayed fixtures</strong> are recorded as a <strong>fixed, mild result in favour of the opponent</strong> (e.g., <strong>5–3</strong>).</li>
              <li>This avoids free heavy wins while preserving earned results and keeping the league table as stable as possible.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>📅 Match Deadlines</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>All league fixtures must be played by the <strong>end of the season</strong>.</li>
              <li>Games not played by the deadline fall under the <strong>forfeit rule</strong>.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>🚫 No-Show Rule</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>If a player fails to show up, the opponent receives a <strong>forfeit win</strong>.</li>
              <li>A forfeit win is worth <strong>3 points only</strong> — no legs are awarded, since no legs were played (a normal win gives legs + 3 bonus).</li>
              <li>However, if the player <strong>notified their opponent about rescheduling beforehand</strong>, or <strong>around the match time (±15 minutes before or after)</strong>, the fixture should be <strong>re-scheduled</strong> instead.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>📝 Result Submission</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>The <strong>winner must submit the result</strong> within <strong>4 hours</strong> of the match.</li>
              <li>Keep your <strong>match log/scorecard</strong> until the result has been approved.</li>
              <li>In a dispute, the player who <strong>cannot provide proof</strong> loses the result.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'white' }}>⚖️ Disputed Results</h3>
            <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Any disputed result must be raised with an <strong>admin within 48 hours</strong> of submission.</li>
              <li>After that time, the <strong>result stands</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Scoring & Standings</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
           <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
             League points are calculated based on your performance in each match.
           </p>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leg Won</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>1 Point</div>
              </div>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--success)' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Win</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>+3 Bonus</div>
              </div>
              <div className="stat-card" style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--warning)' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match Draw</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)' }}>+1 Bonus</div>
              </div>
           </div>
           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
             Example: A 5-3 win gives you 5 (legs) + 3 (win bonus) = 8 total points.
           </p>
        </div>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '30px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '20px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '10px' }}>Code of Conduct</h2>
        <div style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
           <p>Elite Arrows maintains a <strong>Zero Tolerance Policy</strong> for the following:</p>
           <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
              <li>Cheating or score manipulation.</li>
              <li>Toxic behavior, bullying, or harassment of any member.</li>
              <li>Intentional disconnection or rage-quitting during live matches.</li>
           </ul>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid var(--error)' }}>
              <strong style={{ color: 'white' }}>Consequences:</strong> Breaking these rules results in a one-time final warning, followed by an immediate season ban for any subsequent offense.
           </div>
        </div>
      </div>

      <div className="card glass" style={{ marginBottom: '40px', padding: '30px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Prizes & Subscriptions</h2>
        <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
<p style={{ marginBottom: '15px' }}>
              Elite Pass subscribers are eligible for season prizes and entry into official tournaments.
            </p>
            <ul style={{ paddingLeft: '20px' }}>
              <li><strong>Prize Eligibility:</strong> To be eligible for season prizes you must have played all, or at least <strong>75%</strong> of, your fixtures.</li>
              <li><strong>Refunds:</strong> Subscriptions are eligible for a full refund within 14 days of purchase, provided no tournament prizes have been won.</li>
            </ul>
        </div>
      </div>
    </div>
  )
}
