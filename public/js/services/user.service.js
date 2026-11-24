import { getFirebase } from '../firebase/firebase.service.js';
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export async function getUserProfile(uid) {
  try {
    const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
    const docRef = firestore.doc(db, 'users', uid);
    const docSnap = await firestore.getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (err) {
    console.error("Error loading profile:", err);
    return null;
  }
}

export async function saveUserProfile(uid, data) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', uid);
  await firestore.setDoc(docRef, data, { merge: true });
}

export async function toggleSavedJob(uid, jobId, isSaving) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', uid);
  await firestore.updateDoc(docRef, {
    savedJobs: isSaving ? firestore.arrayUnion(jobId) : firestore.arrayRemove(jobId)
  });
}

export async function markJobAsApplied(uid, jobId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', uid);
  await firestore.updateDoc(docRef, { appliedJobs: firestore.arrayUnion(jobId) });
}

export async function addRecentlyViewed(uid, jobId) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', uid);
  const docSnap = await firestore.getDoc(docRef);
  if (!docSnap.exists()) return;
  let viewed = docSnap.data().recentlyViewed || [];
  viewed = viewed.filter(id => id !== jobId);
  viewed.unshift(jobId); 
  if (viewed.length > 5) viewed = viewed.slice(0, 5);
  await firestore.updateDoc(docRef, { recentlyViewed: viewed });
}

export async function completeJobWithRating(workerId, rating, jobId, reviewText, clientId, clientName) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', workerId);
  const docSnap = await firestore.getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const profile = docSnap.data();
  const currentRating = profile.averageRating || 0;
  const totalReviews = profile.totalReviews || 0;
  const newTotalReviews = totalReviews + 1;
  const newAverageRating = ((currentRating * totalReviews) + rating) / newTotalReviews;
  
  let completedHistory = profile.completedJobsHistory || [];
  if (jobId && !completedHistory.includes(jobId)) completedHistory.push(jobId);
  
  await firestore.updateDoc(docRef, {
    completedJobs: firestore.increment(1),
    averageRating: newAverageRating,
    totalReviews: newTotalReviews,
    completedJobsHistory: completedHistory
  });

  if (reviewText && reviewText.trim() !== '') {
    await firestore.addDoc(firestore.collection(db, 'reviews'), {
      workerId, clientId, clientName: clientName || 'A Client', rating, text: reviewText, jobId,
      createdAt: firestore.serverTimestamp()
    });
  }
}

export async function rateClient(clientId, rating) {
  const [{ db }, firestore] = await Promise.all([getFirebase(), import(`${SDK}/firebase-firestore.js`)]);
  const docRef = firestore.doc(db, 'users', clientId);
  const docSnap = await firestore.getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const profile = docSnap.data();
  const currentRating = profile.averageRating || 0;
  const totalReviews = profile.totalReviews || 0;
  const newTotalReviews = totalReviews + 1;
  const newAverageRating = ((currentRating * totalReviews) + rating) / newTotalReviews;
  
  await firestore.updateDoc(docRef, { averageRating: newAverageRating, totalReviews: newTotalReviews });
}
