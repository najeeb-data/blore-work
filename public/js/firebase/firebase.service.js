// Lazy-initializes Firebase only when actually needed. Uses the modular SDK from CDN —
// no bundler, no build step, per the vanilla-ESM project rule.

import { firebaseConfig, isConfigured } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';
let _promise = null;

async function load() {
  if (!isConfigured()) {
    throw new Error('Firebase not configured. Edit public/js/firebase/firebase-config.js');
  }
  const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

export function getFirebase() {
  if (!_promise) _promise = load();
  return _promise;
}
