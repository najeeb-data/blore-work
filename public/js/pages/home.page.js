import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';

(async function boot() {
  try {
    await initNavbar();
    initFooter();
    await initBottomNav();

    // Handle Home Page Search
    const searchForm = document.querySelector('.hero__search');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchForm.querySelector('input').value.trim();
        if (query) {
          window.location.href = `/pages/jobs/index.html?search=${encodeURIComponent(query)}`;
        } else {
          window.location.href = '/pages/jobs/index.html';
        }
      });
    }
  } catch (err) {
    console.error('[home] boot failed', err);
  }
})();
