import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { showToast } from '/js/components/toast.js';
import { createJob, getJobById, updateJob } from '/js/services/job.service.js';
import { getUserProfile } from '/js/services/user.service.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
import { escapeHTML } from '/js/utils/sanitize.js';

initNavbar();
initBottomNav();

/* ------------------------------------------------------------------ *
 * Elements (fail loudly in the console if the HTML is out of sync)
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const REQUIRED_IDS = [
  'post-job-form', 'job-title', 'job-category', 'job-worktype', 'job-desc', 'job-date',
  'job-time', 'job-workers', 'job-pay', 'job-location', 'publish-btn', 'form-notice'
];
const missing = REQUIRED_IDS.filter((id) => !$(id));
if (missing.length) console.error('Post a Job: missing elements in HTML:', missing.join(', '));

const form = $('post-job-form');
const catSelect = $('job-category');
const typeSelect = $('job-worktype');
const locSelect = $('job-location');
const publishBtn = $('publish-btn');
const publishLabel = publishBtn?.querySelector('.wp-save__label') || publishBtn;
const notice = $('form-notice');

const TITLE_MAX = 80;
const DESC_MAX = 1000;

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */
let currentUser = null;
let canPost = false;          // set after auth + role check
let optionsLoaded = false;    // set after dropdown data loads
let submitting = false;
const editId = new URLSearchParams(location.search).get('edit');
let editingJob = null;        // the job being edited (from Firestore)

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const val = (id) => ($(id)?.value || '').trim();

// Turn stored "&amp;" etc. back into normal characters for editing.
function decodeHTML(s) {
  const t = document.createElement('textarea');
  t.innerHTML = String(s ?? '');
  return t.value;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function showNotice(message, type = 'info', html = false) {
  if (!notice) return;
  if (!message) { notice.hidden = true; notice.textContent = ''; return; }
  notice.className = `jp-notice jp-notice--${type}`;
  if (html) notice.innerHTML = message; else notice.textContent = message;
  notice.hidden = false;
}

function refreshPublishState() {
  if (!publishBtn) return;
  publishBtn.disabled = submitting || !optionsLoaded || !canPost;
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

/* ------------------------------------------------------------------ *
 * Dropdowns (native <select>)
 * Data is imported dynamically so a problem with data.js shows a
 * message instead of killing the whole page.
 * ------------------------------------------------------------------ */
function fillSelect(select, placeholder, values) {
  const frag = document.createDocumentFragment();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  frag.appendChild(first);
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    frag.appendChild(opt);
  });
  select.replaceChildren(frag);
}

function fillGroupedSelect(select, placeholder, groups) {
  const frag = document.createDocumentFragment();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  frag.appendChild(first);
  Object.entries(groups).forEach(([region, areas]) => {
    const group = document.createElement('optgroup');
    group.label = region;
    areas.forEach((area) => {
      const opt = document.createElement('option');
      opt.value = area;
      opt.textContent = area;
      group.appendChild(opt);
    });
    frag.appendChild(group);
  });
  select.replaceChildren(frag);
}

function failSelect(select, message) {
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = message;
  select.replaceChildren(opt);
  select.disabled = true;
}

