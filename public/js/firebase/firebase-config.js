// Firebase project config. Fill these in from Firebase Console → Project Settings → Your apps.
// Until configured, the app runs in "logged out" mode and auth buttons are inert.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// Public keys — safe in frontend code. Secrets stay in Cloud Functions.
export const RAZORPAY_KEY_ID = "REPLACE_ME";
export const GOOGLE_MAPS_API_KEY = "REPLACE_ME";

export function isConfigured() {
  return typeof firebaseConfig.apiKey === 'string' && !firebaseConfig.apiKey.startsWith('REPLACE_ME');
}
