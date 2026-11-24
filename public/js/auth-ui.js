import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDooWCHltCIiIx2HWNank4Wm73geScyBYY",
  authDomain: "bloreworks.firebaseapp.com",
  projectId: "bloreworks",
  storageBucket: "bloreworks.firebasestorage.app",
  messagingSenderId: "542506113557",
  appId: "1:542506113557:web:993ddf8273bb17eb528c1c",
  measurementId: "G-M8YQ6J3J45"
};

const USERS_COLLECTION = "users";
const REDIRECT = {
  worker: "/pages/worker/dashboard.html",
  client: "/pages/client/dashboard.html"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
const mode = document.body.dataset.mode;
let role = new URLSearchParams(location.search).get("role") === "client" ? "client" : "worker";

let busy = false;
let confirmation = null;
let verifier = null;
let timer = null;

function showMsg(text, type = "error") {
  const box = $("authMsg");
  box.textContent = text;
  box.className = "auth-msg " + type;
  box.hidden = !text;
}

function setBusy(on, label) {
  busy = on;
  ["googleBtn", "sendOtpBtn"].forEach(id => { if($(id)) $(id).disabled = on; });
  if (label && $("sendOtpBtn")) $("sendOtpBtn").textContent = label;
}

function normalizePhone(value) {
  const v = value.replace(/[\s-]/g, "");
  if (/^\d{10}$/.test(v)) return "+91" + v;
  if (/^\+\d{10,15}$/.test(v)) return v;
  return null;
}

function friendlyError(err) {
  const map = {
    "auth/invalid-phone-number": "That phone number does not look right. Please check it.",
    "auth/too-many-requests": "Too many tries. Please wait a few minutes and try again.",
    "auth/invalid-verification-code": "That code is wrong. Please check and try again.",
    "auth/code-expired": "That code has expired. Tap Resend OTP.",
    "auth/network-request-failed": "No internet. Please check your connection.",
    "auth/popup-closed-by-user": "Google sign-in was closed. Please try again.",
    "auth/captcha-check-failed": "Security check failed. Please refresh the page and try again.",
    "auth/quota-exceeded": "SMS limit reached. Please try again later."
  };
  return map[err?.code] || (err.message || "Something went wrong. Please try again.");
}

function updateTitle() {
  if (mode !== "register") return;
  if ($("authTitle")) {
    $("authTitle").textContent = role === "client" ? "Create Client Account" : "Create Worker Account";
  }
  document.querySelectorAll(".role-switch .chip").forEach(b =>
    b.classList.toggle("active", b.dataset.role === role));
}

async function finish(user) {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  let savedRole = role;
  try {
    const snap = await getDoc(ref);
    if (mode === "register" && !snap.exists()) {
      await setDoc(ref, {
        role,
        name: user.displayName || null,
        email: user.email || null,
        phone: user.phoneNumber || null,
        createdAt: serverTimestamp()
      });
    } else if (snap.exists() && snap.data().role) {
      savedRole = snap.data().role;
    }
  } catch (e) {
    console.error("Could not save user data", e);
    showMsg("You are signed in, but we could not save your details. Please try again.");
    setBusy(false);
    return;
  }
  location.href = REDIRECT[savedRole] || REDIRECT.worker;
}

async function googleSignIn() {
  showMsg("");
  setBusy(true);
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await finish(result.user);
  } catch (err) {
    if (err.code === "auth/popup-blocked") {
      sessionStorage.setItem("authRole", role);
      return signInWithRedirect(auth, provider);
    }
    showMsg(friendlyError(err));
    setBusy(false);
  }
}

function makeVerifier() {
  if (verifier) { try { verifier.clear(); } catch (_) {} }
  if ($("sendOtpBtn")) {
    verifier = new RecaptchaVerifier(auth, "sendOtpBtn", { size: "invisible" });
  }
}

function startResendTimer() {
  let left = 30;
  const btn = $("resendBtn");
  if (!btn) return;
  btn.disabled = true;
  clearInterval(timer);
  timer = setInterval(() => {
    left--;
    btn.textContent = left > 0 ? `Resend OTP in ${left}s` : "Resend OTP";
    if (left <= 0) { clearInterval(timer); btn.disabled = false; }
  }, 1000);
  btn.textContent = `Resend OTP in ${left}s`;
}

async function sendOtp() {
  showMsg("");
  const phone = normalizePhone($("phone").value);
  if (!phone) return showMsg("Please enter a valid phone number.");
  setBusy(true, "Sending...");
  try {
    if (!verifier) makeVerifier();
    confirmation = await signInWithPhoneNumber(auth, phone, verifier);
    $("otpField").hidden = false;
    $("otp").focus();
    $("phone").readOnly = true;
    showMsg("We sent a code to " + phone + ".", "info");
    startResendTimer();
    setBusy(false, "Verify OTP");
  } catch (err) {
    makeVerifier();
    showMsg(friendlyError(err));
    setBusy(false, "Send OTP");
  }
}

async function verifyOtp() {
  showMsg("");
  const code = $("otp").value.trim();
  if (code.length !== 6) return showMsg("Please enter the 6-digit code.");
  setBusy(true, "Checking...");
  try {
    const result = await confirmation.confirm(code);
    await finish(result.user);
  } catch (err) {
    showMsg(friendlyError(err));
    setBusy(false, "Verify OTP");
  }
}

function resendOtp() {
  confirmation = null;
  $("phone").readOnly = false;
  $("otp").value = "";
  makeVerifier();
  sendOtp();
}

document.querySelectorAll(".role-switch .chip").forEach(b =>
  b.addEventListener("click", () => { role = b.dataset.role; updateTitle(); }));

if ($("googleBtn")) $("googleBtn").addEventListener("click", googleSignIn);
if ($("sendOtpBtn")) $("sendOtpBtn").addEventListener("click", () => (confirmation ? verifyOtp() : sendOtp()));
if ($("resendBtn")) $("resendBtn").addEventListener("click", resendOtp);
updateTitle();

(async () => {
  await auth.authStateReady();
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      role = sessionStorage.getItem("authRole") || role;
      busy = true;
      return finish(redirectResult.user);
    }
  } catch (err) { showMsg(friendlyError(err)); }
  if (auth.currentUser && !busy) {
    location.href = REDIRECT[role] || REDIRECT.worker;
  }
})();
