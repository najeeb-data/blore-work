// Dark-mode controller. Storage key and DOM attribute come from app-config.

import { THEME_STORAGE_KEY } from '../config/app-config.js';

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
}

export function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
