import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
import { getUserProfile } from '/js/services/user.service.js';
import { IS_FREE_MODE } from '/js/config/app-config.js';
import { showToast } from '/js/components/toast.js';
import { createJobCard, createStateBox, decodeText, parseJobDate, refreshIcons } from '/js/components/job-card.js';

initNavbar();
initBottomNav();

const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';
const PLACEHOLDER_LOGO = '/assets/icons/company-placeholder.png';
const LOGIN_URL = '/pages/auth/login.html';
const SUBSCRIBE_URL = '/pages/subscription/index.html';
const WA_MESSAGE = 'Hi, I saw your business on BloreWork and would like to connect.';

const root = document.getElementById('profile-content');

/* ------------------------------------------------------------------ *
 * Small, safe DOM helpers (all text goes through textContent)
 * ------------------------------------------------------------------ */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function icon(name, className = 'cp-icon') {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name);
  i.className = className;
  i.setAttribute('aria-hidden', 'true');
  return i;
}
const text = (v) => decodeText(v).trim();

/* ------------------------------------------------------------------ *
 * Data helpers
 * ------------------------------------------------------------------ */
// Only http(s) links, normalised. Anything else is dropped.
function safeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!u.hostname.includes('.')) return '';
    return u.href;
  } catch {
    return '';
  }
}
function prettyUrl(href) {
  try {
    const u = new URL(href);
    return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '');
  } catch {
    return href;
  }
}

// Indian mobile → "91XXXXXXXXXX" for wa.me, or '' if not usable.
function toWaNumber(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) d = `91${d}`;
  return /^91[6-9]\d{9}$/.test(d) ? d : '';
}

// Business contact = the WhatsApp numbers the business published for workers
// (Business Profile → "WhatsApp Numbers"), falling back to the business phone.
function businessWhatsApp(profile) {
  const list = Array.isArray(profile.whatsappNumbers)
    ? profile.whatsappNumbers
    : String(profile.whatsappNumbers || '').split(',');
  for (const n of list) {
    const wa = toWaNumber(n);
    if (wa) return wa;
  }
  return toWaNumber(profile.phone);
}

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
const memberSince = (p) => {
  const d = toDate(p.createdAt);
  return d ? d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
};

function isJobActive(job) {
  if (job.status === 'closed') return false;
  const d = parseJobDate(job.date);
  if (!d) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d >= today;
}

function serviceAreas(p) {
  return [...new Set(String(p.businessLocations || p.locationArea || '')
    .split(',').map((s) => text(s)).filter(Boolean))];
}

function cityLine(p) {
  const parts = [text(p.city), text(p.state)].filter(Boolean);
  if (parts.length) return parts.join(', ');
  const areas = serviceAreas(p);
  return areas.length ? `${areas[0]}, Bengaluru` : '';
}

function fullAddress(p) {
  return [text(p.address), text(p.city), text(p.state), text(p.pincode)].filter(Boolean).join(', ');
}

/* ------------------------------------------------------------------ *
 * Page states
 * ------------------------------------------------------------------ */
function showState(opts) {
  root.replaceChildren(el('div', 'cp-state-wrap'));
  root.firstChild.append(createStateBox(opts));
  refreshIcons();
}

/* ------------------------------------------------------------------ *
 * Share
 * ------------------------------------------------------------------ */
