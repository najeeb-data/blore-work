import { auth } from '../../firebase/firebase-config.js';
import { signInWithPopup, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const googleBtn = document.getElementById('google-login-btn');
  const form = document.getElementById('auth-form');
  const phoneInput = document.getElementById('phone');
  const submitBtn = document.getElementById('send-otp-btn');

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        window.location.href = '/pages/worker/profile.html';
      } catch (error) { alert(error.message); }
    });
  }

  if (form) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let phone = phoneInput.value.trim();
      if (!phone.startsWith('+')) phone = '+91' + phone;
      
      submitBtn.textContent = 'Sending...';
      try {
        const confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        const code = prompt("Enter OTP:");
        if (code) {
          await confirmationResult.confirm(code);
          window.location.href = '/pages/worker/profile.html';
        }
      } catch (error) { alert(error.message); }
      finally { submitBtn.textContent = 'Send OTP'; }
    });
  }
});
