import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
import { getUserProfile, toggleSavedJob } from '/js/services/user.service.js';
import { getJobById } from '/js/services/job.service.js';
import { showToast } from '/js/components/toast.js';
import {
  createJobCard, renderSkeletons, createStateBox, refreshIcons, parseJobDate
} from '/js/components/job-card.js';

initNavbar();
initBottomNav();

// Saved jobs live in users/{uid}.savedJobs (array of job ids),
// updated with toggleSavedJob() from user.service.js.

const $ = (id) => document.getElementById(id);
const grid = $('saved-jobs-grid');
const countEl = $('saved-count');
const inactiveSection = $('saved-inactive');
const inactiveGrid = $('saved-inactive-grid');
const missingBox = $('saved-missing');
const missingText = $('saved-missing-text');
const missingBtn = $('saved-missing-btn');

const state = {
  user: null,
  active: [],     // saved jobs still open and not expired
  inactive: [],   // saved jobs that are closed or past their date
  missing: []     // saved ids whose job document no longer exists
};

function jobStatus(job) {
  if (job.status === 'closed') return 'closed';
  const d = parseJobDate(job.date);
  if (d) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d < today) return 'expired';
  }
  return '';
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function updateCount() {
  const n = state.active.length;
  const off = state.inactive.length;
  if (!n && !off) { countEl.textContent = 'No saved jobs'; return; }
  const main = `${n} saved ${n === 1 ? 'job' : 'jobs'}`;
  countEl.textContent = off ? `${main} · ${off} no longer available` : main;
}

function renderEmpty() {
  grid.replaceChildren(createStateBox({
    icon: 'bookmark',
    title: 'No saved jobs yet',
    text: 'Tap the bookmark on any job to keep it here for later.',
    action: { label: 'Browse jobs', href: '/pages/jobs/index.html' }
  }));
}

function cardFor(job, status) {
  return createJobCard(job, { saved: true, status, onToggleSave: removeSaved });
}

function render() {
  grid.removeAttribute('aria-busy');

  if (state.active.length) grid.replaceChildren(...state.active.map((j) => cardFor(j, '')));
  else if (!state.inactive.length) renderEmpty();
  else {
    grid.replaceChildren(createStateBox({
      icon: 'bookmark',
      title: 'None of your saved jobs are open right now',
      text: 'Find new work and save it for later.',
      action: { label: 'Browse jobs', href: '/pages/jobs/index.html' }
    }));
  }

  inactiveSection.hidden = !state.inactive.length;
  inactiveGrid.replaceChildren(...state.inactive.map(({ job, status }) => cardFor(job, status)));

  missingBox.hidden = !state.missing.length;
  if (state.missing.length) {
    const n = state.missing.length;
    missingText.textContent = `${n} saved ${n === 1 ? 'job was' : 'jobs were'} deleted by the employer.`;
  }

  updateCount();
  refreshIcons();
}

/* ------------------------------------------------------------------ *
 * Remove (bookmark button on each card)
 * ------------------------------------------------------------------ */
async function removeSaved(job, btn) {
  if (!state.user) return;
  const wrap = btn.closest('.jc-wrap');
  const prev = { active: [...state.active], inactive: [...state.inactive] };

  // Update the screen immediately…
  state.active = state.active.filter((j) => j.id !== job.id);
  state.inactive = state.inactive.filter((x) => x.job.id !== job.id);
  wrap?.classList.add('is-removing');
  btn.disabled = true;

  try {
    await toggleSavedJob(state.user.uid, job.id, false);
    setTimeout(render, 160); // let the fade-out finish
    showToast('Removed from saved jobs.', 'success');
  } catch (err) {
    // …and put it back if Firestore fails.
    console.error('Could not remove saved job', err);
    state.active = prev.active;
    state.inactive = prev.inactive;
    wrap?.classList.remove('is-removing');
    btn.disabled = false;
    showToast('Could not remove this job. Please try again.', 'error');
  }
}

missingBtn.addEventListener('click', async () => {
  if (!state.user || !state.missing.length) return;
  missingBtn.disabled = true;
  try {
    await Promise.all(state.missing.map((id) => toggleSavedJob(state.user.uid, id, false)));
    state.missing = [];
    render();
    showToast('Deleted jobs removed from your list.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Could not clean up deleted jobs. Please try again.', 'error');
  } finally {
    missingBtn.disabled = false;
  }
});

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */
async function load(user) {
  renderSkeletons(grid, 3);
  countEl.textContent = 'Loading your saved jobs…';
  inactiveSection.hidden = true;
  missingBox.hidden = true;

  try {
    const profile = await getUserProfile(user.uid);
    const ids = [...new Set(Array.isArray(profile?.savedJobs) ? profile.savedJobs : [])].reverse(); // newest saved first

    const results = await Promise.all(ids.map(async (id) => ({ id, job: await getJobById(id) })));

    // getJobById() returns null on network errors too. If nothing at all came
    // back, treat it as a loading failure rather than "every job was deleted".
    if (ids.length && results.every((r) => !r.job) && !navigator.onLine) throw new Error('offline');

    state.active = [];
    state.inactive = [];
    state.missing = [];
    results.forEach(({ id, job }) => {
      if (!job) { state.missing.push(id); return; }
      const status = jobStatus(job);
      if (status) state.inactive.push({ job, status });
      else state.active.push(job);
    });

    render();
  } catch (err) {
    console.error('Error loading saved jobs', err);
    countEl.textContent = '';
    grid.removeAttribute('aria-busy');
    grid.replaceChildren(createStateBox({
      icon: 'wifi-off',
      title: 'Could not load saved jobs',
      text: 'Check your connection and try again.',
      action: { label: 'Try again', onClick: () => load(user) }
    }));
    refreshIcons();
  }
}

let loadedFor = null;
onAuthChange((user) => {
  if (!user) {
    window.location.href = '/pages/auth/login.html';
    return;
  }
  state.user = user;
  if (loadedFor === user.uid) return;
  loadedFor = user.uid;
  load(user);
});

refreshIcons();
