import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { showToast } from '/js/components/toast.js';
import { createJob } from '/js/services/job.service.js';
import { escapeHTML } from '/js/utils/sanitize.js';
import { WORK_CATEGORIES, BANGALORE_LOCATIONS, WORK_TYPES } from '/js/config/data.js';

initNavbar();
initBottomNav();

const catSelect = document.getElementById('job-category');
WORK_CATEGORIES.forEach(c => catSelect.innerHTML += `<option value="${c}">${c}</option>`);

const typeSelect = document.getElementById('job-worktype');
WORK_TYPES.forEach(t => typeSelect.innerHTML += `<option value="${t}">${t}</option>`);

const locSelect = document.getElementById('job-location');
for (const [region, areas] of Object.entries(BANGALORE_LOCATIONS)) {
  const optGroup = document.createElement('optgroup');
  optGroup.label = region;
  areas.forEach(area => optGroup.innerHTML += `<option value="${area}">${area}</option>`);
  locSelect.appendChild(optGroup);
}

document.getElementById('post-job-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.innerText = 'Publishing...';
  btn.disabled = true;

  try {
    await createJob({
      title: escapeHTML(document.getElementById('job-title').value),
      category: document.getElementById('job-category').value,
      workType: document.getElementById('job-worktype').value,
      description: escapeHTML(document.getElementById('job-desc').value),
      date: document.getElementById('job-date').value,
      time: document.getElementById('job-time').value,
      workersNeeded: Number(document.getElementById('job-workers').value),
      pay: Number(document.getElementById('job-pay').value),
      location: document.getElementById('job-location').value,
      isFeatured: false
    });
    showToast('Job published successfully!', 'success');
    setTimeout(() => window.location.href = '/pages/client/dashboard.html', 1500);
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
    btn.innerText = originalText;
    btn.disabled = false;
  }
});