// Keep a saved value selectable even if it was removed from data.js later.
function ensureOption(select, value) {
  if (!value) return;
  if (![...select.options].some((o) => o.value === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  select.value = value;
}

async function loadOptions() {
  try {
    const data = await import('/js/config/data.js');
    const cats = Array.isArray(data.WORK_CATEGORIES) ? data.WORK_CATEGORIES : [];
    const types = Array.isArray(data.WORK_TYPES) ? data.WORK_TYPES : [];
    const locs = data.BANGALORE_LOCATIONS && typeof data.BANGALORE_LOCATIONS === 'object' ? data.BANGALORE_LOCATIONS : {};
    const locCount = Object.values(locs).flat().length;

    if (!cats.length || !types.length || !locCount) throw new Error('Dropdown data is empty');

    fillSelect(catSelect, 'Select a category', cats);
    fillSelect(typeSelect, 'Select work type', types);
    fillGroupedSelect(locSelect, 'Select an area', locs);
    optionsLoaded = true;
  } catch (err) {
    console.error('Could not load dropdown options from data.js', err);
    const msg = 'Could not load options';
    failSelect(catSelect, msg);
    failSelect(typeSelect, msg);
    failSelect(locSelect, msg);
    showNotice('We could not load the job categories and areas. Please refresh the page. If this keeps happening, contact support.', 'error');
  } finally {
    refreshPublishState();
  }
}

/* ------------------------------------------------------------------ *
 * Counters
 * ------------------------------------------------------------------ */
function bindCounter(inputId, counterId, max) {
  const input = $(inputId);
  const counter = $(counterId);
  if (!input || !counter) return () => {};
  const update = () => {
    const n = input.value.length;
    counter.textContent = `${n} / ${max}`;
    counter.classList.toggle('is-near', n >= max * 0.9);
  };
  input.addEventListener('input', update);
  update();
  return update;
}
const updateTitleCounter = bindCounter('job-title', 'title-counter', TITLE_MAX);
const updateDescCounter = bindCounter('job-desc', 'desc-counter', DESC_MAX);

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */
function setError(id, message) {
  const input = $(id);
  const slot = document.querySelector(`[data-error-for="${id}"]`);
  if (input) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (slot) input.setAttribute('aria-describedby', slot.id || (slot.id = `${id}-error`));
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
  if (slot) slot.textContent = message || '';
  return !message;
}

const RULES = {
  'job-title': () => {
    const v = val('job-title');
    if (!v) return 'Enter a job title.';
    if (v.length < 3) return 'Job title is too short.';
    return '';
  },
  'job-category': () => (val('job-category') ? '' : 'Select a work category.'),
  'job-worktype': () => (val('job-worktype') ? '' : 'Select a work type.'),
  'job-desc': () => {
    const v = val('job-desc');
    if (!v) return 'Enter a job description.';
    if (v.length < 10) return 'Add a little more detail (at least 10 characters).';
    return '';
  },
  'job-date': () => {
    const v = val('job-date');
    if (!v) return 'Select the work date.';
    // When editing, an unchanged old date is allowed.
    if (editingJob && v === editingJob.date) return '';
    if (v < todayISO()) return 'Date cannot be in the past.';
    return '';
  },
  'job-time': () => {
    const v = val('job-time');
    if (!v) return 'Select a start time.';
    const unchanged = editingJob && val('job-date') === editingJob.date && v === editingJob.time;
    if (!unchanged && val('job-date') === todayISO() && v < nowHHMM()) return 'This start time has already passed today.';
    return '';
  },
  'job-workers': () => {
    const raw = val('job-workers');
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < 1) return 'Enter at least 1 worker.';
    if (n > 500) return 'Maximum 500 workers per job.';
    return '';
  },
  'job-pay': () => {
    const raw = val('job-pay');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) return 'Enter a valid pay amount.';
    if (!Number.isInteger(n)) return 'Enter pay in whole rupees.';
    if (n > 100000) return 'Pay per day looks too high. Please check.';
    return '';
  },
  'job-location': () => (val('job-location') ? '' : 'Select a location.')
};

function validateField(id) {
  return RULES[id] ? setError(id, RULES[id]()) : true;
}

function validateAll() {
  let firstInvalid = null;
  Object.keys(RULES).forEach((id) => {
    if (!validateField(id) && !firstInvalid) firstInvalid = $(id);
  });
  return firstInvalid;
}

// Validate when the user leaves a field, and re-check as they fix it.
form?.addEventListener('focusout', (e) => {
  if (e.target.id && RULES[e.target.id] && e.target.value) validateField(e.target.id);
});
form?.addEventListener('input', (e) => {
  if (e.target.id && RULES[e.target.id] && e.target.getAttribute('aria-invalid')) validateField(e.target.id);
});
form?.addEventListener('change', (e) => {
  if (e.target.tagName === 'SELECT' && e.target.id && RULES[e.target.id]) validateField(e.target.id);
  if (e.target.id === 'job-date' && $('job-time').value) validateField('job-time');
});

// No past dates in the date picker.
const dateInput = $('job-date');
if (dateInput) dateInput.min = todayISO();

/* ------------------------------------------------------------------ *
 * Auth + role
 * Firestore rules only let business (client) accounts create jobs.
 * ------------------------------------------------------------------ */
