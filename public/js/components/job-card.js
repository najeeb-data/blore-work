// Shared job card used by the homepage (Recent Jobs), Find Jobs, Saved Jobs
// and the public business profile.
// Builds DOM with textContent only, so job text can never inject HTML.
// Call window.lucide.createIcons() after appending cards (icons use <i data-lucide>).

// Older jobs were saved HTML-escaped ("&amp;"); decode once for display.
const decoder = typeof document !== 'undefined' ? document.createElement('textarea') : null;
export function decodeText(value) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (!decoder || !/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s)) return s;
  decoder.innerHTML = s;
  return decoder.value;
}

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/* ---------- Formatting ---------- */
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatPay(pay) {
  const n = Number(pay);
  if (!hasValue(pay) || !Number.isFinite(n) || n <= 0) return '';
  return `₹${inr.format(n)}`;
}

// "2026-11-27" → local Date (avoids the UTC shift of new Date('YYYY-MM-DD')).
export function parseJobDate(value) {
  if (!hasValue(value)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(value) {
  if (!hasValue(value)) return '';
  const s = String(value).trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s; // e.g. "Flexible" — show as stored
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

export function formatTiming(job) {
  const date = parseJobDate(job.date);
  const time = formatTime(job.time);
  const timeIsFlexible = !time || /^flexible$/i.test(time);

  if (!date) return timeIsFlexible ? 'Flexible timing' : `Flexible date · ${time}`;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  const day = diff === 0 ? 'Today'
    : diff === 1 ? 'Tomorrow'
    : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return timeIsFlexible ? day : `${day} · ${time}`;
}

export function formatPosted(createdAt) {
  const secs = createdAt?.seconds ?? (createdAt instanceof Date ? createdAt.getTime() / 1000 : null);
  if (!secs) return '';
  const mins = Math.floor((Date.now() / 1000 - secs) / 60);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(secs * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ---------- DOM helpers ---------- */
function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function icon(name) {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name);
  i.className = 'jc__icon';
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function metaItem(iconName, text, label) {
  const li = node('li', 'jc__meta-item');
  li.append(icon(iconName));
  const span = node('span', 'jc__meta-text', text);
  if (label) span.title = label;
  li.append(span);
  return li;
}

/* ---------- Bookmark button ---------- */
export function setSaveButtonState(btn, saved) {
  btn.classList.toggle('is-saved', saved);
  btn.setAttribute('aria-pressed', String(saved));
  const label = saved ? 'Remove from saved jobs' : 'Save job';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

/* ---------- Card ---------- */
// options (all optional):
//   saved:        boolean - current bookmark state
//   onToggleSave: (job, button) => void - when given, a bookmark button is added.
//                 The card is then wrapped in <div class="jc-wrap"> so the button
//                 is not nested inside the link.
//   status:       'closed' | 'expired' - shows the job as no longer available
export function createJobCard(job, options = {}) {
  const card = document.createElement('a');
  card.className = 'job-card jc';
  if (options.status) card.classList.add('jc--inactive');
  card.href = `/pages/jobs/detail.html?id=${encodeURIComponent(job.id)}`;

  const title = decodeText(job.title) || 'Untitled job';
  const category = decodeText(job.category);
  const location = decodeText(job.location);
  const pay = formatPay(job.pay);
  const workers = Number(job.workersNeeded);

  card.setAttribute('aria-label', [title, pay && `${pay} per day`, location].filter(Boolean).join(', '));

  // Top row: category + badges
  const top = node('div', 'jc__top');
  if (category) top.append(node('span', 'jc__category', category));
  const badges = node('div', 'jc__badges');
  if (options.status) {
    const b = node('span', 'jc__badge jc__badge--muted');
    b.append(icon(options.status === 'closed' ? 'lock' : 'calendar-x'), document.createTextNode(options.status === 'closed' ? 'Closed' : 'Expired'));
    badges.append(b);
  }
  if (job.isFeatured && !options.status) {
    const b = node('span', 'jc__badge jc__badge--featured');
    b.append(icon('star'), document.createTextNode('Featured'));
    badges.append(b);
  }
  if (job.isUrgent && !options.status) {
    const b = node('span', 'jc__badge jc__badge--urgent');
    b.append(icon('zap'), document.createTextNode('Urgent'));
    badges.append(b);
  }
  if (badges.childElementCount) top.append(badges);
  if (top.childElementCount) card.append(top);

  card.append(node('h3', 'jc__title', title));

  if (pay) {
    const payEl = node('div', 'jc__pay');
    payEl.append(node('span', 'jc__pay-amount', pay), node('span', 'jc__pay-unit', '/ day'));
    card.append(payEl);
  }

  const meta = node('ul', 'jc__meta');
  meta.append(metaItem('clock', formatTiming(job)));
  if (Number.isFinite(workers) && workers > 0) {
    meta.append(metaItem('users', `${workers} ${workers === 1 ? 'worker' : 'workers'} needed`));
  }
  if (location) meta.append(metaItem('map-pin', location, location));
  card.append(meta);

  const footer = node('div', 'jc__footer');
  const posted = formatPosted(job.createdAt);
  footer.append(node('span', 'jc__posted', posted ? `Posted ${posted}` : ''));
  const cta = node('span', 'jc__cta', 'View details');
  cta.append(icon('arrow-right'));
  footer.append(cta);
  card.append(footer);

  if (typeof options.onToggleSave !== 'function') return card;

  const wrap = node('div', 'jc-wrap');
  wrap.dataset.jobId = job.id;
  card.classList.add('jc--has-save');
  const btn = node('button', 'jc-save');
  btn.type = 'button';
  btn.append(icon('bookmark'));
  setSaveButtonState(btn, !!options.saved);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onToggleSave(job, btn);
  });
  wrap.append(card, btn);
  return wrap;
}

export function createSkeletonCard() {
  const s = node('div', 'jc-skeleton');
  s.setAttribute('aria-hidden', 'true');
  ['jc-skeleton__chip', 'jc-skeleton__title', 'jc-skeleton__pay', 'jc-skeleton__line', 'jc-skeleton__line jc-skeleton__line--short']
    .forEach((c) => s.append(node('div', `jc-skeleton__bar ${c}`)));
  return s;
}

export function renderSkeletons(grid, count = 4) {
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren(...Array.from({ length: count }, createSkeletonCard));
}

// Empty / error state. action = { label, href } or { label, onClick }.
export function createStateBox({ icon: iconName = 'briefcase', title, text, action }) {
  const box = node('div', 'state-container jc-state');
  const iconWrap = node('div', 'jc-state__icon');
  iconWrap.append(icon(iconName));
  box.append(iconWrap, node('h3', 'jc-state__title', title));
  if (text) box.append(node('p', 'jc-state__text', text));
  if (action) {
    const a = action.href ? node('a', 'btn btn-primary btn-sm', action.label) : node('button', 'btn btn-secondary btn-sm', action.label);
    if (action.href) a.href = action.href;
    else { a.type = 'button'; a.addEventListener('click', action.onClick); }
    box.append(a);
  }
  return box;
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
