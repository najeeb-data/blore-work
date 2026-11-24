import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';
import { getJobs } from '../services/job.service.js';
import { getFirebase } from '../firebase/firebase.service.js';
import { getUserProfile, toggleSavedJob } from '../services/user.service.js';
import { onAuthChange } from '../firebase/auth.service.js';
import { showToast } from '../components/toast.js';
import {
  createJobCard, renderSkeletons, createStateBox, refreshIcons, decodeText, parseJobDate, setSaveButtonState
} from '../components/job-card.js';

initNavbar();
initFooter();
initBottomNav();

const PAGE_SIZE = 12;

// Homepage "Browse by Category" links use these slugs (?category=...).
const CATEGORY_SLUGS = {
  'event-staff': { label: 'Event Staff', categories: ['Event Management'] },
  'hotel-restaurant': { label: 'Hotel & Restaurant', categories: ['Hotel Work', 'Hospitality'] },
  catering: { label: 'Catering', categories: ['Catering Services', 'ODC / Outdoor Catering'] },
  housekeeping: { label: 'Housekeeping', categories: ['Housekeeping'] },
  delivery: { label: 'Delivery', categories: ['Delivery'] },
  security: { label: 'Security', categories: ['Security'] }
};

/* ------------------------------------------------------------------ *
 * State — every filter combines with the others.
 * ------------------------------------------------------------------ */
const state = {
  all: [],            // jobs from getJobs() (already excludes closed + expired)
  search: '',
  category: '',       // exact category, or "slug:<key>" for a homepage group
  when: 'all',        // all | today | tomorrow | weekend
  prefs: null,        // { cats: [], locs: [] } when "My Preferences" is on
  sort: 'newest',
  shown: PAGE_SIZE,
  user: null,         // signed-in user (for bookmarks)
  saved: new Set()    // job ids in users/{uid}.savedJobs
};

const $ = (id) => document.getElementById(id);
const grid = $('jobs-grid');
const searchInput = $('job-search');
const categorySelect = $('category-select');
const sortSelect = $('sort-select');
const countEl = $('jobs-count');
const loadMoreBtn = $('load-more');
const clearBtn = $('clear-filters');
const prefBtn = $('interested-btn');

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */
const lower = (v) => decodeText(v).toLowerCase();

