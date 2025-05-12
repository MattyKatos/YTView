// Ad Blocker Module for YTView
// Handles ad detection and blocking functionality

/**
 * Initialize the ad blocker module
 * @param {Object} settings - The application settings
 * @returns {Object} - Module interface
 */
function initAdBlocker(settings) {
  // Internal state
  let isEnabled = settings?.adBlockingEnabled === true;
  let adCheckInterval = null;
  let adBannerShowing = false;
  
  /**
   * Set up ad blocking on a YouTube page
   */
  function setupAdBlocking() {
    // Immediately return if ad blocking is disabled
    if (!isEnabled) {
      return;
    }

    console.log('Setting up ad blocking');
    
    // Set interval to check for ads
    if (adCheckInterval) {
      clearInterval(adCheckInterval);
    }
    
    adCheckInterval = setInterval(() => {
      if (isEnabled) {
        handleAdElements();
      }
    }, 500);
    
    // Add direct video event listener as another detection method
    const videoListener = () => {
      if (isEnabled) {
        handleAdElements();
      }
    };
    
    // Check for ads when the video player creates new elements or changes state
    document.addEventListener('timeupdate', videoListener, true);
    document.addEventListener('play', videoListener, true);
    document.addEventListener('playing', videoListener, true);
  }

  /**
   * Handle advertisement elements
   */
  function handleAdElements() {
    // Immediately return if ad blocking is disabled
    if (!isEnabled) {
      return;
    }
    
    const video = document.querySelector('video');
    if (!video) return;
    
    const player = document.getElementById('movie_player');
    if (!player) return;
    
    // Check for ad indicators - using multiple detection methods for reliability
    const isAdShowing = (
      player.classList.contains('ad-showing') || 
      document.querySelector('.ytp-ad-player-overlay') !== null || 
      document.querySelector('.ytp-ad-text') !== null
    );
    
    if (isAdShowing) {
      // We have detected an ad
      console.log('Ad detected');
      
      // Skip the ad if possible by clicking skip button
      const skipButton = document.querySelector('.ytp-ad-skip-button');
      if (skipButton) {
        skipButton.click();
        console.log('Clicked skip button');
      } else {
        // If no skip button, try to move to the end of the ad
        try {
          // Check if it's a non-skippable ad
          const remainingElement = document.querySelector('.ytp-ad-text');
          if (remainingElement && video.duration) {
            // Go to the end of the ad
            video.currentTime = video.duration - 0.1;
            video.play();
            console.log('Moved to end of non-skippable ad');
          }
        } catch (e) {
          console.error('Error skipping ad:', e);
        }
      }
      
      // Show ad banner if not already showing
      if (!adBannerShowing) {
        // Create and insert ad detection banner
        const adBanner = document.createElement('div');
        adBanner.id = 'ytview-ad-banner';
        adBanner.style = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background-color: rgba(255, 0, 0, 0.7);
          color: white;
          padding: 5px;
          text-align: center;
          z-index: 9999;
          font-weight: bold;
        `;
        adBanner.innerText = 'YTView - Ad Detected - Attempting to Skip';
        
        // Insert into player
        const playerContainer = document.querySelector('.html5-video-container');
        if (playerContainer) {
          playerContainer.appendChild(adBanner);
          adBannerShowing = true;
          
          // Auto-remove banner after 3 seconds
          setTimeout(() => {
            const banner = document.getElementById('ytview-ad-banner');
            if (banner) {
              banner.remove();
            }
            adBannerShowing = false;
          }, 3000);
        }
      }
    } else {
      // No ad showing, remove banner if present
      if (adBannerShowing) {
        const adBanner = document.getElementById('ytview-ad-banner');
        if (adBanner) {
          adBanner.remove();
        }
        adBannerShowing = false;
      }
    }
  }

  /**
   * Clean up and remove all ad blocking functionality
   */
  function cleanupAdBlocking() {
    console.log('Cleaning up ad blocking functionality');
    
    // Remove any existing ad banners
    const adBanner = document.getElementById('ytview-ad-banner');
    if (adBanner) {
      adBanner.remove();
    }
    
    // Reset global ad banner flags
    adBannerShowing = false;
    
    // Clear ad check interval timer
    if (adCheckInterval) {
      clearInterval(adCheckInterval);
      adCheckInterval = null;
    }
  }

  /**
   * Update the module settings
   * @param {Object} newSettings - The new settings to apply
   */
  function updateSettings(newSettings) {
    if (newSettings && typeof newSettings.adBlockingEnabled !== 'undefined') {
      const wasEnabled = isEnabled;
      isEnabled = newSettings.adBlockingEnabled === true;
      
      // If state changed, take appropriate action
      if (wasEnabled !== isEnabled) {
        if (isEnabled) {
          setupAdBlocking();
        } else {
          cleanupAdBlocking();
        }
      }
    }
  }

  /**
   * Force reinitialization of the ad blocker
   */
  function forceInitialize() {
    if (isEnabled) {
      cleanupAdBlocking();
      setTimeout(() => {
        setupAdBlocking();
      }, 100);
    }
  }

  // Return the public API
  return {
    setup: setupAdBlocking,
    cleanup: cleanupAdBlocking,
    updateSettings,
    forceInitialize,
    isEnabled: () => isEnabled
  };
}

module.exports = initAdBlocker;
