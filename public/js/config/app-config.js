// Central app configuration. Never hardcode these values elsewhere.
export const APP_NAME = 'BloreWork';
export const APP_TAGLINE = 'Find Nearby Daily Work. Hire Workers in Minutes.';
export const APP_EYEBROW = 'NEW JOBS ADDED DAILY IN BANGALORE';

// TODO: replace with the real support number before deploy.
export const SUPPORT_WHATSAPP = '+91XXXXXXXXXX';

// Theme is persisted in localStorage under this key and applied via data-theme on <html>.
export const THEME_STORAGE_KEY = 'blorework_theme';

// All internal routes. Firebase Hosting cleanUrls is on, so no .html suffix.
export const ROUTES = {
  HOME: '/',
  JOBS: '/pages/jobs/index',
  JOB_DETAIL: '/pages/jobs/detail',            // ?id=<jobId>
  LOGIN: '/pages/auth/login',
  REGISTER: '/pages/auth/register',
  WORKER_DASHBOARD: '/pages/worker/dashboard',
  SAVED_JOBS: '/pages/worker/saved',
  CLIENT_DASHBOARD: '/pages/client/dashboard',
  POST_JOB: '/pages/client/post-job',
  ADMIN_DASHBOARD: '/pages/admin/dashboard',
  WORKER_SUBSCRIPTION: '/pages/subscription/worker',
  CLIENT_SUBSCRIPTION: '/pages/subscription/client',
  PRIVACY: '/pages/legal/privacy',
  TERMS: '/pages/legal/terms',
};
