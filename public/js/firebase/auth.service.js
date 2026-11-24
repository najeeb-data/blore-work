// Auth API for the whole app.
import { getFirebase } from './firebase.service.js';
import { isConfigured } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export function isAuthConfigured() { return isConfigured(); }

export async function onAuthChange(callback) {
  if (!isConfigured()) { callback(null); return () => {}; }
  const [{ auth }, authMod] = await Promise.all([getFirebase(), import(`${SDK}/firebase-auth.js`)]);
  return authMod.onAuthStateChanged(auth, callback);
}

export async function signOut() {
  if (!isConfigured()) return;
  const [{ auth }, authMod] = await Promise.all([getFirebase(), import(`${SDK}/firebase-auth.js`)]);
  await authMod.signOut(auth);
}

export async function getCurrentUserRole() {
  if (!isConfigured()) return null;
  const { auth } = await getFirebase();
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult();
  return token.claims.role || 'worker';
}

export async function signInWithGoogle() {
  const [{ auth }, authMod] = await Promise.all([getFirebase(), import(`${SDK}/firebase-auth.js`)]);
  const provider = new authMod.GoogleAuthProvider();
  return authMod.signInWithPopup(auth, provider);
}

export async function startPhoneOTP(phoneNumber, recaptchaContainerId) {
  const [{ auth }, authMod] = await Promise.all([getFirebase(), import(`${SDK}/firebase-auth.js`)]);
  
  const container = document.getElementById(recaptchaContainerId);
  if (container) container.innerHTML = '';
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch(e) {}
    window.recaptchaVerifier = null;
  }

  const verifier = new authMod.RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  window.recaptchaVerifier = verifier;
  return authMod.signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function confirmPhoneOTP(confirmation, code) {
  return confirmation.confirm(code);
}