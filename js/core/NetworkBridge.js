/**
 * NetworkBridge — network/mobile architecture placeholder
 * 
 * Target Architecture:
 *   NetworkBridge → PerformanceStore → Renderers
 * 
 * Current State:
 *   Akordyar runs as Electron app with local HTTP server.
 *   No network or mobile support yet.
 * 
 * Planned Capabilities:
 *   1. PWA manifest + service worker (offline support)
 *   2. Capacitor/Cordova wrapper for mobile
 *   3. WebRTC / WebSocket for real-time collaboration
 *   4. Cloud sync via REST API
 *   5. Responsive layout for tablet/phone
 * 
 * Integration Points:
 *   - manifest.json → PWA installability
 *   - service-worker.js → offline caching
 *   - responsive CSS breakpoints → mobile layout
 *   - NetworkBridge → sync state via PerformanceStore events
 * 
 * Do NOT import or load this file yet.
 * Implement when network/mobile features are needed.
 */

const NetworkBridge = (() => {

  /**
   * Check if running as installed PWA.
   */
  function isPWA() {
    return !!(typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches);
  }

  /**
   * Check if running on a mobile device.
   */
  function isMobile() {
    return !!(typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent));
  }

  /**
   * Get platform info for adaptive rendering.
   */
  function getPlatformInfo() {
    return {
      isElectron: !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron),
      isPWA: isPWA(),
      isMobile: isMobile(),
      touchEnabled: !!(typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    };
  }

  return {
    isPWA: isPWA,
    isMobile: isMobile,
    getPlatformInfo: getPlatformInfo
  };

})();

if (typeof window !== 'undefined') {
  window.NetworkBridge = NetworkBridge;
}
