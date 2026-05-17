/**
 * Content Script Entry Point
 * Initializes Block Mode for X on x.com / twitter.com pages
 */
import './styles.css';
import { BlockModeController } from './block-mode';

let controller: BlockModeController | null = null;

function init() {
  // Only run on x.com or twitter.com
  const hostname = window.location.hostname;
  if (!hostname.includes('x.com') && !hostname.includes('twitter.com')) {
    return;
  }

  // Prevent double-init
  if (controller) return;

  console.log('[Block Mode for X] Initializing...');
  controller = new BlockModeController();
  console.log('[Block Mode for X] Ready');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle SPA navigation (X uses client-side routing)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Re-inject buttons if in block mode
    // The controller handles this via its MutationObserver
  }
});

urlObserver.observe(document.body, {
  childList: true,
  subtree: true,
});
