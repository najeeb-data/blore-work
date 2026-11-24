import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile } from '/js/services/user.service.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
const SEK = 'https://www.gstatic.com/firebasejs/10.13.0';

initNavbar();
initBottomNav();

function showSkeletons() {
  const grid = document.getElementById('saved-jobs-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    grid.innerHTML += `<div class="skeleton-card"></div>`;
  }
}

function showEmptyState() {
  document.getElementById('saved-jobs-grid').innerHTML = `
    <div class="state-container">
      <i data-lucide="bookmark" class="icon"></i>
      <h3>No saved jobs yet</h3>
      <p>Tap "Save" on a job to keep it here for later.</p>
      <a href="/pages/jobs/index.html" class="btn btn-primary">Find Jobs</a>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

onAuthChange(async (user) => {
  if (!user) {
    window.location.href = '/pages/auth/login.html';
    return;
  }

  showSkeletons();
  
  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const profile = await getUserProfile(user.uid);
    const savedIds = profile?.savedJobs || [];

    if (savedIds.length === 0) { showEmptyState(); return; }

    const jobsData = [];
    for (const id of savedIds) {
      const docSnap = await firestore.getDoc(firestore.doc(db, 'jobs', id));
      if (docSnap.exists()) {
        const job = { id: docSnap.id, ...docSnap.data() };
        if (job.status !== 'closed') jobsData.push(job); 
      }
    }

    if (jobsData.length === 0) { showEmptyState(); return; }

    const grid = document.getElementById('saved-jobs-grid');
    grid.innerHTML = '';
    
    jobsData.forEach(job => {
      const dateStr = job.date ? new Date(job.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Flexible Timing';
      const card = document.createElement('a');
      card.href = `/pages/jobs/detail.html?id=${job.id}`;
      card.className = 'job-card';
      card.innerHTML = `
        <div class="title">${job.title}</div>
        <div class="category">${job.category}</div>
        <div class="salary">₹${job.pay}/day</div>
        <div class="meta">
          <span><i data-lucide="clock" class="icon"></i>${dateStr}</span>
          <span><i data-lucide="map-pin" class="icon"></i>${job.location}</span>
        </div>
      `;
      grid.appendChild(card);
    });
    
    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    console.error(err);
    document.getElementById('saved-jobs-grid').innerHTML = '<p class="text-error">Failed to load.</p>';
  }
});