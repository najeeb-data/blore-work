import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';
import { getJobs } from '../services/job.service.js';
import { createJobCard, renderSkeletons, createStateBox, refreshIcons } from '../components/job-card.js';

const RECENT_COUNT = 6;

async function loadRecentJobs() {
  const grid = document.getElementById('home-jobs-grid');
  if (!grid) return;
  renderSkeletons(grid, 4);

  try {
    // getJobs() already removes closed and past-dated jobs and sorts newest first.
    const jobs = await getJobs();
    const recent = jobs.slice(0, RECENT_COUNT);
    grid.removeAttribute('aria-busy');

    if (!recent.length) {
      grid.replaceChildren(createStateBox({
        icon: 'briefcase',
        title: 'No jobs posted yet',
        text: 'New jobs are added every day. Businesses can post one in minutes.',
        action: { label: 'Post a Job', href: '/pages/client/post-job.html' }
      }));
    } else {
      grid.replaceChildren(...recent.map(createJobCard));
    }
  } catch (err) {
    console.error('[home] could not load recent jobs', err);
    grid.removeAttribute('aria-busy');
    grid.replaceChildren(createStateBox({
      icon: 'wifi-off',
      title: 'Could not load jobs',
      text: 'Please check your connection and refresh the page.'
    }));
  }
  refreshIcons();
}

(async function boot() {
  try {
    await initNavbar();
    initFooter();
    await initBottomNav();
  } catch (err) {
    console.error('[home] navigation failed to load', err);
  }

  // Hero search → Find Jobs
  document.getElementById('hero-search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('hero-search-input').value.trim();
    window.location.href = `/pages/jobs/index.html${query ? '?search=' + encodeURIComponent(query) : ''}`;
  });

  await loadRecentJobs();
})();
