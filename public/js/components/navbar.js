import { el, qs, clearChildren } from '../utils/dom-utils.js';
import { APP_NAME, ROUTES } from '../config/app-config.js';
import { onAuthChange, signOut } from '../firebase/auth.service.js';
import { getCurrentTheme, toggleTheme } from './theme.js';
import { getUserProfile } from '../services/user.service.js';

export async function initNavbar() {
  const root = qs('#navbar-root');
  if (!root) return;
  let currentUser = null;
  let userRole = 'worker';
  let userProfile = null;

  function themeToggle() {
    return el('button', { class: 'btn btn-secondary btn-sm', style: 'border:none; background:transparent; padding:0; width:36px; display:flex; align-items:center; justify-content:center;', type: 'button', onClick: () => { toggleTheme(); render(); } }, [
      el('i', { 'data-lucide': getCurrentTheme() === 'dark' ? 'sun' : 'moon', style: 'width:20px;' })
    ]);
  }

  function loggedOutActions() {
    return [
      el('a', { class: 'btn btn-secondary btn-sm', href: ROUTES.LOGIN }, 'Log in'),
      el('a', { class: 'btn btn-primary btn-sm', href: ROUTES.REGISTER }, 'Get Started'),
    ];
  }

  function loggedInActions(user) {
    let dashRoute = '/pages/worker/dashboard.html';
    if (userRole === 'client') dashRoute = '/pages/client/dashboard.html';
    if (userRole === 'admin') dashRoute = '/pages/admin/dashboard.html';
    
    let avatarElement;
    if (userProfile && (userProfile.photoUrl || userProfile.logoUrl)) {
      avatarElement = el('img', { src: userProfile.photoUrl || userProfile.logoUrl, style: 'width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--color-border);' });
    } else {
      const initial = (user.displayName || user.email || user.phoneNumber || '?').trim()[0].toUpperCase();
      avatarElement = el('span', { style: 'display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; font-size: 14px;' }, initial);
    }

    return [
      themeToggle(),
      el('a', { href: dashRoute, title: 'Go to Dashboard', style: 'text-decoration: none;' }, avatarElement),
      el('button', { class: 'btn btn-secondary btn-sm', style: 'padding:0; width:36px; height:36px; border:none; background:transparent; display:flex; align-items:center; justify-content:center; color: var(--color-text-muted);', type: 'button', onClick: async () => { await signOut(); } }, [ 
        el('i', { 'data-lucide': 'log-out', style: 'width:20px;' }) 
      ])
    ];
  }

  function render() {
    clearChildren(root);
    const actions = currentUser ? loggedInActions(currentUser) : [themeToggle(), ...loggedOutActions()];

    root.append(
      el('div', { class: 'navbar' }, [
        el('div', { class: 'navbar__inner' }, [
          el('a', { class: 'navbar__logo', href: ROUTES.HOME }, [
            el('img', { src: '/assets/logo.png', alt: 'BloreWork Logo', class: 'navbar__logo-img' }),
            el('span', { class: 'navbar__logo-text' }, APP_NAME)
          ]),
          el('nav', { class: 'navbar__links' }, [
            el('a', { class: 'navbar__link', href: '/pages/jobs/index.html' }, 'Find Jobs'),
          ]),
          el('div', { class: 'navbar__actions' }, actions),
        ]),
      ])
    );
    if (window.lucide) window.lucide.createIcons();
  }

  render();
  await onAuthChange(async (user) => { 
    currentUser = user; 
    if (user) {
      try {
        userProfile = await getUserProfile(user.uid);
        if (userProfile && userProfile.role) userRole = userProfile.role;
      } catch (err) {}
    } else {
      userProfile = null;
    }
    render(); 
  });
}
