import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getUserProfile, saveUserProfile } from '/js/services/user.service.js';
import { uploadImage } from '/js/services/upload.service.js';
import { showToast } from '/js/components/toast.js';
import { onAuthChange } from '/js/firebase/auth.service.js';

initNavbar();
initBottomNav();

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */
const WORK_CATEGORIES = [
  "Catering Services", "ODC / Outdoor Catering", "Event Management",
  "Notice / Pamphlet Distribution", "Marketing / Promotion",
  "Housekeeping", "Hotel Work", "Warehouse", "Retail",
  "Office Support", "Delivery", "Security", "Manpower",
  "Construction", "Hospitality", "Sales", "Logistics"
];

const ALL_LOCATIONS = [
  "MG Road", "Brigade Road", "Indiranagar", "Ulsoor", "Shivajinagar", "Commercial Street", "Richmond Town", "Frazer Town", "Koramangala", "Domlur", "Residency Road",
  "Whitefield", "Marathahalli", "Brookefield", "Hoodi", "KR Puram", "Mahadevapura", "Bellandur", "Varthur", "Sarjapur Road", "Kadugodi", "ITPL", "CV Raman Nagar",
  "Hebbal", "Yelahanka", "Jakkur", "Thanisandra", "Hennur", "Nagawara", "RT Nagar", "Sahakara Nagar", "Devanahalli", "Bagalur", "Manyata Tech Park",
  "Jayanagar", "JP Nagar", "BTM Layout", "HSR Layout", "Electronic City", "Banashankari", "Basavanagudi", "Bannerghatta Road", "Bommanahalli", "Arekere", "Hulimavu", "Begur",
  "Rajajinagar", "Vijayanagar", "Basaveshwaranagar", "Malleshwaram", "Yeshwanthpur", "Peenya", "Nagarbhavi", "Kengeri", "RR Nagar", "Magadi Road",
  "Anekal", "Attibele", "Bommasandra", "Jigani", "Chandapura", "Hoskote", "Nelamangala", "Doddaballapur", "Sarjapura", "Kothanur"
];

// Extra search words → list item. Lets people type what they actually say.
const CATEGORY_ALIASES = {
  "Catering Services": ["waiter", "server", "food", "cook", "kitchen", "buffet"],
  "ODC / Outdoor Catering": ["odc", "outdoor", "catering", "wedding", "function"],
  "Event Management": ["event", "events", "party", "decoration", "stage"],
  "Notice / Pamphlet Distribution": ["pamphlet", "flyer", "leaflet", "notice", "distribution"],
  "Marketing / Promotion": ["promoter", "promotion", "branding", "canvassing", "marketing"],
  "Housekeeping": ["cleaning", "cleaner", "maid", "housekeeper"],
  "Hotel Work": ["hotel", "restaurant", "steward"],
  "Warehouse": ["godown", "packing", "loading", "unloading", "picker", "packer"],
  "Retail": ["shop", "store", "mall", "cashier"],
  "Office Support": ["office boy", "peon", "admin", "data entry", "receptionist"],
  "Delivery": ["courier", "rider", "bike", "swiggy", "zomato", "delivery boy"],
  "Security": ["guard", "watchman", "bouncer"],
  "Manpower": ["helper", "labour", "labor", "staffing"],
  "Construction": ["mason", "site", "labour", "painter", "civil"],
  "Hospitality": ["front desk", "guest", "host", "hostess"],
  "Sales": ["salesman", "field sales", "telecaller", "bde"],
  "Logistics": ["transport", "driver", "supply chain", "dispatch"]
};

const LOCATION_ALIASES = {
  "MG Road": ["mahatma gandhi road", "mgroad"],
  "Indiranagar": ["indranagar", "indira nagar", "100 feet road"],
  "Ulsoor": ["halasuru"],
  "Marathahalli": ["marathalli", "marthahalli"],
  "KR Puram": ["k r puram", "krishnarajapuram"],
  "Electronic City": ["ecity", "e city", "electronics city"],
  "BTM Layout": ["btm"],
  "HSR Layout": ["hsr"],
  "JP Nagar": ["j p nagar", "jayaprakash nagar"],
  "RR Nagar": ["rajarajeshwari nagar", "r r nagar"],
  "RT Nagar": ["r t nagar"],
  "CV Raman Nagar": ["cv raman", "c v raman nagar"],
  "Yeshwanthpur": ["yeshwantpur", "yesvantpur"],
  "Manyata Tech Park": ["manyata", "mtp"],
  "ITPL": ["international tech park", "whitefield itpl"],
  "Sarjapur Road": ["sarjapura road"],
  "Banashankari": ["bsk"],
  "Basaveshwaranagar": ["basaveshwara nagar"],
  "Vijayanagar": ["vijaya nagar"],
  "Malleshwaram": ["malleswaram"],
  "Shivajinagar": ["shivaji nagar"],
  "Bannerghatta Road": ["bannerghatta", "bg road"],
  "Doddaballapur": ["doddaballapura"],
  "Devanahalli": ["airport", "kia"]
};