async function shareProfile(name, url) {
  const shareText = `Check out ${name} on BloreWork. They are hiring!`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${name} — BloreWork`, text: shareText, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // user closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Profile link copied to clipboard.', 'success');
  } catch {
    window.prompt('Copy this profile link:', url);
  }
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */
function buildHero(ctx) {
  const { profile, name, isOwner, contact } = ctx;
  const card = el('section', 'cp-card cp-hero');

  const logoWrap = el('div', 'cp-hero__logo');
  const img = el('img', 'cp-hero__logo-img');
  img.alt = `${name} logo`;
  img.width = 88; img.height = 88;
  img.decoding = 'async';
  const logo = safeUrl(profile.logoUrl);
  img.src = logo || PLACEHOLDER_LOGO;
  img.addEventListener('error', () => { if (!img.src.endsWith(PLACEHOLDER_LOGO)) img.src = PLACEHOLDER_LOGO; }, { once: true });
  logoWrap.append(img);

  const body = el('div', 'cp-hero__body');
  const titleRow = el('div', 'cp-hero__title-row');
  titleRow.append(el('h1', 'cp-hero__name', name));
  if (profile.isVerified === true) {
    const badge = el('span', 'cp-verified');
    badge.title = 'Verified by BloreWork';
    badge.append(icon('badge-check'), el('span', null, 'Verified'));
    titleRow.append(badge);
  }
  body.append(titleRow);

  const category = text(profile.businessCategory);
  if (category) body.append(el('p', 'cp-hero__category', category));

  const meta = el('ul', 'cp-hero__meta');
  const city = cityLine(profile);
  if (city) { const li = el('li'); li.append(icon('map-pin'), el('span', null, city)); meta.append(li); }
  const since = memberSince(profile);
  if (since) { const li = el('li'); li.append(icon('calendar'), el('span', null, `Member since ${since}`)); meta.append(li); }
  if (meta.childElementCount) body.append(meta);

  const desc = text(profile.businessDescription);
  if (desc) body.append(el('p', 'cp-hero__desc', desc));

  const top = el('div', 'cp-hero__top');
  top.append(logoWrap, body);
  card.append(top);

  // Actions
  const actions = el('div', 'cp-hero__actions');
  if (contact.state === 'available') {
    const wa = el('a', 'btn btn-primary cp-btn cp-btn--wa');
    wa.href = `https://wa.me/${contact.number}?text=${encodeURIComponent(WA_MESSAGE)}`;
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.append(icon('message-circle'), el('span', null, 'Chat on WhatsApp'));
    actions.append(wa);
  } else if (contact.state === 'locked') {
    const lock = el('a', 'btn btn-secondary cp-btn cp-btn--lock');
    lock.href = SUBSCRIBE_URL;
    lock.append(icon('lock'), el('span', null, 'Subscribe to contact'));
    actions.append(lock);
  }

  const share = el('button', 'btn btn-secondary cp-btn');
  share.type = 'button';
  share.append(icon('share-2'), el('span', null, 'Share'));
  share.addEventListener('click', () => shareProfile(name, ctx.publicUrl));
  actions.append(share);

  const site = safeUrl(profile.website);
  if (site) {
    const w = el('a', 'btn btn-secondary cp-btn');
    w.href = site;
    w.target = '_blank';
    w.rel = 'noopener noreferrer nofollow';
    w.append(icon('globe'), el('span', null, 'Website'));
    actions.append(w);
  }

  if (isOwner) {
    const edit = el('a', 'btn btn-secondary cp-btn');
    edit.href = '/pages/client/profile.html';
    edit.append(icon('pencil'), el('span', null, 'Edit profile'));
    actions.append(edit);
  }
  card.append(actions);

  if (contact.state === 'none' && isOwner) {
    card.append(el('p', 'cp-hint', 'Add a WhatsApp number in your Business Profile so workers can contact you.'));
  }
  return card;
}

function buildStats({ activeCount, totalCount, profile }) {
  const avg = Number(profile.averageRating);
  const reviews = Number(profile.totalReviews) || 0;
  const hasRating = Number.isFinite(avg) && avg > 0 && reviews > 0;

  const items = [
    { icon: 'briefcase', value: String(activeCount), label: 'Active jobs' },
    { icon: 'layers', value: String(totalCount), label: 'Jobs posted' },
    { icon: 'star', value: hasRating ? avg.toFixed(1) : 'New', label: 'Avg. rating' },
    { icon: 'message-square', value: String(reviews), label: reviews === 1 ? 'Rating' : 'Ratings' }
  ];
  const grid = el('section', 'cp-stats');
  grid.setAttribute('aria-label', 'Business statistics');
  items.forEach((s) => {
    const card = el('div', 'cp-card cp-stat');
    const iconWrap = el('span', 'cp-stat__icon');
    iconWrap.append(icon(s.icon));
    card.append(iconWrap, el('span', 'cp-stat__value', s.value), el('span', 'cp-stat__label', s.label));
    grid.append(card);
  });
  return grid;
}

