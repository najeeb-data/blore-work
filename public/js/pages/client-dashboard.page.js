import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { deleteJob, closeJob } from '/js/services/job.service.js';
import { completeJobWithRating, getUserProfile } from '/js/services/user.service.js';
import { showToast } from '/js/components/toast.js';
import { sendNotification } from '/js/services/notification.service.js';

initNavbar();
initBottomNav();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

async function loadClientJobs() {
  const card = document.querySelector('.card');
  
  try {
    const [{ db, auth }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    if (!auth.currentUser) return;
    
    // Show user name
    const profile = await getUserProfile(auth.currentUser.uid);
    if (profile && profile.businessName) document.getElementById('client-name').textContent = profile.businessName;

    const q = firestore.query(firestore.collection(db, 'jobs'), firestore.where('clientId', '==', auth.currentUser.uid), firestore.orderBy('createdAt', 'desc'));
    const snapshot = await firestore.getDocs(q);
    const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (jobs.length === 0) {
      document.getElementById('client-stats').style.display = 'none';
      card.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <h3 style="margin-bottom: 0.5rem;">You haven't posted any jobs yet.</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">Hire your first worker in minutes.</p>
          <a href="/pages/client/post-job.html" class="btn btn-primary">+ Post Your First Job</a>
        </div>
      `;
      return;
    }
    
    // --- Calculate Stats ---
    let activeJobsCount = 0;
    let totalViews = 0;
    let totalInterested = 0;

    let html = `<table style="width: 100%; text-align: left; border-collapse: collapse;">
      <thead><tr style="border-bottom: 1px solid var(--color-border);">
        <th style="padding: 0.5rem 0;">Title</th>
        <th style="padding: 0.5rem 0;">Status</th>
        <th style="padding: 0.5rem 0;">Views</th>
        <th style="padding: 0.5rem 0;">Interested</th>
        <th style="padding: 0.5rem 0;">Actions</th>
      </tr></thead><tbody>`;
    
    for (const job of jobs) {
      const interestedSnap = await firestore.getDocs(firestore.collection(db, `jobs/${job.id}/interested`));
      const interestedCount = interestedSnap.size;
      
      if (job.status !== 'closed') activeJobsCount++;
      totalViews += (job.views || 0);
      totalInterested += interestedCount;

      const statusBadge = job.status === 'closed' 
        ? '<span style="color: var(--color-error); font-weight: 600;">Closed</span>' 
        : '<span style="color: var(--color-success); font-weight: 600;">Open</span>';
      const closeBtn = job.status === 'closed' ? '' : `<button class="btn btn-outline btn-sm" onclick="closeJobAction('${job.id}')">Close</button>`;

      html += `<tr style="border-bottom: 1px solid var(--color-divider);">
          <td style="padding: 0.75rem 0; font-weight: 500;">${job.title}<br><span class="text-muted" style="font-size: 0.8rem;">₹${job.pay}</span></td>
          <td style="padding: 0.75rem 0;">${statusBadge}</td>
          <td style="padding: 0.75rem 0;">👁️ ${job.views || 0}</td>
          <td style="padding: 0.75rem 0;"><button class="btn btn-outline btn-sm" onclick="viewContacts('${job.id}', '${job.title}')">${interestedCount}</button></td>
          <td style="padding: 0.75rem 0; display: flex; gap: 0.5rem;">
            ${closeBtn} <button class="btn btn-outline btn-sm" onclick="window.location.href='/pages/client/post-job.html?edit=${job.id}'">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="shareJob('${job.id}', '${job.title}', '${job.location}', '${job.pay}')" title="Share on WhatsApp"><i data-lucide="share-2" style="width:16px;"></i></button>
            <button class="btn btn-ghost btn-sm text-error" onclick="deleteJobAction('${job.id}')">Delete</button>
          </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    card.innerHTML = html;

    // Inject Stats
    document.getElementById('stat-active-jobs').textContent = activeJobsCount;
    document.getElementById('stat-views').textContent = totalViews;
    document.getElementById('stat-interested').textContent = totalInterested;
    const rating = profile?.averageRating ? profile.averageRating.toFixed(1) : 'New';
    document.getElementById('stat-rating').textContent = rating;

    window.closeJobAction = async (id) => {
      if (confirm('Mark this job as closed?')) { await closeJob(id); showToast('Job closed.', 'success'); loadClientJobs(); }
    };

    window.deleteJobAction = async (id) => {
      if (confirm('Delete this job permanently?')) { await deleteJob(id); loadClientJobs(); }
    };

    window.viewContacts = async (jobId, jobTitle) => {
      window.currentJobId = jobId;
      const snap = await firestore.getDocs(firestore.collection(db, `jobs/${jobId}/interested`));
      if (snap.size === 0) { showToast("No workers have clicked WhatsApp yet.", 'error'); return; }
      
      const modal = document.createElement('div');
      modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;';
      const content = document.createElement('div');
      content.className = 'card';
      content.style = 'max-width: 450px; width: 100%; max-height: 80vh; overflow-y: auto;';
      content.innerHTML = `<h3 style="margin-bottom: 1rem;">Workers for "${jobTitle}"</h3>`;
      
      for (const doc of snap.docs) {
        const data = doc.data();
        const workerProfile = await getUserProfile(doc.id);
        const rating = workerProfile?.averageRating ? workerProfile.averageRating.toFixed(1) : 'New';
        const stars = workerProfile?.averageRating ? '⭐'.repeat(Math.round(workerProfile.averageRating)) : '';
        const completed = workerProfile?.completedJobs || 0;

        const row = document.createElement('div');
        row.style = 'border-bottom: 1px solid var(--color-border); padding: 1rem 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;';
        row.innerHTML = `
          <div>
            <a href="/pages/worker/public-profile.html?id=${doc.id}" style="font-weight: 600; color: var(--color-primary); text-decoration: underline;">${data.name}</a>
            <div class="text-muted" style="font-size: 0.85rem;">📞 ${data.phone}</div>
            <div style="font-size: 0.85rem; margin-top: 0.25rem;"><span style="font-weight: 600; color: var(--color-primary);">${rating}</span> ${stars} (${completed} jobs)</div>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <textarea id="review-${doc.id}" class="form-input" rows="2" placeholder="Leave a short review (optional)..." style="width: 100%; margin-bottom: 0.5rem; font-size: 0.85rem;"></textarea>
            <select id="rating-${doc.id}" class="form-input" style="padding: 0.25rem; min-height: 32px; width: auto;">
              <option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="markCompleted('${doc.id}', this)">Complete</button>
          </div>`;
        content.appendChild(row);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn btn-outline btn-block';
      closeBtn.style = 'margin-top: 1rem;';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = () => document.body.removeChild(modal);
      content.appendChild(closeBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);
    };

    window.markCompleted = async (workerId, btn) => {
      const ratingSelect = btn.previousElementSibling;
      const rating = parseInt(ratingSelect.value, 10);
      btn.textContent = 'Saving...'; btn.disabled = true;
      await completeJobWithRating(workerId, rating, window.currentJobId, reviewText, auth.currentUser.uid, clientName);
      btn.textContent = 'Completed ✅'; btn.style.background = 'var(--color-success)';
      showToast('Worker marked as completed!', 'success');
    };
  } catch (err) {
    console.error(err);
    card.innerHTML = '<p class="text-error">Failed to load your jobs.</p>';
  }
}
loadClientJobs();

window.shareJob = (id, title, location, pay) => {
  const link = `https://bloreworks.web.app/pages/jobs/detail.html?id=${id}`;
  const text = `*Hiring:* ${title}\n📍 ${location}\n💰 ₹${pay}/day\n\nApply directly on BloreWork:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};
