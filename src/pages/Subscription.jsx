import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextInternal";
import { DIVISION_COLORS } from "../utils/leagueStandings";

const MONTHLY_PRICE = 10;

const PRICE_BREAKDOWN = [
  { label: 'League Prize Pool', amount: 7, color: '#fbbf24' },
  { label: 'Player of the Month (£40 target / 4 divs)', amount: 1.5, color: '#a78bfa' },
  { label: 'Highout Prize (£15 target)', amount: 0.5, color: '#10b981' },
  { label: 'Site Pot (Rest)', amount: 1, color: '#38bdf8' },
];

const PASS_DIVISIONS = ['Elite', 'Emerald', 'Diamond', 'Platinum'];

const PASS_DESCRIPTIONS = {
  Elite: 'Top tier of the league — Best of 12.',
  Emerald: 'Second tier — Best of 10.',
  Diamond: 'Mid tier — Best of 8.',
  Platinum: 'Entry tier — Best of 8.',
};

const PASS_FEATURES = [
  'Official league entry & fixtures',
  'Match submissions & full stats',
  'Cups and tournament access',
  'League prize pool eligibility',
  'Player of the Month voting',
];

const PAYMENT_METHODS = [
  {
    name: 'PayPal',
    icon: '💳',
    detail: '@RhysHowe834',
    href: 'https://paypal.me/RhysHowe834',
  },
  {
    name: 'Bank Transfer',
    icon: '🏦',
    lines: ['Name: Rhys Howe', 'Account Number: 80249442', 'Sort Code: 60-09-09'],
  },
  {
    name: 'Revolut',
    icon: '⚡',
    detail: 'revolut.me/rhys_howe',
    href: 'https://revolut.me/rhys_howe',
  },
  {
    name: 'Monzo',
    icon: '🏦',
    lines: ['Name: Rhys Howe', 'Bank: Monzo Bank', 'Account Number: 43482637', 'Sort Code: 04-00-06'],
  },
];

const RULES_SUMMARY = [
  'You play one league match against every other player in your division each season.',
  'All league fixtures must be played by the season end date.',
  'The winner submits the result within 4 hours; disputes go to an admin within 48 hours.',
  'Everyone must play at least 3 fixtures per week (unless a valid reason is given).',
  '3 warnings = 1 strike; 1 strike results in an immediate season ban.',
  'Zero tolerance for cheating, score manipulation, toxic behaviour and rage-quitting.',
];

