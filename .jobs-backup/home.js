import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';
import { getJobs } from '../services/job.service.js';

(async function boot() {
  try {
    await initNavbar();
    initFooter();
    await initBottomNav();

    // Handle Search
    document.getElementById('hero-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const query = document.getElementById('hero-search-input').value.trim();
      window.location.href = `/pages/jobs/index.html${query ? '?search=' + encodeURIComponent(query) : ''}`;
    });

    // Fetch Jobs
    const grid = document.getElementById('home-jobs-grid');
    grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(4);

    const jobs = await getJobs();
    const recentJobs = jobs.slice(0, 4);

    if (recentJobs.length === 0) {
      grid.innerHTML = `
        <div class="state-container" style="grid-column: 1/-1;">
          <i data-lucide="briefcase" class="icon"></i>
          <h3>No jobs posted yet</h3>
          <p>Be the first to post a job!</p>
          <a href="/pages/client/post-job.html" class="btn btn-primary">Post a Job</a>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = '';
    recentJobs.forEach(job => {
      const dateStr = job.date ? new Date(job.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Flexible';
      const badges = [];
      if (job.isFeatured) badges.push('<span class="badge-featured">⭐ Featured</span>');
      if (job.isUrgent) badges.push('<span class="badge-urgent">Urgent</span>');

      const card = document.createElement('a');
      card.href = `/pages/jobs/detail.html?id=${job.id}`;
      card.className = 'job-card';
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div class="title">${job.title}</div>
            <div class="category">${job.category}</div>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">${badges.join('')}</div>
        </div>
        <div class="salary">₹${job.pay}/day</div>
        <div class="meta">
          <span><i data-lucide="clock" class="icon"></i>${dateStr} at ${job.time || 'Flexible'}</span>
          <span><i data-lucide="map-pin" class="icon"></i>${job.location}</span>
        </div>
      `;
      grid.appendChild(card);
    });
    
    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    console.error('[home] boot failed', err);
  }
})();
