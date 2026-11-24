import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile, saveUserProfile } from '/js/services/user.service.js';
import { uploadImage } from '/js/services/upload.service.js';
import { showToast } from '/js/components/toast.js';
import { onAuthChange } from '/js/firebase/auth.service.js';

initNavbar();
initBottomNav();

const WORK_CATEGORIES = [
  "Catering Services", "ODC / Outdoor Catering", "Event Management", 
  "Notice / Pamphlet Distribution", "Marketing / Promotion", 
  "Housekeeping", "Hotel Work", "Warehouse", "Retail", 
  "Office Support", "Delivery", "Security", "Manpower", 
  "Construction", "Hospitality", "Sales", "Logistics"
];

const ALL_LOCATIONS = [
  "MG Road", "Brigade Road", "Indiranagar", "Ulsoor", "Shivajinagar", "Commercial Street", "Richmond Town", "Frazer Town", "Koramangala", "Domlur", "Residency Road",
  "Whitefield", "Marathahalli", "Brookefield", "Hoodi", "KR Puram", "Mahadevapura", "Bellandur", "Varthur", "Sarjapur Road", "Kadugodi", "ITPL", "CV Raman Nagar",
  "Hebbal", "Yelahanka", "Jakkur", "Thanisandra", "Hennur", "Nagawara", "RT Nagar", "Sahakara Nagar", "Devanahalli", "Bagalur", "Manyata Tech Park",
  "Jayanagar", "JP Nagar", "BTM Layout", "HSR Layout", "Electronic City", "Banashankari", "Basavanagudi", "Bannerghatta Road", "Bommanahalli", "Arekere", "Hulimavu", "Begur",
  "Rajajinagar", "Vijayanagar", "Basaveshwaranagar", "Malleshwaram", "Yeshwanthpur", "Peenya", "Nagarbhavi", "Kengeri", "RR Nagar", "Magadi Road",
  "Anekal", "Attibele", "Bommasandra", "Jigani", "Chandapura", "Hoskote", "Nelamangala", "Doddaballapur", "Sarjapura", "Kothanur"
];

let selectedFile = null;
let currentUser = null;
let selectedCategories = [];
let selectedLocations = [];

const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');

function renderTags(type) {
  const container = type === 'cats' ? document.getElementById('selected-cats') : document.getElementById('selected-locs');
  const array = type === 'cats' ? selectedCategories : selectedLocations;
  container.innerHTML = '';
  
  array.forEach((item, index) => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `${item} <button type="button">&times;</button>`;
    
    // Using mousedown for the remove button too
    pill.querySelector('button').addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      array.splice(index, 1);
      renderTags(type);
    });
    
    container.appendChild(pill);
  });
}

// --- ULTIMATE MOBILE SEARCH LOGIC ---
function setupSearch(inputId, boxId, dataList, type) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const array = type === 'cats' ? selectedCategories : selectedLocations;

  function showSuggestions(term = '') {
    box.innerHTML = '';
    const lowerTerm = term.toLowerCase().trim();
    let matches = [];

    if (!lowerTerm) {
      matches = dataList.slice(0, 15).filter(item => !array.includes(item));
    } else {
      // Split search terms by space to allow fuzzy search
      const searchWords = lowerTerm.split(/\s+/).filter(w => w.length > 0);
      matches = dataList.filter(item => {
        if (array.includes(item)) return false;
        const itemLower = item.toLowerCase();
        return searchWords.some(word => itemLower.includes(word));
      });
    }

    matches = matches.slice(0, 15);

    if (matches.length === 0) {
      box.classList.remove('active');
      return;
    }

    matches.forEach(match => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = match;
      
      // THIS IS THE FIX: mousedown prevents the keyboard from closing before the tap registers
      div.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        
        array.push(match);
        input.value = '';
        box.classList.remove('active');
        renderTags(type);
        
        // Keep keyboard open for fast multiple adds
        input.focus(); 
      });
      
      box.appendChild(div);
    });
    
    box.classList.add('active');
  }

  input.addEventListener('focus', () => showSuggestions(input.value));
  input.addEventListener('input', (e) => showSuggestions(e.target.value));

  // Close when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (!input.contains(e.target) && !box.contains(e.target)) {
      box.classList.remove('active');
    }
  });
}

setupSearch('search-cats', 'suggest-cats', WORK_CATEGORIES, 'cats');
setupSearch('search-locs', 'suggest-locs', ALL_LOCATIONS, 'locs');

onAuthChange(async (user) => {
  if (!user) return;
  currentUser = user;

  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      document.getElementById('worker-name').value = profile.displayName || '';
      document.getElementById('worker-age').value = profile.age || '';
      document.getElementById('worker-phone').value = profile.phone || '';
      document.getElementById('worker-skills').value = profile.skills || '';
      document.getElementById('worker-exp').value = profile.experience || '';
      if (profile.photoUrl) photoPreview.src = profile.photoUrl;

      if (profile.preferredCategories) {
        selectedCategories = profile.preferredCategories.split(',').map(s => s.trim()).filter(Boolean);
        renderTags('cats');
      }
      if (profile.preferredLocations) {
        selectedLocations = profile.preferredLocations.split(',').map(s => s.trim()).filter(Boolean);
        renderTags('locs');
      }
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Error loading profile", err);
  }
});

if (photoInput) {
  photoInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      selectedFile = e.target.files[0];
      photoPreview.src = URL.createObjectURL(selectedFile);
    }
  });
}

document.getElementById('share-profile-btn')?.addEventListener('click', () => {
  if (!currentUser) return;
  const profileLink = `https://bloreworks.web.app/pages/worker/public-profile.html?id=${currentUser.uid}`;
  const text = `Check out my worker profile on BloreWork! I am available for work. View my skills and ratings here:\n${profileLink}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const btn = document.getElementById('save-btn');
  const originalText = btn.innerText;
  btn.innerText = 'Saving...';
  btn.disabled = true;
  
  try {
    let photoUrl = photoPreview.src;
    if (selectedFile) photoUrl = await uploadImage(selectedFile, 'worker-photos');

    await saveUserProfile(currentUser.uid, {
      displayName: document.getElementById('worker-name').value.trim(),
      age: document.getElementById('worker-age').value,
      phone: document.getElementById('worker-phone').value.trim(),
      skills: document.getElementById('worker-skills').value.trim(),
      preferredCategories: selectedCategories.join(', '),
      preferredLocations: selectedLocations.join(', '),
      experience: document.getElementById('worker-exp').value,
      photoUrl: photoUrl
    });
    
    showToast('Profile saved successfully!', 'success');
    selectedFile = null;
  } catch (err) {
    console.error(err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
});
