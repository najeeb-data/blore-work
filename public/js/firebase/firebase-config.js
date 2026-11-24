// Firebase project config. 
export const firebaseConfig = {
  apiKey: "AIzaSyDooWCHltCIiIx2HWNank4Wm73geScyBYY",
  authDomain: "bloreworks.firebaseapp.com",
  projectId: "bloreworks",
  storageBucket: "bloreworks.firebasestorage.app",
  messagingSenderId: "542506113557",
  appId: "1:542506113557:web:993ddf8273bb17eb528c1c",
  measurementId: "G-M8YQ6J3J45"
};

export const RAZORPAY_KEY_ID = "REPLACE_ME";
export const GOOGLE_MAPS_API_KEY = "AIzaSyBHMpjv51T2kQGhVTWW8Vv3-xsKammHjzQ";

export function isConfigured() {
  return typeof firebaseConfig.apiKey === 'string' && !firebaseConfig.apiKey.startsWith('REPLACE_ME');
}
