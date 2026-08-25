import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContextInternal";
import { initStore, requestPurchase } from "../utils/store";
import { Capacitor } from "@capacitor/core";
import { storage, ref, uploadBytesResumable, getDownloadURL } from '../firebase'

const SUBSCRIPTION_PRODUCT_IDS = {
  standard: 'standard_pass',
  elite: 'elite_pass'
}
const SUBSCRIPTION_ENTITLEMENTS = ['standard_pass', 'elite_pass']

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
  const { user, updateUser, getSeasons, adminData } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [targetSeason, setTargetSeason] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const seasons = getSeasons();
  const currentSeasonName = adminData?.currentSeason || 'Season 1';

  const [proofFile, setProofFile] = useState(null);

  // Find upcoming seasons that are not the current one
  const upcomingSeasons = seasons.filter(s =>
    !s.isArchived &&
    (s.status === 'upcoming' || (s.startDate && new Date(s.startDate) > new Date())) &&
    s.name !== currentSeasonName
  );

  const availableSeasons = [
    { name: currentSeasonName, label: 'Current Season' },
    ...upcomingSeasons.map(s => ({ name: s.name, label: 'Next Season' }))
  ];

  useEffect(() => {
    if (availableSeasons.length > 0 && !targetSeason) {
      // Prioritize Season 4 as default if it exists in available list
      const season4 = availableSeasons.find(s => s.name === 'Season 4');
      setTargetSeason(season4 ? season4.name : availableSeasons[0].name);
    }
  }, [availableSeasons, targetSeason]);

  const isNativeApp = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNativeApp) {
      initStore((productId) => {
        const tier = productId === 'elite_pass' ? 'premium' : 'standard';
        updateUser({
          isSubscribed: true,
          subscriptionDate: new Date().toISOString(),
          subscriptionTier: tier,
          paymentMethod: 'google_play'
        }, false).then(() => {
          alert(`Success! Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} pass is now active.`);
        });
      });
    }
  }, [isNativeApp]);

  const handleNativePurchase = async (planId) => {
    const productID = SUBSCRIPTION_PRODUCT_IDS[planId];
    requestPurchase(productID);
  };

  const isSubscribedForSelected = (user?.subscribedSeasons || []).includes(targetSeason) || (targetSeason === currentSeasonName && user?.isSubscribed);
  const hasSelectedSeason = (user?.subscribedSeasons || []).includes(targetSeason);

  const plans = [
    {
      id: 'free',
      name: 'Rookie Pass',
      price: 'Free',
      description: 'The starting point for every dart player.',
      features: ['League Standings', 'Global Chat', 'Basic Analytics', 'User Profile'],
      color: 'var(--text-muted)',
      buttonText: 'Current Plan',
      active: !hasSelectedSeason && (!user?.isSubscribed && (!user?.division || user?.division === 'Unassigned'))
    },
    {
      id: 'elite',
      name: 'Elite Pass',
      price: '£5.99',
      description: `Full access for ${targetSeason}.`,
      features: ['Official League Entry', 'Top 2 Division Playoffs', 'Cash Prize Tournaments', 'Priority Support', 'Full Analytics Dashboard', 'Tournament Access', 'Match Submissions'],
      color: '#fbbf24',
      buttonText: hasSelectedSeason ? 'Already Paid' : 'Get Elite Pass',
      premium: true,
      active: hasSelectedSeason
    }
  ];

  const handleProofUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // For preview, we still compress or just use blob URL
      const dataUrl = await compressImage(file);
      setProofImage(dataUrl);
      setProofFile(file); // Store original or we could compress to blob
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!isNativeApp && !proofFile) return alert("Please upload proof of payment.");
    setSubmitting(true);
    try {
      if (isNativeApp) {
        // ... (existing native logic)
        await updateUser({
          adminRequestPending: true,
          requestedPlan: paymentMethod,
          requestedSeason: targetSeason,
          requestDate: new Date().toISOString()
        }, false);
        alert(`Request sent for ${targetSeason}! An admin will contact you to arrange payment and activate your pass.`);
      } else {
        // Web logic: Upload to Storage first
        let finalProofUrl = proofImage;
        if (proofFile) {
          const storageRef = ref(storage, `payments/${user.id}_${Date.now()}_proof.jpg`);
          const uploadTask = uploadBytesResumable(storageRef, proofFile);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', null, reject, async () => {
              finalProofUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            });
          });
        }

        await updateUser({
          paymentPending: true,
          paymentMethod,
          paymentProof: finalProofUrl, // URL instead of base64
          paymentDate: new Date().toISOString(),
          requestedSeason: targetSeason,
          requestedPlan: paymentMethod
        }, false);
        alert(`Payment submitted for ${targetSeason}! Awaiting admin approval.`);
      }
      setPaymentMethod("");
      setProofImage("");
      setProofFile(null);
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

        {availableSeasons.length > 1 && (
          <div style={{ marginTop: '24px', display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select Season:</span>
            <select
              value={targetSeason}
              onChange={(e) => setTargetSeason(e.target.value)}
              className="glass"
              style={{ padding: '4px 12px', minWidth: '150px' }}
            >
              {availableSeasons.map(s => (
                <option key={s.name} value={s.name}>{s.label}: {s.name}</option>
              ))}
            </select>
          </div>
        )}
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

            {plan.id === 'elite' && hasSelectedSeason && (
              <p style={{ fontSize: '0.7rem', color: 'var(--success)', textAlign: 'center', marginTop: '12px', fontWeight: 700 }}>
                ✓ You have access for {targetSeason}
              </p>
            )}
          </div>
        ))}
      </div>

      {!isNativeApp && paymentMethod && (
        <div className="card glass animate-fade-in" style={{ border: '1px solid var(--accent-cyan)', padding: '40px' }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Finalize Your {paymentMethod === 'elite' ? 'Elite' : 'Standard'} Pass for {targetSeason}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>Option 1: PayPal</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Send £5.99 to:</p>
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
