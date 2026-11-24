import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile } from '/js/services/user.service.js';

initNavbar();
initBottomNav();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

async function loadPublicProfile() {
  const params = new URLSearchParams(window.location.search);
  const workerId = params.get('id');
  const card = document.getElementById('profile-card');

  if (!workerId) { card.innerHTML = '<h2>Worker not found</h2>'; return; }

  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const profile = await getUserProfile(workerId);
    
    if (!profile) { card.innerHTML = '<h2>Worker profile not found</h2>'; return; }

    // Fetch Reviews
    const q = firestore.query(firestore.collection(db, 'reviews'), firestore.where('workerId', '==', workerId));
    const reviewsSnap = await firestore.getDocs(q);
    const reviews = reviewsSnap.docs.map(doc => doc.data()).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const photoUrl = profile.photoUrl || '/assets/icons/company-placeholder.png';
    const rating = profile.averageRating ? profile.averageRating.toFixed(1) : 'New';
    const stars = profile.averageRating ? '⭐'.repeat(Math.round(profile.averageRating)) : '';
    const completed = profile.completedJobs || 0;

    // Create Pills for Categories and Locations
    const createPills = (str) => {
      if (!str) return '';
      return str.split(',').map(s => `<span style="background: var(--color-surface-alt); padding: 4px 12px; border-radius: 99px; font-size: 13px; font-weight: 500; color: var(--color-text); border: 1px solid var(--color-border);">${s.trim()}</span>`).join('');
    };

    let reviewsHtml = '';
    if (reviews.length === 0) {
      reviewsHtml = '<p class="text-muted" style="font-size: 14px;">No written reviews yet.</p>';
    } else {
      reviews.forEach(r => {
        reviewsHtml += `
          <div style="border-bottom: 1px solid var(--color-border); padding: 16px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong style="font-size: 14px; color: var(--color-text);">${r.clientName}</strong>
              <span style="color: #F59E0B; font-size: 13px;">${'⭐'.repeat(r.rating)}</span>
            </div>
            <p class="text-muted" style="font-size: 14px; line-height: 1.5;">"${r.text}"</p>
          </div>
        `;
      });
    }

    card.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${photoUrl}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-primary); margin: 0 auto 16px; background: #fff;">
        <h1 style="font-size: 24px; margin-bottom: 4px; color: var(--color-text);">${profile.displayName || 'Worker'}</h1>
        ${profile.age ? `<p class="text-muted" style="font-size: 14px;">${profile.age} years old</p>` : ''}
        
        <div style="margin-top: 12px;">
          <span style="font-size: 18px; font-weight: bold; color: var(--color-primary);">${rating}</span> 
          <span style="font-size: 16px;">${stars}</span>
          <span class="text-muted" style="display: block; font-size: 13px; margin-top: 4px;">(${completed} jobs completed)</span>
        </div>
      </div>

      <!-- Interested Categories -->
      ${profile.preferredCategories ? `
        <div class="card section-card" style="margin-bottom: 16px; padding: 20px; text-align: left; background: var(--color-surface);">
          <h4 style="margin-bottom: 12px; font-size: 15px; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">Interested Categories</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">${createPills(profile.preferredCategories)}</div>
        </div>
      ` : ''}

      <!-- Preferred Locations -->
      ${profile.preferredLocations ? `
        <div class="card section-card" style="margin-bottom: 16px; padding: 20px; text-align: left; background: var(--color-surface);">
          <h4 style="margin-bottom: 12px; font-size: 15px; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">Preferred Work Locations</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">${createPills(profile.preferredLocations)}</div>
        </div>
      ` : ''}

      <!-- Skills & Experience -->
      <div class="card section-card" style="margin-bottom: 16px; padding: 20px; text-align: left; background: var(--color-surface);">
        <h4 style="margin-bottom: 12px; font-size: 15px; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">Skills & Experience</h4>
        <p style="font-size: 14px; margin-bottom: 8px; color: var(--color-text);"><strong>Skills:</strong> ${profile.skills || 'No skills listed.'}</p>
        <p style="font-size: 14px; color: var(--color-text);"><strong>Experience:</strong> ${profile.experience ? profile.experience + ' years' : 'No experience listed.'}</p>
      </div>

      <!-- Reviews -->
      <div class="card section-card" style="margin-bottom: 24px; padding: 20px; text-align: left; background: var(--color-surface);">
        <h4 style="margin-bottom: 12px; font-size: 15px; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">Reviews from Clients</h4>
        ${reviewsHtml}
      </div>

      <a href="javascript:history.back()" class="btn btn-outline btn-block" style="margin-bottom: 40px;">← Go Back</a>
    `;
    
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error(err);
    card.innerHTML = '<h2>Error loading profile</h2>';
  }
}
loadPublicProfile();