/* ------------------------------------------------------------------ *
 * State — ONE source of truth. Arrays are always read via state[type],
 * never captured in a closure, so reloading from Firebase can't
 * disconnect the search from the chips.
 * ------------------------------------------------------------------ */
const state = { cats: [], locs: [] };
const touched = { cats: false, locs: false };

let selectedFile = null;
let previewObjectUrl = null;
let currentUser = null;
let savedPhotoUrl = '';
let loadedForUid = null;

const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const normalize = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compact = (s) => normalize(s).replace(/ /g, '');

// Firestore stores these as a comma-separated string; tolerate arrays too.
function toList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const out = [];
  raw.map((s) => String(s).trim()).filter(Boolean).forEach((s) => {
    if (!out.includes(s)) out.push(s);
  });
  return out;
}

function buildIndex(list, aliases) {
  return list.map((label) => {
    const words = [label, ...(aliases[label] || [])].map(normalize);
    return { label, norm: normalize(label), haystack: words, compactHay: words.map((w) => w.replace(/ /g, '')) };
  });
}

function searchIndex(index, term, exclude) {
  const q = normalize(term);
  const available = index.filter((it) => !exclude.includes(it.label));
  if (!q) return available.map((it) => it.label);

  const qWords = q.split(' ');
  const qCompact = compact(term);
  const scored = [];

  available.forEach((it) => {
    let score = -1;
    if (it.norm === q) score = 100;
    else if (it.norm.startsWith(q)) score = 80;
    else if (it.norm.split(' ').some((w) => w.startsWith(q))) score = 70;
    else if (it.norm.includes(q)) score = 60;
    else if (it.haystack.some((h) => h.startsWith(q))) score = 50;
    else if (it.haystack.some((h) => h.includes(q))) score = 40;
    else if (qCompact.length > 1 && it.compactHay.some((h) => h.includes(qCompact))) score = 30;
    else if (qWords.every((w) => it.haystack.some((h) => h.includes(w)))) score = 20;
    if (score >= 0) scored.push({ label: it.label, score });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .map((s) => s.label);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

/* ------------------------------------------------------------------ *
 * Chips
 * ------------------------------------------------------------------ */
const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

function renderTags(type) {
  const container = document.getElementById(type === 'cats' ? 'selected-cats' : 'selected-locs');
  container.replaceChildren();

  state[type].forEach((item) => {
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
    container.appendChild(chip);
  });
}

function removeItem(type, item) {
  state[type] = state[type].filter((v) => v !== item);
  touched[type] = true;
  renderTags(type);
  pickers[type]?.refresh();
}

function addItem(type, item) {
  if (state[type].includes(item)) return;
  state[type] = [...state[type], item];
  touched[type] = true;
  renderTags(type);
}

/* ------------------------------------------------------------------ *
 * Search + dropdown
 * ------------------------------------------------------------------ */
const pickers = {};

function setupSearch(inputId, boxId, dataList, aliases, type) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const chips = document.getElementById(type === 'cats' ? 'selected-cats' : 'selected-locs');
  if (!input || !box || !chips) return;
  const wrapper = input.closest('.wp-search');

  const index = buildIndex(dataList, aliases);
  let matches = [];
  let activeIndex = -1;
  let isOpen = false;

  function open() {
    isOpen = true;
    box.classList.add('active');
    wrapper?.classList.add('is-open');
    document.body.classList.add('wp-picker-open');
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    isOpen = false;
    activeIndex = -1;
    box.classList.remove('active');
    wrapper?.classList.remove('is-open');
    if (!document.querySelector('.wp-search.is-open')) document.body.classList.remove('wp-picker-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function highlight(i) {
    const items = box.querySelectorAll('.wp-suggest__item');
    items.forEach((el) => el.classList.remove('is-active'));
    activeIndex = i;
    if (i >= 0 && items[i]) {
      items[i].classList.add('is-active');
      items[i].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', items[i].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render() {
    const term = input.value;
    matches = searchIndex(index, term, state[type]);
    box.replaceChildren();
    activeIndex = -1;

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wp-suggest__empty';
      empty.textContent = normalize(term)
        ? `No matches for “${term.trim()}”`
        : 'All options already added';
      box.appendChild(empty);
      return;
    }

    matches.forEach((label, i) => {
      const item = document.createElement('div');
      item.className = 'wp-suggest__item';
      item.id = `${boxId}-opt-${i}`;
      item.setAttribute('role', 'option');
      item.dataset.value = label;
      item.textContent = label;
      box.appendChild(item);
    });
  }

  function show() {
    render();
    open();
  }

  function choose(label) {
    if (!label) return;
    addItem(type, label);
    input.value = '';
    show();          // keep list open for quick multiple adds
    input.focus();
  }

  // --- Input events -------------------------------------------------
  input.addEventListener('focus', () => {
    show();
    // On phones, lift the field to the top so the list sits above the keyboard.
    if (window.matchMedia('(max-width: 767px)').matches) {
      setTimeout(() => input.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
    }
  });
  input.addEventListener('click', () => { if (!isOpen) show(); });
  input.addEventListener('input', show);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Never let Enter in a search box submit the whole profile form.
      e.preventDefault();
      if (!isOpen) { show(); return; }
      const pick = activeIndex >= 0 ? matches[activeIndex] : (normalize(input.value) ? matches[0] : null);
      if (pick) choose(pick);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) show();
      if (matches.length) highlight(Math.min(activeIndex + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length) highlight(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  });

  // --- Dropdown events ----------------------------------------------
  // mousedown.preventDefault keeps focus (and the phone keyboard) on the
  // input; the real selection happens on click, which is NOT fired when
  // the user drags to scroll the list on a touch screen.
  box.addEventListener('mousedown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => {
    const item = e.target.closest('.wp-suggest__item');
    if (item && box.contains(item)) choose(item.dataset.value);
  });

  // --- Chip remove (delegated, attached once) -----------------------
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn && chips.contains(btn)) removeItem(type, btn.dataset.remove);
  });

  pickers[type] = {
    contains: (node) => input.contains(node) || box.contains(node),
    close,
    refresh: () => { if (isOpen) render(); }
  };
}

