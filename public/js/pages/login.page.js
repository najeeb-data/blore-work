import { initNavbar } from '/js/components/navbar.js';
import { showToast } from '/js/components/toast.js';
import { signInWithGoogle, startPhoneOTP, confirmPhoneOTP } from '/js/firebase/auth.service.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile } from '/js/services/user.service.js';

initNavbar();
let confirmationResult = null;

async function handleSuccess(user) {
  try {
    const profile = await getUserProfile(user.uid);
    const role = profile?.role || 'worker';
    window.location.href = role === 'client' ? '/pages/client/dashboard.html' : '/pages/worker/dashboard.html';
  } catch (err) {
    window.location.href = '/pages/worker/dashboard.html';
  }
}

document.getElementById('google-btn').addEventListener('click', async () => {
  try {
    const result = await signInWithGoogle();
    await handleSuccess(result.user);
  } catch (err) {
    showToast(err.message, 'error');
  }
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
      phoneGroup.style.display = 'none'; otpGroup.style.display = 'flex';
      submitBtn.textContent = 'Verify OTP'; submitBtn.disabled = false;
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
      showToast('Invalid OTP. Please try again.', 'error'); submitBtn.textContent = 'Verify OTP'; submitBtn.disabled = false;
    }
  }
});
