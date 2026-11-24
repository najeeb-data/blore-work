import { initNavbar } from '/js/components/navbar.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile, saveUserProfile } from '/js/services/user.service.js';
import { showToast } from '/js/components/toast.js';

initNavbar();

async function setupPage() {
  const { auth } = await getFirebase();
  if (!auth.currentUser) {
    window.location.href = '/pages/auth/login.html';
    return;
  }

  const profile = await getUserProfile(auth.currentUser.uid);
  const role = profile?.role || 'worker';

  if (role === 'client') {
    document.getElementById('sub-title').textContent = 'Client Subscription';
    document.getElementById('sub-desc').textContent = 'Subscribe to post jobs and hire workers.';
    document.getElementById('plan-price').textContent = '₹49';
    document.getElementById('feature-1').textContent = '✅ Post unlimited jobs';
    document.getElementById('feature-2').textContent = '✅ See worker contact details';
  } else {
    document.getElementById('sub-title').textContent = 'Worker Subscription';
    document.getElementById('sub-desc').textContent = 'Subscribe to reveal WhatsApp contacts.';
    document.getElementById('plan-price').textContent = '₹9';
    document.getElementById('feature-1').textContent = '✅ Reveal client WhatsApp numbers';
    document.getElementById('feature-2').textContent = '✅ Get hired faster';
  }

  // Check if already active
  if (profile?.subscriptionExpires > Date.now()) {
    document.getElementById('subscribe-btn').textContent = 'Active until ' + new Date(profile.subscriptionExpires).toLocaleDateString();
    document.getElementById('subscribe-btn').disabled = true;
    document.getElementById('subscribe-btn').style.background = 'var(--color-success)';
  }
}

setupPage();

document.getElementById('subscribe-btn').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    const { auth } = await getFirebase();
    // Simulate 30 days subscription
    const thirtyDaysFromNow = Date.now() + (30 * 24 * 60 * 60 * 1000);
    
    await saveUserProfile(auth.currentUser.uid, {
      subscriptionExpires: thirtyDaysFromNow
    });
    
    showToast('Subscription activated successfully!', 'success');
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    showToast(err.message);
    btn.textContent = 'Subscribe Now';
    btn.disabled = false;
  }
});
