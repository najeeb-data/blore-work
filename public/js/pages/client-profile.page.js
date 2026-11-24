import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getUserProfile, saveUserProfile } from '/js/services/user.service.js';
import { uploadImage } from '/js/services/upload.service.js';
import { showToast } from '/js/components/toast.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
import { BANGALORE_LOCATIONS } from '/js/config/data.js';

initNavbar();
initBottomNav();

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const BUSINESS_CATEGORIES = [
  'Catering & Food Services', 'Event Management', 'Hotel / Restaurant',
  'Retail Shop / Showroom', 'Warehouse & Logistics', 'Delivery / Courier',
  'Security Agency', 'Manpower / Staffing Agency', 'Housekeeping & Facility Management',
  'Construction & Real Estate', 'Marketing / Promotion Agency', 'Office / Corporate',
  'Manufacturing / Factory', 'Hospital / Clinic', 'Education / Institute', 'Other'
];

const DESC_MAX = 500;
const WHATSAPP_MAX = 5;

const LOCATION_ALIASES = {
  'MG Road': ['mahatma gandhi road'], 'Indiranagar': ['indranagar', 'indira nagar'],
  'Ulsoor': ['halasuru'], 'Marathahalli': ['marathalli'], 'KR Puram': ['k r puram'],
  'Electronic City': ['ecity', 'e city'], 'BTM Layout': ['btm'], 'HSR Layout': ['hsr'],
  'JP Nagar': ['j p nagar'], 'RR Nagar': ['rajarajeshwari nagar'], 'Yeshwanthpur': ['yeshwantpur'],
  'Manyata Tech Park': ['manyata'], 'Malleshwaram': ['malleswaram'], 'Devanahalli': ['airport']
};

// Flatten { region: [areas] } → [{ label, group }]
const LOCATIONS = Object.entries(BANGALORE_LOCATIONS).flatMap(([group, areas]) =>
  areas.map((label) => ({ label, group }))
);

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */
const state = {
  locs: [],
  whatsapp: [],          // 10-digit strings (may be '' while editing)
  profile: null
};
let locsTouched = false;
let selectedFile = null;
let previewObjectUrl = null;
let savedLogoUrl = '';
let currentUser = null;
let loadedForUid = null;
let saving = false;

const $ = (id) => document.getElementById(id);
const val = (id) => ($(id)?.value || '').trim();

const logoInput = $('logo-input');
const logoPreview = $('logo-preview');

/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// Accepts "9876543210", "+91 98765 43210", "09876543210", "919876543210".
function toMobile10(v) {
  let d = onlyDigits(v);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
const isMobile = (v) => /^[6-9]\d{9}$/.test(toMobile10(v));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);
const isPincode = (v) => /^[1-9]\d{5}$/.test(v);

function normalizeUrl(v, mustInclude) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return null;
    if (mustInclude && !mustInclude.some((h) => u.hostname.replace(/^www\./, '').endsWith(h))) return null;
    return u.href;
  } catch {
    return null;
  }
}

// Instagram accepts "@handle", "handle" or a full link.
function normalizeInstagram(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const handle = s.replace(/^@/, '');
  if (/^[a-z0-9._]{1,30}$/i.test(handle) && !handle.includes('..') && !/\.(com|in|net|org)$/i.test(handle)) {
    return `https://instagram.com/${handle}`;
  }
  return normalizeUrl(s, ['instagram.com']);
}
const normalizeFacebook = (v) => normalizeUrl(v, ['facebook.com', 'fb.com', 'fb.me']);

