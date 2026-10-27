// Home page controller. Boots all page-level components.
import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initBottomNav } from '../components/bottom-nav.js';

(async function boot() {
  try {
    await initNavbar();
    initFooter();
    await initBottomNav();
  } catch (err) {
    console.error('[home] boot failed', err);
  }
})();
