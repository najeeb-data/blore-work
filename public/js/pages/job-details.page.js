import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile, toggleSavedJob, markJobAsApplied, addRecentlyViewed } from '/js/services/user.service.js';
import { IS_FREE_MODE } from '/js/config/app-config.js';
import { showToast } from '/js/components/toast.js';
import { sendNotification } from '/js/services/notification.service.js';

initNavbar();
initBottomNav();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

async function loadJob() {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('id');
  const container = document.getElementById('job-content');

  if (!jobId) { container.innerHTML = '<h2>Job not found</h2>'; return; }

  try {
    const [{ db, auth }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const docRef = firestore.doc(db, 'jobs', jobId);
    
    firestore.updateDoc(docRef, { views: firestore.increment(1) }).catch(e => {});
    if (auth.currentUser) addRecentlyViewed(auth.currentUser.uid, jobId).catch(e => {});

    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) { container.innerHTML = '<h2>Job not found</h2>'; return; }
    const job = { id: docSnap.id, ...docSnap.data() };
    
    let timingHtml = 'Flexible Timing';
    if (job.date) {
      const dateObj = new Date(job.date);
      const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = (job.time && job.time !== 'Flexible') ? ` • ${job.time}` : '';
      timingHtml = `${dateStr}${timeStr}`;
    }

    let isExpired = false;
    if (job.date) {
      const today = new Date(); today.setHours(0,0,0,0);
      if (new Date(job.date) < today) isExpired = true;
    }

    let clientProfile = null;
    let clientPhone = '919605142422';
    if (job.clientId) {
      clientProfile = await getUserProfile(job.clientId);
      if (clientProfile && clientProfile.phone) clientPhone = clientProfile.phone.replace(/\D/g, '');
    }

    let userProfile = null;
    let isSubscribed = false;
    if (auth.currentUser) {
      userProfile = await getUserProfile(auth.currentUser.uid);
      isSubscribed = IS_FREE_MODE || userProfile?.subscriptionExpires > Date.now();
    }

    const isSaved = userProfile?.savedJobs?.includes(jobId) || false;
    const clientName = clientProfile?.businessName || 'Client';
    const clientInitial = clientName.charAt(0).toUpperCase();
    const clientRating = clientProfile?.averageRating ? `⭐ ${clientProfile.averageRating.toFixed(1)} (${clientProfile.totalReviews} reviews)` : '⭐ New Client';
    
    let badgesHtml = '';
    if (job.isFeatured) badgesHtml += '<span class="badge-featured">⭐ Featured</span>';
    if (job.isUrgent) badgesHtml += '<span class="badge-urgent" style="margin-left:4px;">Urgent</span>';

    let reqHtml = '';
    if (job.gender && job.gender !== 'Any') reqHtml += `<span><i data-lucide="user" class="icon"></i>Gender: ${job.gender}</span>`;
    if (job.dressCode) reqHtml += `<span><i data-lucide="shirt" class="icon"></i>Dress Code: ${job.dressCode}</span>`;
    if (job.foodProvided) reqHtml += `<span><i data-lucide="utensils" class="icon"></i>Food Provided</span>`;
    if (job.transportProvided) reqHtml += `<span><i data-lucide="bus" class="icon"></i>Transport Provided</span>`;

    container.innerHTML = `
      <a href="/pages/jobs/index.html" class="back-link">
        <i data-lucide="arrow-left"></i> Back to Jobs
      </a>

      ${isExpired ? `<div class="expired-warning"><i data-lucide="alert-circle" class="icon"></i> This job has expired.</div>` : ''}

      <div class="card main-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="title">${job.title}</h1>
            <div class="category"><i data-lucide="briefcase" style="width:14px; height:14px;"></i> ${job.category}</div>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">${badgesHtml}</div>
        </div>
        
        <div class="salary">₹${job.pay}/day</div>
        
        <div class="meta-tags">
          <span><i data-lucide="clock" class="icon"></i>${timingHtml}</span>
          <span><i data-lucide="users" class="icon"></i>${job.workersNeeded || 1} Workers Needed</span>
          <span><i data-lucide="map-pin" class="icon"></i>${job.location}</span>
        </div>
      </div>

      <div class="card section-card">
        <h2>Job Description</h2>
        <p>${job.description}</p>
      </div>

      ${reqHtml ? `
        <div class="card section-card">
          <h2>Requirements</h2>
          <div class="req-list">${reqHtml}</div>
        </div>
      ` : ''}

      ${clientProfile ? `
        <div class="card section-card">
          <h2>About the Client</h2>
          <a href="/pages/client/public-profile.html?id=${job.clientId}" class="client-box">
            <div class="client-avatar">${clientInitial}</div>
            <div>
              <div class="client-name">${clientName} ${clientProfile.isVerified ? '<i data-lucide="check-circle" style="width:16px; height:16px; color:#263FE5;"></i>' : ''}</div>
              <div class="client-rating">${clientRating}</div>
            </div>
          </a>
        </div>
      ` : ''}

      <div class="action-grid">
        ${!isExpired ? `
          ${isSubscribed || job.clientId === auth.currentUser?.uid ? `
            <button id="whatsappBtn" class="btn btn-whatsapp">
              <i data-lucide="message-circle"></i> Chat on WhatsApp
            </button>
          ` : `
            <a href="/pages/subscription/index.html" class="btn btn-outline" style="grid-column: 1 / -1; border-color: var(--color-warning); color: var(--color-warning);">
              <i data-lucide="lock"></i> Subscribe to Reveal Contact
            </a>
          `}
        ` : ''}

        <button id="saveBtn" class="btn btn-secondary btn-save">
          <i data-lucide="bookmark"></i> ${isSaved ? 'Saved' : 'Save'}
        </button>
        
        <button id="shareBtn" class="btn btn-secondary btn-share">
          <i data-lucide="share-2"></i> Share
        </button>
      </div>

      ${auth.currentUser ? `
        <button id="reportBtn" class="btn" style="background:none; color:var(--color-error); width:100%; margin-top:16px; font-size:13px;">
          <i data-lucide="flag" style="width:14px; height:14px;"></i> Report this job
        </button>
      ` : ''}
    `;

    if (window.lucide) window.lucide.createIcons();

    // --- UPDATED WHATSAPP BUTTON LOGIC ---
    document.getElementById('whatsappBtn')?.addEventListener('click', async () => {
      if (auth.currentUser) {
        try {
          await firestore.setDoc(firestore.doc(db, `jobs/${jobId}/interested/${auth.currentUser.uid}`), {
            name: userProfile?.displayName || 'Worker',
            phone: userProfile?.phone || auth.currentUser.phoneNumber || 'No phone',
            timestamp: firestore.serverTimestamp()
          });
          await markJobAsApplied(auth.currentUser.uid, jobId);
          if (job.clientId) {
            await sendNotification(job.clientId, 'New Applicant!', `${userProfile?.displayName || 'A worker'} is interested in your job: ${job.title}`, '/pages/client/dashboard.html');
          }
        } catch (e) { console.error(e); }
      }
      
      // Create the message with the Worker's Profile Link
      const workerName = userProfile?.displayName || 'A Worker';
      const profileLink = `https://bloreworks.web.app/pages/worker/public-profile.html?id=${auth.currentUser.uid}`;
      const message = `Hi, I am ${workerName}. I am interested in your job: *${job.title}* in ${job.location}.\n\nView my profile and ratings here:\n${profileLink}`;
      
      window.open(`https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`, '_blank');
    });

    document.getElementById('shareBtn')?.addEventListener('click', () => {
      const shareText = `Check out this job on BloreWork: ${job.title} in ${job.location} paying ₹${job.pay}/day. Apply here: ${window.location.href}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    });

    document.getElementById('saveBtn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const currentlySaved = btn.innerText.includes('Saved');
      await toggleSavedJob(auth.currentUser.uid, jobId, !currentlySaved);
      btn.innerHTML = `<i data-lucide="bookmark"></i> ${currentlySaved ? 'Save' : 'Saved'}`;
      if (window.lucide) window.lucide.createIcons();
      btn.disabled = false;
    });

    document.getElementById('reportBtn')?.addEventListener('click', async () => {
      const reason = prompt('Why are you reporting this job?');
      if (reason) {
        try {
          await firestore.addDoc(firestore.collection(db, 'reports'), {
            jobId, jobTitle: job.title, reportedBy: auth.currentUser.uid, reason, createdAt: firestore.serverTimestamp()
          });
          showToast('Report submitted. Thank you!', 'success');
        } catch (e) { showToast('Failed to submit report.', 'error'); }
      }
    });

  } catch (err) {
    console.error(err); 
    container.innerHTML = '<h2>Error loading job details</h2>';
  }
}
loadJob();
