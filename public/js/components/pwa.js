// PWA Install Prompt Logic
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Show the install banner after a 3-second delay
  setTimeout(() => {
    if (!localStorage.getItem('pwa_banner_dismissed')) {
      showInstallBanner();
    }
  }, 3000);
});

function showInstallBanner() {
  if (document.getElementById('pwa-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.style = `
    position: fixed; bottom: 80px; left: 16px; right: 16px;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: 16px; padding: 16px; display: flex; align-items: center;
    justify-content: space-between; gap: 12px; z-index: 1000;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1); animation: slideUp 0.3s ease-out;
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="/assets/icons/icon-192.png" style="width: 40px; height: 40px; border-radius: 8px;">
      <div>
        <div style="font-weight: 600; font-size: 14px; color: var(--color-text);">Install BloreWork</div>
        <div style="font-size: 12px; color: var(--color-text-muted);">Add to home screen for quick access</div>
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="pwa-dismiss" class="btn btn-secondary btn-sm" style="padding: 0 12px;">Later</button>
      <button id="pwa-install" class="btn btn-primary btn-sm" style="padding: 0 16px;">Install</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwa-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        banner.remove();
      }
      deferredPrompt = null;
    }
  });

  document.getElementById('pwa-dismiss').addEventListener('click', () => {
    banner.remove();
    // Hide for 3 days
    localStorage.setItem('pwa_banner_dismissed', Date.now());
  });
}

// Add slideUp animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
document.head.appendChild(style);