async function handleAuth(user) {
  currentUser = user || null;

  if (!user) {
    canPost = false;
    showNotice('Please <a href="/pages/auth/login.html">log in</a> with your business account to post a job.', 'info', true);
    refreshPublishState();
    return;
  }

  let role = null;
  try {
    const profile = await getUserProfile(user.uid);
    role = profile?.role || null;
  } catch (err) {
    console.error('Could not read user role', err);
  }

  if (role !== 'client' && role !== 'admin') {
    canPost = false;
    showNotice('Only business accounts can post jobs. Please log in with your business account.', 'info');
    refreshPublishState();
    return;
  }

  canPost = true;
  if (!editId && optionsLoaded) showNotice(''); // keep a data-load error visible
  refreshPublishState();

  if (editId && !editingJob) await loadJobForEdit(user);
}

/* ------------------------------------------------------------------ *
 * Edit mode (dashboard links to post-job.html?edit=<jobId>)
 * ------------------------------------------------------------------ */
async function loadJobForEdit(user) {
  const job = await getJobById(editId);
  if (!job || (job.clientId !== user.uid)) {
    showNotice('This job could not be found or you do not have permission to edit it. You can post a new job instead.', 'error');
    return;
  }
  editingJob = job;

  $('page-title').textContent = 'Edit Job';
  $('page-sub').textContent = 'Update the details and save. Workers will see the changes right away.';
  publishLabel.textContent = 'Save Changes';
  document.title = 'Edit Job — BloreWork';

  $('job-title').value = decodeHTML(job.title);
  $('job-desc').value = decodeHTML(job.description);
  ensureOption(catSelect, job.category);
  ensureOption(typeSelect, job.workType);
  ensureOption(locSelect, job.location);
  $('job-date').value = job.date || '';
  if (job.date && job.date < todayISO()) $('job-date').min = job.date;
  $('job-time').value = job.time || '';
  $('job-workers').value = job.workersNeeded ?? 1;
  $('job-pay').value = job.pay ?? '';
  updateTitleCounter();
  updateDescCounter();
  if (optionsLoaded) showNotice('');
}

/* ------------------------------------------------------------------ *
 * Submit
 * ------------------------------------------------------------------ */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  if (!currentUser || !canPost) {
    showToast('Please log in with your business account to post a job.', 'error');
    return;
  }
  if (!optionsLoaded) {
    showToast('Options did not load. Please refresh the page.', 'error');
    return;
  }

  const firstInvalid = validateAll();
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  submitting = true;
  refreshPublishState();
  const originalText = publishLabel.textContent;
  publishLabel.textContent = editingJob ? 'Saving…' : 'Publishing…';
  publishBtn.classList.add('is-loading');

  // Same field names the dashboard and job listings already read.
  // Title and description stay HTML-escaped because the listing pages
  // insert them with innerHTML (see note in the report).
  const jobData = {
    title: escapeHTML(val('job-title')),
    category: val('job-category'),
    workType: val('job-worktype'),
    description: escapeHTML(val('job-desc')),
    date: val('job-date'),
    time: val('job-time'),
    workersNeeded: Number(val('job-workers')),
    pay: Number(val('job-pay')),
    location: val('job-location')
  };

  try {
    if (editingJob) {
      await updateJob(editingJob.id, jobData);
      showToast('Job updated successfully!', 'success');
    } else {
      // createJob adds status: 'open', clientId, createdAt (server timestamp) and views: 0.
      await createJob({ ...jobData, isFeatured: false });
      showToast('Job published successfully!', 'success');
    }
    publishLabel.textContent = 'Done!';
    setTimeout(() => { window.location.href = '/pages/client/dashboard.html'; }, 1200);
  } catch (err) {
    console.error('Publishing job failed', err);
    const msg = err?.code === 'permission-denied'
      ? 'Permission denied. Only business accounts can post jobs.'
      : `Could not publish the job: ${err?.message || 'please try again.'}`;
    showToast(msg, 'error');
    submitting = false;
    publishLabel.textContent = originalText;
    publishBtn.classList.remove('is-loading');
    refreshPublishState();
  }
});

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
refreshPublishState();
refreshIcons();
const optionsReady = loadOptions();
onAuthChange(async (user) => {
  await optionsReady;          // edit mode needs the options before selecting values
  await handleAuth(user);
});