function formatMobile(d) {
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

/* ------------------------------------------------------------------ *
 * Inline errors
 * ------------------------------------------------------------------ */
function setError(id, message) {
  const input = $(id);
  const slot = document.querySelector(`[data-error-for="${id}"]`);
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (slot) slot.textContent = message || '';
  return !message;
}

const FIELD_RULES = {
  'biz-name': () => (val('biz-name').length >= 2 ? '' : 'Enter your business name.'),
  'biz-phone': () => (!val('biz-phone') || isMobile(val('biz-phone')) ? '' : 'Enter a valid 10-digit mobile number.'),
  'biz-email': () => (!val('biz-email') || isEmail(val('biz-email')) ? '' : 'Enter a valid email address.'),
  'biz-pincode': () => (!val('biz-pincode') || isPincode(val('biz-pincode')) ? '' : 'PIN code must be 6 digits.'),
  'biz-website': () => (normalizeUrl(val('biz-website')) === null ? 'Enter a valid website, e.g. www.example.com' : ''),
  'biz-instagram': () => (normalizeInstagram(val('biz-instagram')) === null ? 'Enter an Instagram handle or instagram.com link.' : ''),
  'biz-facebook': () => (normalizeFacebook(val('biz-facebook')) === null ? 'Enter a facebook.com link.' : '')
};

function validateField(id) {
  const rule = FIELD_RULES[id];
  return rule ? setError(id, rule()) : true;
}

/* ------------------------------------------------------------------ *
 * Category select
 * ------------------------------------------------------------------ */
const categorySelect = $('biz-category');
BUSINESS_CATEGORIES.forEach((c) => {
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = c;
  categorySelect.appendChild(opt);
});

function setCategory(value) {
  if (!value) { categorySelect.value = ''; return; }
  // Keep a previously saved value even if it's not in today's list.
  if (![...categorySelect.options].some((o) => o.value === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    categorySelect.appendChild(opt);
  }
  categorySelect.value = value;
}

/* ------------------------------------------------------------------ *
 * Description counter
 * ------------------------------------------------------------------ */
const descInput = $('biz-desc');
const descCounter = $('desc-counter');
function updateCounter() {
  const n = descInput.value.length;
  descCounter.textContent = `${n} / ${DESC_MAX}`;
  descCounter.classList.toggle('is-near', n >= DESC_MAX * 0.9);
}
descInput.addEventListener('input', updateCounter);

/* ------------------------------------------------------------------ *
 * Identity header (live preview)
 * ------------------------------------------------------------------ */
function updateIdentity() {
  $('identity-name').textContent = val('biz-name') || 'Your business name';
  const cat = categorySelect.value;
  const catEl = $('identity-category');
  catEl.textContent = cat || 'Add a business category';
  catEl.classList.toggle('is-empty', !cat);
}

/* ------------------------------------------------------------------ *
 * Service area picker (search + chips)
 * ------------------------------------------------------------------ */
const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const locIndex = LOCATIONS.map(({ label, group }) => {
  const words = [label, ...(LOCATION_ALIASES[label] || [])].map(normalize);
  return { label, group, norm: normalize(label), words, compact: words.map((w) => w.replace(/ /g, '')) };
});

function searchLocations(term) {
  const q = normalize(term);
  const available = locIndex.filter((it) => !state.locs.includes(it.label));
  if (!q) return available;
  const qc = q.replace(/ /g, '');
  const qWords = q.split(' ');
  return available
    .map((it) => {
      let score = -1;
      if (it.norm === q) score = 100;
      else if (it.norm.startsWith(q)) score = 80;
      else if (it.norm.split(' ').some((w) => w.startsWith(q))) score = 70;
      else if (it.words.some((w) => w.includes(q))) score = 50;
      else if (qc.length > 1 && it.compact.some((w) => w.includes(qc))) score = 40;
      else if (normalize(it.group).includes(q)) score = 30;
      else if (qWords.every((w) => it.words.some((h) => h.includes(w)))) score = 20;
      return { it, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.it.label.localeCompare(b.it.label))
    .map((x) => x.it);
}

const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

const chipsBox = $('selected-locs');
const locInput = $('search-locs');
const suggestBox = $('suggest-locs');
const locWrapper = locInput.closest('.wp-search');
let locMatches = [];
let locActive = -1;
let locOpen = false;

function renderChips() {
  chipsBox.replaceChildren();
  state.locs.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'wp-chip';
    const text = document.createElement('span');
    text.className = 'wp-chip__text';
    text.textContent = item;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'wp-chip__remove';
    remove.dataset.remove = item;
    remove.setAttribute('aria-label', `Remove ${item}`);
    remove.innerHTML = CLOSE_SVG;
    chip.append(text, remove);
    chipsBox.appendChild(chip);
  });
  updateCompleteness();
}

function renderSuggestions() {
  locMatches = searchLocations(locInput.value);
  locActive = -1;
  suggestBox.replaceChildren();
  if (!locMatches.length) {
    const empty = document.createElement('div');
    empty.className = 'wp-suggest__empty';
    empty.textContent = normalize(locInput.value) ? `No areas match “${locInput.value.trim()}”` : 'All areas already added';
    suggestBox.appendChild(empty);
    return;
  }
  locMatches.forEach((it, i) => {
    const item = document.createElement('div');
    item.className = 'wp-suggest__item bp-suggest__item';
    item.id = `suggest-locs-opt-${i}`;
    item.setAttribute('role', 'option');
    item.dataset.value = it.label;
    const name = document.createElement('span');
    name.textContent = it.label;
    const group = document.createElement('span');
    group.className = 'bp-suggest__group';
    group.textContent = it.group;
    item.append(name, group);
    suggestBox.appendChild(item);
  });
}

function openSuggest() {
  renderSuggestions();
  locOpen = true;
  suggestBox.classList.add('active');
  locWrapper.classList.add('is-open');
  document.body.classList.add('wp-picker-open');
  locInput.setAttribute('aria-expanded', 'true');
}

function closeSuggest() {
  locOpen = false;
  locActive = -1;
  suggestBox.classList.remove('active');
  locWrapper.classList.remove('is-open');
  document.body.classList.remove('wp-picker-open');
  locInput.setAttribute('aria-expanded', 'false');
  locInput.removeAttribute('aria-activedescendant');
}

function highlight(i) {
  const items = suggestBox.querySelectorAll('.wp-suggest__item');
  items.forEach((el) => el.classList.remove('is-active'));
  locActive = i;
  if (items[i]) {
    items[i].classList.add('is-active');
    items[i].scrollIntoView({ block: 'nearest' });
    locInput.setAttribute('aria-activedescendant', items[i].id);
  }
}

function addLocation(label) {
  if (!label || state.locs.includes(label)) return;
  state.locs = [...state.locs, label];
  locsTouched = true;
  renderChips();
  locInput.value = '';
  openSuggest();
  locInput.focus();
}

function removeLocation(label) {
  state.locs = state.locs.filter((l) => l !== label);
  locsTouched = true;
  renderChips();
  if (locOpen) renderSuggestions();
}

locInput.addEventListener('focus', () => {
  openSuggest();
  if (window.matchMedia('(max-width: 767px)').matches) {
    setTimeout(() => locInput.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
  }
});
locInput.addEventListener('click', () => { if (!locOpen) openSuggest(); });
locInput.addEventListener('input', openSuggest);
locInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // never submit the form from the search box
    if (!locOpen) { openSuggest(); return; }
    const pick = locActive >= 0 ? locMatches[locActive] : (normalize(locInput.value) ? locMatches[0] : null);
    if (pick) addLocation(pick.label);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!locOpen) openSuggest();
    if (locMatches.length) highlight(Math.min(locActive + 1, locMatches.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (locMatches.length) highlight(Math.max(locActive - 1, 0));
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    closeSuggest();
  }
});

// Keep focus on the input while tapping the list; select on click (not fired on scroll-drag).
suggestBox.addEventListener('mousedown', (e) => e.preventDefault());
suggestBox.addEventListener('click', (e) => {
  const item = e.target.closest('.wp-suggest__item');
  if (item) addLocation(item.dataset.value);
});
chipsBox.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (btn) removeLocation(btn.dataset.remove);
});
document.addEventListener('pointerdown', (e) => {
  if (locOpen && !locInput.contains(e.target) && !suggestBox.contains(e.target)) closeSuggest();
});

