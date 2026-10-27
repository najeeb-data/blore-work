// Auth API for the whole app. Callers import from here — never from the Firebase SDK directly.

import { getFirebase } from './firebase.service.js';
import { isConfigured } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export function isAuthConfigured() { return isConfigured(); }

// Subscribe to auth state. Always calls back at least once (null when signed out).
// In unconfigured mode, calls back with null immediately and returns a no-op unsubscribe.
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

// Reads role from the ID token's custom claims (set server-side; user cannot self-assign).
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

// Returns a ConfirmationResult. Element id must exist in the DOM.
export async function startPhoneOTP(phoneNumber, recaptchaContainerId) {
  const [{ auth }, authMod] = await Promise.all([getFirebase(), import(`${SDK}/firebase-auth.js`)]);
  const verifier = new authMod.RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  return authMod.signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function confirmPhoneOTP(confirmation, code) {
  return confirmation.confirm(code);
}
