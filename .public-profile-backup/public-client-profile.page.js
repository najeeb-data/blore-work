import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile } from '/js/services/user.service.js';

initNavbar();
initBottomNav();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('id');
  const container = document.getElementById('profile-content');

  if (!clientId) { container.innerHTML = '<h2>Business not found</h2>'; return; }

  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    
    // 1. Fetch Client Profile
    const profile = await getUserProfile(clientId);
    if (!profile) { container.innerHTML = '<h2>Business profile not found</h2>'; return; }

    // 2. Fetch Client's Jobs (No complex query, just filter in JS)
    const q = firestore.query(firestore.collection(db, 'jobs'), firestore.where('clientId', '==', clientId));
    const jobsSnap = await firestore.getDocs(q);
    
    let jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    jobs = jobs.filter(j => j.status === 'open');
    jobs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // 3. Setup Variables
    const logoUrl = profile.logoUrl || '/assets/icons/company-placeholder.png';
    const name = profile.businessName || 'Business';
    const rating = profile.averageRating ? profile.averageRating.toFixed(1) : 'New';
    const reviews = profile.totalReviews || 0;
    const verified = profile.isVerified ? '<i data-lucide="check-circle" style="color:#263FE5; width:20px;"></i>' : '';
    const phone = profile.phone ? profile.phone.replace(/\D/g, '') : '';
    const locationText = profile.locationArea ? `${profile.locationArea}${profile.address ? `, ${profile.address}` : ''}` : (profile.address || 'Bangalore, India');
    
    // 4. Render Jobs Grid
    let jobsHtml = '';
    if (jobs.length === 0) {
      jobsHtml = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 24px;">No active jobs at the moment.</p>';
    } else {
      jobs.forEach(job => {
        jobsHtml += `
          <a href="/pages/jobs/detail.html?id=${job.id}" class="grid-card">
            <div>
              <div class="title">${job.title}</div>
              <div class="category">${job.category}</div>
            </div>
            <div>
              <div class="salary">₹${job.pay}/day</div>
              <div class="location"><i data-lucide="map-pin"></i>${job.location}</div>
            </div>
          </a>
        `;
      });
    }

    container.innerHTML = `
      <div class="card mb-4" style="border: none; background: transparent; padding: 0;">
        <div class="profile-header">
          <img src="${logoUrl}" class="profile-avatar">
          <div class="profile-info">
            <div class="profile-name">${name} ${verified}</div>
            <div class="profile-stats">
              <div><strong>${jobs.length}</strong><span>Active Jobs</span></div>
              <div><strong>${rating}</strong><span>Rating (${reviews})</span></div>
            </div>
            <div class="profile-bio">
              <div><i data-lucide="map-pin" class="icon"></i>${locationText}</div>
            </div>
          </div>
        </div>

        <div class="profile-actions">
          ${phone ? `
            <a href="https://wa.me/${phone}?text=Hi, I saw your business on BloreWork and would like to connect." target="_blank" class="btn btn-primary">
              <i data-lucide="message-circle"></i> Chat
            </a>
          ` : ''}
          <button id="share-profile-btn" class="btn btn-secondary">
            <i data-lucide="share-2"></i> Share Profile
          </button>
        </div>
      </div>

      <div style="border-top: 1px solid var(--color-border); padding-top: 24px;">
        <h3 style="margin-bottom: 16px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="briefcase"></i> Jobs Posted by ${name}
        </h3>
        <div class="jobs-grid-container">
          ${jobsHtml}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Share Profile Logic
    document.getElementById('share-profile-btn')?.addEventListener('click', () => {
      const text = `Check out ${name} on BloreWork! They are hiring. View their profile here: ${window.location.href}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<h2>Error loading profile</h2>';
  }
}
loadProfile();