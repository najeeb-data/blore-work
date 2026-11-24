import { getFirebase } from '../firebase/firebase.service.js';
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export async function sendNotification(recipientId, title, message, link) {
  if (!recipientId) return;
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  await firestore.addDoc(firestore.collection(db, 'notifications'), {
    recipientId,
    title,
    message,
    link,
    read: false,
    createdAt: firestore.serverTimestamp()
  });
}

export async function getNotifications(userId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const q = firestore.query(
    firestore.collection(db, 'notifications'),
    firestore.where('recipientId', '==', userId),
    firestore.orderBy('createdAt', 'desc'),
    firestore.limit(10)
  );
  const snapshot = await firestore.getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function markAllAsRead(userId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const q = firestore.query(
    firestore.collection(db, 'notifications'),
    firestore.where('recipientId', '==', userId),
    firestore.where('read', '==', false)
  );
  const snapshot = await firestore.getDocs(q);
  
  const batch = firestore.writeBatch(db);
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });
  await batch.commit();
}

// NEW: Notify Workers when a matching job is posted
export async function notifyWorkersOfNewJob(job) {
  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    
    // Get all workers
    const q = firestore.query(firestore.collection(db, 'users'), firestore.where('role', '==', 'worker'));
    const workersSnap = await firestore.getDocs(q);
    
    const jobLoc = (job.location || '').toLowerCase();
    const jobCat = (job.category || '').toLowerCase();
    
    let notifiedCount = 0;
    
    workersSnap.forEach(workerDoc => {
      const worker = workerDoc.data();
      
      // Check if worker has preferences set
      const prefLocs = worker.preferredLocations ? worker.preferredLocations.toLowerCase() : '';
      const prefCats = worker.preferredCategories ? worker.preferredCategories.toLowerCase() : '';
      
      // Match if the job location is in their preferred locations OR job category is in their preferred categories
      const matchesLocation = prefLocs.includes(jobLoc);
      const matchesCategory = prefCats.includes(jobCat);
      
      if (matchesLocation || matchesCategory) {
        // Send notification
        sendNotification(
          workerDoc.id, 
          'New Job Match! 🎯', 
          `A new job for "${job.title}" was posted in ${job.location}. Check it out!`, 
          `/pages/jobs/detail.html?id=${job.id}`
        );
        notifiedCount++;
      }
    });
    
    console.log(`Sent notifications to ${notifiedCount} matched workers.`);
  } catch (err) {
    console.error("Failed to notify workers:", err);
  }
}
