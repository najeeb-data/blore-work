import { getFirebase } from '../firebase/firebase.service.js';
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export async function getJobs() {
  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    // Fetch all jobs without complex sorting to avoid index errors
    const snapshot = await firestore.getDocs(firestore.collection(db, 'jobs'));
    
    const today = new Date(); today.setHours(0, 0, 0, 0);

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(job => {
        if (job.status === 'closed') return false;
        if (!job.date) return true;
        return new Date(job.date) >= today;
      })
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return []; // Return empty array instead of hanging
  }
}

export async function getJobById(jobId) {
  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const docSnap = await firestore.getDoc(firestore.doc(db, 'jobs', jobId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    return null;
  }
}

export async function createJob(jobData) {
  const [{ db, auth }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const user = auth.currentUser;
  if (!user) throw new Error("Must be logged in to post a job.");
  const docRef = await firestore.addDoc(firestore.collection(db, 'jobs'), {
    ...jobData,
    status: 'open',
    clientId: user.uid,
    createdAt: firestore.serverTimestamp(),
    views: 0
  });
  return docRef.id;
}

export async function updateJob(jobId, jobData) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  await firestore.updateDoc(firestore.doc(db, 'jobs', jobId), jobData);
}

export async function deleteJob(jobId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  await firestore.deleteDoc(firestore.doc(db, 'jobs', jobId));
}

export async function closeJob(jobId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  await firestore.updateDoc(firestore.doc(db, 'jobs', jobId), { status: 'closed' });
}