function dayDiff(job) {
  const d = parseJobDate(job.date);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function matchesWhen(job) {
  if (state.when === 'all') return true;
  const diff = dayDiff(job);
  if (diff === null) return false;
  if (state.when === 'today') return diff === 0;
  if (state.when === 'tomorrow') return diff === 1;
  if (state.when === 'weekend') {
    const day = parseJobDate(job.date).getDay();
    return diff >= 0 && diff <= 6 && (day === 0 || day === 6);
  }
  return true;
}

function matchesCategory(job) {
  if (!state.category) return true;
  if (state.category.startsWith('slug:')) {
    const group = CATEGORY_SLUGS[state.category.slice(5)];
    return group ? group.categories.includes(decodeText(job.category)) : true;
  }
  return decodeText(job.category) === state.category;
}

function matchesSearch(job) {
  const term = state.search.trim().toLowerCase();
  if (!term) return true;
  const hay = `${lower(job.title)} ${lower(job.location)} ${lower(job.category)}`;
  return term.split(/\s+/).every((w) => hay.includes(w));
}

// Same smart matching as before: category OR location, either string containing the other.
function matchesPrefs(job) {
  if (!state.prefs) return true;
  const jobCat = lower(job.category);
  const jobLoc = lower(job.location);
  const catMatch = jobCat && state.prefs.cats.some((p) => jobCat.includes(p) || p.includes(jobCat));
  const locMatch = jobLoc && state.prefs.locs.some((p) => jobLoc.includes(p) || p.includes(jobLoc));
  return catMatch || locMatch;
}

function sortJobs(list) {
  const sorted = [...list];
  // Jobs without a valid pay always go last in pay sorts.
  const pay = (j, missing) => (Number(j.pay) > 0 ? Number(j.pay) : missing);
  if (state.sort === 'pay-high') sorted.sort((a, b) => pay(b, -Infinity) - pay(a, -Infinity));
  else if (state.sort === 'pay-low') sorted.sort((a, b) => pay(a, Infinity) - pay(b, Infinity));
  else if (state.sort === 'soonest') {
    const key = (j) => `${j.date || '9999-12-31'} ${j.time || '99:99'}`;
    sorted.sort((a, b) => key(a).localeCompare(key(b)));
  } else {
    sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
  // Keep existing behaviour: Featured first, then Urgent (stable sort keeps the order above).
  sorted.sort((a, b) => (Number(!!b.isFeatured) - Number(!!a.isFeatured)) || (Number(!!b.isUrgent) - Number(!!a.isUrgent)));
  return sorted;
}

function filtered() {
  return sortJobs(state.all.filter((j) => matchesSearch(j) && matchesCategory(j) && matchesWhen(j) && matchesPrefs(j)));
}

function hasActiveFilters() {
  return !!(state.search.trim() || state.category || state.when !== 'all' || state.prefs);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function render({ keepPage = false } = {}) {
  if (!keepPage) state.shown = PAGE_SIZE;
  const list = filtered();
  const visible = list.slice(0, state.shown);
  grid.removeAttribute('aria-busy');
  clearBtn.hidden = !hasActiveFilters();

  if (!state.all.length) {
    countEl.textContent = 'No jobs available';
    grid.replaceChildren(createStateBox({
      icon: 'briefcase',
      title: 'No jobs available right now',
      text: 'New jobs are added every day. Check back soon.'
    }));
    loadMoreBtn.hidden = true;
    refreshIcons();
    return;
  }

  if (!list.length) {
    countEl.textContent = 'No matching jobs';
    grid.replaceChildren(createStateBox({
      icon: 'search-x',
      title: 'No jobs match your filters',
      text: state.prefs ? 'No jobs match your saved preferences right now.' : 'Try a different search, category or date.',
      action: { label: 'Clear filters', onClick: clearFilters }
    }));
    loadMoreBtn.hidden = true;
    refreshIcons();
    return;
  }

  const total = list.length;
  countEl.textContent = total === 1
    ? '1 job available'
    : visible.length < total
      ? `Showing ${visible.length} of ${total} jobs`
      : `${total} jobs available`;

  grid.replaceChildren(...visible.map((job) => createJobCard(job, {
    saved: state.saved.has(job.id),
    onToggleSave: toggleSave
  })));
  loadMoreBtn.hidden = visible.length >= total;
  if (!loadMoreBtn.hidden) loadMoreBtn.textContent = `Load more jobs (${total - visible.length} more)`;
  refreshIcons();
}

/* ------------------------------------------------------------------ *
 * Bookmarks (users/{uid}.savedJobs array via toggleSavedJob)
 * ------------------------------------------------------------------ */
async function toggleSave(job, btn) {
  if (!state.user) {
    showToast('Please log in to save jobs.', 'error');
    return;
  }
  const wasSaved = state.saved.has(job.id);
  // Update the UI first, then roll back if Firestore fails.
  if (wasSaved) state.saved.delete(job.id); else state.saved.add(job.id);
  setSaveButtonState(btn, !wasSaved);
  btn.disabled = true;
  try {
    await toggleSavedJob(state.user.uid, job.id, !wasSaved);
    showToast(wasSaved ? 'Removed from saved jobs.' : 'Job saved.', 'success');
  } catch (err) {
    console.error('Could not update saved jobs', err);
    if (wasSaved) state.saved.add(job.id); else state.saved.delete(job.id);
    setSaveButtonState(btn, wasSaved);
    showToast('Could not update saved jobs. Please try again.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function loadSavedIds(user) {
  state.user = user || null;
  state.saved = new Set();
  if (user) {
    try {
      const profile = await getUserProfile(user.uid);
      (Array.isArray(profile?.savedJobs) ? profile.savedJobs : []).forEach((id) => state.saved.add(id));
    } catch (err) {
      console.warn('Could not load saved jobs', err);
    }
  }
  // Refresh bookmark icons on cards already on screen.
  grid.querySelectorAll('.jc-wrap').forEach((wrap) => {
    const btn = wrap.querySelector('.jc-save');
    if (btn) setSaveButtonState(btn, state.saved.has(wrap.dataset.jobId));
  });
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */
function setWhen(when) {
  state.when = when;
  document.querySelectorAll('#filter-chips [data-when]').forEach((c) => {
    const on = c.dataset.when === when;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

function setPrefsActive(on) {
  prefBtn.classList.toggle('active', on);
  prefBtn.setAttribute('aria-pressed', String(on));
  if (!on) state.prefs = null;
}

function clearFilters() {
  state.search = '';
  searchInput.value = '';
  state.category = '';
  categorySelect.value = '';
  setWhen('all');
  setPrefsActive(false);
  render();
}

let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = searchInput.value; render(); }, 150);
});
searchInput.addEventListener('search', () => { state.search = searchInput.value; render(); });

sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; render(); });
categorySelect.addEventListener('change', () => { state.category = categorySelect.value; render(); });

document.querySelectorAll('#filter-chips [data-when]').forEach((chip) => {
  chip.addEventListener('click', () => {
    setWhen(chip.dataset.when);
    if (chip.dataset.when === 'all') setPrefsActive(false);
    render();
  });
});

loadMoreBtn.addEventListener('click', () => {
  state.shown += PAGE_SIZE;
  render({ keepPage: true });
});

clearBtn.addEventListener('click', clearFilters);

// --- "My Preferences" (toggle) ---
async function applyPreferences({ quiet = false } = {}) {
  const { auth } = await getFirebase();
  if (!auth.currentUser) {
    if (!quiet) {
      showToast('Please log in to view your preferred jobs.', 'error');
      setTimeout(() => { window.location.href = '/pages/auth/login.html'; }, 1500);
    }
    return false;
  }
  const profile = await getUserProfile(auth.currentUser.uid);
  const split = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const cats = split(profile?.preferredCategories);
  const locs = split(profile?.preferredLocations);
  if (!cats.length && !locs.length) {
    if (!quiet) showToast('Please go to My Profile and set your preferred categories and locations.', 'error');
    return false;
  }
  state.prefs = { cats, locs };
  setPrefsActive(true);
  render();
  if (!quiet && !filtered().length) showToast('No jobs found matching your preferences right now.', 'error');
  return true;
}

prefBtn.addEventListener('click', async () => {
  if (state.prefs) { setPrefsActive(false); render(); return; }
  prefBtn.disabled = true;
  try {
    await applyPreferences();
  } catch (err) {
    console.error(err);
    showToast('Failed to load preferences.', 'error');
  } finally {
    prefBtn.disabled = false;
  }
});

/* ------------------------------------------------------------------ *
 * Categories for the dropdown (from data.js, falling back to the jobs)
 * ------------------------------------------------------------------ */
async function fillCategories() {
  let cats = [];
  try {
    const data = await import('../config/data.js');
    if (Array.isArray(data.WORK_CATEGORIES)) cats = [...data.WORK_CATEGORIES];
  } catch (err) {
    console.warn('Could not load categories from data.js; using categories from jobs.', err);
  }
  state.all.forEach((j) => {
    const c = decodeText(j.category);
    if (c && !cats.includes(c)) cats.push(c);
  });
  const frag = document.createDocumentFragment();
  cats.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    frag.appendChild(opt);
  });
  categorySelect.appendChild(frag);
}

/* ------------------------------------------------------------------ *
 * URL parameters (homepage search box, chips and category links)
 *   ?search=…   ?filter=today|tomorrow|weekend|nearby   ?category=<slug or name>
 * ------------------------------------------------------------------ */
async function applyUrlParams() {
  const params = new URLSearchParams(location.search);

  const search = params.get('search');
  if (search) { state.search = search; searchInput.value = search; }

  const filter = params.get('filter');
  if (['today', 'tomorrow', 'weekend'].includes(filter)) setWhen(filter);

  const category = params.get('category');
  if (category) {
    if (CATEGORY_SLUGS[category]) {
      const opt = document.createElement('option');
      opt.value = `slug:${category}`;
      opt.textContent = CATEGORY_SLUGS[category].label;
      categorySelect.insertBefore(opt, categorySelect.options[1] || null);
      state.category = opt.value;
      categorySelect.value = opt.value;
    } else if ([...categorySelect.options].some((o) => o.value === category)) {
      state.category = category;
      categorySelect.value = category;
    }
  }

  // "Nearby Jobs" uses the worker's preferred locations/categories when logged in.
  if (filter === 'nearby') {
    try {
      const ok = await applyPreferences({ quiet: true });
      if (!ok) showToast('Log in and set your preferred locations to see nearby jobs.', 'error');
    } catch (err) {
      console.error(err);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */
async function loadJobs() {
  renderSkeletons(grid, 6);
  countEl.textContent = 'Loading jobs…';
  try {
    state.all = await getJobs(); // closed and past-dated jobs are already removed
    await fillCategories();
    await applyUrlParams();
    render();
  } catch (err) {
    console.error('Failed to load jobs', err);
    countEl.textContent = '';
    grid.replaceChildren(createStateBox({
      icon: 'wifi-off',
      title: 'Could not load jobs',
      text: 'Check your connection and try again.',
      action: { label: 'Try again', onClick: loadJobs }
    }));
    grid.removeAttribute('aria-busy');
    refreshIcons();
  }
}

loadJobs();
onAuthChange((user) => { loadSavedIds(user); });
