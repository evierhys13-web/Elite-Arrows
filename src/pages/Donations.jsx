import { useState } from 'react'

export default function Donations() {
  const [reference, setReference] = useState('')
  const [copied, setCopied] = useState('')

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Donations</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ lineHeight: '1.8', color: 'var(--text)' }}>
          <p style={{ marginBottom: '15px' }}>
            <strong>Support Elite Arrows</strong>
          </p>
          
          <p style={{ marginBottom: '15px' }}>
            Your donations help keep Elite Arrows running and improving. Here's what your support goes toward:
          </p>

          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li><strong>App Store & Google Play fees</strong> - £99/year for Apple App Store, £25 one-time for Google Play</li>
            <li><strong>Domain renewal</strong> - £7.99/month for elite-arrows.co.uk</li>
            <li><strong>Transaction fees</strong> - 15% fees on subscriptions when paid through the app on Google Play / Apple App Store</li>
          </ul>

          <p>
            Every contribution makes a difference. Thank you for your support! 🙏
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Bank Transfer</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)' }}>
            What are you donating for? (reference)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., League fees, Cup entry, General donation, App fees"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1rem',
              background: 'var(--bg-primary)',
              border: '2px solid var(--accent-cyan)',
              borderRadius: '8px',
              color: 'var(--text)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <span style={{ color: 'var(--text)' }}>Name: </span>
            <strong style={{ color: 'var(--text)' }}>Rhys Howe</strong>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <span style={{ color: 'var(--text)' }}>Account number: </span>
            <strong style={{ color: 'var(--text)', cursor: 'pointer' }} onClick={() => copyToClipboard('80249442')}>
              80249442 {copied === '80249442' && <span style={{ color: 'var(--accent-cyan)' }}> (copied!)</span>}
            </strong>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <span style={{ color: 'var(--text)' }}>Sort code: </span>
            <strong style={{ color: 'var(--text)', cursor: 'pointer' }} onClick={() => copyToClipboard('600909')}>
              60-09-09 {copied === '600909' && <span style={{ color: 'var(--accent-cyan)' }}> (copied!)</span>}
            </strong>
          </div>
          {reference && (
            <div>
              <span style={{ color: 'var(--text)' }}>Reference: </span>
              <strong style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }} onClick={() => copyToClipboard(reference)}>
                {reference} {copied === reference && <span style={{ color: 'var(--accent-cyan)' }}> (copied!)</span>}
              </strong>
            </div>
          )}
        </div>

        <p style={{ marginTop: '15px', color: 'var(--text)', fontSize: '0.9rem' }}>
          💡 Click any detail to copy it to your clipboard
        </p>
      </div>

      <div className="card">
        <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>PayPal</h3>
        
        <a
          href="https://paypal.me/Rhyshowe834"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '15px 25px',
            background: '#003087',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '1.1rem',
            fontWeight: 'bold'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.424 0-.75.37-.718.792.032.422.422.792.847.792h2.19c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.046.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H6.17c-.424 0-.75.37-.718.792.032.422.422.792.847.792h2.19c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437L12.316 24c-.09.461-.547.74-1.02.74H7.076z"/>
          </svg>
          Donate via PayPal
        </a>

        <p style={{ marginTop: '15px', color: 'var(--text)', fontSize: '0.9rem' }}>
          Or send to: <strong>@Rhyshowe834</strong>
        </p>
      </div>
    </div>
  )
}