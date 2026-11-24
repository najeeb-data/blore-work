import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const shareBtn = document.getElementById('share-profile-btn');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      alert("Please log in to share your profile.");
      return;
    }

    const profileUrl = `${window.location.origin}/pages/worker/profile.html?id=${user.uid}`;
    const text = `Check out my BloreWork profile: ${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });
});
