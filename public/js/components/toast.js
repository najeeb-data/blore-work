export function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: type === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
    color: 'white', padding: '12px 24px', borderRadius: '999px',
    boxShadow: 'var(--shadow-lg)', zIndex: '1000', fontWeight: '500',
    fontSize: '0.9rem', textAlign: 'center', transition: 'opacity 0.3s'
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
