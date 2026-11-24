import { initNavbar } from '/js/components/navbar.js';
import { initBottomNav } from '/js/components/bottom-nav.js';
import { getFirebase } from '/js/firebase/firebase.service.js';
import { getUserProfile, saveUserProfile } from '/js/services/user.service.js';
import { uploadImage } from '/js/services/upload.service.js';
import { showToast } from '/js/components/toast.js';
import { onAuthChange } from '/js/firebase/auth.service.js';
const SEK = 'https://www.gstatic.com/firebasejs/10.13.0';

import { BANGALORE_LOCATIONS } from '/js/config/data.js';

initNavbar$();
initBottomNav();

let selectedFile = null;
let currentUser = null;

const logoInput = document.getElementById('logo-input');
const logoPreview = document.getElementById('logo-preview');
const locSelect = document.getElementById('biz-location');

// Populate Locations
for (const [region, areas] of Object.entries(BANGALORE_LOCATIONS)) {
  const optGroup = document.createElement('optgroup');
  optGroup.label = region;
  areas.forEach(area => optGroup.innerHTML += `<option value="${area}">${area}</option>`);
  locSelect.appendChild(optGroup);
}

onAuthChange(async (user) => {
  if (!user) return;
  currentUser = user;

  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      document.getElementById('biz-name').value = profile.businessName || '';
      document.getElementById('biz-address').value = profile.address || '';
      document.getElementById('biz-phone').value = profile.phone || '';
      if (profile.logoUrl) logoPreview.src = profile.logoUrl;

      if (profile.businessLocations) {
        const savedLocs = profile.businessLocations.split(',').map(s => s.trim());
        Array.from(locSelect.options).forEach(opt => {
          if (savedLocs.includes(opt.value)) opt.selected = true;
        });
      } else if (profile.locationArea) {
        // Migrate old data
        Array.from(locSelect.options).forEach(opt => {
          if (opt.value === profile.locationArea) opt.selected = true;
        });
      }
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Error loading profile", err);
  }
});

if (logoInput) {
  logoInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      selectedFile = e.target.files[0];
      logoPreview.src = URL.createObjectURL(selectedFile);
    }
  });
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const btn = document.getElementById('save-btn');
  const originalText = btn.innerText;
  btn.innerText = 'Saving...';
  btn.disabled = true;
  
  try {
    let logoUrl = logoPreview.src;
    if (selectedFile) {
      logoUrl = await uploadImage(selectedFile, 'client-logos');
    }

    const selectedLocs = Array.from(locSelect.selectedOptions).map(opt => opt.value).join(', ');

    await saveUserProfile(currentUser.uid, {
      businessName: document.getElementById('biz-name').value.trim(),
      businessLocations: selectedLocs,
      address: document.getElementById('biz-address').value.trim(),
      phone: document.getElementById('biz-phone').value.trim(),
      logoUrl: logoUrl
    });
    
    showToast('Business profile saved successfully!', 'success');
    selectedFile = null;
  } catch (err) {
    console.error(err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
});