import { initNavbar } from '/js/components/navbar.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { deleteJob } from '/js/services/job.service.js';
import { showToast } from '/js/components/toast.js';

initNavbar();
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

async function loadAdminData() {
  const { db, auth } = await getFirebase();
  const firestore = await import(`${SDK}/firebase-firestore.js`);

  // --- 1. LOAD ANALYTICS STATS ---
  try {
    // Users Count
    const usersCountSnap = await firestore.getCountFromServer(firestore.collection(db, 'users'));
    document.getElementById('stat-total-users').textContent = usersCountSnap.data().count;

    // Jobs Count
    const jobsCountSnap = await firestore.getCountFromServer(firestore.collection(db, 'jobs'));
    document.getElementById('stat-total-jobs').textContent = jobsCountSnap.data().count;

    // Reviews (Completed Jobs) Count
    const reviewsCountSnap = await firestore.getCountFromServer(firestore.collection(db, 'reviews'));
    document.getElementById('stat-completed-jobs').textContent = reviewsCountSnap.data().count;

    // Reports Count
    const reportsCountSnap = await firestore.getCountFromServer(firestore.collection(db, 'reports'));
    document.getElementById('stat-reports').textContent = reportsCountSnap.data().count;
  } catch (err) {
    console.error("Stats error:", err);
  }

  // --- 2. LOAD REPORTS ---
  try {
    const reportsSnap = await firestore.getDocs(firestore.collection(db, 'reports'));
    const reportsList = document.getElementById('admin-reports-list');
    
    if (reportsSnap.empty) {
      reportsList.innerHTML = '<p class="text-muted">No reported jobs. Good job!</p>';
    } else {
      let html = `<table class="admin-table"><thead><tr>
        <th>Job Title</th><th>Reason</th><th>Actions</th>
      </tr></thead><tbody>`;
      
      reportsSnap.forEach(doc => {
        const report = doc.data();
        html += `<tr>
          <td>${report.jobTitle || 'Unknown'}</td>
          <td>${report.reason}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="window.location.href='/pages/jobs/detail.html?id=${report.jobId}'">View</button>
            <button class="btn btn-primary btn-sm" onclick="deleteReportedJob('${report.jobId}', '${doc.id}')">Delete Job</button>
            <button class="btn btn-ghost btn-sm" onclick="dismissReport('${doc.id}')">Dismiss</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table>`;
      reportsList.innerHTML = html;
    }
  } catch (err) {
    document.getElementById('admin-reports-list').innerHTML = '<p class="text-error">Failed to load reports.</p>';
  }

  // --- 3. LOAD JOBS ---
  try {
    const jobsSnap = await firestore.getDocs(firestore.collection(db, 'jobs'));
    const jobsList = document.getElementById('admin-jobs-list');
    
    if (jobsSnap.empty) {
      jobsList.innerHTML = '<p class="text-muted">No jobs found.</p>';
    } else {
      let html = `<table class="admin-table"><thead><tr>
        <th>Title</th><th>Category</th><th>Pay</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>`;
      
      jobsSnap.forEach(doc => {
        const job = doc.data();
        const isFeatured = job.isFeatured ? '<span style="color: #F59E0B; font-weight: bold;">⭐ Featured</span>' : 'Standard';
        
        html += `<tr>
          <td>${job.title}</td>
          <td>${job.category}</td>
          <td>₹${job.pay}</td>
          <td>${isFeatured}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="toggleFeatured('${doc.id}', ${!!job.isFeatured})">${job.isFeatured ? 'Unfeature' : 'Feature'}</button>
            <button class="btn btn-ghost btn-sm text-error" onclick="adminDeleteJob('${doc.id}')">Delete</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table>`;
      jobsList.innerHTML = html;
    }
  } catch (err) {}

  // --- 4. LOAD USERS ---
  try {
    const usersSnap = await firestore.getDocs(firestore.collection(db, 'users'));
    const usersList = document.getElementById('admin-users-list');
    
    if (usersSnap.empty) {
      usersList.innerHTML = '<p class="text-muted">No users found.</p>';
    } else {
      let html = `<table class="admin-table"><thead><tr>
        <th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Action</th>
      </tr></thead><tbody>`;
      
      usersSnap.forEach(doc => {
        const user = doc.data();
        const isSelf = doc.id === auth.currentUser?.uid;
        
        let roleHtml = `<select class="role-select" onchange="changeRole('${doc.id}', this.value)" ${isSelf ? 'disabled' : ''}>
          <option value="worker" ${user.role === 'worker' ? 'selected' : ''}>Worker</option>
          <option value="client" ${user.role === 'client' ? 'selected' : ''}>Client</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>`;

        let verifyBtn = '';
        if (user.role === 'client') {
          verifyBtn = `<button class="btn ${user.isVerified ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="toggleVerified('${doc.id}', ${!!user.isVerified})">${user.isVerified ? 'Unverify' : 'Verify'}</button>`;
        }
        
        const verifiedBadge = user.isVerified ? '<span style="color: #0018E8; font-weight: bold;">🔵 Verified</span>' : '-';

        html += `<tr>
          <td>${user.businessName || user.displayName || 'N/A'} ${isSelf ? '(You)' : ''}</td>
          <td>${user.phone || 'N/A'}</td>
          <td>${roleHtml}</td>
          <td>${user.role === 'client' ? verifiedBadge : '-'}</td>
          <td>
            ${verifyBtn}
            <button class="btn btn-ghost btn-sm text-error" onclick="adminDeleteUser('${doc.id}')">Delete</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table>`;
      usersList.innerHTML = html;
    }
  } catch (err) {}

  // --- ACTION FUNCTIONS ---
  window.adminDeleteJob = async (id) => { if (confirm('Delete this job?')) { await deleteJob(id); loadAdminData(); } };
  window.toggleFeatured = async (id, current) => { await firestore.updateDoc(firestore.doc(db, 'jobs', id), { isFeatured: !current }); loadAdminData(); };
  window.changeRole = async (id, role) => { await firestore.updateDoc(firestore.doc(db, 'users', id), { role }); showToast('Role updated', 'success'); };
  window.toggleVerified = async (id, current) => { await firestore.updateDoc(firestore.doc(db, 'users', id), { isVerified: !current }); loadAdminData(); };
  window.adminDeleteUser = async (id) => { if (confirm('Delete user?')) { await firestore.deleteDoc(firestore.doc(db, 'users', id)); loadAdminData(); } };
  window.deleteReportedJob = async (jobId, reportId) => {
    if (confirm('Delete job and report?')) { await deleteJob(jobId); await firestore.deleteDoc(firestore.doc(db, 'reports', reportId)); loadAdminData(); }
  };
  window.dismissReport = async (reportId) => { await firestore.deleteDoc(firestore.doc(db, 'reports', reportId)); loadAdminData(); };
}
loadAdminData();
