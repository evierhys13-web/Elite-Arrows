import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

// Maximum size for the proof image
const MAX_IMAGE_BYTES = 800 * 1024;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.onloadend = () => {
      const originalDataUrl = reader.result;
      if (originalDataUrl.length <= MAX_IMAGE_BYTES) {
        resolve(originalDataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load the image."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 1200;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > MAX_IMAGE_BYTES && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function Subscription() {
  const { user, updateUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isNativeApp = Capacitor.isNativePlatform();

  const handleNativePurchase = async (planId) => {
    try {
      setSubmitting(true);
      // Maps your plan IDs to RevenueCat product/package IDs
      const productID = planId === 'elite' ? 'elite_pass' : 'standard_pass';

      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
        const pkg = offerings.current.availablePackages.find(p => p.product.identifier === productID);
        if (pkg) {
          const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
          if (typeof customerInfo.entitlements.active['elite_pass'] !== "undefined" ||
              typeof customerInfo.entitlements.active['standard_pass'] !== "undefined") {

            await updateUser({
              isSubscribed: true,
              subscriptionDate: new Date().toISOString(),
              subscriptionTier: planId === 'elite' ? 'premium' : 'standard',
              paymentMethod: 'google_play'
            }, false);

            alert("Success! Your Elite Pass is now active.");
          }
        } else {
          alert("Selected plan is not available for purchase right now.");
        }
      }
    } catch (e) {
      if (!e.userCancelled) {
        alert("Purchase error: " + e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Rookie Pass',
      price: 'Free',
      description: 'The starting point for every dart player.',
      features: ['League Standings', 'Global Chat', 'Basic Analytics', 'User Profile'],
      color: 'var(--text-muted)',
      buttonText: 'Current Plan',
      active: !user?.isSubscribed && (!user?.division || user?.division === 'Unassigned')
    },
    {
      id: 'standard',
      name: 'Standard Pass',
      price: '£5',
      description: 'Gold, Silver, Bronze & Development divisions.',
      features: ['Official League Entry', 'Tournament Access', 'Match Submissions', 'Advanced Stats'],
      color: 'var(--accent-cyan)',
      buttonText: 'Get Standard',
      active: user?.isSubscribed && ['Gold', 'Silver', 'Bronze', 'Development'].includes(user?.division)
    },
    {
      id: 'elite',
      name: 'Elite Pass',
      price: '£5',
      description: 'For Elite, Diamond & Platinum challengers.',
      features: ['Official League Entry', 'Cash Prize Tournaments', 'Priority Support', 'Full Dashboard'],
      color: '#fbbf24',
      buttonText: 'Get Elite',
      premium: true,
      active: user?.isSubscribed && ['Elite', 'Diamond', 'Platinum'].includes(user?.division)
    }
  ];

  const handleProofUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setProofImage(dataUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!isNativeApp && !proofImage) return alert("Please upload proof of payment.");
    setSubmitting(true);
    try {
      if (isNativeApp) {
        // App logic: Simply notify admins of the request
        await updateUser({
          adminRequestPending: true,
          requestedPlan: paymentMethod,
          requestDate: new Date().toISOString()
        }, false);
        alert("Request sent! An admin will contact you to arrange payment and activate your pass.");
      } else {
        // Web logic: Usual flow with proof
        await updateUser({
          paymentPending: true,
          paymentMethod,
          paymentProof: proofImage,
          paymentDate: new Date().toISOString()
        }, false);
        alert("Payment submitted! Awaiting admin approval.");
      }
      setPaymentMethod("");
      setProofImage("");
    } catch (err) {
      alert("Submission failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>Elite Arrows Pass</h1>
        <p style={{ color: 'var(--text-muted)' }}>Unlock full league participation and cash prize tournaments.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        {plans.map(plan => (
          <div key={plan.id} className="card glass" style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '30px',
            border: plan.premium ? '2px solid #fbbf24' : '1px solid var(--border)',
            position: 'relative',
            transform: plan.active ? 'scale(1.02)' : 'none',
            background: plan.active ? 'rgba(124, 92, 252, 0.1)' : 'var(--bg-card)'
          }}>
            {plan.active && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: plan.color, color: 'black', padding: '2px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 900 }}>CURRENT PLAN</div>}

            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: plan.color }}>{plan.name}</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '12px' }}>{plan.price}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/season</span></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px', minHeight: '40px' }}>{plan.description}</p>

            <div style={{ flex: 1 }}>
              {plan.features.map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '0.9rem' }}>
                  <span style={{ color: plan.color }}>✓</span> {feat}
                </div>
              ))}
            </div>

            <button
              className={`btn btn-block ${plan.active ? 'btn-secondary' : 'btn-primary'}`}
              disabled={plan.active || user?.paymentPending || (submitting && isNativeApp)}
              onClick={() => isNativeApp ? handleNativePurchase(plan.id) : setPaymentMethod(plan.id)}
              style={{ marginTop: '24px', background: plan.premium && !plan.active ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : '' }}
            >
              {user?.paymentPending ? 'Pending Approval' : (submitting && isNativeApp) ? 'Connecting Store...' : plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      {!isNativeApp && paymentMethod && (
        <div className="card glass animate-fade-in" style={{ border: '1px solid var(--accent-cyan)', padding: '40px' }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Finalize Your {paymentMethod === 'elite' ? 'Elite' : 'Standard'} Pass</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>Option 1: PayPal</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Send £5.00 to:</p>
              <a href="https://paypal.me/DanielHineBerry" target="_blank" rel="noreferrer" style={{ display: 'block', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', color: 'white', textAlign: 'center', textDecoration: 'none', fontWeight: 700 }}>paypal.me/DanielHineBerry</a>
            </div>

            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>Option 2: Bank Transfer</h4>
              <div style={{ fontSize: '0.85rem' }}>
                <div><strong>Acc:</strong> Rhys Howe</div>
                <div><strong>Sort:</strong> 60-09-09</div>
                <div><strong>No:</strong> 80249442</div>
                <div style={{ marginTop: '8px', color: 'var(--warning)' }}>Ref: {user.username}</div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
            <label>Upload Proof of Payment (Screenshot)</label>
            <input type="file" accept="image/*" onChange={handleProofUpload} className="glass" style={{ padding: '12px' }} />
            {uploading && <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Processing receipt...</p>}
            {proofImage && <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>✓ Receipt Attached</p>}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setPaymentMethod("")}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmitPayment} disabled={submitting || !proofImage}>
              {submitting ? 'Submitting...' : 'Confirm Payment Submission'}
            </button>
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px' }}>
        <p><strong>Refund Policy:</strong> Elite Pass subscriptions are eligible for a full refund within 14 days of purchase, provided no tournament prizes have been won. Contact support to initiate a refund.</p>
      </div>
    </div>
  );
}
