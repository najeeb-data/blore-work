import { initNavbar } from '/js/components/navbar.js';
import { showToast } from '/js/components/toast.js';
import { signInWithGoogle, startPhoneOTP, confirmPhoneOTP } from '/js/firebase/auth.service.js';
import { saveUserProfile } from '/js/services/user.service.js';

initNavbar();
const params = new URLSearchParams(window.location.search);
const intendedRole = params.get('role') === 'client' ? 'client' : 'worker';

// Change the heading based on the role
const titleEl = document.getElementById('auth-title');
if (intendedRole === 'worker') titleEl.textContent = 'Create Worker Account';
if (intendedRole === 'client') titleEl.textContent = 'Create Client Account';

let confirmationResult = null;

async function handleSuccess(user) {
  // Save the role to Firestore automatically
  await saveUserProfile(user.uid, { 
    role: intendedRole, 
    phone: user.phoneNumber || '', 
    email: user.email || '',
    createdAt: new Date().toISOString()
  });
  window.location.href = intendedRole === 'client' ? '/pages/client/dashboard.html' : '/pages/worker/dashboard.html';
}

document.getElementById('google-btn').addEventListener('click', async () => {
  try {
    const result = await signInWithGoogle();
    await handleSuccess(result.user);
  } catch (err) { showToast(err.message, 'error'); }
});

document.getElementById('phone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phoneGroup = document.getElementById('phone-group');
  const otpGroup = document.getElementById('otp-group');
  const submitBtn = document.getElementById('submit-btn');
  const phoneInput = document.getElementById('phone-input');
  const otpInput = document.getElementById('otp-input');

  let phone = phoneInput.value.trim();
  if (!phone.startsWith('+')) {
    if (phone.length === 10) phone = '+91' + phone;
    else if (phone.length === 12 && phone.startsWith('91')) phone = '+' + phone;
  }

  if (confirmationResult === null) {
    try {
      submitBtn.textContent = 'Sending...'; submitBtn.disabled = true;
      confirmationResult = await startPhoneOTP(phone, 'recaptcha-container');
      
      // Show OTP field
      phoneGroup.style.display = 'none'; 
      otpGroup.style.display = 'block';
      submitBtn.textContent = 'Verify & Create Account'; 
      submitBtn.disabled = false;
    } catch (err) {
      showToast(err.message, 'error'); submitBtn.textContent = 'Send OTP'; submitBtn.disabled = false;
      if (window.recaptchaVerifier) window.recaptchaVerifier.reset();
    }
  } else {
    try {
      submitBtn.textContent = 'Verifying...'; submitBtn.disabled = true;
      const result = await confirmPhoneOTP(confirmationResult, otpInput.value);
      await handleSuccess(result.user);
    } catch (err) {
      showToast('Invalid OTP. Please try again.', 'error'); submitBtn.textContent = 'Verify & Create Account'; submitBtn.disabled = false;
    }
  }
});
