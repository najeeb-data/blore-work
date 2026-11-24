import { el, qs, clearChildren } from '../utils/dom-utils.js';
import { ROUTES } from '../config/app-config.js';
import { onAuthChange, getCurrentUserRole } from '../firebase/auth.service.js';

export async function initBottomNav() {
  const root = qs('#bottom-nav-root');
  if (!root) return;

  async function render(user) {
    clearChildren(root);
    document.body.classList.toggle('has-bottom-nav', !!user);
    if (!user) return;

    const role = await getCurrentUserRole();
    const currentPath = window.location.pathname;

    let dashRoute = '/pages/worker/dashboard.html';
    if (role === 'client') dashRoute = '/pages/client/dashboard.html';
    if (role === 'admin') dashRoute = ROUTES.ADMIN_DASHBOARD;

    let profileRoute = '/pages/worker/profile.html';
    if (role === 'client') profileRoute = '/pages/client/profile.html';

    const items = [
      { label: 'Home', icon: 'home', href: ROUTES.HOME, match: '/' },
      { label: 'Search', icon: 'search', href: ROUTES.JOBS, match: '/pages/jobs/index.html' },
      role === 'client'
        ? { label: 'Post', icon: 'plus-circle', href: ROUTES.POST_JOB, match: '/pages/client/post-job.html' }
        : { label: 'Saved', icon: 'bookmark', href: '/pages/worker/saved.html', match: '/pages/worker/saved.html' },
      { label: 'Account', icon: 'user', href: profileRoute, match: profileRoute },
    ];

    root.append(
      el('div', { class: 'bottom-nav' }, [
        el('div', { class: 'bottom-nav__inner' },
          items.map((it) => {
            const isActive = currentPath === it.match || (it.match === '/' && currentPath === '/index.html');
            return el('a', { class: `bottom-nav__link ${isActive ? 'active' : ''}`, href: it.href }, [
              el('i', { 'data-lucide': it.icon, style: 'width: 20px; height: 20px;' }),
              el('span', {}, it.label)
            ]);
          })
        ),
      ])
    );
    if (window.lucide) window.lucide.createIcons();
  }

  render(null);
  await onAuthChange(render);
}
