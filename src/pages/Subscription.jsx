import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Subscription() {
  const { user, subscribe, getAllUsers, updateUser } = useAuth()
  const [showPayment, setShowPayment] = useState(false)
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [proofImage, setProofImage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleMethodSelect = (method) => {
    setPaymentMethod(method)
    setStep(2)
  }

  const handleProofUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitPayment = () => {
    setSubmitting(true)
    const users = getAllUsers()
    const userIndex = users.findIndex(u => u.id === user.id)
    if (userIndex !== -1) {
      users[userIndex].paymentPending = true
      users[userIndex].paymentMethod = paymentMethod
      users[userIndex].paymentProof = proofImage
      users[userIndex].paymentDate = new Date().toISOString()
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      updateUser({
        paymentPending: true,
        paymentMethod: paymentMethod,
        paymentProof: proofImage,
        paymentDate: new Date().toISOString()
      })
    }
    setSubmitting(false)
    setShowPayment(false)
    setStep(1)
    setPaymentMethod('')
    setProofImage('')
    alert('Payment submitted! Awaiting admin approval.')
  }

  const allUsers = getAllUsers()
  const pendingPayments = allUsers.filter(u => u.paymentPending && !u.isSubscribed)
  
  const getSubscriptionPrice = () => {
    if (!user?.division || user?.division === 'Unassigned') {
      return 0
    }
    if (user?.division === 'Elite' || user?.division === 'Diamond') {
      return 10
    }
    return 5
  }
  
  const price = getSubscriptionPrice()
  const isFreeTier = !user?.division || user?.division === 'Unassigned'
  const isHighTier = user?.division === 'Elite' || user?.division === 'Diamond'
  const isAdmin = user?.email?.toLowerCase() === 'rhyshowe2023@outlook.com'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Subscription</h1>
      </div>

      {(user?.isSubscribed && !isAdmin) ? (
        <div className="subscription-card">
          <h2>Elite Arrows Pass</h2>
          <div className="subscription-price">
            £{price}<span>/month</span>
          </div>
          <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <p style={{ color: 'var(--success)', fontWeight: '600' }}>Active Subscriber</p>
            {user?.freeAdminSubscription && <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', marginTop: '5px' }}>(Free - Admin Granted)</p>}
          </div>
        </div>
      ) : (user?.paymentPending) ? (
        <div className="subscription-card">
          <h2>Elite Arrows Pass</h2>
          <div className="subscription-price">
            £{price}<span>/month</span>
          </div>
          <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <p style={{ color: 'var(--warning)', fontWeight: '600' }}>Payment Pending Approval</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
              Your payment is awaiting admin approval.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="subscription-card" style={{ border: '2px solid #888' }}>
              <h2 style={{ color: '#888', fontSize: '1.1rem' }}>Free Tier</h2>
              <div className="subscription-price" style={{ fontSize: '1.5rem' }}>
                Free<span style={{ fontSize: '0.8rem' }}>/month</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>Unassigned</p>
              
              <ul className="subscription-features" style={{ fontSize: '0.8rem', paddingLeft: '15px' }}>
                <li>View players</li>
                <li>View tables</li>
                <li>Basic features</li>
              </ul>
            </div>

            <div className="subscription-card">
              <h2 style={{ fontSize: '1.1rem' }}>Standard Pass</h2>
              <div className="subscription-price" style={{ fontSize: '1.5rem' }}>
                £5<span style={{ fontSize: '0.8rem' }}>/month</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>Gold/Silver/Bronze</p>
              
              <ul className="subscription-features" style={{ fontSize: '0.8rem', paddingLeft: '15px' }}>
                <li>Match submissions</li>
                <li>Tournaments</li>
                <li>Full access</li>
              </ul>

              {(user?.isSubscribed && !isAdmin) ? (
                <button className="btn btn-secondary btn-block" disabled>
                  Active
                </button>
              ) : (
                <button className="btn btn-primary btn-block" onClick={() => {
                  setPaymentMethod('paypal5')
                  setShowPayment(true)
                }}>
                  Pay £5
                </button>
              )}
            </div>

            <div className="subscription-card" style={{ border: '2px solid #ffd700' }}>
              <h2 style={{ color: '#ffd700', fontSize: '1.1rem' }}>Premium Pass</h2>
              <div className="subscription-price" style={{ fontSize: '1.5rem' }}>
                £10<span style={{ fontSize: '0.8rem' }}>/month</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>Elite/Diamond</p>
              
              <ul className="subscription-features" style={{ fontSize: '0.8rem', paddingLeft: '15px' }}>
                <li>All Standard</li>
                <li>Priority support</li>
                <li>VIP features</li>
              </ul>

              {(user?.isSubscribed && !isAdmin) ? (
                <button className="btn btn-secondary btn-block" disabled>
                  Active
                </button>
              ) : (
                <button className="btn btn-primary btn-block" style={{ background: 'linear-gradient(135deg, #ffd700, #ff8c00)', border: 'none' }} onClick={() => {
                  setPaymentMethod('paypal10')
                  setShowPayment(true)
                }}>
                  Pay £10
                </button>
              )}
            </div>
</div>
          </div>

          {showPayment && paymentMethod === 'paypal10' && (
            <div className="card" style={{ marginTop: '20px', border: '1px solid #ffd700' }}>
              <h3 className="card-title" style={{ color: '#ffd700' }}>Premium Payment - PayPal Only</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                For Elite/Diamond members, payment via PayPal only.
              </p>
              <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p><strong>PayPal Email:</strong> <a href="https://paypal.me/DanielHineBerry" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>paypal.me/DanielHineBerry</a></p>
                <p><strong>Reference:</strong> Elite Arrows Subscription</p>
              </div>
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Upload Proof of Payment (screenshot/photo)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleProofUpload}
                  style={{ width: '100%' }}
                />
              </div>
              <button 
                className="btn btn-primary btn-block" 
                style={{ marginTop: '15px', background: 'linear-gradient(135deg, #ffd700, #ff8c00)', border: 'none' }}
                onClick={handleSubmitPayment}
                disabled={submitting || !proofImage}
              >
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          )}

          {showPayment && paymentMethod === 'paypal5' && (
            <div className="card" style={{ marginTop: '20px' }}>
              <h3 className="card-title">Standard Payment - PayPal</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                For Gold/Silver/Bronze members, payment via PayPal.
              </p>
              <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p><strong>PayPal Email:</strong> <a href="https://paypal.me/Rhyshowe834" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>paypal.me/Rhyshowe834</a></p>
                <p><strong>Reference:</strong> Elite Arrows Subscription</p>
              </div>
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Upload Proof of Payment (screenshot/photo)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleProofUpload}
                  style={{ width: '100%' }}
                />
              </div>
              <button 
                className="btn btn-primary btn-block" 
                style={{ marginTop: '15px' }}
                onClick={handleSubmitPayment}
                disabled={submitting || !proofImage}
              >
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          )}

          <div className="card" style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              Current Status: <strong style={{ color: 'var(--warning)' }}>Free Tier</strong>
            </p>
          </div>
        </>
      )}

      {showPayment && (
        <div className="card" style={{ marginTop: '20px' }}>
          {step === 1 && (
            <>
              <h3 className="card-title">Select Payment Method</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className="btn btn-secondary btn-block"
                  onClick={() => handleMethodSelect('bank')}
                >
                  Bank Transfer
                </button>
                <button 
                  className="btn btn-secondary btn-block"
                  onClick={() => handleMethodSelect('paypal5')}
                >
                  PayPal (£5)
                </button>
                <button 
                  className="btn btn-secondary btn-block"
                  onClick={() => handleMethodSelect('paypal10')}
                >
                  PayPal (£10)
                </button>
              </div>
            </>
          )}

          {step === 2 && paymentMethod && (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ marginBottom: '15px' }}
                onClick={() => setStep(1)}
              >
                ← Back
              </button>

              {paymentMethod === 'bank' && (
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '15px' }}>Bank Transfer</h4>
                  <p><strong>Account Name:</strong> Rhys Howe</p>
                  <p><strong>Sort Code:</strong> 60-09-09</p>
                  <p><strong>Account Number:</strong> 80249442</p>
                  <p style={{ marginTop: '10px' }}><strong>Reference:</strong> Elite Arrows Subscription</p>
                </div>
              )}

              {paymentMethod === 'paypal10' && (
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '15px' }}>PayPal Payment (£10 Tier)</h4>
                  <p>Send payment to: <strong><a href="https://paypal.me/DanielHineBerry" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>paypal.me/DanielHineBerry</a></strong></p>
                  <p style={{ marginTop: '10px' }}><strong>Reference:</strong> Elite Arrows Subscription</p>
                </div>
              )}

              {paymentMethod === 'paypal5' && (
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '15px' }}>PayPal Payment (£5 Tier)</h4>
                  <p>Send payment to: <strong><a href="https://paypal.me/Rhyshowe834" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>paypal.me/Rhyshowe834</a></strong></p>
                  <p style={{ marginTop: '10px' }}><strong>Reference:</strong> Elite Arrows Subscription</p>
                </div>
              )}

              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Upload Proof of Payment (screenshot/photo)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleProofUpload}
                  style={{ width: '100%' }}
                />
                {proofImage && (
                  <div style={{ marginTop: '10px' }}>
                    <img src={proofImage} alt="Proof" style={{ maxWidth: '200px', borderRadius: '8px' }} />
                  </div>
                )}
              </div>

              <button 
                className="btn btn-primary btn-block" 
                style={{ marginTop: '20px' }}
                onClick={handleSubmitPayment}
                disabled={submitting || !proofImage}
              >
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </>
          )}

          <button 
            className="btn btn-secondary btn-block" 
            style={{ marginTop: '12px' }}
            onClick={() => { setShowPayment(false); setStep(1); setPaymentMethod(''); setProofImage(''); }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}