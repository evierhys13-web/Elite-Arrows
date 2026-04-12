import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Subscription() {
  const { user, subscribe, getAllUsers, updateUser } = useAuth()
  const [showPayment, setShowPayment] = useState(false)
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [proofImage, setProofImage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdminEmail = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isAdmin = isAdminEmail || isDbAdmin

  const currentSeason = new Date().getFullYear().toString()
  const hasActiveSubscription = user?.isSubscribed && !isAdmin
  const subscriptionEndDate = user?.subscriptionDate ? new Date(user.subscriptionDate) : null
  const daysUntilEnd = subscriptionEndDate ? Math.ceil((subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
  const hasSubscriptionThisSeason = user?.subscriptionDate && 
    new Date(user.subscriptionDate).getFullYear() === parseInt(currentSeason)

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
    if (hasActiveSubscription) {
      alert(`You already have an active subscription. It will end on ${subscriptionEndDate?.toLocaleDateString()}. You can renew after it expires.`)
      return
    }

    if (hasSubscriptionThisSeason) {
      alert(`You already have a subscription this season (${currentSeason}). You can renew for the next season.`)
      return
    }

    setSubmitting(true)
    const users = getAllUsers()
    const userIndex = users.findIndex(u => u.id === user.id)
    if (userIndex !== -1) {
      users[userIndex].paymentPending = true
      users[userIndex].paymentMethod = paymentMethod
      users[userIndex].paymentProof = proofImage
      users[userIndex].paymentDate = new Date().toISOString()
      users[userIndex].subscriptionSeason = currentSeason
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      updateUser({
        paymentPending: true,
        paymentMethod: paymentMethod,
        paymentProof: proofImage,
        paymentDate: new Date().toISOString(),
        subscriptionSeason: currentSeason
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
    return 5
  }
  
  const price = getSubscriptionPrice()
  const isFreeTier = !user?.division || user?.division === 'Unassigned'

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
            {subscriptionEndDate && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                Expires: {subscriptionEndDate.toLocaleDateString()}
              </p>
            )}
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
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div className="subscription-card" style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <h2 style={{ color: '#888' }}>Free Tier</h2>
            <div className="subscription-price">Free<span>/month</span></div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Unassigned</p>
            <ul className="subscription-features">
              <li>Home</li>
              <li>Table</li>
              <li>Players</li>
              <li>Leaderboards</li>
              <li>Profile</li>
              <li>Settings</li>
              <li>Contact</li>
              <li>Support</li>
            </ul>
          </div>

          <div className="subscription-card" style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <h2>Standard Pass</h2>
            <div className="subscription-price">£5<span>/month</span></div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gold/Silver/Bronze</p>
            <ul className="subscription-features">
              <li>Match submissions</li>
              <li>Tournaments</li>
              <li>Full access</li>
            </ul>
            <div style={{ background: 'var(--warning)', color: '#000', padding: '8px', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '10px', fontWeight: 'bold' }}>
              ⚠️ Do NOT buy until assigned a division!
            </div>
            {hasActiveSubscription || hasSubscriptionThisSeason ? (
              <button className="btn btn-secondary btn-block" disabled>
                {hasActiveSubscription ? 'Already Subscribed' : 'This Season'}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" onClick={() => { setPaymentMethod('paypal5'); setShowPayment(true) }}>
                Entry Fee
              </button>
            )}
          </div>

          <div className="subscription-card" style={{ flex: '1 1 200px', minWidth: '200px', border: '2px solid #ffd700' }}>
            <h2 style={{ color: '#ffd700' }}>Elite Pass</h2>
            <div className="subscription-price">£5<span>/month</span></div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Elite/Diamond</p>
            <ul className="subscription-features">
              <li>Full access</li>
              <li>Tournaments</li>
              <li>Match submissions</li>
            </ul>
            <div style={{ background: 'var(--warning)', color: '#000', padding: '8px', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '10px', fontWeight: 'bold' }}>
              ⚠️ Do NOT buy until assigned a division!
            </div>
            {hasActiveSubscription || hasSubscriptionThisSeason ? (
              <button className="btn btn-secondary btn-block" disabled style={{ background: 'linear-gradient(135deg, #888, #666)', border: 'none' }}>
                {hasActiveSubscription ? 'Already Subscribed' : 'This Season'}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" style={{ background: 'linear-gradient(135deg, #ffd700, #ff8c00)', border: 'none' }} onClick={() => { setPaymentMethod('paypal5'); setShowPayment(true) }}>
                Entry Fee
              </button>
            )}
          </div>
        </div>
      )}

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
              style={{ marginBottom: '15px' }}
            />
          </div>
          <button 
            className="btn btn-primary btn-block" 
            onClick={handleSubmitPayment}
            disabled={submitting || !proofImage}
          >
            {submitting ? 'Submitting...' : 'Submit Payment'}
          </button>
          <button 
            className="btn btn-secondary btn-block" 
            style={{ marginTop: '12px' }}
            onClick={() => { setShowPayment(false); setStep(1); setPaymentMethod(''); setProofImage('') }}
          >
            Cancel
          </button>
        </div>
      )}

      {showPayment && paymentMethod === 'paypal5' && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 className="card-title">Standard Payment</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            For Gold/Silver/Bronze members.
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
              style={{ marginBottom: '15px' }}
            />
          </div>
          <button 
            className="btn btn-primary btn-block" 
            onClick={handleSubmitPayment}
            disabled={submitting || !proofImage}
          >
            {submitting ? 'Submitting...' : 'Submit Payment'}
          </button>
          <button 
            className="btn btn-secondary btn-block" 
            style={{ marginTop: '12px' }}
            onClick={() => { setShowPayment(false); setStep(1); setPaymentMethod(''); setProofImage('') }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}