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
    const items = [
      { label: 'Home', href: ROUTES.HOME },
      { label: 'Search', href: ROUTES.JOBS },
      role === 'client'
        ? { label: 'Post', href: ROUTES.POST_JOB }
        : { label: 'Saved', href: ROUTES.SAVED_JOBS },
      { label: 'Account', href: ROUTES.HOME },
    ];

    root.append(
      el('div', { class: 'bottom-nav' }, [
        el('div', { class: 'bottom-nav__inner' },
          items.map((it) => el('a', { class: 'bottom-nav__link', href: it.href }, it.label))
        ),
      ])
    );
  }

  render(null);
  await onAuthChange(render);
}