export default function Subscription() {
  const { user, updateUser, adminData } = useAuth();
  const [selectedPass, setSelectedPass] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentSeasonName = adminData?.currentSeason || 'Elite Arrows Season 6';
  const isPending = Boolean(user?.paymentPending);
  const paidDivision = user?.requestedDivision || user?.requestedPlan || '';
  const userDivision = user?.division && user.division !== 'Unassigned' ? user.division : '';
  const isMember = user?.isSubscribed === true || (Array.isArray(user?.subscribedSeasons) && user.subscribedSeasons.includes(currentSeasonName));

  const handlePaid = async () => {
    if (!selectedPass) return alert("Please choose which pass you are paying for.");
    if (!rulesAccepted) return alert("Please read and accept the league rules first.");
    setSubmitting(true);
    try {
      await updateUser({
        paymentPending: true,
        requestedDivision: selectedPass,
        requestedPlan: selectedPass,
        requestedSeason: currentSeasonName,
        paymentDate: new Date().toISOString(),
      }, false);
    } catch (err) {
      alert("Submission failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>Elite Arrows Pass</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          £{MONTHLY_PRICE} per month. Choose the division you're paying for, pay using the details below, then tap <strong>I have paid</strong>.
        </p>
      </div>

      {isMember && (
        <div className="card glass" style={{ padding: '16px 20px', marginBottom: '24px', borderLeft: '4px solid var(--success)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontWeight: 800 }}>✓ You're a member this season{userDivision ? ` — ${userDivision} Division` : ''}.</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Paying again extends your entry for the next month.</span>
        </div>
      )}

      {isPending && (
        <div className="card glass" style={{ padding: '16px 20px', marginBottom: '24px', borderLeft: '4px solid #fbbf24', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontWeight: 800, color: '#fbbf24' }}>⏳ Payment pending approval{paidDivision ? ` — ${paidDivision} Division` : ''}.</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>An admin will confirm your payment shortly.</span>
        </div>
      )}

      {/* PASS SELECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '32px' }}>
        {PASS_DIVISIONS.map(div => {
          const color = DIVISION_COLORS[div] || 'var(--accent-cyan)';
          const selected = selectedPass === div;
          return (
            <button
              key={div}
              onClick={() => setSelectedPass(div)}
              disabled={isPending}
              className="card glass glass-hover"
              style={{
                textAlign: 'left', cursor: isPending ? 'not-allowed' : 'pointer',
                padding: '22px', borderRadius: '20px', opacity: isPending ? 0.6 : 1,
                border: selected ? `2px solid ${color}` : `1px solid ${color}44`,
                background: selected ? `linear-gradient(170deg, ${color}22, rgba(15,23,42,0.5))` : `linear-gradient(170deg, ${color}12, rgba(15,23,42,0.45))`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 900, fontSize: '1.2rem', color }}>{div}</span>
                {selected && <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'black', background: color, padding: '3px 10px', borderRadius: '99px' }}>SELECTED</span>}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>Division Pass</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px' }}>{PASS_DESCRIPTIONS[div]}</div>
              <div style={{ marginTop: '14px', fontWeight: 900, fontSize: '1.4rem' }}>£{MONTHLY_PRICE}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}> /month</span></div>
            </button>
          );
        })}
      </div>

      {!selectedPass && !isPending && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px' }}>Select a division pass above to see payment details.</p>
      )}

      {selectedPass && (
        <div className="animate-fade-in">
          {/* WHAT'S INCLUDED */}
          <div className="card glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>What's included with the {selectedPass} Pass</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {PASS_FEATURES.map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: DIVISION_COLORS[selectedPass] }}>✓</span> {feat}
                </div>
              ))}
            </div>
          </div>

          {/* WHERE YOUR MONEY GOES */}
          <div className="card glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>Where your £{MONTHLY_PRICE} goes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {PRICE_BREAKDOWN.map(item => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.color}44`, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: item.color }}>£{item.amount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '14px', marginBottom: 0 }}>
              Total <strong>£{MONTHLY_PRICE} per month</strong>. Payment is made manually each month.
            </p>
          </div>

          {/* PAYMENT DETAILS */}
          <div className="card glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px', border: '1px solid var(--accent-cyan)' }}>
            <h3 className="card-title" style={{ marginBottom: '6px' }}>Pay £{MONTHLY_PRICE} using any method below</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '18px' }}>
              Please use <strong style={{ color: 'var(--accent-cyan)' }}>{user?.username || 'your username'}</strong> as the payment reference so your payment can be matched.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {PAYMENT_METHODS.map(method => (
                <div key={method.name} style={{ padding: '18px', background: 'rgba(0,0,0,0.2)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ color: 'var(--accent-cyan)', marginTop: 0, marginBottom: '10px' }}>{method.icon} {method.name}</h4>
                  {method.detail && (
                    method.href ? (
                      <a href={method.href} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', textAlign: 'center', textDecoration: 'none', fontWeight: 700, wordBreak: 'break-all' }}>
                        {method.detail}
                      </a>
                    ) : (
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}>{method.detail}</div>
                    )
                  )}
                  {method.lines && method.lines.map(line => (
                    <div key={line} style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{line}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* LEAGUE RULES ACCEPTANCE */}
          <div className="card glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>League Rules — please read before paying</h3>
            <ul style={{ margin: '0 0 16px', paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.7 }}>
              {RULES_SUMMARY.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
            <p style={{ fontSize: '0.82rem', marginTop: 0 }}>
              Read the full rules here: <Link to="/rules" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>League Rules →</Link>
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '14px' }}>
              <input type="checkbox" checked={rulesAccepted} onChange={e => setRulesAccepted(e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>I have read the league rules and I understand and accept them.</span>
            </label>
          </div>

          {/* I HAVE PAID */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <button
              className="btn btn-primary"
              disabled={!rulesAccepted || submitting || isPending}
              onClick={handlePaid}
              style={{ padding: '16px 40px', fontSize: '1rem', background: DIVISION_COLORS[selectedPass], color: 'black', border: 'none', opacity: (!rulesAccepted || submitting || isPending) ? 0.55 : 1 }}
            >
              {isPending ? 'Payment Pending Approval' : submitting ? 'Submitting…' : `I have paid £${MONTHLY_PRICE} for the ${selectedPass} Pass`}
            </button>
            {!rulesAccepted && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px' }}>Accept the league rules to enable this button.</p>}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px' }}>
        <p><strong>Refund Policy:</strong> Pass subscriptions are eligible for a full refund within 14 days, provided no tournament prizes have been won. Contact support to initiate a refund.</p>
      </div>
    </div>
  );
}