function aboutRow(iconName, label, valueNode) {
  const row = el('div', 'cp-about__row');
  const dt = el('dt', 'cp-about__label');
  dt.append(icon(iconName), el('span', null, label));
  const dd = el('dd', 'cp-about__value');
  dd.append(valueNode);
  row.append(dt, dd);
  return row;
}

function linkNode(href, label) {
  const a = el('a', 'cp-link', label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer nofollow';
  return a;
}

function buildAbout(profile, name) {
  const card = el('section', 'cp-card cp-about');
  card.append(el('h2', 'cp-section-title', 'About the business'));

  const desc = text(profile.businessDescription);
  if (desc) card.append(el('p', 'cp-about__desc', desc));

  const dl = el('dl', 'cp-about__list');
  dl.append(aboutRow('building-2', 'Business', document.createTextNode(name)));
  const category = text(profile.businessCategory);
  if (category) dl.append(aboutRow('tag', 'Category', document.createTextNode(category)));
  const address = fullAddress(profile);
  if (address) dl.append(aboutRow('map-pin', 'Address', document.createTextNode(address)));

  const areas = serviceAreas(profile);
  if (areas.length) {
    const chips = el('div', 'cp-chips');
    areas.forEach((a) => chips.append(el('span', 'cp-chip', a)));
    dl.append(aboutRow('map', 'Service areas', chips));
  }

  const site = safeUrl(profile.website);
  if (site) dl.append(aboutRow('globe', 'Website', linkNode(site, prettyUrl(site))));
  const insta = safeUrl(profile.instagram);
  if (insta) dl.append(aboutRow('instagram', 'Instagram', linkNode(insta, prettyUrl(insta))));
  const fb = safeUrl(profile.facebook);
  if (fb) dl.append(aboutRow('facebook', 'Facebook', linkNode(fb, prettyUrl(fb))));

  const since = memberSince(profile);
  if (since) dl.append(aboutRow('calendar', 'Member since', document.createTextNode(since)));

  card.append(dl);
  return card;
}

// Client ratings are stored as averageRating + totalReviews on the user
// document (written when a worker rates a client). There are no written
// reviews or per-star counts for clients, so none are shown.
function buildRating(profile) {
  const card = el('section', 'cp-card cp-rating');
  card.append(el('h2', 'cp-section-title', 'Rating'));
  const avg = Number(profile.averageRating);
  const count = Number(profile.totalReviews) || 0;

  if (!(Number.isFinite(avg) && avg > 0 && count > 0)) {
    card.append(el('p', 'cp-muted', 'No ratings yet. Workers can rate this business after completing a job.'));
    return card;
  }

  const row = el('div', 'cp-rating__row');
  row.append(el('span', 'cp-rating__value', avg.toFixed(1)));
  const right = el('div', 'cp-rating__right');
  const stars = el('div', 'cp-stars');
  stars.setAttribute('role', 'img');
  stars.setAttribute('aria-label', `${avg.toFixed(1)} out of 5`);
  const fill = el('div', 'cp-stars__fill');
  fill.style.width = `${Math.max(0, Math.min(5, avg)) / 5 * 100}%`;
  stars.append(el('span', 'cp-stars__base', '★★★★★'), fill);
  fill.append(el('span', null, '★★★★★'));
  right.append(stars, el('span', 'cp-muted', `Based on ${count} ${count === 1 ? 'rating' : 'ratings'} from workers`));
  row.append(right);
  card.append(row);
  return card;
}

function buildJobs(jobs, name) {
  const section = el('section', 'cp-jobs');
  const head = el('div', 'cp-jobs__head');
  head.append(el('h2', 'cp-section-title cp-jobs__title', `Jobs posted by ${name}`));
  head.append(el('span', 'cp-count', `${jobs.length} active`));
  section.append(head);

  const grid = el('div', 'jobs-grid cp-jobs__grid');
  if (!jobs.length) {
    grid.append(createStateBox({
      icon: 'briefcase',
      title: 'No active jobs right now',
      text: `${name} has no open jobs at the moment. Check back soon.`,
      action: { label: 'Browse all jobs', href: '/pages/jobs/index.html' }
    }));
  } else {
    jobs.forEach((j) => grid.append(createJobCard(j)));
  }
  section.append(grid);
  return section;
}

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */
function firstAuthState() {
  return new Promise((resolve) => {
    let done = false;
    onAuthChange((user) => { if (!done) { done = true; resolve(user || null); } });
    setTimeout(() => { if (!done) { done = true; resolve(null); } }, 8000);
  });
}

async function loadProfile() {
  const clientId = new URLSearchParams(location.search).get('id') || '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(clientId)) {
    showState({ icon: 'building-2', title: 'Business not found', text: 'This profile link is incomplete or incorrect.', action: { label: 'Browse jobs', href: '/pages/jobs/index.html' } });
    return;
  }

  try {
    const viewer = await firstAuthState();
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);

    // 1. Business profile (users/{id}). Rules require a signed-in reader.
    let profile;
    try {
      const snap = await firestore.getDoc(firestore.doc(db, 'users', clientId));
      if (!snap.exists()) {
        showState({ icon: 'building-2', title: 'Business not found', text: 'This business may have removed its profile.', action: { label: 'Browse jobs', href: '/pages/jobs/index.html' } });
        return;
      }
      profile = snap.data();
    } catch (err) {
      if (err?.code === 'permission-denied') {
        showState({
          icon: 'lock',
          title: 'Log in to view this business',
          text: 'Business profiles are visible to signed-in BloreWork members.',
          action: { label: 'Log in', href: LOGIN_URL }
        });
        return;
      }
      throw err;
    }

    // Only business accounts have a public business profile.
    if (profile.role && profile.role !== 'client' && profile.role !== 'admin') {
      showState({ icon: 'building-2', title: 'Business not found', text: 'This link does not belong to a business account.', action: { label: 'Browse jobs', href: '/pages/jobs/index.html' } });
      return;
    }

    // 2. This business's jobs (jobs are publicly readable).
    const jobsSnap = await firestore.getDocs(firestore.query(firestore.collection(db, 'jobs'), firestore.where('clientId', '==', clientId)));
    const allJobs = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const activeJobs = allJobs
      .filter(isJobActive)
      .sort((a, b) => (Number(!!b.isFeatured) - Number(!!a.isFeatured))
        || (Number(!!b.isUrgent) - Number(!!a.isUrgent))
        || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));

    // 3. Contact permission — same rule as the job details page.
    const isOwner = viewer?.uid === clientId;
    let canContact = IS_FREE_MODE || isOwner;
    if (!canContact && viewer) {
      const viewerProfile = await getUserProfile(viewer.uid);
      canContact = Number(viewerProfile?.subscriptionExpires) > Date.now();
    }
    const number = businessWhatsApp(profile);
    const contact = !number ? { state: 'none' } : canContact ? { state: 'available', number } : { state: 'locked' };

    const name = text(profile.businessName) || 'Business';
    document.title = `${name} — BloreWork`;
    const ctx = {
      profile, name, isOwner, contact,
      publicUrl: `${location.origin}/pages/client/public-profile.html?id=${encodeURIComponent(clientId)}`
    };

    // 4. Render
    const layout = el('div', 'cp-layout');
    const main = el('div', 'cp-main');
    const side = el('aside', 'cp-side');
    main.append(buildJobs(activeJobs, name));
    side.append(buildAbout(profile, name), buildRating(profile));
    layout.append(main, side);

    root.replaceChildren(
      buildHero(ctx),
      buildStats({ activeCount: activeJobs.length, totalCount: allJobs.length, profile }),
      layout
    );
    refreshIcons();
  } catch (err) {
    console.error('Error loading business profile', err);
    showState({
      icon: 'wifi-off',
      title: 'Could not load this profile',
      text: 'Check your connection and try again.',
      action: { label: 'Try again', onClick: loadProfile }
    });
  }
}

loadProfile();
