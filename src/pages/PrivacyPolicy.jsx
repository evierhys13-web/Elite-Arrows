export default function PrivacyPolicy() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Privacy Policy</h1>
      </div>
      
      <div className="card">
        <div style={{ lineHeight: '1.8', color: 'var(--text)' }}>
          <p style={{ marginBottom: '20px' }}>
            <strong>Effective Date:</strong> April 2026
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>1. Introduction</h3>
          <p style={{ marginBottom: '15px' }}>
            Elite Arrows ("we", "our", or "us") operates the Elite Arrows darts league management application. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our app.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>2. Data We Collect</h3>
          <p style={{ marginBottom: '10px' }}>
            <strong>Personal Information:</strong> When you create an account, we collect:
          </p>
          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li>Your name</li>
            <li>Email address</li>
            <li>Profile information (division, statistics)</li>
          </ul>

          <p style={{ marginBottom: '10px' }}>
            <strong>Match Data:</strong> We collect match results, scores, win/loss records, and league standings.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>3. How We Use Your Data</h3>
          <p style={{ marginBottom: '15px' }}>
            We use your information to:
          </p>
          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li>Manage your user account and league participation</li>
            <li>Track and display match results and league standings</li>
            <li>Calculate statistics and rankings</li>
            <li>Facilitate league administration</li>
          </ul>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>4. Data Sharing</h3>
          <p style={{ marginBottom: '15px' }}>
            We do <strong>not</strong> sell, trade, or otherwise transfer your personal information to outside parties. 
            We use Firebase (Google) for authentication services - their servers store your credentials securely.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>5. Data Security</h3>
          <p style={{ marginBottom: '15px' }}>
            We implement appropriate technical and organizational measures to protect your personal information. 
            Data is stored securely through Firebase with industry-standard encryption.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>6. Your Rights (GDPR)</h3>
          <p style={{ marginBottom: '15px' }}>
            Under the General Data Protection Regulation (GDPR), you have the right to:
          </p>
          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
            <li><strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten")</li>
            <li><strong>Data Portability:</strong> Request your data in a portable format</li>
          </ul>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>7. Feedback Survey Data</h3>
          <p style={{ marginBottom: '15px' }}>
            When users complete the feedback survey, their responses are stored securely in our database. 
            Survey responses may include user identification information and are used solely for improving 
            the Elite Arrows service. Access to survey data is restricted to administrators only.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>8. Children's Privacy</h3>
          <p style={{ marginBottom: '15px' }}>
            Our service is not intended for children under 13 years of age. We do not knowingly collect 
            personal information from children under 13.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>8. Changes to This Policy</h3>
          <p style={{ marginBottom: '15px' }}>
            We may update this Privacy Policy from time to time. We will notify you of any changes 
            by posting the new policy on this page. You are advised to review this Privacy Policy periodically.
          </p>

          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px', marginTop: '25px' }}>9. Contact Us</h3>
          <p style={{ marginBottom: '15px' }}>
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <p style={{ marginBottom: '30px' }}>
            <strong>Email:</strong> Rhyshowe2023@outlook.com<br />
            <strong>Data Controller:</strong> Rhys Howe
          </p>
        </div>
      </div>
    </div>
  )
}