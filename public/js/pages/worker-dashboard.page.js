import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile } from '/js/services/user.service.js';
import { onAuthChange } from '/js/firebase/auth.service.js';

initNavbar();
initBottomNav();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

function showError(msg) {
  const grids = ['recent-jobs-grid', 'applied-jobs-grid', 'completed-jobs-grid'];
  grids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p class="text-error" style="padding: 16px;">${msg}</p>`;
  });
  const stats = document.getElementById('worker-stats');
  if (stats) stats.innerHTML = `<p class="text-error">Could not load stats</p>`;
}

onAuthChange(async (user) => {
  if (!user) { window.location.href = '/pages/auth/login.html'; return; }

  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const profile = await getUserProfile(user.uid);
    
    // 1. Stats
    const statsCard = document.getElementById('worker-stats');
    if (statsCard) {
      const completed = profile?.completedJobs || 0;
      const rating = profile?.averageRating ? profile.averageRating.toFixed(1) : 'New';
      const starDisplay = profile?.averageRating ? '⭐'.repeat(Math.round(profile.averageRating)) : '';
      statsCard.innerHTML = `
        <h3>Your Stats</h3>
        <p class="text-muted" style="font-size: 1.1rem; margin-top: 0.5rem;">Completed Jobs: <strong>${completed}</strong></p>
        <p class="text-muted" style="font-size: 1.1rem;">Rating: <strong>${rating}</strong> ${starDisplay}</p>
      `;
    }

    // 2. Profile Progress
    const progressContainer = document.getElementById('profile-progress');
    if (profile && progressContainer) {
      let score = 0; let missing = [];
      if (profile.displayName) score += 20; else missing.push('Name');
      if (profile.phone) score += 20; else missing.push('Phone');
      if (profile.skills) score += 20; else missing.push('Skills');
      if (profile.experience) score += 20; else missing.push('Experience');
      if (profile.photoUrl) score += 20; else missing.push('Photo');

      if (score < 100) {
        progressContainer.style.display = 'block';
        document.getElementById('progress-pct').textContent = `${score}%`;
        document.getElementById('progress-fill').style.width = `${score}%`;
        document.getElementById('progress-tip').innerHTML = `Missing: <strong>${missing.join(', ')}</strong>. <a href="/pages/worker/profile.html" style="color: var(--color-primary);">Update</a>`;
      }
    }

    // 3. Helper to load grids
    async function renderGrid(jobIds, gridId, emptyMsg, isCompleted = false) {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      
      if (!jobIds || jobIds.length === 0) {
        grid.innerHTML = `<p class="text-muted">${emptyMsg}</p>`;
        return;
      }

      const jobs = [];
      for (const id of jobIds) {
        const snap = await firestore.getDoc(firestore.doc(db, 'jobs', id));
        if (snap.exists()) jobs.push({ id: snap.id, ...snap.data() });
      }

      if (jobs.length === 0) { grid.innerHTML = `<p class="text-muted">No jobs found.</p>`; return; }

      grid.innerHTML = '';
      jobs.forEach(job => {
        const card = document.createElement('a');
        card.href = `/pages/jobs/detail.html?id=${job.id}`;
        card.className = 'job-card';
        card.style = `cursor: pointer; ${isCompleted ? 'border-left: 4px solid var(--color-success);' : ''}`;
        card.innerHTML = `
          <div class="title">${job.title}</div>
          <div class="category">${job.category}</div>
          <div class="salary">₹${job.pay}/day</div>
          <div class="meta">
            <span><i data-lucide="map-pin" class="icon"></i>${job.location}</span>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // 4. Render all grids
    await renderGrid(profile?.recentlyViewed, 'recent-jobs-grid', "No recently viewed jobs.");
    await renderGrid(profile?.appliedJobs, 'applied-jobs-grid', "No applied jobs.");
    await renderGrid(profile?.completedJobsHistory, 'completed-jobs-grid', "No completed jobs yet.", true);

    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    console.error(err);
    showError("Failed to load dashboard data. Please refresh.");
  }
});