setupSearch('search-cats', 'suggest-cats', WORK_CATEGORIES, CATEGORY_ALIASES, 'cats');
setupSearch('search-locs', 'suggest-locs', ALL_LOCATIONS, LOCATION_ALIASES, 'locs');

// One document-level listener closes whichever dropdown was tapped away from.
document.addEventListener('pointerdown', (e) => {
  Object.values(pickers).forEach((p) => { if (!p.contains(e.target)) p.close(); });
});

/* ------------------------------------------------------------------ *
 * Load profile
 * ------------------------------------------------------------------ */
function mergeLoaded(type, loaded) {
  // If the user already picked something while the profile was loading,
  // keep those picks instead of overwriting them.
  state[type] = touched[type] ? toList([...loaded, ...state[type]]) : loaded;
  renderTags(type);
  pickers[type]?.refresh();
}

onAuthChange(async (user) => {
  currentUser = user || null;
  if (!user || loadedForUid === user.uid) return;
  loadedForUid = user.uid;

  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      document.getElementById('worker-name').value = profile.displayName || '';
      document.getElementById('worker-age').value = profile.age ?? '';
      document.getElementById('worker-phone').value = profile.phone || '';
      document.getElementById('worker-skills').value = profile.skills || '';
      document.getElementById('worker-exp').value = profile.experience ?? '';

      if (profile.photoUrl) {
        savedPhotoUrl = profile.photoUrl;
        if (!selectedFile) photoPreview.src = profile.photoUrl;
      }

      mergeLoaded('cats', toList(profile.preferredCategories));
      mergeLoaded('locs', toList(profile.preferredLocations));
    }
  } catch (err) {
    console.error('Error loading profile', err);
    showToast('Could not load your profile. Please refresh.', 'error');
  } finally {
    refreshIcons();
  }
});

/* ------------------------------------------------------------------ *
 * Photo
 * ------------------------------------------------------------------ */
document.querySelectorAll('[data-photo-trigger]').forEach((btn) => {
  btn.addEventListener('click', () => photoInput?.click());
});

photoInput?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    photoInput.value = '';
    return;
  }
  selectedFile = file;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  photoPreview.src = previewObjectUrl;
});

/* ------------------------------------------------------------------ *
 * Share (WhatsApp)
 * ------------------------------------------------------------------ */
document.getElementById('share-profile-btn')?.addEventListener('click', () => {
  if (!currentUser) return;
  const profileLink = `https://bloreworks.web.app/pages/worker/public-profile.html?id=${currentUser.uid}`;
  const text = `Check out my worker profile on BloreWork! I am available for work. View my skills and ratings here:\n${profileLink}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

/* ------------------------------------------------------------------ *
 * Save
 * ------------------------------------------------------------------ */
const form = document.getElementById('profile-form');
const saveBtn = document.getElementById('save-btn');
const saveLabel = saveBtn.querySelector('.wp-save__label') || saveBtn;
let saving = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving) return;
  if (!currentUser) {
    showToast('Please log in again to save your profile.', 'error');
    return;
  }

  Object.values(pickers).forEach((p) => p.close());

  saving = true;
  const originalText = saveLabel.textContent;
  saveLabel.textContent = 'Saving...';
  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');

  try {
    let photoUrl = savedPhotoUrl;
    if (selectedFile) photoUrl = await uploadImage(selectedFile, 'worker-photos');

    const data = {
      displayName: document.getElementById('worker-name').value.trim(),
      age: document.getElementById('worker-age').value,
      phone: document.getElementById('worker-phone').value.trim(),
      skills: document.getElementById('worker-skills').value.trim(),
      preferredCategories: state.cats.join(', '),
      preferredLocations: state.locs.join(', '),
      experience: document.getElementById('worker-exp').value
    };
    // Only write photoUrl when there is a real photo — never the placeholder.
    if (photoUrl) data.photoUrl = photoUrl;

    await saveUserProfile(currentUser.uid, data);

    savedPhotoUrl = photoUrl || savedPhotoUrl;
    selectedFile = null;
    if (photoInput) photoInput.value = '';
    touched.cats = false;
    touched.locs = false;
    showToast('Profile saved successfully!', 'success');
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

refreshIcons();
