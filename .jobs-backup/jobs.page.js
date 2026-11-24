import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';
import { getJobs } from '../services/job.service.js';
import { getFirebase } from '../firebase/firebase.service.js';
import { getUserProfile } from '../services/user.service.js';
import { showToast } from '../components/toast.js';

initNavbar();
initFooter();
initBottomNav();

let allJobs = [];
let currentFilteredJobs = [];

function showSkeletons() {
  const grid = document.getElementById('jobs-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    grid.innerHTML += `<div class="skeleton-card"></div>`;
  }
}

function showEmptyState(message = "No jobs found", sub = "Try adjusting your search or filters.") {
  document.getElementById('jobs-grid').innerHTML = `
    <div class="state-container">
      <i data-lucide="briefcase" class="icon"></i>
      <h3>${message}</h3>
      <p>${sub}</p>
      <a href="/pages/jobs/index.html" class="btn btn-primary">Clear Filters</a>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

async function loadJobs() {
  showSkeletons();
  
  try {
    allJobs = await getJobs();
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('search');
    
    if (searchQuery) {
      document.getElementById('job-search').value = searchQuery;
      currentFilteredJobs = allJobs.filter(job => job.title.toLowerCase().includes(searchQuery.toLowerCase()) || job.location.toLowerCase().includes(searchQuery.toLowerCase()));
    } else {
      currentFilteredJobs = [...allJobs];
    }
    renderJobs(currentFilteredJobs);
  } catch (err) {
    document.getElementById('jobs-grid').innerHTML = '<p class="text-error">Failed to load jobs.</p>';
  }
}

function renderJobs(jobsToRender) {
  const grid = document.getElementById('jobs-grid');
  
  if (jobsToRender.length === 0) {
    showEmptyState("No jobs found", "Try a different search or click 'My Preferences'.");
    return;
  }

  const sortType = document.getElementById('sort-select').value;
  let sorted = [...jobsToRender];

  if (sortType === 'pay-high') sorted.sort((a, b) => b.pay - a.pay);
  else if (sortType === 'pay-low') sorted.sort((a, b) => a.pay - b.pay);

  // Float Featured -> Urgent -> Normal
  sorted.sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    return 0;
  });

  grid.innerHTML = '';
  sorted.forEach(job => {
    // Fix for "Flexible at Flexible"
    let dateStr = 'Flexible Timing';
    if (job.date) {
      const d = new Date(job.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      dateStr = job.time ? `${d} at ${job.time}` : d;
    } else if (job.time) {
      dateStr = `Flexible Date at ${job.time}`;
    }

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
        <span><i data-lucide="clock" class="icon"></i>${dateStr}</span>
        <span><i data-lucide="users" class="icon"></i>${job.workersNeeded || 1} needed</span>
        <span><i data-lucide="map-pin" class="icon"></i>${job.location}</span>
      </div>
    `;
    grid.appendChild(card);
  });
  
  if (window.lucide) window.lucide.createIcons();
}

// Event Listeners
document.getElementById('sort-select').addEventListener('change', () => {
  renderJobs(currentFilteredJobs);
});

document.getElementById('job-search').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  currentFilteredJobs = allJobs.filter(job => job.title.toLowerCase().includes(term) || job.location.toLowerCase().includes(term));
  renderJobs(currentFilteredJobs);
});

document.querySelector('.chip[data-category="All Jobs"]').addEventListener('click', (e) => {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilteredJobs = [...allJobs];
  renderJobs(currentFilteredJobs);
});

// --- SMART "MY PREFERENCES" LOGIC ---
document.getElementById('interested-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const { auth } = await getFirebase();
  
  if (!auth.currentUser) {
    showToast('Please log in to view your preferred jobs.', 'error');
    setTimeout(() => window.location.href = '/pages/auth/login.html', 1500);
    return;
  }
  
  try {
    const profile = await getUserProfile(auth.currentUser.uid);
    if (!profile || (!profile.preferredCategories && !profile.preferredLocations)) {
      showToast('Please go to My Profile and set your preferred categories and locations.', 'error');
      return;
    }
    
    // Parse strings into lowercase arrays
    const prefCats = profile.preferredCategories ? profile.preferredCategories.split(',').map(s => s.trim().toLowerCase()) : [];
    const prefLocs = profile.preferredLocations ? profile.preferredLocations.split(',').map(s => s.trim().toLowerCase()) : [];
    
    if (prefCats.length === 0 && prefLocs.length === 0) {
      showToast('Your preferences are empty. Please update your profile.', 'error');
      return;
    }

    // SMART MATCHING: Check if either string contains the other
    const filtered = allJobs.filter(job => {
      const jobCat = (job.category || '').toLowerCase();
      const jobLoc = (job.location || '').toLowerCase();
      
      // Matches if "catering" is in "catering services" OR "catering services" is in "catering"
      const catMatch = prefCats.some(pref => jobCat.includes(pref) || pref.includes(jobCat));
      const locMatch = prefLocs.some(pref => jobLoc.includes(pref) || pref.includes(jobLoc));
      
      return catMatch || locMatch;
    });
    
    // UI Update
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    
    if (filtered.length === 0) {
      showToast('No jobs found matching your preferences right now.', 'error');
      showEmptyState("No matches yet", "No jobs match your saved preferences at the moment.");
    } else {
      currentFilteredJobs = filtered;
      renderJobs(filtered);
    }
    
  } catch (err) {
    console.error(err);
    showToast('Failed to load preferences.', 'error');
  }
});

loadJobs();