/* ------------------------------------------------------------------ *
 * WhatsApp numbers
 * ------------------------------------------------------------------ */
const waList = $('whatsapp-list');
const addWaBtn = $('add-whatsapp-btn');

function waErrors() {
  const errors = state.whatsapp.map(() => '');
  const seen = new Map();
  state.whatsapp.forEach((num, i) => {
    if (!num) return;
    if (!isMobile(num)) { errors[i] = 'Enter a valid 10-digit mobile number.'; return; }
    const d = toMobile10(num);
    if (seen.has(d)) errors[i] = 'This number is already added.';
    else seen.set(d, i);
  });
  return errors;
}

function renderWhatsapp(focusIndex = -1) {
  waList.replaceChildren();

  if (!state.whatsapp.length) {
    const empty = document.createElement('p');
    empty.className = 'bp-empty';
    empty.textContent = 'No WhatsApp numbers added yet.';
    waList.appendChild(empty);
  }

  state.whatsapp.forEach((num, i) => {
    const row = document.createElement('div');
    row.className = 'bp-wa-row';

    const group = document.createElement('div');
    group.className = 'bp-phone';
    const code = document.createElement('span');
    code.className = 'bp-phone__code';
    code.textContent = '+91';
    const input = document.createElement('input');
    input.type = 'tel';
    input.inputMode = 'numeric';
    input.className = 'wp-input bp-phone__input';
    input.placeholder = '98765 43210';
    input.maxLength = 14;
    input.value = num;
    input.dataset.waIndex = String(i);
    input.setAttribute('aria-label', `WhatsApp number ${i + 1}`);
    group.append(code, input);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bp-icon-btn';
    remove.dataset.waRemove = String(i);
    remove.setAttribute('aria-label', `Remove WhatsApp number ${i + 1}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';

    const err = document.createElement('p');
    err.className = 'bp-error bp-wa-row__error';
    err.dataset.waError = String(i);

    row.append(group, remove, err);
    waList.appendChild(row);
  });

  $('whatsapp-count').textContent = state.whatsapp.length ? `${state.whatsapp.length} / ${WHATSAPP_MAX}` : '';
  addWaBtn.disabled = state.whatsapp.length >= WHATSAPP_MAX;
  if (focusIndex >= 0) waList.querySelector(`[data-wa-index="${focusIndex}"]`)?.focus();
  updateCompleteness();
}

function showWaErrors(onlyIndex = null) {
  const errors = waErrors();
  errors.forEach((msg, i) => {
    if (onlyIndex !== null && i !== onlyIndex) return;
    const slot = waList.querySelector(`[data-wa-error="${i}"]`);
    const input = waList.querySelector(`[data-wa-index="${i}"]`);
    if (slot) slot.textContent = msg;
    if (input) msg ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
  });
  return errors.every((m) => !m);
}

addWaBtn.addEventListener('click', () => {
  if (state.whatsapp.length >= WHATSAPP_MAX) return;
  state.whatsapp.push('');
  renderWhatsapp(state.whatsapp.length - 1);
});

waList.addEventListener('input', (e) => {
  const i = e.target.dataset.waIndex;
  if (i === undefined) return;
  state.whatsapp[Number(i)] = e.target.value;
  updateCompleteness();
});
waList.addEventListener('focusout', (e) => {
  const i = e.target.dataset.waIndex;
  if (i === undefined) return;
  const d = toMobile10(e.target.value);
  if (/^[6-9]\d{9}$/.test(d)) {
    e.target.value = formatMobile(d);
    state.whatsapp[Number(i)] = e.target.value;
  }
  showWaErrors();
});
waList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-wa-remove]');
  if (!btn) return;
  state.whatsapp.splice(Number(btn.dataset.waRemove), 1);
  renderWhatsapp();
  showWaErrors();
});

/* ------------------------------------------------------------------ *
 * Verification card (backend: admin toggles users/{uid}.isVerified)
 * ------------------------------------------------------------------ */
const VERIFY_VIEW = {
  verified: {
    badge: ['bp-badge--verified', 'badge-check', 'Verified'],
    icon: 'badge-check', title: 'Verified business',
    text: 'Your business is verified. Workers see a blue tick on your jobs and profile.',
    button: null
  },
  pending: {
    badge: ['bp-badge--pending', 'clock', 'Verification pending'],
    icon: 'clock', title: 'Verification pending',
    text: 'We have your request. The BloreWork team will review your business details.',
    button: null
  },
  none: {
    badge: ['bp-badge--none', 'shield', 'Not verified'],
    icon: 'shield', title: 'Not verified',
    text: 'Verified businesses get a blue tick on their jobs and profile. Complete your name and phone number, then request a review.',
    button: 'Request verification'
  }
};

function verificationStatus(profile) {
  if (profile?.isVerified) return 'verified';
  if (profile?.verificationRequestedAt) return 'pending';
  return 'none';
}

function renderVerification() {
  const status = verificationStatus(state.profile);
  const view = VERIFY_VIEW[status];

  const badge = $('verified-badge');
  badge.className = `bp-badge ${view.badge[0]}`;
  badge.innerHTML = `<i data-lucide="${view.badge[1]}"></i>`;
  const label = document.createElement('span');
  label.textContent = view.badge[2];
  badge.appendChild(label);

  const card = $('verification-card');
  card.dataset.status = status;
  $('verification-icon').innerHTML = `<i data-lucide="${view.icon}"></i>`;
  $('verification-title').textContent = view.title;
  $('verification-status-text').textContent = view.text;

  const btn = $('request-verification-btn');
  btn.hidden = !view.button;
  refreshIcons();
}

$('request-verification-btn').addEventListener('click', async () => {
  if (!currentUser) return;
  if (val('biz-name').length < 2 || !isMobile(val('biz-phone'))) {
    showToast('Add your business name and a valid phone number first.', 'error');
    validateField('biz-name');
    validateField('biz-phone');
    return;
  }
  const btn = $('request-verification-btn');
  btn.disabled = true;
  try {
    const requestedAt = new Date().toISOString();
    await saveUserProfile(currentUser.uid, { verificationRequestedAt: requestedAt });
    state.profile = { ...(state.profile || {}), verificationRequestedAt: requestedAt };
    renderVerification();
    showToast('Verification requested.', 'success');
  } catch (err) {
    console.error(err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ------------------------------------------------------------------ *
 * Profile completeness
 * ------------------------------------------------------------------ */
const COMPLETENESS = [
  { label: 'business name', weight: 15, ok: () => val('biz-name').length >= 2 },
  { label: 'logo', weight: 10, ok: () => !!(savedLogoUrl || selectedFile) },
  { label: 'category', weight: 10, ok: () => !!categorySelect.value },
  { label: 'description (30+ characters)', weight: 10, ok: () => val('biz-desc').length >= 30 },
  { label: 'contact person', weight: 5, ok: () => val('biz-contact').length >= 2 },
  { label: 'phone number', weight: 15, ok: () => isMobile(val('biz-phone')) },
  { label: 'email', weight: 5, ok: () => isEmail(val('biz-email')) },
  { label: 'full address with PIN code', weight: 15, ok: () => val('biz-address').length >= 5 && !!val('biz-city') && isPincode(val('biz-pincode')) },
  { label: 'service areas', weight: 10, ok: () => state.locs.length > 0 },
  { label: 'WhatsApp number', weight: 5, ok: () => state.whatsapp.some((n) => isMobile(n)) }
];

function updateCompleteness() {
  let score = 0;
  const missing = [];
  COMPLETENESS.forEach((c) => (c.ok() ? (score += c.weight) : missing.push(c.label)));
  if (missing.length && score >= 100) score = 99; // never 100% with something missing

  $('completion-percent').textContent = `${score}%`;
  $('completion-bar').style.width = `${score}%`;
  $('completion-track').setAttribute('aria-valuenow', String(score));
  const track = $('completion-track');
  track.classList.toggle('is-complete', !missing.length);

  $('completion-hint').textContent = missing.length
    ? `Add ${missing.slice(0, 2).join(' and ')}${missing.length > 2 ? ` +${missing.length - 2} more` : ''} to complete your profile.`
    : 'Your profile is complete.';
}

/* ------------------------------------------------------------------ *
 * Form-wide listeners
 * ------------------------------------------------------------------ */
const form = $('profile-form');

form.addEventListener('input', (e) => {
  if (e.target.id === 'biz-name') updateIdentity();
  if (e.target.id && FIELD_RULES[e.target.id] && e.target.getAttribute('aria-invalid')) validateField(e.target.id);
  updateCompleteness();
});
form.addEventListener('change', (e) => {
  if (e.target === categorySelect) updateIdentity();
  updateCompleteness();
});
form.addEventListener('focusout', (e) => {
  const id = e.target.id;
  if (!id || !FIELD_RULES[id]) return;
  if (id === 'biz-phone' && isMobile(e.target.value)) e.target.value = formatMobile(toMobile10(e.target.value));
  if (id === 'biz-pincode') e.target.value = onlyDigits(e.target.value).slice(0, 6);
  validateField(id);
});

/* ------------------------------------------------------------------ *
 * Logo
 * ------------------------------------------------------------------ */
document.querySelectorAll('[data-logo-trigger]').forEach((b) => b.addEventListener('click', () => logoInput.click()));

logoInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    logoInput.value = '';
    return;
  }
  selectedFile = file;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  logoPreview.src = previewObjectUrl;
  updateCompleteness();
});

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */
function toList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))];
}

function fillForm(p, user) {
  $('biz-name').value = p.businessName || '';
  setCategory(p.businessCategory || '');
  descInput.value = p.businessDescription || '';
  $('biz-contact').value = p.contactPerson || '';
  const phone10 = toMobile10(p.phone);
  $('biz-phone').value = /^[6-9]\d{9}$/.test(phone10) ? formatMobile(phone10) : (p.phone || '');
  $('biz-email').value = p.email || user?.email || '';
  $('biz-address').value = p.address || '';
  $('biz-city').value = p.city || 'Bengaluru';
  $('biz-state').value = p.state || 'Karnataka';
  $('biz-pincode').value = p.pincode || '';
  $('biz-website').value = p.website || '';
  $('biz-instagram').value = p.instagram || '';
  $('biz-facebook').value = p.facebook || '';

  if (p.logoUrl) {
    savedLogoUrl = p.logoUrl;
    if (!selectedFile) logoPreview.src = p.logoUrl;
  }

  // Service areas: businessLocations (comma string), falling back to legacy locationArea.
  const loaded = toList(p.businessLocations || p.locationArea || '');
  state.locs = locsTouched ? [...new Set([...loaded, ...state.locs])] : loaded;

  const wa = toList(p.whatsappNumbers || p.whatsapp || '');
  state.whatsapp = wa.map((n) => {
    const d = toMobile10(n);
    return /^[6-9]\d{9}$/.test(d) ? formatMobile(d) : n;
  });
}

onAuthChange(async (user) => {
  currentUser = user || null;
  if (!user || loadedForUid === user.uid) return;
  loadedForUid = user.uid;

  try {
    const profile = await getUserProfile(user.uid);
    state.profile = profile || {};
    fillForm(state.profile, user);
  } catch (err) {
    console.error('Error loading profile', err);
    showToast('Could not load your business profile. Please refresh.', 'error');
  } finally {
    updateCounter();
    updateIdentity();
    renderChips();
    renderWhatsapp();
    renderVerification();
    updateCompleteness();
  }
});

/* ------------------------------------------------------------------ *
 * Save
 * ------------------------------------------------------------------ */
const saveBtn = $('save-btn');
const saveLabel = saveBtn.querySelector('.wp-save__label');

function validateAll() {
  let firstInvalid = null;
  Object.keys(FIELD_RULES).forEach((id) => {
    if (!validateField(id) && !firstInvalid) firstInvalid = $(id);
  });
  if (!showWaErrors() && !firstInvalid) firstInvalid = waList.querySelector('[aria-invalid="true"]');
  return firstInvalid;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving) return;
  if (!currentUser) {
    showToast('Please log in again to save your profile.', 'error');
    return;
  }

  closeSuggest();
  const firstInvalid = validateAll();
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  saving = true;
  const originalText = saveLabel.textContent;
  saveLabel.textContent = 'Saving...';
  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');

  try {
    let logoUrl = savedLogoUrl;
    if (selectedFile) logoUrl = await uploadImage(selectedFile, 'client-logos');

    const phone10 = toMobile10(val('biz-phone'));
    const whatsappNumbers = [...new Set(
      state.whatsapp.filter((n) => isMobile(n)).map((n) => `+91${toMobile10(n)}`)
    )];

    const data = {
      businessName: val('biz-name'),
      businessCategory: categorySelect.value,
      businessDescription: val('biz-desc').slice(0, DESC_MAX),
      contactPerson: val('biz-contact'),
      phone: phone10 ? `+91${phone10}` : '',
      email: val('biz-email'),
      address: val('biz-address'),
      city: val('biz-city'),
      state: val('biz-state'),
      pincode: val('biz-pincode'),
      businessLocations: state.locs.join(', '),
      website: normalizeUrl(val('biz-website')) || '',
      instagram: normalizeInstagram(val('biz-instagram')) || '',
      facebook: normalizeFacebook(val('biz-facebook')) || '',
      whatsappNumbers
    };
    if (logoUrl) data.logoUrl = logoUrl; // never save the placeholder image

    // merge: true in saveUserProfile keeps isVerified, role, ratings, etc. untouched.
    await saveUserProfile(currentUser.uid, data);

    state.profile = { ...(state.profile || {}), ...data };
    savedLogoUrl = logoUrl || savedLogoUrl;
    selectedFile = null;
    logoInput.value = '';
    locsTouched = false;

    // Show the normalized values the user just saved.
    $('biz-website').value = data.website;
    $('biz-instagram').value = data.instagram;
    $('biz-facebook').value = data.facebook;
    state.whatsapp = whatsappNumbers.map((n) => formatMobile(toMobile10(n)));
    renderWhatsapp();
    updateCompleteness();

    showToast('Business profile saved successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    saving = false;
    saveLabel.textContent = originalText;
    saveBtn.disabled = false;
    saveBtn.classList.remove('is-loading');
  }
});

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

updateCounter();
updateIdentity();
renderChips();
renderWhatsapp();
renderVerification();
updateCompleteness();
