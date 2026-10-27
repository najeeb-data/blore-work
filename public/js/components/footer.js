import { el, qs, clearChildren } from '../utils/dom-utils.js';
import { ROUTES } from '../config/app-config.js';
import { CATEGORIES } from '../config/constants.js';

export function initFooter() {
  const root = qs('#footer-root');
  if (!root) return;
  clearChildren(root);

  const workerCol = el('div', {}, [
    el('h4', { class: 'footer__heading' }, 'For Workers'),
    el('ul', { class: 'footer__list' }, [
      el('li', {}, el('a', { class: 'footer__link', href: `${ROUTES.REGISTER}?role=worker` }, 'Find Jobs')),
      el('li', {}, el('a', { class: 'footer__link', href: ROUTES.WORKER_DASHBOARD }, 'Worker Dashboard')),
    ]),
  ]);

  const clientCol = el('div', {}, [
    el('h4', { class: 'footer__heading' }, 'For Clients'),
    el('ul', { class: 'footer__list' }, [
      el('li', {}, el('a', { class: 'footer__link', href: ROUTES.POST_JOB }, 'Post a Job')),
      el('li', {}, el('a', { class: 'footer__link', href: ROUTES.CLIENT_DASHBOARD }, 'Client Dashboard')),
    ]),
  ]);

  const catCol = el('div', {}, [
    el('h4', { class: 'footer__heading' }, 'Categories'),
    el('ul', { class: 'footer__list' },
      CATEGORIES.slice(0, 5).map((c) =>
        el('li', {}, el('a', {
          class: 'footer__link',
          href: `${ROUTES.JOBS}?category=${c.id}`,
        }, c.label))
      )
    ),
  ]);

  const moreCol = el('div', {}, [
    el('h4', { class: 'footer__heading' }, 'More'),
    el('ul', { class: 'footer__list' }, [
      el('li', {}, el('a', { class: 'footer__link', href: ROUTES.PRIVACY }, 'Privacy')),
      el('li', {}, el('a', { class: 'footer__link', href: ROUTES.TERMS }, 'Terms')),
    ]),
  ]);

  root.append(
    el('div', { class: 'footer' }, [
      el('div', { class: 'footer__inner' }, [workerCol, clientCol, catCol, moreCol]),
      el('div', { class: 'footer__bottom' }, [
        el('span', {}, '\u00A9 BloreWork'),
        el('span', {}, 'Made in Bangalore.'),
      ]),
    ])
  );
}
