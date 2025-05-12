// This file contains the code for actively removing YouTube ads
// It will be injected into the webview to directly manipulate the video player

// Content script for YouTube ad blocking
const adBlockerScript = `
// YouTube ad blocker - simplified version that targets only known ad elements
(function() {
  // Configuration
  const DEBUG = false; // Reduce console spam
  
  // Debug logging
  function log(...args) {
    if (DEBUG) console.log('[YTView AdBlocker]', ...args);
  }
  
  // Keep track of whether an ad was detected
  let adDetected = false;
  let adCheckInterval = null;
  
  // Function to detect and skip ads
  function handleAds() {
    const videoElement = document.querySelector('video');
    if (!videoElement) return;
    
    const player = document.getElementById('movie_player');
    if (!player) return;
    
    // Check if an ad is playing using multiple indicators
    const isAdPlaying = player.classList.contains('ad-showing') || 
                        document.querySelector('.ytp-ad-player-overlay') !== null ||
                        document.querySelector('.ytp-ad-text') !== null;
    
    if (isAdPlaying && !adDetected) {
      adDetected = true;
      log('Ad detected');
      
      // Try to click the skip button if available
      const skipButton = document.querySelector('.ytp-ad-skip-button');
      if (skipButton) {
        log('Skip button found - clicking');
        skipButton.click();
      }
      
      // Mute during ads
      if (!videoElement.muted) {
        videoElement.muted = true;
        log('Ad muted');
      }
    } else if (!isAdPlaying && adDetected) {
      // Ad finished playing - restore normal playback
      adDetected = false;
      log('Ad finished');
      
      // Unmute when ad is done
      if (videoElement.muted) {
        videoElement.muted = false;
        log('Video unmuted');
      }
      
      // Reset playback rate
      videoElement.playbackRate = 1;
    }
  }
  
  // Remove ad-related containers
  function removeAdContainers() {
    // Only target the most obvious ad containers that won't affect regular content
    const adSelectors = [
      '.ytp-ad-overlay-container',
      '.ytp-ad-message-container',
      '.ytp-ad-module',
      '.ytd-display-ad-renderer',
      '.ytd-banner-promo-renderer',
      'ytd-promoted-video-renderer',
      'ytd-ad-slot-renderer'
    ];
    
    adSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          try {
            el.style.visibility = 'hidden'; // Hide rather than remove to avoid layout shifts
          } catch (err) {}
        });
      }
    });
  }
  
  // Initialize ad blocking with a more modest approach
  function initAdBlocker() {
    log('Initializing ad blocker');
    
    // Check for ads at a reasonable interval
    if (adCheckInterval) {
      clearInterval(adCheckInterval);
    }
    
    adCheckInterval = setInterval(() => {
      handleAds();
      removeAdContainers();
    }, 1000); // Less frequent checks to reduce performance impact
  }
  
  // Start the ad blocker when the page is ready
  if (document.readyState === 'complete') {
    setTimeout(initAdBlocker, 1500); // Delay to let YouTube fully initialize
  } else {
    window.addEventListener('load', initAdBlocker);
  }
})();
`;

// Export the script for use in the main process
module.exports = { adBlockerScript };
