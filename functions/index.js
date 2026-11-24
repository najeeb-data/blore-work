const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// This function runs automatically every day at midnight
exports.cleanupExpiredJobs = onSchedule("every day 00:00", async (event) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const jobsRef = db.collection("jobs");
  const snapshot = await jobsRef.get();

  let deletedCount = 0;

  for (const doc of snapshot.docs) {
    const job = doc.data();
    if (job.date) {
      const jobDate = new Date(job.date);
      // If the job date is before today, delete it from the database completely
      if (jobDate < today) {
        await doc.ref.delete();
        deletedCount++;
      }
    }
  }
  console.log(`Auto-cleanup finished. Deleted ${deletedCount} expired jobs.`);
});
