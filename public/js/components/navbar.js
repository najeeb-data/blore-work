import { el, qs, clearChildren } from '../utils/dom-utils.js';
import { APP_NAME, ROUTES } from '../config/app-config.js';
import { onAuthChange, signOut } from '../firebase/auth.service.js';
import { getCurrentTheme, toggleTheme } from './theme.js';

export async function initNavbar() {
  const root = qs('#navbar-root');
  if (!root) return;

  let currentUser = null;

  function themeToggle() {
    return el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      'aria-label': 'Toggle dark mode',
      title: 'Toggle dark mode',
      onClick: () => { toggleTheme(); render(); },
    }, getCurrentTheme() === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19');
  }

  function loggedOutActions() {
    return [
      el('a', { class: 'btn btn-ghost btn-sm', href: ROUTES.LOGIN }, 'Log in'),
      el('a', { class: 'btn btn-primary btn-sm', href: ROUTES.REGISTER }, 'Get Started'),
    ];
  }

  function loggedInActions(user) {
    const initial = (user.displayName || user.email || user.phoneNumber || '?').trim()[0].toUpperCase();
    return [
      el('a', { class: 'btn btn-ghost btn-sm', href: ROUTES.HOME }, 'Dashboard'),
      el('span', {
        'aria-hidden': 'true',
        style: {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'var(--color-primary)', color: '#fff',
          fontWeight: '600', fontSize: '0.85rem',
        },
      }, initial),
      el('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        onClick: async () => { await signOut(); },
      }, 'Sign out'),
    ];
  }

  function render() {
    clearChildren(root);
    const actions = [
      themeToggle(),
      ...(currentUser ? loggedInActions(currentUser) : loggedOutActions()),
    ];
    root.append(
      el('div', { class: 'navbar' }, [
        el('div', { class: 'navbar__inner' }, [
          el('a', { class: 'navbar__logo', href: ROUTES.HOME }, APP_NAME),
          el('nav', { class: 'navbar__links' }, [
            el('a', { class: 'navbar__link', href: ROUTES.JOBS }, 'Find Jobs'),
            el('a', { class: 'navbar__link', href: `${ROUTES.REGISTER}?role=worker` }, 'For Workers'),
            el('a', { class: 'navbar__link', href: `${ROUTES.REGISTER}?role=client` }, 'For Clients'),
          ]),
          el('div', { class: 'navbar__actions' }, actions),
        ]),
      ])
    );
  }

  render();
  await onAuthChange((user) => { currentUser = user; render(); });
}
